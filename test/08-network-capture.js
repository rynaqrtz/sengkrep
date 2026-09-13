const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sengkrep = require('../index');
const { ready, closeAll } = require('./server');
const { test, rejects, assert, delay, finish } = require('./harness');
const NetworkCapture = require('../src/capture/NetworkCapture');
const { CdpCapture } = require('../src/capture/CdpCapture');
const { CaptureProxy } = require('../src/capture/CaptureProxy');
const PlaywrightCapture = require('../src/capture/PlaywrightCapture');
const HarImporter = require('../src/capture/HarImporter');
const analyze = require('../src/capture/analyze');
const entryModel = require('../src/capture/entry');
const ws = require('../src/capture/WebSocketClient');

const BASE = 'http://127.0.0.1:9911';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sengkrep-capture-'));

async function waitFor(check, timeout = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = check();
    if (value) return value;
    await delay(10);
  }
  return check();
}

function sampleHar() {
  return {
    log: {
      version: '1.2',
      creator: { name: 'fixture', version: '1.0' },
      entries: [
        {
          startedDateTime: '2026-01-01T00:00:00.000Z',
          time: 120,
          _resourceType: 'XHR',
          request: {
            method: 'GET',
            url: 'https://api.example.com/v1/users/42/orders?limit=25&page=2',
            headers: [
              { name: 'Accept', value: 'application/json' },
              { name: 'Authorization', value: 'Bearer super-secret' },
              { name: 'X-Trace', value: 'abc' },
            ],
          },
          response: {
            status: 200,
            statusText: 'OK',
            headers: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }],
            content: {
              size: 120,
              mimeType: 'application/json; charset=utf-8',
              text: Buffer.from(JSON.stringify({ items: [{ id: 1, name: 'A', price: 9.5 }], total: 1 })).toString('base64'),
              encoding: 'base64',
            },
          },
          cache: {},
          timings: { send: 1, wait: 100, receive: 19 },
        },
        {
          startedDateTime: '2026-01-01T00:00:01.000Z',
          time: 12,
          request: { method: 'GET', url: 'https://cdn.example.com/assets/app.7f3a9c.js', headers: [] },
          response: {
            status: 200,
            statusText: 'OK',
            headers: [{ name: 'Content-Type', value: 'application/javascript' }],
            content: { size: 900, mimeType: 'application/javascript', text: 'console.log(1)' },
          },
          cache: {},
          timings: {},
        },
        {
          startedDateTime: '2026-01-01T00:00:02.000Z',
          time: 30,
          request: { method: 'POST', url: 'https://api.example.com/v1/users/42/orders', headers: [{ name: 'Content-Type', value: 'application/json' }], postData: { mimeType: 'application/json', text: '{"sku":"X"}' } },
          response: {
            status: 500,
            statusText: 'Server Error',
            headers: [{ name: 'Content-Type', value: 'application/json' }],
            content: { size: 20, mimeType: 'application/json', text: '{"error":"boom"}' },
            _error: 'Internal Server Error',
          },
          cache: {},
          timings: {},
        },
      ],
    },
  };
}

