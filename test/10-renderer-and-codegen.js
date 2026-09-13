const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const sengkrep = require('../index');
const { ready, closeAll } = require('./server');
const { test, rejects, assert, delay, finish } = require('./harness');
const { CdpCapture } = require('../src/capture/CdpCapture');
const { CdpRenderer } = require('../src/capture/CdpRenderer');
const codegen = require('../src/capture/codegen');
const cookies = require('../src/capture/cookies');
const CookieJar = require('../src/modules/CookieJar');

const BASE = 'http://127.0.0.1:9911';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sengkrep-codegen-'));
const REPO_ROOT = path.resolve(__dirname, '..');

const SESSION_ID = 'SESSION-1';

function fakeCdpClient(options = {}) {
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
      const done = (result) => this.emit('message', { id: message.id, sessionId: SESSION_ID, result });

      switch (message.method) {
        case 'Target.createTarget':
          return done({ targetId: 'TARGET-1' });
        case 'Target.attachToTarget':
          return done({ sessionId: SESSION_ID });
        case 'Runtime.evaluate':
          if (options.evaluate) return done({ result: { value: options.evaluate(message.params?.expression ?? '') } });
          return done({ result: { value: '<html><body><h1>Rendered App</h1></body></html>' } });
        case 'Network.getAllCookies':
          return done({ cookies: options.cookies ?? [] });
        case 'Page.navigate': {
          done({ frameId: 'FRAME-1' });
          setTimeout(() => {
            for (const event of options.events ?? []) {
              this.emit('message', { method: event.method, sessionId: SESSION_ID, params: event.params });
            }
            if (options.loadEvent !== false) {
              this.emit('message', { method: 'Page.loadEventFired', sessionId: SESSION_ID, params: {} });
            }
          }, options.loadDelay ?? 5);
          return;
        }
        default:
          return done({});
      }
    },
  };
}

function sampleHar(url) {
  return {
    log: {
      version: '1.2',
      creator: { name: 'fixture', version: '1.0' },
      entries: [
        {
          startedDateTime: '2026-01-01T00:00:00.000Z',
          time: 80,
          _resourceType: 'XHR',
          request: {
            method: 'GET',
            url,
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
              size: 200,
              mimeType: 'application/json; charset=utf-8',
              text: JSON.stringify({ data: { items: [{ title: 'A' }, { title: 'B' }], user: { name: 'qrtz' } } }),
            },
          },
          cache: {},
          timings: { send: 1, wait: 60, receive: 19 },
        },
      ],
    },
  };
}

function runNode(file, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { cwd: TMP, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), options.timeout ?? 30000);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

