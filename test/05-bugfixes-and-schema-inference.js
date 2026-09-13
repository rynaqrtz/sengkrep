const { ready, closeAll } = require('./server');
const { test, rejects, assert, finish } = require('./harness');
const cheerio = require('cheerio');
const sengkrep = require('../index');
const { inferSchema, inferFields, detectRepeatingContainers, buildSelector } = require('../src/modules/SchemaInference');
const { Extractor } = require('../src/core/Extractor');
const HarRecorder = require('../src/modules/HarRecorder');
const { SecurityGuard } = require('../src/modules/SecurityGuard');
const { version } = require('../package.json');

const BASE = 'http://127.0.0.1:9911';

const LIST_HTML = `<html><body>
  <div class="card"><h2 class="t">A</h2><span class="price">Rp1</span></div>
  <div class="card"><h2 class="t">B</h2><span class="price">Rp2</span></div>
  <div class="card"><h2 class="t">C</h2><span class="price">Rp3</span></div>
</body></html>`;

async function main() {
  await ready;

  await test('inferSchema detects repeating lists with the default root', () => {
    const $ = cheerio.load(LIST_HTML);
    const result = inferSchema($, {});
    assert.strictEqual(result.type, 'list');
    assert.strictEqual(result.container, 'div.card');
    assert.strictEqual(result.itemCount, 3);
    assert.strictEqual(result.schema.title.selector, 'h2.t');
    assert.strictEqual(result.schema.price.selector, 'span.price');
    assert.ok(result.sample.title);
  });

  await test('inferSchema honors hints and forces single analysis', () => {
    const $ = cheerio.load(LIST_HTML);
    const hinted = inferSchema($, { hints: ['title'] });
    assert.deepStrictEqual(Object.keys(hinted.schema), ['title']);

    const single = inferSchema($, { list: false, hints: ['title'] });
    assert.strictEqual(single.type, 'single');
  });

  await test('inference helpers expose containers and selectors', () => {
    const $ = cheerio.load(LIST_HTML);
    const containers = detectRepeatingContainers($, $.root().get(0));
    assert.ok(containers.some((c) => c.selector === 'div.card' && c.count === 3));

    const fields = inferFields($, $('div.card').first().get(0), ['title', 'price']);
    assert.ok(fields.title);
    assert.ok(fields.price);
    assert.strictEqual(buildSelector({ tag: 'div', className: 'a b', id: 'x' }), '#x');
    assert.strictEqual(buildSelector({ tag: 'div', className: 'a b', id: '' }), 'div.a');
    assert.strictEqual(buildSelector({ tag: 'p', className: '', id: '' }), 'p');
  });

  await test('inferSchema works end to end through the scraper', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });

    const list = await scraper.inferSchema(`${BASE}/inference-list`);
    assert.strictEqual(list.type, 'list');
    assert.strictEqual(list.itemCount, 3);
    assert.strictEqual(list.schema.title.selector, 'h2.product-title');

    const data = await scraper.extract(`${BASE}/inference-list`, list.schema);
    assert.strictEqual(data.title, 'Sepatu Lari');
    assert.strictEqual(data.price, 'Rp450.000');

    const single = await scraper.inferSchema(`${BASE}/inference-single`);
    assert.strictEqual(single.type, 'single');
    assert.ok(single.schema.title);
  });

  await test('required extraction errors name every attempted selector', () => {
    const extractor = new Extractor();
    try {
      extractor.extract('<div class="x">v</div>', { field: { selector: ['.a', '.b'], required: true } });
      assert.fail('expected an ExtractionError');
    } catch (err) {
      assert.strictEqual(err.name, 'ExtractionError');
      assert.ok(err.message.includes('".a"'));
      assert.ok(err.message.includes('".b"'));
    }
  });

  await test('cookie jar keeps ip hosts in separate buckets', () => {
    const jar = new sengkrep.CookieJar();
    jar.setManual('127.0.0.1', 'session', 'abc');
    assert.strictEqual(jar.getAll('127.0.0.1').length, 1);
    assert.strictEqual(jar.getAll('10.0.0.1').length, 0);
    jar.setManual('10.0.0.1', 'other', 'xyz');
    assert.strictEqual(jar.getCookieHeader('127.0.0.1'), 'session=abc');
    assert.strictEqual(jar.getCookieHeader('10.0.0.1'), 'other=xyz');
  });

  await test('security guard activates for port-only configuration', async () => {
    const guard = new SecurityGuard({ blockedPorts: [22, 6379] });
    assert.strictEqual(guard.enabled, true);
    await rejects(guard.check('http://host:6379/'), 'SECURITY_BLOCKED');
    assert.strictEqual(await guard.check('http://host:8080/'), true);
    assert.strictEqual(new SecurityGuard({}).enabled, false);
  });

  await test('crawl results stay unique via the deduplicator', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const job = scraper.crawl({ seed: `${BASE}/crawl-a`, schema: { h1: 'h1' }, follow: /\/crawl/, maxUrls: 20, concurrency: 2 });
    const results = await job.start();
    const urls = results.map((r) => r.url);
    assert.strictEqual(urls.length, 4);
    assert.strictEqual(new Set(urls).size, 4);
  });

  await test('truncated responses surface as TRUNCATED_RESPONSE', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    await rejects(scraper.fetch(`${BASE}/truncated`), 'TRUNCATED_RESPONSE');
  });

  await test('truncated responses are retried automatically', async () => {
    const seen = [];
    const scraper = sengkrep.create({
      logLevel: 'error',
      retry: { max: 1, jitter: false, onRetry: (info) => seen.push(info) },
    });
    await rejects(scraper.fetch(`${BASE}/truncated`), 'TRUNCATED_RESPONSE');
    assert.strictEqual(seen.length, 1);
    assert.strictEqual(seen[0].code, 'TRUNCATED_RESPONSE');
  });

  await test('retry-after headers drive the wait time', async () => {
    const seen = [];
    const scraper = sengkrep.create({
      logLevel: 'error',
      retry: { max: 1, respectRetryAfter: true, onRetry: (info) => seen.push(info) },
    });
    const err = await rejects(scraper.fetch(`${BASE}/retry-after-seconds`), 'HTTP_ERROR');
    assert.strictEqual(err.status, 429);
    assert.strictEqual(seen.length, 1);
    assert.strictEqual(seen[0].respectedRetryAfter, true);
    assert.strictEqual(seen[0].waitMs, 1000);
  });

  await test('transient 503 responses recover through retries', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 3 } });
    const res = await scraper.fetch(`${BASE}/flaky`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(JSON.parse(res.body).attempt, 3);
  });

  await test('distributedQueue factory wires any adapter', () => {
    const scraper = sengkrep.create({ logLevel: 'error' });
    const queue = scraper.distributedQueue({ maxItemRetries: 5 });
    assert.ok(queue);
    assert.strictEqual(typeof queue.enqueue, 'function');
    assert.strictEqual(typeof queue.run, 'function');
  });

  await test('har creator version tracks the package version', () => {
    assert.strictEqual(new HarRecorder().toHAR().log.creator.version, version);
  });

  await test('top level exports cover the public surface', () => {
    for (const key of ['inferFields', 'detectRepeatingContainers', 'UrlDeduplicator', 'StreamWriter', 'PaginationDetector', 'MemoryAdapter', 'DistributedQueue', 'extractJsonLd', 'normalizeUrl', 'contentSafety', 'errors', 'plugins']) {
      assert.ok(sengkrep[key], `expected sengkrep.${key} to be exported`);
    }
  });

  finish('05-bugfixes-and-schema-inference');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
