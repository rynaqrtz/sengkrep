const http = require('http');
const https = require('https');
const { createEntry, headerMap, isTextMime } = require('./entry');
const ws = require('./WebSocketClient');

const DEFAULT_HOST = 'http://127.0.0.1:9222';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function httpGetJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }

    const transport = parsed.protocol === 'https:' ? https : http;
    const request = transport.get(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        timeout: options.timeout ?? 5000,
      },
      (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error(`Expected JSON from ${url}`));
          }
        });
      },
    );

    request.on('timeout', () => request.destroy(new Error(`Timed out reaching ${url}`)));
    request.on('error', reject);
  });
}

class CdpSession {
  constructor(client, options = {}) {
    this.client = client;
    this.timeout = options.timeout ?? 30000;
    this.closed = false;
    this._id = 0;
    this._pending = new Map();
    this._listeners = [];
    this._errors = [];

    client.on('message', (message) => this._dispatch(message));
    client.on('close', () => this._abort(new Error('CDP connection closed')));
  }

  on(method, handler, sessionId) {
    this._listeners.push({ method, handler, sessionId });
    return this;
  }

  once(method, handler, sessionId) {
    const wrapper = (params, eventSessionId) => {
      this._listeners = this._listeners.filter((listener) => listener.handler !== wrapper);
      handler(params, eventSessionId);
    };
    this._listeners.push({ method, handler: wrapper, sessionId });
    return this;
  }

  send(method, params = {}, sessionId) {
    if (this.closed) return Promise.reject(new Error('CDP session is closed'));

    this._id += 1;
    const id = this._id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`CDP ${method} timed out after ${this.timeout}ms`));
      }, this.timeout);
      if (typeof timer.unref === 'function') timer.unref();

      this._pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.client.send(payload);
    });
  }

  _dispatch(message) {
    if (!message) return;

    if (message.id !== undefined) {
      const pending = this._pending.get(message.id);
      if (!pending) return;
      this._pending.delete(message.id);
      if (message.error) {
        const err = new Error(`${message.error.message}${message.error.code ? ` (${message.error.code})` : ''}`);
        err.code = 'CDP_ERROR';
        pending.reject(err);
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method) {
      for (const listener of this._listeners) {
        if (listener.method !== message.method) continue;
        if (listener.sessionId !== undefined && listener.sessionId !== message.sessionId) continue;
        listener.handler(message.params ?? {}, message.sessionId);
      }
    }
  }

  _abort(err) {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this._pending.values()) pending.reject(err);
    this._pending.clear();
  }

  close() {
    this._listeners = [];
    if (!this.closed) this._abort(new Error('CDP session closed'));
    try {
      this.client.close();
    } catch {
      this._errors.push('close failed');
    }
  }
}

class CdpCapture {
  constructor(options = {}) {
    this.host = options.host ?? DEFAULT_HOST;
    this.timeout = options.timeout ?? 30000;
    this.idleMs = options.idleMs ?? 600;
    this.maxEntries = options.maxEntries ?? 1000;
    this.maxBodyBytes = options.maxBodyBytes ?? 2000000;
    this.captureBodies = options.bodies ?? true;
    this.maxFramesPerSocket = options.maxFramesPerSocket ?? 500;
    this.captureFrames = options.frames ?? true;
    this.debuggerUrl = options.debuggerUrl ?? null;
    this.connect = options.connect ?? ws.connect;
    this.discover = options.discover ?? ((discoverOptions) => CdpCapture.discover(this.host, discoverOptions));
  }

  static version(host = DEFAULT_HOST, options = {}) {
    return httpGetJson(`${String(host).replace(/\/+$/, '')}/json/version`, options);
  }

  static targets(host = DEFAULT_HOST, options = {}) {
    return httpGetJson(`${String(host).replace(/\/+$/, '')}/json/list`, options);
  }

  static async discover(host = DEFAULT_HOST, options = {}) {
    const info = await CdpCapture.version(host, options);
    if (!info || !info.webSocketDebuggerUrl) {
      throw new Error(`No DevTools endpoint at ${host}: start Chrome with --remote-debugging-port=9222`);
    }
    return info;
  }

  static captureUrl(url, options = {}) {
    return new CdpCapture(options).capture({ ...options, url });
  }

