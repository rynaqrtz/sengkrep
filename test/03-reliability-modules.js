const { ready, closeAll } = require('./server');
const { test, rejects, assert, delay, finish } = require('./harness');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sengkrep = require('../index');
const { CircuitBreaker } = require('../src/modules/CircuitBreaker');
const HealthMonitor = require('../src/modules/HealthMonitor');
const DiffDetector = require('../src/modules/DiffDetector');
const Cache = require('../src/modules/Cache');
const Incremental = require('../src/modules/Incremental');
const CrawlQueue = require('../src/modules/CrawlQueue');
const Observability = require('../src/modules/Observability');
const RateLimiter = require('../src/modules/RateLimiter');
const ProxyRotator = require('../src/modules/ProxyRotator');
const { SecurityGuard } = require('../src/modules/SecurityGuard');
const SessionPool = require('../src/modules/SessionPool');
const AuthManager = require('../src/modules/AuthManager');
const CsrfHandler = require('../src/modules/CsrfHandler');
const { DistributedQueue, MemoryAdapter } = require('../src/modules/DistributedQueue');
const HarRecorder = require('../src/modules/HarRecorder');
const Interceptors = require('../src/modules/Interceptors');
const DnsCache = require('../src/modules/DnsCache');
const Webhook = require('../src/modules/Webhook');
const cheerio = require('cheerio');

const BASE = 'http://127.0.0.1:9911';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sengkrep-reliability-'));

