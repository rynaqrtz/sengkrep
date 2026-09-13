const http = require('http');
const https = require('https');
const crypto = require('crypto');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const DEFAULT_MAX_PAYLOAD = 16 * 1024 * 1024;

const OPCODES = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
};

function encodeFrame(opcode, data, options = {}) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
  const mask = options.mask === true;
  const length = payload.length;

  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  header[0] = 0x80 | opcode;

  if (!mask) return Buffer.concat([header, payload]);

  header[1] |= 0x80;
  const key = options.key ?? crypto.randomBytes(4);
  const masked = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) masked[i] = payload[i] ^ key[i % 4];
  return Buffer.concat([header, key, masked]);
}

function decodeFrames(buffer, options = {}) {
  const maxPayload = options.maxPayload ?? DEFAULT_MAX_PAYLOAD;
  const frames = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const fin = (first & 0x80) === 0x80;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) === 0x80;
    let length = second & 0x7f;
    let cursor = offset + 2;

    if (length === 126) {
      if (cursor + 2 > buffer.length) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (cursor + 8 > buffer.length) break;
      const big = buffer.readBigUInt64BE(cursor);
      if (big > BigInt(maxPayload)) throw new Error('WebSocket frame exceeds max payload');
      length = Number(big);
      cursor += 8;
    }

    if (length > maxPayload) throw new Error('WebSocket frame exceeds max payload');

    let key = null;
    if (masked) {
      if (cursor + 4 > buffer.length) break;
      key = buffer.subarray(cursor, cursor + 4);
      cursor += 4;
    }

    if (cursor + length > buffer.length) break;

    const payload = Buffer.from(buffer.subarray(cursor, cursor + length));
    if (key) {
      for (let i = 0; i < payload.length; i += 1) payload[i] ^= key[i % 4];
    }

    frames.push({ fin, opcode, payload });
    offset = cursor + length;
  }

  return { frames, rest: buffer.subarray(offset) };
}

function acceptKey(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

class WebSocketClient {
  constructor(socket, options = {}) {
    this.socket = socket;
    this.maxPayload = options.maxPayload ?? DEFAULT_MAX_PAYLOAD;
    this._buffer = Buffer.alloc(0);
    this._fragments = [];
    this._fragmentOpcode = null;
    this._listeners = new Map();
    this.closed = false;

    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('close', () => this._handleClose(1006, 'connection closed'));
    socket.on('error', (err) => this.emit('error', err));
  }

  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(handler);
    return this;
  }

  off(event, handler) {
    const handlers = this._listeners.get(event);
    if (!handlers) return this;
    this._listeners.set(event, handlers.filter((item) => item !== handler));
    return this;
  }

  emit(event, ...args) {
    for (const handler of this._listeners.get(event) ?? []) {
      try {
        handler(...args);
      } catch (err) {
        if (event !== 'error') this.emit('error', err);
      }
    }
    return this;
  }

  _onData(chunk) {
    this._buffer = Buffer.concat([this._buffer, chunk]);

    let decoded;
    try {
      decoded = decodeFrames(this._buffer, { maxPayload: this.maxPayload });
    } catch (err) {
      this.emit('error', err);
      this.close(1009, 'frame too large');
      return;
    }

    this._buffer = Buffer.from(decoded.rest);

    for (const frame of decoded.frames) {
      if (frame.opcode === OPCODES.PING) {
        this._write(encodeFrame(OPCODES.PONG, frame.payload, { mask: true }));
        continue;
      }
      if (frame.opcode === OPCODES.PONG) continue;
      if (frame.opcode === OPCODES.CLOSE) {
        const code = frame.payload.length >= 2 ? frame.payload.readUInt16BE(0) : 1005;
        this._handleClose(code, frame.payload.subarray(2).toString('utf8'));
        return;
      }
      this._handleDataFrame(frame);
    }
  }

  _handleDataFrame(frame) {
    if (frame.opcode === OPCODES.CONTINUATION) {
      if (this._fragmentOpcode === null) return;
      this._fragments.push(frame.payload);
      if (frame.fin) {
        const payload = Buffer.concat(this._fragments);
        const opcode = this._fragmentOpcode;
        this._fragments = [];
        this._fragmentOpcode = null;
        this._deliver(opcode, payload);
      }
      return;
    }

    if (!frame.fin) {
      this._fragmentOpcode = frame.opcode;
      this._fragments = [frame.payload];
      return;
    }

    this._deliver(frame.opcode, frame.payload);
  }

  _deliver(opcode, payload) {
    if (opcode === OPCODES.TEXT) {
      const text = payload.toString('utf8');
      this.emit('text', text);
      try {
        this.emit('message', JSON.parse(text));
      } catch {
        this.emit('raw', payload);
      }
      return;
    }
    this.emit('binary', payload);
  }

  _write(data) {
    if (this.closed || this.socket.destroyed) return false;
    return this.socket.write(data);
  }

  send(data) {
    if (typeof data === 'string') return this._write(encodeFrame(OPCODES.TEXT, data, { mask: true }));
    if (Buffer.isBuffer(data)) return this._write(encodeFrame(OPCODES.BINARY, data, { mask: true }));
    return this._write(encodeFrame(OPCODES.TEXT, JSON.stringify(data), { mask: true }));
  }

  _handleClose(code, reason) {
    if (this.closed) return;
    this.closed = true;
    this.emit('close', { code, reason });
  }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    const payload = Buffer.alloc(2 + Buffer.byteLength(reason));
    payload.writeUInt16BE(code, 0);
    payload.write(reason, 2);
    this._write(encodeFrame(OPCODES.CLOSE, payload, { mask: true }));
    this.closed = true;
    this.emit('close', { code, reason });
    this.socket.end();
    setTimeout(() => this.socket.destroy(), 50).unref?.();
  }
}

function connect(url, options = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`Invalid WebSocket URL: ${url}`));
      return;
    }

    const secure = parsed.protocol === 'wss:';
    const transport = secure ? https : http;
    const port = parsed.port ? Number(parsed.port) : secure ? 443 : 80;
    const key = crypto.randomBytes(16).toString('base64');
    const expected = acceptKey(key);
    const timeout = options.timeout ?? 10000;

    const request = transport.request({
      hostname: parsed.hostname,
      port,
      path: `${parsed.pathname || '/'}${parsed.search}`,
      method: 'GET',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key,
        ...(options.headers ?? {}),
      },
      rejectUnauthorized: options.rejectUnauthorized ?? true,
    });

    request.setTimeout(timeout, () => {
      request.destroy(new Error(`WebSocket handshake timed out after ${timeout}ms`));
    });

    request.on('upgrade', (response, socket, head) => {
      if (String(response.headers['sec-websocket-accept'] ?? '') !== expected) {
        socket.destroy();
        reject(new Error('WebSocket handshake failed: invalid Sec-WebSocket-Accept'));
        return;
      }
      const client = new WebSocketClient(socket, options);
      if (head && head.length > 0) client._onData(head);
      if (typeof options.onOpen === 'function') options.onOpen(client);
      resolve(client);
    });

    request.on('response', (response) => {
      response.resume();
      reject(new Error(`WebSocket upgrade rejected with status ${response.statusCode}`));
    });

    request.on('error', reject);
    request.end();
  });
}

module.exports = {
  GUID,
  OPCODES,
  WebSocketClient,
  acceptKey,
  connect,
  decodeFrames,
  encodeFrame,
};