function fakeCdpClient(sessionId = 'SESSION-1') {
  return {
    sent: [],
    handlers: new Map(),
    on(event, handler) {
      if (!this.handlers.has(event)) this.handlers.set(event, []);
      this.handlers.get(event).push(handler);
    },
    emit(event, payload) {
      for (const handler of this.handlers.get(event) ?? []) handler(payload);
    },
    close() {
      this.emit('close', {});
    },
    send(message) {
      this.sent.push(message.method);
      const done = (result) => this.emit('message', { id: message.id, sessionId, result });

      switch (message.method) {
        case 'Target.createTarget':
          return done({ targetId: 'TARGET-1' });
        case 'Target.attachToTarget':
          return done({ sessionId });
        case 'Runtime.evaluate':
          return done({ result: { value: { title: 'Fake App', url: 'https://app.example.com/dashboard' } } });
        case 'Network.getResponseBody':
          return done({ body: JSON.stringify({ items: [{ id: 7, sku: 'X' }], total: 1 }), base64Encoded: false });
        case 'Page.navigate': {
          done({ frameId: 'FRAME-1' });
          setTimeout(() => {
            this.emit('message', { method: 'Network.requestWillBeSent', sessionId, params: { requestId: 'r1', type: 'Document', wallTime: Date.now() / 1000, request: { method: 'GET', url: 'https://app.example.com/dashboard', headers: { accept: 'text/html' } } } });
            this.emit('message', { method: 'Network.requestWillBeSent', sessionId, params: { requestId: 'r2', type: 'Fetch', wallTime: Date.now() / 1000, request: { method: 'POST', url: 'https://app.example.com/api/items', headers: { accept: 'application/json' }, postData: '{"page":1}' } } });
            this.emit('message', { method: 'Network.responseReceived', sessionId, params: { requestId: 'r2', type: 'Fetch', response: { status: 201, statusText: 'Created', mimeType: 'application/json', protocol: 'h2', headers: { 'content-type': 'application/json' } } } });
            this.emit('message', { method: 'Network.loadingFinished', sessionId, params: { requestId: 'r2', encodedDataLength: 48 } });
            this.emit('message', { method: 'Network.webSocketCreated', sessionId, params: { requestId: 'ws1', url: 'wss://app.example.com/socket' } });
            this.emit('message', { method: 'Page.loadEventFired', sessionId, params: {} });
          }, 5);
          return;
        }
        default:
          return done({});
      }
    },
  };
}