async function main() {
  await ready;

  await test('circuit breaker opens, half-opens and closes', () => {
    let now = 0;
    const events = [];
    const cb = new CircuitBreaker({
      threshold: 2,
      cooldown: 1000,
      clock: () => now,
      onOpen: () => events.push('open'),
      onClose: () => events.push('close'),
    });

    assert.strictEqual(cb.canRequest('a'), true);
    cb.recordFailure('a');
    cb.recordFailure('a');
    assert.strictEqual(cb.getState('a').state, 'open');
    assert.strictEqual(cb.canRequest('a'), false);
    assert.deepStrictEqual(events, ['open']);
    assert.throws(() => cb.assertCanRequest('a'), (e) => e.code === 'CIRCUIT_OPEN');

    now = 1000;
    assert.strictEqual(cb.canRequest('a'), true);
    assert.strictEqual(cb.getState('a').state, 'half_open');

    cb.recordSuccess('a');
    assert.strictEqual(cb.getState('a').state, 'closed');
    assert.deepStrictEqual(events, ['open', 'close']);
    assert.strictEqual(cb.canRequest('a'), true);

    cb.reset('a');
    assert.strictEqual(cb.getState('a').failures, 0);
    assert.strictEqual(cb.getAllStates().length, 1);
  });

  await test('health monitor flags empty rates and count drops', () => {
    const health = new HealthMonitor({ alertThreshold: 0.5 });
    let report;
    for (let i = 0; i < 3; i += 1) {
      report = health.record('u', { title: { selector: '.t', empty: true, count: 0 } });
    }
    assert.strictEqual(report.healthy, false);
    assert.ok(report.alerts.some((a) => a.type === 'high_empty_rate'));
    assert.strictEqual(health.getReport('u').fields.title.emptyRate, 100);

    const counts = new HealthMonitor({ alertThreshold: 1 });
    for (let i = 0; i < 3; i += 1) {
      counts.record('u', { n: { selector: '.n', empty: false, count: 10 } });
    }
    const drop = counts.record('u', { n: { selector: '.n', empty: false, count: 1 } });
    assert.ok(drop.alerts.some((a) => a.type === 'count_drop'));

    health.reset();
    assert.strictEqual(health.getReport('u'), null);
  });

  await test('diff detector reports structural and value changes', () => {
    const dir = path.join(TMP, 'diff');
    const diff = new DiffDetector({ storageDir: dir, sensitivity: 'value' });
    const first = diff.check('u', { a: 1, b: 'x' });
    assert.strictEqual(first.firstRun, true);

    const second = diff.check('u', { a: 2, c: 'y' });
    assert.strictEqual(second.hasCritical, true);
    const types = second.changes.map((c) => c.type);
    assert.ok(types.includes('keys_removed'));
    assert.ok(types.includes('keys_added'));
    assert.ok(types.includes('value_changed'));

    assert.strictEqual(diff.getAllChanges('u').length, 2);
    assert.strictEqual(diff.getChangedOnly('u').length, 1);
    diff.clearHistory();
    assert.strictEqual(diff.getAllChanges().length, 0);

    diff.clearSnapshot('u');
    assert.strictEqual(diff.check('u', { a: 1 }).firstRun, true);
    diff.clearAll();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test('cache stores, expires and tracks stats in memory', async () => {
    const cache = new Cache({ ttl: 0.05 });
    cache.set('http://x', { v: 1 });
    assert.deepStrictEqual(cache.get('http://x'), { v: 1 });
    assert.strictEqual(cache.has('http://x'), true);
    await delay(80);
    assert.strictEqual(cache.get('http://x'), null);
    const stats = cache.stats();
    assert.ok(stats.hits >= 1);
    assert.ok(stats.misses >= 1);
  });

  await test('cache supports disk storage and deletion', () => {
    const dir = path.join(TMP, 'cache');
    const cache = new Cache({ storage: 'disk', storageDir: dir, ttl: 60 });
    cache.set('http://y', { v: 2 });
    assert.deepStrictEqual(cache.get('http://y'), { v: 2 });
    cache.delete('http://y');
    assert.strictEqual(cache.get('http://y'), null);
    cache.clear();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test('incremental stores conditional headers and snapshots', () => {
    const dir = path.join(TMP, 'inc');
    const inc = new Incremental({ storageDir: dir });
    inc.record('http://z', { etag: '"e1"', 'last-modified': 'date-1' }, { title: 'snap' });
    const headers = inc.getConditionalHeaders('http://z');
    assert.strictEqual(headers['If-None-Match'], '"e1"');
    assert.strictEqual(headers['If-Modified-Since'], 'date-1');
    assert.strictEqual(inc.hasSnapshot('http://z'), true);
    assert.deepStrictEqual(inc.getSnapshot('http://z'), { title: 'snap' });
    inc.clear('http://z');
    assert.strictEqual(inc.hasSnapshot('http://z'), false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await test('crawl queue persists and resumes state', async () => {
    const stateFile = path.join(TMP, 'crawl-state.json');
    const graph = { a: ['b', 'c'], b: ['d'], c: [], d: [] };
    const visit = async (url) => ({ data: { url }, links: (graph[url.split('/').pop()] ?? []).map((x) => `http://h/${x}`) });

    const queue = new CrawlQueue({ seed: 'http://h/a', maxUrls: 10, concurrency: 2, stateFile, saveEvery: 1 });
    const events = [];
    queue.on('url:done', ({ url }) => events.push(url));
    queue.on('done', () => events.push('done'));
    const results = await queue.start(visit);
    assert.strictEqual(results.length, 4);
    assert.ok(events.includes('done'));
    assert.ok(fs.existsSync(stateFile));

    const resumed = new CrawlQueue({ seed: 'http://h/a', maxUrls: 10, concurrency: 2, stateFile });
    const resumedResults = await resumed.resume(visit);
    assert.strictEqual(resumedResults.length, 4);
    assert.strictEqual(resumed.stats().visited, 4);
    fs.rmSync(stateFile, { force: true });
  });

  await test('observability aggregates success, failures and categories', () => {
    const obs = new Observability({ enabled: false });
    obs.recordSuccess('http://a/1');
    obs.recordSuccess('http://a/2');
    obs.recordFailure('http://a/3', { code: 'TIMEOUT' });
    obs.recordFailure('http://a/4', { status: 500 });
    obs.recordFailure('http://a/5', { name: 'ValidationError' });
    obs.trackBytes(10, 20);
    const report = obs.report();
    assert.strictEqual(report.total, 5);
    assert.strictEqual(report.success, 2);
    assert.strictEqual(report.failed, 3);
    assert.strictEqual(report.categories.timeout, 1);
    assert.strictEqual(report.categories.http5xx, 1);
    assert.strictEqual(report.categories.validation, 1);
    assert.deepStrictEqual(report.bytes, { sent: 10, received: 20 });
    assert.ok(report.topErrors.some((e) => e.code === 'TIMEOUT'));
    assert.strictEqual(report.domains['a'].requests, 5);
    obs.close();
  });

  await test('rate limiter spaces requests and enforces concurrency', async () => {
    const limiter = new RateLimiter({ requestsPerSecond: 20 });
    const releaseA = await limiter.acquire('h');
    const start = Date.now();
    const releaseB = await limiter.acquire('h');
    assert.ok(Date.now() - start >= 40);
    releaseA();
    releaseB();

    const single = new RateLimiter({ concurrency: 1 });
    const r1 = await single.acquire('h');
    let done = false;
    const pending = single.acquire('h').then((release) => { done = true; return release; });
    await delay(30);
    assert.strictEqual(done, false);
    r1();
    const r2 = await pending;
    assert.strictEqual(done, true);
    r2();
  });

  await test('proxy rotator cycles, sticks and tracks failures', () => {
    const proxies = ['http://p1', 'http://p2', 'http://p3'];
    const rr = new ProxyRotator({ proxies, strategy: 'round-robin' });
    assert.strictEqual(rr.enabled, true);
    assert.strictEqual(rr.next('a'), 'http://p1');
    assert.strictEqual(rr.next('b'), 'http://p2');

    const sticky = new ProxyRotator({ proxies, strategy: 'sticky' });
    assert.strictEqual(sticky.next('a'), sticky.next('a'));

    const rand = new ProxyRotator({ proxies, strategy: 'random' });
    assert.ok(proxies.includes(rand.next('a')));

    rand.reportFailure('http://p1');
    rand.reportFailure('http://p1');
    rand.reportFailure('http://p1');
    assert.strictEqual(rand.stats().find((s) => s.proxy === 'http://p1').healthy, false);
    rand.reportSuccess('http://p1');
    assert.strictEqual(rand.stats().find((s) => s.proxy === 'http://p1').failures, 0);
  });

  await test('security guard blocks domains, ports and private addresses', async () => {
    await rejects(new SecurityGuard({ blockDomains: ['*.evil.com'] }).check('http://x.evil.com/'), 'SECURITY_BLOCKED');
    await rejects(new SecurityGuard({ allowDomains: ['*.good.com'] }).check('http://evil.com/'), 'SECURITY_BLOCKED');
    assert.strictEqual(await new SecurityGuard({ allowDomains: ['*.good.com'] }).check('http://x.good.com/'), true);
    await rejects(new SecurityGuard({ blockedPorts: [22] }).check('http://host:22/'), 'SECURITY_BLOCKED');
    await rejects(new SecurityGuard({ blockPrivateIPs: true }).check('http://127.0.0.1/'), 'SECURITY_BLOCKED');
    await rejects(new SecurityGuard({ blockPrivateIPs: true }).check('http://10.0.0.5/'), 'SECURITY_BLOCKED');
    assert.strictEqual(new SecurityGuard({}).enabled, false);
  });

  await test('session pool rotates and recycles sessions', () => {
    const pool = new SessionPool({ size: 2, strategy: 'least-used' });
    const s1 = pool.next();
    const s2 = pool.next();
    const s3 = pool.next();
    assert.strictEqual(s1.id, 0);
    assert.strictEqual(s2.id, 1);
    assert.strictEqual(s3.id, 0);
    assert.strictEqual(pool.stats().length, 2);

    const recycling = new SessionPool({ size: 1, recycleAfter: 1 });
    const session = recycling.next();
    assert.strictEqual(session.useCount, 0);
  });

  await test('auth manager refreshes once for concurrent 401s', async () => {
    let calls = 0;
    const auth = new AuthManager({
      token: 't1',
      refresh: async () => { calls += 1; await delay(30); return 't2'; },
    });
    assert.deepStrictEqual(auth.buildHeaders(), { Authorization: 'Bearer t1' });
    assert.strictEqual(auth.shouldRefresh(401), true);
    assert.strictEqual(auth.shouldRefresh(500), false);
    const [a, b] = await Promise.all([auth.refresh(), auth.refresh()]);
    assert.strictEqual(calls, 1);
    assert.strictEqual(a, 't2');
    assert.strictEqual(b, 't2');
    assert.strictEqual(auth.token, 't2');
  });

  await test('csrf handler extracts tokens and builds requests', () => {
    const csrf = new CsrfHandler({});
    assert.strictEqual(csrf.enabled, true);
    const $ = cheerio.load('<meta name="csrf-token" content="tok-1"><input name="_token" value="tok-2">');
    assert.strictEqual(csrf.extractFromHtml($), 'tok-1');

    const jar = new sengkrep.CookieJar();
    jar.setManual('example.com', 'XSRF-TOKEN', 'cookie-tok');
    assert.strictEqual(csrf.extractFromCookies(jar, 'example.com'), 'cookie-tok');

    assert.strictEqual(csrf.buildFormBody({ a: '1' }, 'tok'), 'a=1&_token=tok');
    assert.deepStrictEqual(csrf.buildHeaders('tok', { 'X-Extra': '1' }), { 'X-Extra': '1', 'X-CSRF-Token': 'tok' });
    assert.deepStrictEqual(csrf.buildHeaders(null, {}), {});
  });

  await test('distributed queue completes work and drops poisoned items', async () => {
    const queue = new DistributedQueue({ adapter: new MemoryAdapter(), maxItemRetries: 3, pollInterval: 5, emptyRetries: 2 });
    await queue.enqueue(['a', 'b', 'c']);
    const results = await queue.run(async (item) => item.toUpperCase(), { concurrency: 2 });
    assert.strictEqual(results.length, 3);
    assert.deepStrictEqual(results.map((r) => r.result).sort(), ['A', 'B', 'C']);
    assert.deepStrictEqual(await queue.size(), { queued: 0, locked: 0, done: 3 });

    const failing = new DistributedQueue({ adapter: new MemoryAdapter(), maxItemRetries: 3, pollInterval: 5, emptyRetries: 2 });
    await failing.enqueue(['poison']);
    const failed = await failing.run(async () => { throw new Error('boom'); }, { concurrency: 1 });
    assert.strictEqual(failed.length, 3);
    assert.strictEqual(failed[2].droppedAfterRetries, 3);
  });

  await test('har recorder captures requests through interceptors', async () => {
    const interceptors = new Interceptors();
    const har = new HarRecorder().attach(interceptors);
    await interceptors.request.run({ url: 'http://x/1', method: 'GET', headers: { a: 'b' } });
    await interceptors.response.run({ url: 'http://x/1', status: 200, headers: { 'content-type': 'text/plain' }, body: 'hi' });
    const log = har.toHAR().log;
    assert.strictEqual(log.entries.length, 1);
    assert.strictEqual(log.entries[0].response.status, 200);
    const file = path.join(TMP, 'out.har');
    har.save(file);
    assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).log.entries.length, 1);
    har.clear();
    assert.strictEqual(har.entries.length, 0);
  });

  await test('sengkrep saveHar writes a HAR file when enabled', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 }, har: true });
    await scraper.fetch(`${BASE}/html`);
    const file = path.join(TMP, 'scraper.har');
    scraper.saveHar(file);
    assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).log.entries.length, 1);

    const bare = sengkrep.create({ logLevel: 'error' });
    assert.throws(() => bare.saveHar(path.join(TMP, 'nope.har')), /HAR recording not enabled/);
  });

  await test('interceptors transform payloads and can be ejected', async () => {
    const interceptors = new Interceptors();
    const id = interceptors.request.use((config) => ({ ...config, tagged: true }));
    assert.strictEqual((await interceptors.request.run({ url: 'a' })).tagged, true);
    interceptors.request.eject(id);
    assert.strictEqual((await interceptors.request.run({ url: 'a' })).tagged, undefined);
  });

  await test('dns cache resolves and invalidates hostnames', async () => {
    const dns = new DnsCache({ ttl: 60000 });
    const address = await dns.lookup('localhost');
    assert.strictEqual(typeof address, 'string');
    assert.ok(dns.stats().some((s) => s.hostname === 'localhost'));
    dns.invalidate('localhost');
    assert.strictEqual(dns.stats().length, 0);
  });

  await test('webhooks fire without throwing on unreachable targets', async () => {
    const webhook = new Webhook({ onComplete: 'http://127.0.0.1:9/unreachable' });
    await webhook.fire('onComplete', { ok: true });
    await webhook.fire('missingEvent', { ok: true });
    assert.ok(true);
  });

  finish('03-reliability-modules');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
