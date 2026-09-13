const http = require('http');
const https = require('https');
const net = require('net');
const { createEntry, headerMap } = require('./entry');

const TEXT_TYPES = /json|text|xml|javascript|graphql|x-www-form-urlencoded|csv/i;

class CaptureProxy {
  constructor(options = {}) {
    this.host = options.host ?? '127.0.0.1';
    this.port = options.port ?? 0;
    this.maxBodyBytes = options.maxBodyBytes ?? 2000000;
    this.captureTunnels = options.captureTunnels ?? true;
    this.onEntry = options.onEntry ?? null;
    this.server = null;
    this.address = null;
    this.entries = [];
    this.sockets = new Set();
    this.requestCount = 0;
    this.tunnelCount = 0;
  }

  async start() {
    if (this.server) return this.address;

    this.server = http.createServer((req, res) => this._handleRequest(req, res));
    this.server.on('connect', (req, socket, head) => this._handleConnect(req, socket, head));
    this.server.on('connection', (socket) => {
      this.sockets.add(socket);
      socket.on('close', () => this.sockets.delete(socket));
    });

    await new Promise((resolve, reject) => {
      const onError = (err) => reject(err);
      this.server.once('error', onError);
      this.server.listen(this.port, this.host, () => {
        this.server.off('error', onError);
        resolve();
      });
    });

    const bound = this.server.address();
    this.address = {
      host: this.host,
      port: bound.port,
      url: `http://${this.host}:${bound.port}`,
    };
    return this.address;
  }

  async stop() {
    if (!this.server) return this.entries.length;
    const server = this.server;
    this.server = null;

    await new Promise((resolve) => server.close(() => resolve()));
    for (const socket of this.sockets) socket.destroy();
    this.sockets.clear();
    return this.entries.length;
  }

  _record(entry) {
    this.entries.push(entry);
    if (typeof this.onEntry === 'function') this.onEntry(entry);
    return entry;
  }

  _resourceType(req, responseHeaders = {}) {
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') return 'xhr';
    const dest = req.headers['sec-fetch-dest'];
    const mime = String(responseHeaders['content-type'] ?? '');
    if (dest === 'empty' || dest === 'iframe') return 'xhr';
    if (dest === 'script') return 'script';
    if (dest === 'style') return 'stylesheet';
    if (dest === 'image') return 'image';
    if (dest === 'document') return 'document';
    if (/json|graphql/i.test(mime)) return 'fetch';
    return undefined;
  }

  _readBody(stream, initial = []) {
    const chunks = [...initial];
    let size = 0;
    return new Promise((resolve) => {
      stream.on('data', (chunk) => {
        size += chunk.length;
        if (size <= this.maxBodyBytes) chunks.push(chunk);
      });
      stream.on('end', () => resolve({ text: Buffer.concat(chunks).toString('utf8'), size }));
      stream.on('error', () => resolve({ text: Buffer.concat(chunks).toString('utf8'), size }));
    });
  }

  async _handleRequest(req, res) {
    this.requestCount += 1;

    let target;
    try {
      target = new URL(req.url);
    } catch {
      res.writeHead(400, { 'content-type': 'text/plain' });
      res.end('Capture proxy expects absolute-form request URLs');
      return;
    }

    const startedAt = Date.now();
    const startedDateTime = new Date(startedAt).toISOString();
    const requestHeaders = { ...req.headers };
    delete requestHeaders['proxy-connection'];
    delete requestHeaders['proxy-authorization'];
    requestHeaders.host = target.host;

    const upstreamBody = await this._readBody(req);
    const transport = target.protocol === 'https:' ? https : http;

    const upstream = transport.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: req.method,
        headers: requestHeaders,
      },
      (upstreamRes) => {
        const responseHeaders = headerMap(upstreamRes.headers);
        const resourceType = this._resourceType(req, upstreamRes.headers);
        const isText = TEXT_TYPES.test(String(upstreamRes.headers['content-type'] ?? ''));

        res.writeHead(upstreamRes.statusCode, upstreamRes.headers);

        const chunks = [];
        let size = 0;
        upstreamRes.on('data', (chunk) => {
          size += chunk.length;
          if (isText && size <= this.maxBodyBytes) chunks.push(chunk);
          res.write(chunk);
        });
        upstreamRes.on('end', () => {
          res.end();
          this._record(
            createEntry({
              source: 'proxy',
              method: req.method,
              url: target.href,
              status: upstreamRes.statusCode,
              statusText: upstreamRes.statusMessage,
              httpVersion: `HTTP/${upstreamRes.httpVersion}`,
              requestHeaders,
              responseHeaders: upstreamRes.headers,
              requestBody: upstreamBody.size > 0 ? upstreamBody.text : null,
              responseBody: isText ? Buffer.concat(chunks).toString('utf8') : null,
              requestSize: upstreamBody.size,
              responseSize: size,
              startedDateTime,
              time: Date.now() - startedAt,
              resourceType,
            }),
          );
        });
      },
    );

    upstream.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'text/plain' });
        res.end(`Capture proxy error: ${err.message}`);
      } else {
        res.end();
      }
      this._record(
        createEntry({
          source: 'proxy',
          method: req.method,
          url: target.href,
          status: 0,
          requestHeaders,
          requestBody: upstreamBody.size > 0 ? upstreamBody.text : null,
          requestSize: upstreamBody.size,
          startedDateTime,
          time: Date.now() - startedAt,
          failed: true,
          errorText: err.message,
        }),
      );
    });

    if (upstreamBody.size > 0) upstream.write(upstreamBody.text);
    upstream.end();
  }

  _handleConnect(req, socket, head) {
    this.tunnelCount += 1;

    const target = String(req.url ?? '');
    const separator = target.lastIndexOf(':');
    const host = separator > 0 ? target.slice(0, separator) : target;
    const port = separator > 0 ? Number(target.slice(separator + 1)) || 443 : 443;
    const startedAt = Date.now();
    const startedDateTime = new Date(startedAt).toISOString();

    let sent = head ? head.length : 0;
    let received = 0;

    let entry = null;
    const finalize = () => {
      if (!entry) return;
      entry.time = Date.now() - startedAt;
      entry.requestSize = sent;
      entry.responseSize = received;
    };

    const upstream = net.connect(port, host, () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head && head.length > 0) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);

      if (!this.captureTunnels) return;
      entry = createEntry({
        source: 'proxy',
        method: 'CONNECT',
        url: `https://${host}:${port}`,
        status: 200,
        statusText: 'Connection Established',
        httpVersion: 'HTTP/1.1',
        requestHeaders: req.headers,
        resourceType: 'other',
        mimeType: 'application/x-tunnel',
        requestSize: sent,
        responseSize: 0,
        startedDateTime,
        time: 0,
      });
      this._record(entry);
    });

    upstream.on('data', (chunk) => {
      received += chunk.length;
    });
    socket.on('data', (chunk) => {
      sent += chunk.length;
    });

    upstream.on('close', () => {
      finalize();
      socket.destroy();
    });
    upstream.on('error', () => {
      finalize();
      socket.destroy();
    });
    socket.on('close', () => {
      finalize();
      upstream.destroy();
    });
    socket.on('error', () => {
      finalize();
      upstream.destroy();
    });
  }

  captured() {
    return this.entries;
  }
}

module.exports = { CaptureProxy };