function startEchoWebSocketServer() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.sockets = new Set();
    server.on('upgrade', (req, socket) => {
      server.sockets.add(socket);
      socket.on('close', () => server.sockets.delete(socket));
      socket.write([
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${ws.acceptKey(req.headers['sec-websocket-key'])}`,
        '', '',
      ].join('\r\n'));

      socket.on('data', (chunk) => {
        const decoded = ws.decodeFrames(chunk);
        for (const frame of decoded.frames) {
          if (frame.opcode !== ws.OPCODES.TEXT) continue;
          socket.write(ws.encodeFrame(ws.OPCODES.TEXT, `echo:${frame.payload.toString('utf8')}`));
        }
      });
      socket.on('error', () => socket.destroy());
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function closeServer(server) {
  for (const socket of server.sockets ?? []) socket.destroy();
  server.closeAllConnections?.();
  return new Promise((resolve) => {
    server.close(() => resolve());
    setTimeout(resolve, 200).unref?.();
  });
}

async function main() {
  await ready;

  await test('entry model normalizes headers and classifies resources', () => {
    const entry = entryModel.createEntry({
      method: 'post',
      url: 'https://api.example.com/v2/items/1024',
      requestHeaders: { 'Content-Type': 'application/json', 'X-One': 1 },
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      requestBody: '{"a":1}',
      responseBody: '{"ok":true}',
    });

    assert.strictEqual(entry.method, 'POST');
    assert.strictEqual(entry.requestHeaders['x-one'], '1');
    assert.strictEqual(entry.mimeType, 'application/json');
    assert.strictEqual(entry.resourceType, 'fetch');
    assert.strictEqual(entry.requestSize, 7);
    assert.strictEqual(entryModel.isApiEntry(entry), true);
    assert.strictEqual(entryModel.classifyResourceType({ url: 'https://a/b.css' }), 'stylesheet');
    assert.strictEqual(entryModel.entryKind({ status: 503 }), 'server-error');
  });

  await test('har import decodes bodies and flags failures', () => {
    const entries = HarImporter.parseHar(sampleHar());

    assert.strictEqual(entries.length, 3);
    assert.strictEqual(entries[0].resourceType, 'xhr');
    assert.strictEqual(entries[0].bodyBase64, true);
    assert.ok(entries[0].responseBody.includes('"total":1'));
    assert.strictEqual(entries[0].requestHeaders.authorization, 'Bearer super-secret');
    assert.strictEqual(entries[1].resourceType, 'script');
    assert.strictEqual(entries[2].failed, true);
    assert.strictEqual(entries[2].requestBody, '{"sku":"X"}');
  });

  await test('har export redacts credentials and keeps the 1.2 shape', () => {
    const capture = NetworkCapture.fromHar(sampleHar());
    const har = capture.toHAR();

    assert.strictEqual(har.log.version, '1.2');
    assert.strictEqual(har.log.creator.name, 'sengkrep');
    const request = har.log.entries[0].request;
    assert.strictEqual(request.headers.find((header) => header.name === 'authorization').value, '<redacted>');
    assert.strictEqual(request.queryString.length, 2);

    const raw = capture.toHAR({ redact: false });
    assert.strictEqual(raw.log.entries[0].request.headers.find((header) => header.name === 'authorization').value, 'Bearer super-secret');

    assert.strictEqual(HarImporter.isHar(har), true);
    assert.strictEqual(HarImporter.isHar({ log: {} }), false);
    assert.throws(() => HarImporter.parseHar({ nope: true }), /Invalid HAR/);
  });

  await test('har round trips through a file', () => {
    const capture = NetworkCapture.fromHar(sampleHar());
    const file = path.join(TMP, 'roundtrip.har');
    capture.saveHar(file);

    const reopened = NetworkCapture.fromHar(file);
    assert.strictEqual(reopened.size, 3);
    assert.strictEqual(reopened.api().size, 2);
  });

  await test('url templates collapse dynamic segments', () => {
    assert.strictEqual(analyze.urlTemplate('https://api.example.com/v1/users/42/orders?x=1'), 'https://api.example.com/v1/users/:id/orders');
    assert.strictEqual(analyze.urlTemplate('https://api.example.com/items/7f9c1e2a-1b3d-4c5e-8f70-112233445566'), 'https://api.example.com/items/:id');
    assert.strictEqual(analyze.urlTemplate('https://api.example.com/a1b2c3d4e5f6a7b8c9d0'), 'https://api.example.com/:id');
    assert.deepStrictEqual(analyze.queryParams('https://a/b?z=1&a=2'), ['a', 'z']);
  });

  await test('json schema inference merges samples and marks required fields', () => {
    const merged = analyze.mergeSchemas([
      analyze.inferJsonSchema({ id: 1, tags: ['a'], total: 1 }),
      analyze.inferJsonSchema({ id: 2, tags: ['b'], total: 2, extra: true }),
    ]);

    assert.strictEqual(merged.type, 'object');
    assert.strictEqual(merged.properties.id.type, 'integer');
    assert.strictEqual(merged.properties.tags.type, 'array');
    assert.strictEqual(merged.properties.tags.items.type, 'string');
    assert.deepStrictEqual(merged.required.sort(), ['id', 'tags', 'total']);
    assert.strictEqual(analyze.inferJsonSchema(3).type, 'integer');
    assert.strictEqual(analyze.inferJsonSchema(null).type, 'null');
  });

  await test('endpoint grouping hides static assets unless asked', () => {
    const capture = NetworkCapture.fromHar(sampleHar());
    const api = capture.endpoints();
    const all = capture.endpoints({ all: true });

    assert.strictEqual(api.length, 2);
    assert.strictEqual(all.length, 3);
    assert.ok(api.every((endpoint) => endpoint.path.includes(':id')));
    assert.ok(!api.some((endpoint) => endpoint.template.includes('/assets/')));

    const get = api.find((endpoint) => endpoint.method === 'GET');
    assert.strictEqual(get.count, 1);
    assert.deepStrictEqual(get.params, ['limit', 'page']);
    assert.strictEqual(get.schema.properties.items.items.properties.price.type, 'number');
    assert.ok(get.averageTime >= 0);
  });

  await test('endpoint grouping counts repeated calls and merges bodies', () => {
    const entries = [
      { method: 'GET', url: 'https://api.example.com/v1/items/1', responseBody: '{"id":1}', mimeType: 'application/json', resourceType: 'fetch', responseHeaders: {}, requestHeaders: {} },
      { method: 'GET', url: 'https://api.example.com/v1/items/2', responseBody: '{"id":2}', mimeType: 'application/json', resourceType: 'fetch', responseHeaders: {}, requestHeaders: {} },
    ];
    const capture = new NetworkCapture().add(entries);
    const [endpoint] = capture.endpoints();

    assert.strictEqual(endpoint.count, 2);
    assert.strictEqual(endpoint.template, 'https://api.example.com/v1/items/:id');
    assert.strictEqual(endpoint.schema.properties.id.type, 'integer');
  });

  await test('curl and fetch snippets redact credentials and skip hop headers', () => {
    const capture = NetworkCapture.fromHar(sampleHar());
    const request = capture.find((entry) => entry.method === 'GET' && entry.resourceType === 'xhr');

    const curl = capture.toCurl(request);
    assert.ok(curl.startsWith("curl -X GET 'https://api.example.com/v1/users/42/orders?limit=25&page=2'"));
    assert.ok(curl.includes('authorization: <redacted>'));
    assert.ok(!curl.includes('Bearer super-secret'));

    const code = capture.toFetchCode(request);
    assert.ok(code.includes('await fetch("https://api.example.com/v1/users/42/orders'));
    assert.ok(code.includes('await res.json();'));
    assert.ok(code.includes('"<redacted>"'));

    const open = capture.toFetchCode(request, { redact: false });
    assert.ok(open.includes('Bearer super-secret'));
    assert.throws(() => capture.toFetchCode('missing-id'), /No capture entry/);
  });

  await test('websocket frames encode, mask and decode', () => {
    const single = ws.encodeFrame(ws.OPCODES.TEXT, 'hello');
    assert.strictEqual(single[0], 0x81);
    assert.strictEqual(single.length, 2 + 5);

    const decoded = ws.decodeFrames(single);
    assert.strictEqual(decoded.frames.length, 1);
    assert.strictEqual(decoded.frames[0].payload.toString('utf8'), 'hello');
    assert.strictEqual(decoded.rest.length, 0);

    const masked = ws.encodeFrame(ws.OPCODES.TEXT, 'secret', { mask: true, key: Buffer.from([1, 2, 3, 4]) });
    assert.strictEqual(masked[1] & 0x80, 0x80);
    assert.strictEqual(ws.decodeFrames(masked).frames[0].payload.toString('utf8'), 'secret');

    const big = ws.encodeFrame(ws.OPCODES.BINARY, Buffer.alloc(70000, 7));
    assert.strictEqual(big[1] & 0x7f, 127);
    assert.strictEqual(ws.decodeFrames(big).frames[0].payload.length, 70000);

    const stream = Buffer.concat([
      ws.encodeFrame(ws.OPCODES.TEXT, 'one', { mask: true }),
      ws.encodeFrame(ws.OPCODES.TEXT, 'two'),
    ]);
    const partial = ws.decodeFrames(stream.subarray(0, 1));
    assert.strictEqual(partial.frames.length, 0);
    assert.strictEqual(partial.rest.length, 1);

    const two = ws.decodeFrames(stream);
    assert.deepStrictEqual(two.frames.map((frame) => frame.payload.toString('utf8')), ['one', 'two']);
  });

  await test('websocket client performs a real handshake and echo', async () => {
    const server = await startEchoWebSocketServer();
    const { port } = server.address();
    const client = await ws.connect(`ws://127.0.0.1:${port}/socket`);

    const reply = new Promise((resolve) => client.on('text', resolve));
    client.send('ping');

    assert.strictEqual(await reply, 'echo:ping');

    const closed = new Promise((resolve) => client.on('close', resolve));
    client.close();
    const closeEvent = await closed;
    assert.strictEqual(closeEvent.code, 1000);

    await closeServer(server);
  });

  await test('cdp capture records document, fetch bodies and websockets', async () => {
    const client = fakeCdpClient();
    const cdp = new CdpCapture({ connect: async () => client, debuggerUrl: 'ws://fake', idleMs: 10 });
    const result = await cdp.capture({ url: 'https://app.example.com/dashboard' });

    assert.strictEqual(result.title, 'Fake App');
    assert.strictEqual(result.entries.length, 3);

    const document = result.entries.find((entry) => entry.resourceType === 'document');
    assert.strictEqual(document.url, 'https://app.example.com/dashboard');

    const fetch = result.entries.find((entry) => entry.resourceType === 'fetch');
    assert.strictEqual(fetch.status, 201);
    assert.strictEqual(fetch.requestBody, '{"page":1}');
    assert.ok(fetch.responseBody.includes('"total":1'));
    assert.strictEqual(fetch.httpVersion, 'h2');

    const socket = result.entries.find((entry) => entry.resourceType === 'websocket');
    assert.strictEqual(socket.url, 'wss://app.example.com/socket');

    for (const method of ['Page.enable', 'Network.enable', 'Page.navigate', 'Network.getResponseBody', 'Target.closeTarget']) {
      assert.ok(client.sent.includes(method), `expected CDP call ${method}`);
    }
  });

  await test('cdp capture synthesizes api endpoints from the session', async () => {
    const capture = await NetworkCapture.fromCdp({
      url: 'https://app.example.com/dashboard',
      connect: async () => fakeCdpClient(),
      debuggerUrl: 'ws://fake',
      idleMs: 10,
    });

    assert.strictEqual(capture.source, 'cdp');
    assert.strictEqual(capture.meta.title, 'Fake App');
    const [endpoint] = capture.endpoints();
    assert.strictEqual(endpoint.method, 'POST');
    assert.strictEqual(endpoint.template, 'https://app.example.com/api/items');
    assert.strictEqual(endpoint.statuses[201], 1);
  });

  await test('cdp capture reports a clear error without a devtools endpoint', async () => {
    await rejects(CdpCapture.discover('http://127.0.0.1:9', { timeout: 500 }), (err) => Boolean(err));
    const cdp = new CdpCapture({ host: 'http://127.0.0.1:9', timeout: 500 });
    await rejects(cdp.capture({ url: 'https://example.com' }), (err) => Boolean(err));
  });

  await test('capture proxy records http requests with bodies end to end', async () => {
    const proxy = new CaptureProxy({});
    await proxy.start();

    const scraper = sengkrep.create({ logLevel: 'error', proxies: [proxy.address.url], retry: { max: 1 } });
    const res = await scraper.fetch(`${BASE}/html`);
    assert.ok(res.body.includes('Hello Sengkrep'));

    await waitFor(() => proxy.entries.length > 0);
    assert.strictEqual(proxy.requestCount, 1);
    assert.strictEqual(proxy.entries.length, 1);

    const [entry] = proxy.entries;
    assert.strictEqual(entry.method, 'GET');
    assert.strictEqual(entry.status, 200);
    assert.strictEqual(entry.source, 'proxy');
    assert.strictEqual(entry.resourceType, 'document');
    assert.ok(entry.responseBody.includes('Hello Sengkrep'));
    assert.ok(entry.responseSize > 0);

    const capture = new NetworkCapture({ source: 'proxy' });
    assert.strictEqual(capture.pull(proxy), 1);
    assert.strictEqual(capture.pull(proxy), 0);

    await proxy.stop();
    assert.strictEqual(proxy.server, null);
  });

  await test('capture proxy records https connect tunnels as metadata', async () => {
    const proxy = new CaptureProxy({});
    await proxy.start();

    const status = await new Promise((resolve, reject) => {
      const req = http.request({
        host: proxy.address.host,
        port: proxy.address.port,
        method: 'CONNECT',
        path: '127.0.0.1:9912',
      });
      req.on('connect', (res, socket) => {
        socket.destroy();
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    });

    assert.strictEqual(status, 200);
    const [entry] = await waitFor(() => proxy.entries) ?? [];
    assert.ok(entry, `expected a tunnel entry (entries=${proxy.entries.length}, tunnels=${proxy.tunnelCount})`);
    assert.strictEqual(entry.method, 'CONNECT');
    assert.strictEqual(entry.url, 'https://127.0.0.1:9912');
    assert.strictEqual(entry.mimeType, 'application/x-tunnel');

    await proxy.stop();
  });

  await test('network capture filters, finds and summarizes', () => {
    const capture = NetworkCapture.fromHar(sampleHar());

    assert.strictEqual(capture.size, 3);
    assert.strictEqual(capture.api().size, 2);
    assert.strictEqual(capture.filter({ method: 'POST' }).size, 1);
    assert.strictEqual(capture.filter({ url: /orders/ }).size, 2);
    assert.strictEqual(capture.filter({ failed: true }).size, 1);
    assert.strictEqual(capture.filter({ status: 500 }).size, 1);
    assert.strictEqual(capture.filter({ host: 'cdn.example.com' }).size, 1);
    assert.strictEqual(capture.filter((entry) => entry.responseSize > 500).size, 1);

    const found = capture.find(capture.entries[1].id);
    assert.strictEqual(found.url, 'https://cdn.example.com/assets/app.7f3a9c.js');
    assert.strictEqual(capture.find('nope'), null);

    const summary = capture.summary();
    assert.strictEqual(summary.total, 3);
    assert.strictEqual(summary.byStatus['500'], 1);
    assert.strictEqual(summary.byResourceType.xhr, 1);
    assert.strictEqual(capture.json().endpoints.length, 2);
  });

  await test('network capture writes analysis and ignores unknown duplicates', () => {
    const capture = NetworkCapture.fromHar(sampleHar());
    const first = capture.entries[0];

    assert.strictEqual(capture.add(first), capture);
    assert.strictEqual(capture.size, 3);

    capture.clear();
    assert.strictEqual(capture.size, 0);
  });

  await test('network capture run requires a source', async () => {
    await rejects(NetworkCapture.run({}), /needs one of/);
  });

  await test('playwright capture reports a clear error when it is missing', async () => {
    const capture = new PlaywrightCapture({ moduleName: 'not-a-real-browser-package' });
    assert.throws(() => capture.resolve(), (err) => err.code === 'PLAYWRIGHT_MISSING');
    await rejects(
      new PlaywrightCapture({ moduleName: 'not-a-real-browser-package' }).capture('https://example.com'),
      (err) => err.code === 'PLAYWRIGHT_MISSING',
    );
  });

  await test('playwright capture attaches to a page-like object', async () => {
    const listeners = new Map();
    const page = {
      on(event, handler) {
        listeners.set(event, handler);
      },
      off(event) {
        listeners.delete(event);
      },
    };

    const capture = new PlaywrightCapture({});
    const controller = capture.attach(page);
    assert.ok(typeof controller.stop === 'function');

    const request = { method: () => 'GET', url: () => 'https://api.example.com/items', resourceType: () => 'fetch', headers: () => ({ accept: 'application/json' }), postData: () => null, failure: () => null, allHeaders: async () => ({ accept: 'application/json' }) };
    const response = { request: () => request, status: () => 200, statusText: () => 'OK', headers: () => ({ 'content-type': 'application/json' }), allHeaders: async () => ({ 'content-type': 'application/json' }), text: async () => '{"items":[]}' };

    listeners.get('request')(request);
    await listeners.get('response')(response);
    await delay(20);

    assert.strictEqual(controller.entries.length, 1);
    assert.strictEqual(controller.entries[0].source, 'playwright');
    assert.strictEqual(controller.entries[0].responseBody, '{"items":[]}');

    controller.stop();
    assert.strictEqual(listeners.has('request'), false);
  });

  await test('capture surface is exported from the package root', () => {
    for (const key of ['NetworkCapture', 'CdpCapture', 'CaptureProxy', 'PlaywrightCapture', 'HarImporter', 'captureUrl', 'captureHar']) {
      assert.ok(sengkrep[key], `expected sengkrep.${key}`);
    }
    assert.strictEqual(typeof sengkrep.capture.analyze.urlTemplate, 'function');
    assert.ok(sengkrep.capture.DEFAULT_CDP_HOST.includes('9222'));
  });

  finish('08-network-capture');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