async function main() {
  await ready;

  await test('schema flattening walks objects, arrays and unions', () => {
    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        total: { type: 'integer' },
        data: { type: 'object', properties: { id: { type: 'string' } } },
        mixed: { type: 'string|integer' },
      },
    };

    const paths = codegen.jsonPathsFromSchema(schema);
    assert.strictEqual(paths.id, 'items[].id');
    assert.strictEqual(paths.name, 'items[].name');
    assert.strictEqual(paths.tags, 'items[].tags[]');
    assert.strictEqual(paths.total, 'total');
    assert.strictEqual(paths.data_id, 'data.id');
    assert.strictEqual(paths.mixed, 'mixed');

    assert.deepStrictEqual(codegen.jsonPathsFromSchema({ type: 'array', items: { type: 'object', properties: { id: { type: 'integer' } } } }), { id: '[].id' });
    assert.deepStrictEqual(codegen.jsonPathsFromSchema({ type: 'string' }), {});
    assert.deepStrictEqual(codegen.jsonPathsFromSchema(schema, { maxDepth: 1 }).total, 'total');
    assert.strictEqual(codegen.keyForPath('items[].id'), 'id');
    assert.strictEqual(codegen.keyForPath('[]'), 'value');
  });

  await test('generated script embeds url, schema, params and redacted headers', () => {
    const capture = sengkrep.captureHar(sampleHar(`${BASE}/echo-request?page=2&limit=25`));
    const endpoint = capture.endpoints()[0];

    const script = capture.toScript(endpoint, { require: REPO_ROOT });

    assert.ok(script.startsWith(`const sengkrep = require(${JSON.stringify(REPO_ROOT)});`));
    assert.ok(script.includes(`const URL = "${BASE}/echo-request";`));
    assert.ok(script.includes('"title": "data.items[].title"'));
    assert.ok(script.includes('"name": "data.user.name"'));
    assert.ok(!script.includes('const URL = "' + BASE + '/echo-request?'));
    assert.ok(!script.includes('super-secret'));
    assert.ok(script.includes('"<redacted>"'));
    assert.ok(script.includes('"page": "2"'));
    assert.ok(script.includes('scraper.extract(URL, SCHEMA'));
    assert.ok(script.includes('scraper.close();'));
    assert.ok(!script.split('\n').some((line) => line.trim().startsWith('//')));
  });

  await test('generated script actually runs against a live server', async () => {
    const capture = sengkrep.captureHar(sampleHar(`${BASE}/json`));
    const endpoint = capture.endpoints()[0];
    const schema = capture.toSchema(endpoint);

    assert.deepStrictEqual(schema, { title: 'data.items[].title', name: 'data.user.name' });

    const file = path.join(TMP, 'generated.js');
    fs.writeFileSync(file, capture.toScript(endpoint, { require: REPO_ROOT, logLevel: 'error' }));

    const result = await runNode(file);
    assert.strictEqual(result.signal, null, 'the generated script should exit on its own');
    assert.strictEqual(result.code, 0, result.stderr);

    const data = JSON.parse(result.stdout);
    assert.deepStrictEqual(data.title, ['A', 'B']);
    assert.strictEqual(data.name, 'qrtz');
  });

  await test('toSchema and toScript reject endpoints without a json body', () => {
    const capture = sengkrep.captureHar({
      log: {
        version: '1.2',
        creator: { name: 'x', version: '1' },
        entries: [{
          startedDateTime: '2026-01-01T00:00:00.000Z',
          time: 10,
          _resourceType: 'Document',
          request: { method: 'GET', url: `${BASE}/html`, headers: [] },
          response: {
            status: 200,
            statusText: 'OK',
            headers: [{ name: 'Content-Type', value: 'text/html' }],
            content: { size: 10, mimeType: 'text/html', text: '<h1>x</h1>' },
          },
          cache: {},
          timings: {},
        }],
      },
    });

    assert.throws(() => capture.toSchema(capture.entries[0]), /no JSON body/);
    assert.throws(() => capture.toScript(capture.entries[0]), /no JSON body/);
    assert.throws(() => capture.toSchema('missing'), /No capture endpoint/);
  });

  await test('cdp capture records websocket frames per socket', async () => {
    const client = fakeCdpClient({
      events: [
        { method: 'Network.webSocketCreated', params: { requestId: 'ws1', url: 'wss://app.example.com/socket' } },
        { method: 'Network.webSocketFrameSent', params: { requestId: 'ws1', timestamp: 1, response: { opcode: 1, mask: true, payloadData: '{"subscribe":"trades"}' } } },
        { method: 'Network.webSocketFrameReceived', params: { requestId: 'ws1', timestamp: 2, response: { opcode: 1, mask: false, payloadData: '{"ok":true}' } } },
      ],
    });

    const cdp = new CdpCapture({ connect: async () => client, debuggerUrl: 'ws://fake', idleMs: 1 });
    const result = await cdp.capture({ url: 'https://app.example.com/dashboard' });

    const socket = result.entries.find((entry) => entry.resourceType === 'websocket');
    assert.ok(socket, 'expected a websocket entry');
    assert.strictEqual(socket.frames.length, 2);
    assert.strictEqual(socket.frames[0].direction, 'sent');
    assert.strictEqual(socket.frames[0].payloadData, '{"subscribe":"trades"}');
    assert.strictEqual(socket.frames[0].size, 22);
    assert.strictEqual(socket.frames[1].direction, 'received');
    assert.strictEqual(socket.frames[1].opcode, 1);
  });

  await test('network capture exposes frames and caps them per socket', async () => {
    const client = fakeCdpClient({
      events: [
        { method: 'Network.webSocketCreated', params: { requestId: 'ws1', url: 'wss://app.example.com/socket' } },
        { method: 'Network.webSocketFrameSent', params: { requestId: 'ws1', response: { opcode: 1, payloadData: 'one' } } },
        { method: 'Network.webSocketFrameSent', params: { requestId: 'ws1', response: { opcode: 1, payloadData: 'two' } } },
      ],
    });

    const cdp = new CdpCapture({
      connect: async () => client,
      debuggerUrl: 'ws://fake',
      idleMs: 1,
      maxFramesPerSocket: 1,
    });
    const result = await cdp.capture({ url: 'https://app.example.com/dashboard' });
    const capture = new sengkrep.NetworkCapture().add(result.entries);
    const socket = result.entries.find((entry) => entry.resourceType === 'websocket');

    assert.strictEqual(socket.frames.length, 1);
    assert.strictEqual(socket.framesTruncated, true);
    assert.strictEqual(capture.frames(socket.id).length, 1);
    assert.strictEqual(capture.frames(socket.id)[0].payloadData, 'one');
    assert.throws(() => capture.frames('nope'), /No capture entry/);
  });

  await test('cdp renderer returns html for a url', async () => {
    const client = fakeCdpClient();
    const renderer = new CdpRenderer({ connect: async () => client, debuggerUrl: 'ws://fake', idleMs: 1 });

    const html = await renderer.render('https://app.example.com/page');
    assert.ok(html.includes('Rendered App'));
    assert.ok(client.sent.includes('Page.navigate'));
    assert.ok(client.sent.includes('Runtime.evaluate'));
    assert.ok(client.sent.includes('Target.closeTarget'));
  });

  await test('cdp renderer can wait for a selector and return metadata', async () => {
    let probes = 0;
    const client = fakeCdpClient({
      evaluate: (expression) => {
        if (expression.includes('document.querySelector')) {
          probes += 1;
          return probes > 1;
        }
        if (expression.includes('document.title')) {
          return { title: 'App', url: 'https://app.example.com/page', status: 'complete' };
        }
        return '<html><body><h1>Ready</h1></body></html>';
      },
    });

    const renderer = new CdpRenderer({
      connect: async () => client,
      debuggerUrl: 'ws://fake',
      idleMs: 0,
      includeMeta: true,
      waitForSelector: '#ready',
      waitForSelectorInterval: 5,
      waitForSelectorTimeout: 500,
    });

    const result = await renderer.render('https://app.example.com/page');
    assert.strictEqual(result.title, 'App');
    assert.strictEqual(result.readyState, 'complete');
    assert.ok(result.html.includes('Ready'));
    assert.ok(probes >= 2);
  });

  await test('cdp renderer throws when the selector never appears', async () => {
    const client = fakeCdpClient({ evaluate: (expression) => (expression.includes('document.querySelector') ? false : '<html></html>') });
    const renderer = new CdpRenderer({
      connect: async () => client,
      debuggerUrl: 'ws://fake',
      idleMs: 0,
      waitForSelector: '#missing',
      waitForSelectorInterval: 5,
      waitForSelectorTimeout: 40,
    });

    await rejects(renderer.render('https://app.example.com/page'), /waited 40ms for #missing/);
  });

  await test('the cdp renderer plugs into extract with render true', async () => {
    const client = fakeCdpClient();
    const scraper = sengkrep.create({
      logLevel: 'error',
      retry: { max: 0 },
      renderer: sengkrep.renderers.cdp({ connect: async () => client, debuggerUrl: 'ws://fake', idleMs: 1 }),
    });

    const data = await scraper.extract('https://app.example.com/page', { title: 'h1' }, { render: true });
    assert.strictEqual(data.title, 'Rendered App');
    assert.strictEqual(data._sengkrep.rendered, true);
  });

  await test('cookie files parse netscape lines and session cookies', () => {
    const text = [
      '# Netscape HTTP Cookie File',
      '',
      '.example.com\tTRUE\t/\tTRUE\t2000000000\tsid\tABC123',
      `#HttpOnly_example.com\tTRUE\t/\tFALSE\t0\thttpOnlyCookie\tXYZ`,
      'api.example.com\tFALSE\t/v1\tFALSE\t0\tapiKey\tKEY9',
      '# a comment line',
    ].join('\n');

    const parsed = cookies.parseCookieFile(text);
    assert.strictEqual(parsed.length, 3);
    assert.strictEqual(parsed[0].domain, 'example.com');
    assert.strictEqual(parsed[0].secure, true);
    assert.strictEqual(parsed[0].httpOnly, false);
    assert.strictEqual(parsed[0].expires, 2000000000000);
    assert.strictEqual(parsed[1].httpOnly, true);
    assert.strictEqual(parsed[1].expires, null);
    assert.strictEqual(parsed[2].path, '/v1');
    assert.strictEqual(parsed[2].name, 'apiKey');
  });

  await test('cookie json handles both shapes', () => {
    const list = cookies.parseCookieJson({ cookies: [{ name: 'a', value: '1', domain: 'x.test', expirationDate: 2000000000 }] });
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].expires, 2000000000000);
    assert.strictEqual(cookies.parseCookieJson('[{"name":"b","value":"2"}]')[0].name, 'b');
    assert.throws(() => cookies.parseCookieJson('{"a":1}'), /must be an array/);
    assert.throws(() => cookies.parseCookieJson('nope'), /Invalid cookie JSON/);
    assert.throws(() => cookies.parseCookieJson('{bad json'), /Invalid cookie JSON/);
  });

  await test('import cookies into a jar from a file with domain filtering', async () => {
    const file = path.join(TMP, 'cookies.txt');
    fs.writeFileSync(file, [
      '# Netscape HTTP Cookie File',
      '.example.com\tTRUE\t/\tFALSE\t2000000000\tsid\tABC123',
      'other.test\tFALSE\t/\tFALSE\t2000000000\tx\t1',
    ].join('\n'));

    const jar = new CookieJar();
    const imported = await sengkrep.importCookies(jar, { from: 'file', path: file, domains: ['example.com'] });

    assert.strictEqual(imported, 1);
    assert.strictEqual(jar.getCookieHeader('example.com'), 'sid=ABC123');
    assert.strictEqual(jar.getCookieHeader('other.test'), null);
    assert.strictEqual(sengkrep.parseCookieFile(fs.readFileSync(file, 'utf8')).length, 2);
  });

  await test('import cookies rejects a bad jar and unknown sources', async () => {
    await rejects(sengkrep.importCookies({}, { from: 'text', text: '' }), /needs a CookieJar/);
    await rejects(sengkrep.importCookies(new CookieJar(), { from: 'nope' }), /Unknown cookie source/);
    await rejects(sengkrep.importCookies(new CookieJar(), { from: 'file' }), /needs a path/);
  });

  await test('cdp cookies export maps browser fields', async () => {
    const client = fakeCdpClient({
      cookies: [
        { name: 'sid', value: 'S1', domain: '.example.com', path: '/', secure: true, httpOnly: true, session: true },
        { name: 'auth', value: 'A1', domain: 'app.example.com', path: '/', secure: false, httpOnly: false, expires: 2000000000 },
      ],
    });

    const exported = await new CdpCapture({ connect: async () => client, debuggerUrl: 'ws://fake' }).exportCookies();
    assert.strictEqual(exported.length, 2);
    assert.strictEqual(exported[0].domain, 'example.com');
    assert.strictEqual(exported[0].expires, null);
    assert.strictEqual(exported[0].httpOnly, true);
    assert.strictEqual(exported[1].expires, 2000000000000);

    const jar = new CookieJar();
    const imported = await sengkrep.importCookies(jar, { from: 'cdp', connect: async () => client, debuggerUrl: 'ws://fake' });
    assert.strictEqual(imported, 2);
    assert.ok(jar.getCookieHeader('app.example.com').includes('auth=A1'));
  });

  await test('generated code and cookie helpers are on the package surface', () => {
    assert.strictEqual(typeof sengkrep.renderers.cdp, 'function');
    assert.strictEqual(typeof sengkrep.CdpRenderer, 'function');
    assert.strictEqual(typeof sengkrep.importCookies, 'function');
    assert.strictEqual(typeof sengkrep.parseCookieFile, 'function');
    assert.strictEqual(typeof sengkrep.capture.codegen.jsonPathsFromSchema, 'function');
    assert.strictEqual(typeof sengkrep.capture.codegen.buildScript, 'function');
    assert.strictEqual(typeof sengkrep.capture.cookies.parseCookieFile, 'function');
    assert.strictEqual(typeof sengkrep.capture.createCdpRenderer, 'function');
  });

  await test('buildScript falls back to the endpoint template and drops the query when params exist', () => {
    const script = codegen.buildScript({
      endpoint: { method: 'GET', template: 'https://api.example.com/v1/items' },
      schema: { id: 'items[].id' },
      params: { page: '3' },
      require: 'sengkrep',
    });

    assert.ok(script.includes('const URL = "https://api.example.com/v1/items";'));
    assert.ok(script.includes('"page": "3"'));
    assert.ok(script.includes('require("sengkrep")'));
    assert.throws(() => codegen.buildScript({ endpoint: {} }), /needs an endpoint/);
    assert.strictEqual(codegen.stripQuery('https://a.test/x?y=1#z'), 'https://a.test/x');
  });

  await delay(20);
  finish('10-renderer-and-codegen');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
