const { ready, closeAll } = require('./server');
const { test, rejects, assert, delay, finish } = require('./harness');
const http2 = require('http2');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const sengkrep = require('../index');
const Fingerprint = require('../src/modules/Fingerprint');
const { Transport } = require('../src/core/Transport');
const { Http2Fetcher } = require('../src/core/Http2Fetcher');
const { Fetcher } = require('../src/core/Fetcher');
const Retry = require('../src/core/Retry');
const RateLimiter = require('../src/modules/RateLimiter');
const Cache = require('../src/modules/Cache');
const ContentDedup = require('../src/modules/ContentDedup');
const AdaptiveThrottle = require('../src/modules/AdaptiveThrottle');
const { DistributedQueue, MemoryAdapter } = require('../src/modules/DistributedQueue');
const Webhook = require('../src/modules/Webhook');
const Observability = require('../src/modules/Observability');
const { SecurityGuard } = require('../src/modules/SecurityGuard');
const SqliteStorage = require('../src/modules/SqliteStorage');
const Storage = require('../src/utils/storage');

const BASE = 'http://127.0.0.1:9911';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sengkrep-v4-'));

function startH2Server() {
  return new Promise((resolve) => {
    const server = http2.createServer((req, res) => {
      if (req.url === '/throttle') {
        res.writeHead(429, { 'retry-after': '1' });
        return res.end('slow down');
      }
      if (req.url === '/not-modified') {
        res.writeHead(304);
        return res.end();
      }
      if (req.url === '/slow') {
        setTimeout(() => { res.writeHead(200); res.end('late'); }, 400);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<h1>h2 hello</h1>');
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  await ready;
  const h2server = await startH2Server();
  const h2port = h2server.address().port;

  await test('fingerprint keeps user agent and client hints coherent', () => {
    const fp = new Fingerprint({});
    const headers = fp.buildHeaders({});
    const ua = headers['User-Agent'];
    const major = Number(ua.match(/(?:Chrome|Edg)\/(\d+)/)[1]);
    assert.ok(headers['Sec-CH-UA'].includes(`v="${major}"`));
    assert.ok(headers['Sec-CH-UA'].includes('Google Chrome'));
    assert.strictEqual(headers['Accept-Encoding'].includes('zstd'), Fingerprint.ZSTD_SUPPORTED);
  });

  await test('fingerprint does not rotate by default but can rotate on demand', () => {
    const stable = new Fingerprint({});
    assert.strictEqual(stable.buildHeaders()['User-Agent'], stable.buildHeaders()['User-Agent']);

    const rotating = new Fingerprint({ rotateUAOnEachRequest: true });
    const seen = new Set();
    for (let i = 0; i < 40; i += 1) seen.add(rotating.getUA());
    assert.ok(seen.size > 1);
  });

  await test('fingerprint exposes selectable profiles', () => {
    const fp = new Fingerprint({ profile: 'firefox-windows' });
    assert.strictEqual(fp.profile.browser, 'firefox');
    assert.ok(fp.getUA().includes('Firefox'));
    assert.throws(() => fp.setProfile('netscape'), /Unknown fingerprint profile/);
    assert.strictEqual(Fingerprint.PROFILES.length > 3, true);
  });

  await test('fingerprint sends navigation headers for a plain GET', () => {
    const fp = new Fingerprint({ profile: 'chrome-windows', randomizeHeaderOrder: false });
    const headers = fp.buildHeaders({}, { method: 'GET', targetUrl: `${BASE}/html` });

    assert.strictEqual(headers['Sec-Fetch-Dest'], 'document');
    assert.strictEqual(headers['Sec-Fetch-Mode'], 'navigate');
    assert.strictEqual(headers['Sec-Fetch-User'], '?1');
    assert.strictEqual(headers['Upgrade-Insecure-Requests'], '1');
    assert.ok(headers['Accept'].includes('text/html'));
  });

  await test('fingerprint sends fetch headers for a JSON request', () => {
    const fp = new Fingerprint({ profile: 'chrome-windows', randomizeHeaderOrder: false });
    const headers = fp.buildHeaders({ accept: 'application/json' }, { method: 'GET', targetUrl: `${BASE}/json` });

    assert.strictEqual(headers['Sec-Fetch-Dest'], 'empty');
    assert.strictEqual(headers['Sec-Fetch-Mode'], 'cors');
    assert.strictEqual(headers['Sec-Fetch-User'], undefined);
    assert.strictEqual(headers['Upgrade-Insecure-Requests'], undefined);
    assert.strictEqual(headers['accept'], 'application/json');
  });

  await test('fingerprint treats a request with a body as a subresource', () => {
    const fp = new Fingerprint({ profile: 'chrome-windows', randomizeHeaderOrder: false });
    const headers = fp.buildHeaders({}, { method: 'POST', targetUrl: `${BASE}/login` });

    assert.strictEqual(headers['Sec-Fetch-Dest'], 'empty');
    assert.strictEqual(headers['Sec-Fetch-Mode'], 'cors');
    assert.strictEqual(headers['Sec-Fetch-User'], undefined);
    assert.strictEqual(headers['Accept'], '*/*');
  });

  await test('fingerprint lets caller headers win without leaving a duplicate case', () => {
    const fp = new Fingerprint({ profile: 'chrome-windows', randomizeHeaderOrder: false });
    const headers = fp.buildHeaders({ 'user-agent': 'custom/1.0', accept: 'application/json' }, { method: 'GET', targetUrl: `${BASE}/json` });
    const names = Object.keys(headers).map((name) => name.toLowerCase());

    assert.strictEqual(names.filter((name) => name === 'user-agent').length, 1);
    assert.strictEqual(names.filter((name) => name === 'accept').length, 1);
    assert.strictEqual(headers['user-agent'], 'custom/1.0');
    assert.strictEqual(headers['accept'], 'application/json');
  });

  await test('fingerprint headers reach the server as a fetch, not a page load', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });

    const plain = await scraper.fetch(`${BASE}/echo-headers`);
    const plainHeaders = JSON.parse(plain.body).headers;
    assert.strictEqual(plainHeaders['sec-fetch-dest'], 'document');
    assert.strictEqual(plainHeaders['sec-fetch-mode'], 'navigate');

    const api = await scraper.fetch(`${BASE}/echo-headers`, { request: { headers: { accept: 'application/json' } } });
    const apiHeaders = JSON.parse(api.body).headers;
    assert.strictEqual(apiHeaders['sec-fetch-dest'], 'empty');
    assert.strictEqual(apiHeaders['sec-fetch-mode'], 'cors');
    assert.strictEqual(apiHeaders['sec-fetch-user'], undefined);
    assert.strictEqual(apiHeaders.accept, 'application/json');

    scraper.close();
  });

  await test('rate limiter serializes concurrent acquires per host', async () => {
    const limiter = new RateLimiter({ requestsPerSecond: 25 });
    const start = Date.now();
    const releases = await Promise.all([
      limiter.acquire('h'),
      limiter.acquire('h'),
      limiter.acquire('h'),
    ]);
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 70, `expected >= 70ms of spacing, got ${elapsed}ms`);
    releases.forEach((release) => release());
  });

  await test('cache evicts least recently used entries', () => {
    const cache = new Cache({ ttl: 60, maxItems: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    assert.strictEqual(cache.get('a'), 1);
    cache.set('c', 3);
    assert.strictEqual(cache.get('a'), 1);
    assert.strictEqual(cache.get('b'), null);
    assert.ok(cache.stats().evictions >= 1);
  });

  await test('transport prefers http/2 and falls back on connection errors', async () => {
    const calls = [];
    const http1 = { fetch: async (url) => { calls.push('http1'); return { status: 200, headers: {}, url, body: 'http1-body' }; } };
    const http2Fetcher = { fetch: async () => { calls.push('http2'); throw Object.assign(new Error('no h2'), { code: 'CONNECT_FAILED' }); }, closeAll() {} };

    const transport = new Transport({ fetcher: http1, http2: http2Fetcher });
    const res = await transport.request('https://example.com/', {});
    assert.strictEqual(res.body, 'http1-body');
    assert.deepStrictEqual(calls, ['http2', 'http1']);

    calls.length = 0;
    await transport.request('http://example.com/', {});
    assert.deepStrictEqual(calls, ['http1']);
  });

  await test('transport does not fall back on http status errors', async () => {
    const http1 = { fetch: async () => { throw new Error('should not be called'); } };
    const http2Fetcher = { fetch: async () => { throw Object.assign(new Error('HTTP 500'), { status: 500, code: 'HTTP_ERROR' }); }, closeAll() {} };
    const transport = new Transport({ fetcher: http1, http2: http2Fetcher });
    const err = await rejects(transport.request('https://example.com/', {}), (e) => e.status === 500);
    assert.strictEqual(err.status, 500);
  });

  await test('http2 fetcher supports status, retry-after, 304, sizes and cancel', async () => {
    const h2 = new Http2Fetcher({ timeout: 3000 });

    const res = await h2.fetch(`http://127.0.0.1:${h2port}/text`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.protocol, 'h2');
    assert.ok(res.body.includes('h2 hello'));
    assert.strictEqual(typeof res.responseSize, 'number');

    const throttle = await rejects(h2.fetch(`http://127.0.0.1:${h2port}/throttle`), (e) => e.status === 429);
    assert.strictEqual(throttle.retryAfterMs, 1000);

    const notModified = await h2.fetch(`http://127.0.0.1:${h2port}/not-modified`);
    assert.strictEqual(notModified.notModified, true);

    const controller = new AbortController();
    const pending = h2.fetch(`http://127.0.0.1:${h2port}/slow`, { signal: controller.signal });
    controller.abort();
    await rejects(pending, 'CANCELED');

    h2.closeAll();
  });

  await test('retry budget stops retrying once exhausted', async () => {
    const retry = new Retry({ max: 5, jitter: false, budgetMs: 1 });
    let calls = 0;
    await rejects(retry.run(async () => {
      calls += 1;
      throw Object.assign(new Error('boom'), { status: 500 });
    }), (e) => e.status === 500);
    assert.strictEqual(calls, 1);
  });

  await test('fetcher supports a pinned lookup override', async () => {
    const fetcher = new Fetcher({ timeout: 3000 });
    const res = await fetcher.fetch(`${BASE}/html`, {
      lookup: (host, options, callback) => callback(null, '127.0.0.1', 4),
    });
    assert.ok(res.body.includes('Hello Sengkrep'));
  });

  await test('security guard resolves and pins addresses', async () => {
    const guard = new SecurityGuard({ blockPrivateIPs: true });
    const resolved = await guard.resolve('localhost');
    assert.strictEqual(typeof resolved.address, 'string');
    await rejects(guard.resolveForRequest('http://localhost/'), 'SECURITY_BLOCKED');
    assert.strictEqual(await new SecurityGuard({}).resolveForRequest('http://localhost/'), null);
  });

  await test('file storage shards keys and clears cleanly', () => {
    const dir = path.join(TMP, 'file-storage');
    const storage = new Storage(dir);
    storage.set('user:1', { name: 'a' });
    storage.set('user:2', { name: 'b' });
    assert.deepStrictEqual(storage.get('user:1').data, { name: 'a' });
    assert.strictEqual(storage.list().length, 2);
    storage.delete('user:1');
    assert.strictEqual(storage.list().length, 1);
    storage.clear();
    assert.strictEqual(storage.list().length, 0);
  });

  await test('createStorage selects memory, file and sqlite backends', () => {
    assert.ok(Storage.createStorage({ storage: 'memory' }) instanceof Storage.MemoryStorage);
    assert.ok(Storage.createStorage({ storageDir: path.join(TMP, 'factory') }) instanceof Storage);
    const memory = new Storage.MemoryStorage();
    memory.set('k', 1);
    assert.strictEqual(memory.get('k').data, 1);
    assert.strictEqual(memory.list().length, 1);
    memory.clear();
    assert.strictEqual(memory.list().length, 0);
  });

  await test('sqlite storage reports a clear error on unsupported runtimes', () => {
    let supported = true;
    try {
      require('node:sqlite');
    } catch {
      supported = false;
    }
    const sqlite = new SqliteStorage({ file: path.join(TMP, 'store.db') });
    if (!supported) {
      assert.throws(() => sqlite.set('k', 'v'), /node:sqlite/);
      return;
    }
    sqlite.set('k', 'v');
    assert.strictEqual(sqlite.get('k').data, 'v');
    assert.strictEqual(sqlite.list().length, 1);
    sqlite.close();
  });

  await test('content dedup detects near duplicates with simhash', () => {
    const dedup = new ContentDedup({ threshold: 3 });
    const text = 'the quick brown fox jumps over the lazy dog near the river bank every morning';
    assert.strictEqual(dedup.isDuplicate(text).duplicate, false);
    assert.strictEqual(dedup.check(text).duplicate, false);
    assert.strictEqual(dedup.check(text).duplicate, true);
    assert.strictEqual(dedup.check('completely unrelated article about cooking pasta and tomatoes').duplicate, false);
    assert.strictEqual(dedup.size(), 2);
    const fingerprint = dedup.fingerprint(text);
    assert.strictEqual(ContentDedup.hammingDistance(fingerprint, fingerprint), 0);
  });

  await test('adaptive throttle backs off and recovers per host', () => {
    const throttle = new AdaptiveThrottle({ initialConcurrency: 4, minConcurrency: 1, maxConcurrency: 4, increaseEvery: 2, baseDelay: 10, maxDelay: 100 });
    assert.strictEqual(throttle.concurrencyFor('h'), 4);
    throttle.onFailure('h', {});
    assert.strictEqual(throttle.concurrencyFor('h'), 2);
    assert.ok(throttle.delayFor('h') > 0);
    throttle.onFailure('h', {});
    assert.strictEqual(throttle.concurrencyFor('h'), 1);
    throttle.onSuccess('h');
    throttle.onSuccess('h');
    assert.strictEqual(throttle.concurrencyFor('h'), 2);
    assert.strictEqual(throttle.stats().length, 1);
    throttle.reset();
    assert.strictEqual(throttle.stats().length, 0);
  });

  await test('distributed queue honors priority', async () => {
    const queue = new DistributedQueue({ adapter: new MemoryAdapter(), emptyRetries: 1, pollInterval: 5 });
    await queue.enqueue(['low'], { priority: 10 });
    await queue.enqueue(['high'], { priority: 0 });
    const order = [];
    await queue.run(async (item) => { order.push(item); return item; }, { concurrency: 1 });
    assert.deepStrictEqual(order, ['high', 'low']);
  });

  await test('distributed queue records dead letters after max retries', async () => {
    const queue = new DistributedQueue({ adapter: new MemoryAdapter(), maxItemRetries: 2, emptyRetries: 1, pollInterval: 5 });
    await queue.enqueue(['poison']);
    const results = await queue.run(async () => { throw new Error('nope'); }, { concurrency: 1 });
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[1].droppedAfterRetries, 2);
    assert.strictEqual(queue.deadLettered().length, 1);
    assert.strictEqual(queue.deadLettered()[0].item, 'poison');
  });

  await test('memory adapter expires leases', async () => {
    const adapter = new MemoryAdapter();
    await adapter.enqueue(['x']);
    assert.strictEqual(await adapter.dequeue(40), 'x');
    assert.strictEqual(await adapter.dequeue(40), null);
    await delay(60);
    assert.strictEqual(await adapter.dequeue(40), 'x');
  });

  await test('webhooks retry, sign and skip unknown events', async () => {
    const webhook = new Webhook({ onComplete: 'http://127.0.0.1:9/unreachable', retries: 1, backoffMs: 10, secret: 's3cret' });
    assert.ok(webhook.sign('{"a":1}').startsWith('sha256='));
    const result = await webhook.fire('onComplete', { ok: true });
    assert.strictEqual(result.delivered, false);
    assert.strictEqual(result.attempts, 2);
    assert.strictEqual((await webhook.fire('unknownEvent', {})).skipped, true);
  });

  await test('observability exposes prometheus metrics', () => {
    const obs = new Observability();
    obs.recordSuccess('http://a/1');
    obs.recordFailure('http://a/2', { code: 'TIMEOUT' });
    obs.trackBytes(5, 10);
    const text = obs.prometheus();
    assert.ok(text.includes('# TYPE sengkrep_requests_total counter'));
    assert.ok(text.includes('sengkrep_requests_total 2'));
    assert.ok(text.includes('sengkrep_errors_total{category="timeout"} 1'));
    assert.ok(text.includes('sengkrep_bytes_total{dir="received"} 10'));
    assert.ok(text.includes('sengkrep_domain_requests_total{domain="a"} 2'));
  });

  await test('renderer can supply html without a network call', async () => {
    const scraper = sengkrep.create({
      logLevel: 'error',
      retry: { max: 0 },
      renderer: async () => '<html><body><h1>Rendered Title</h1></body></html>',
    });
    const data = await scraper.extract(`${BASE}/never-fetched`, { title: 'h1' }, { render: true });
    assert.strictEqual(data.title, 'Rendered Title');
    assert.strictEqual(data._sengkrep.rendered, true);
  });

  await test('compliance masks fields and writes an audit log', async () => {
    const audit = path.join(TMP, 'audit.jsonl');
    const scraper = sengkrep.create({
      logLevel: 'error',
      retry: { max: 0 },
      compliance: { maskFields: ['title'], auditLog: audit, purpose: 'testing' },
    });
    const data = await scraper.extract(`${BASE}/html`, { title: 'h1' });
    assert.strictEqual(data.title, '[redacted]');
    await delay(80);
    const lines = fs.readFileSync(audit, 'utf8').trim().split('\n');
    assert.ok(lines.length >= 1);
    const record = JSON.parse(lines[0]);
    assert.ok(record.url.includes('/html'));
    assert.strictEqual(record.purpose, 'testing');
  });

  await test('compliance honors X-Robots-Tag and identifiable user agents', async () => {
    const scraper = sengkrep.create({
      logLevel: 'error',
      retry: { max: 0 },
      compliance: { respectXRobotsTag: true, userAgent: 'polite-bot/1.0' },
    });
    assert.strictEqual(scraper.fingerprint.getUA(), 'polite-bot/1.0');
    await rejects(scraper.fetch(`${BASE}/robots-tag-none`), 'X_ROBOTS_DISALLOWED');
  });

  await test('discover robots cache can be invalidated', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 }, robotsTtl: 3600000 });
    assert.strictEqual(await scraper.isAllowed(`${BASE}/private/secret`), false);
    scraper.discoverer.clearRobotsCache();
    assert.strictEqual(await scraper.isAllowed(`${BASE}/private/secret`), false);
  });

  await test('exported v4 surface is available from the package root', () => {
    for (const key of ['Transport', 'AdaptiveThrottle', 'ContentDedup', 'SqliteStorage', 'Storage', 'MemoryStorage', 'createStorage']) {
      assert.ok(sengkrep[key], `expected sengkrep.${key}`);
    }
    assert.strictEqual(typeof zlib, 'object');
  });

  finish('07-transport-fingerprint-storage');
  h2server.close();
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