  async _connect(options = {}) {
    const debuggerUrl = options.debuggerUrl ?? this.debuggerUrl;
    const info = debuggerUrl
      ? { webSocketDebuggerUrl: debuggerUrl }
      : await this.discover(options);

    const client = await this.connect(info.webSocketDebuggerUrl, { timeout: options.timeout ?? this.timeout });
    const session = new CdpSession(client, { timeout: options.timeout ?? this.timeout });

    return { session, client, browser: info };
  }

  async open(options = {}) {
    const opened = await this._connect(options);

    const created = await opened.session.send('Target.createTarget', { url: 'about:blank' });
    const attached = await opened.session.send('Target.attachToTarget', { targetId: created.targetId, flatten: true });

    return {
      ...opened,
      targetId: created.targetId,
      sessionId: attached.sessionId,
    };
  }

  async exportCookies(options = {}) {
    const opened = await this._connect(options);
    const { session } = opened;

    try {
      const result = await session.send('Network.getAllCookies', {});
      return (result?.cookies ?? []).map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: String(cookie.domain ?? '').replace(/^\./, ''),
        path: cookie.path ?? '/',
        secure: Boolean(cookie.secure),
        httpOnly: Boolean(cookie.httpOnly),
        expires: cookie.session || !cookie.expires ? null : cookie.expires * 1000,
      }));
    } catch (err) {
      if (err.code === 'CDP_ERROR') {
        throw new Error(`Could not read cookies from the browser: ${err.message}`);
      }
      throw err;
    } finally {
      session.close();
    }
  }

  static exportCookies(options = {}) {
    return new CdpCapture(options).exportCookies(options);
  }

  _recordFrame(byRequestId, params, direction) {
    const record = byRequestId.get(params.requestId);
    if (!record) return;
    if (!Array.isArray(record.entry.frames)) record.entry.frames = [];
    if (record.entry.frames.length >= this.maxFramesPerSocket) {
      record.entry.framesTruncated = true;
      return;
    }

    const frame = params.response ?? params;
    const payload = frame.payloadData ?? '';
    record.entry.frames.push({
      direction,
      opcode: Number.isFinite(frame.opcode) ? frame.opcode : 0,
      payloadData: String(payload),
      size: Buffer.byteLength(String(payload)),
      timestamp: Number.isFinite(params.timestamp) ? params.timestamp : Date.now() / 1000,
    });
  }

  _shouldReadBody(entry, options) {
    if (!entry.mimeType) return true;
    if (isTextMime(entry.mimeType)) return true;
    return options.readAllBodies === true;
  }

  _record(records, byRequestId, params) {
    const request = params.request ?? {};
    const record = {
      requestId: params.requestId,
      entry: createEntry({
        source: 'cdp',
        method: request.method,
        url: request.url,
        requestHeaders: request.headers,
        requestBody: request.postData ?? null,
        resourceType: params.type,
        startedDateTime: new Date(params.wallTime ? params.wallTime * 1000 : Date.now()).toISOString(),
        initiator: params.initiator ? params.initiator.type ?? null : null,
      }),
    };

    records.push(record);
    byRequestId.set(params.requestId, record);
    return record;
  }

  async capture(options = {}) {
    const url = options.url;
    if (!url) throw new Error('capture() requires a url');

    const maxEntries = options.maxEntries ?? this.maxEntries;
    const records = [];
    const byRequestId = new Map();
    const opened = await this.open(options);
    const { session, sessionId } = opened;

    let resolveLoaded;
    const loaded = new Promise((resolve) => {
      resolveLoaded = resolve;
    });
    let loadTimer = null;
    const markLoaded = () => {
      if (loadTimer) clearTimeout(loadTimer);
      loadTimer = null;
      resolveLoaded();
    };

    session.on('Network.requestWillBeSent', (params) => {
      const previous = byRequestId.get(params.requestId);
      if (previous && params.redirectResponse) {
        previous.entry.status = params.redirectResponse.status ?? 0;
        previous.entry.statusText = params.redirectResponse.statusText ?? '';
        previous.entry.responseHeaders = headerMap(params.redirectResponse.headers);
        previous.entry.redirectURL = params.redirectResponse.url ?? null;
        previous.entry.done = true;
      }
      if (records.length >= maxEntries) return;
      this._record(records, byRequestId, params);
    }, sessionId);

    session.on('Network.responseReceived', (params) => {
      const record = byRequestId.get(params.requestId);
      if (!record) return;
      const response = params.response ?? {};
      const entry = record.entry;
      entry.status = response.status ?? 0;
      entry.statusText = response.statusText ?? '';
      entry.responseHeaders = headerMap(response.headers);
      entry.mimeType = response.mimeType ?? entry.responseHeaders['content-type'] ?? '';
      if (params.type) entry.resourceType = params.type.toLowerCase();
      entry.fromCache = Boolean(response.fromDiskCache || response.fromServiceWorker || response.fromPrefetchCache);
      entry.httpVersion = response.protocol ?? entry.httpVersion;
      entry.time = Math.max(0, Date.now() - new Date(entry.startedDateTime).getTime());
    }, sessionId);

    session.on('Network.loadingFinished', (params) => {
      const record = byRequestId.get(params.requestId);
      if (!record) return;
      record.entry.done = true;
      if (Number.isFinite(params.encodedDataLength)) record.entry.responseSize = params.encodedDataLength;
      if (!record.entry.time) record.entry.time = Math.max(0, Date.now() - new Date(record.entry.startedDateTime).getTime());
    }, sessionId);

    session.on('Network.loadingFailed', (params) => {
      const record = byRequestId.get(params.requestId);
      if (!record) return;
      record.entry.failed = true;
      record.entry.errorText = params.errorText ?? 'request failed';
      record.entry.done = true;
    }, sessionId);

    session.on('Network.webSocketCreated', (params) => {
      if (records.length >= maxEntries) return;
      const record = {
        requestId: params.requestId,
        entry: createEntry({
          source: 'cdp',
          method: 'GET',
          url: params.url,
          resourceType: 'websocket',
          startedDateTime: new Date().toISOString(),
        }),
      };
      record.entry.frames = [];
      records.push(record);
      byRequestId.set(params.requestId, record);
    }, sessionId);

    if (this.captureFrames && options.frames !== false) {
      session.on('Network.webSocketFrameSent', (params) => this._recordFrame(byRequestId, params, 'sent'), sessionId);
      session.on('Network.webSocketFrameReceived', (params) => this._recordFrame(byRequestId, params, 'received'), sessionId);
    }

    session.on('Page.loadEventFired', () => markLoaded(), sessionId);

    try {
      await session.send('Page.enable', {}, sessionId);
      await session.send('Network.enable', {}, sessionId);
      await session.send('Page.navigate', { url }, sessionId);

      loadTimer = setTimeout(markLoaded, options.timeout ?? this.timeout);
      if (typeof loadTimer.unref === 'function') loadTimer.unref();
      await loaded;

      await delay(options.idleMs ?? this.idleMs);

      if (this.captureBodies && options.bodies !== false) {
        await this.fetchBodies(session, sessionId, records, options);
      }

      const meta = await session
        .send('Runtime.evaluate', { expression: '({ title: document.title, url: location.href })', returnByValue: true }, sessionId)
        .then((result) => result?.result?.value ?? null)
        .catch(() => null);

      const entries = records.map((record) => record.entry);

      return {
        entries,
        url: meta?.url ?? url,
        title: meta?.title ?? null,
        session: { targetId: opened.targetId, browser: opened.browser?.Browser ?? null },
      };
    } finally {
      try {
        await session.send('Target.closeTarget', { targetId: opened.targetId });
      } catch {}
      session.close();
    }
  }

  async fetchBodies(session, sessionId, records, options = {}) {
    for (const record of records) {
      const entry = record.entry;
      if (entry.failed || !entry.done) continue;
      if (entry.responseBody || !this._shouldReadBody(entry, options)) continue;
      if (entry.responseSize > this.maxBodyBytes) {
        entry.truncated = true;
        continue;
      }

      try {
        const result = await session.send('Network.getResponseBody', { requestId: record.requestId }, sessionId);
        if (!result) continue;
        entry.responseBody = result.base64Encoded
          ? Buffer.from(result.body ?? '', 'base64').toString('utf8')
          : String(result.body ?? '');
        entry.bodyBase64 = Boolean(result.base64Encoded);
      } catch {
        entry.truncated = true;
      }
    }
    return records;
  }
}

module.exports = { CdpCapture, CdpSession, DEFAULT_HOST, httpGetJson };
