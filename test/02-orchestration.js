const { ready, closeAll } = require('./server');
const { test, assert, finish } = require('./harness');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sengkrep = require('../index');

const BASE = 'http://127.0.0.1:9911';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sengkrep-orch-'));

async function main() {
  await ready;

  await test('create exposes every documented module and alias', async () => {
    const scraper = sengkrep.create({ logLevel: 'error' });
    for (const key of ['sessionPool', 'wordpress', 'graphql', 'formHandler', 'deduplicator', 'proxyRotator', 'rateLimiter', 'fingerprint', 'observability', 'interceptors', 'cookieJar', 'health', 'diff']) {
      assert.ok(scraper[key], `expected ${key} to be present`);
    }
    assert.strictEqual(scraper.cache, null);
    assert.strictEqual(scraper.circuitBreaker, null);
    assert.strictEqual(scraper.incremental, null);
    assert.strictEqual(scraper.auth, scraper.authManager);
    assert.strictEqual(scraper.diff, scraper.diffDetector);
    assert.strictEqual(scraper.csrf, scraper.csrfHandler);
    assert.strictEqual(scraper.security, scraper.securityGuard);
  });

  await test('extract attaches non-enumerable _sengkrep metadata', async () => {
    const scraper = sengkrep.create({
      logLevel: 'error',
      retry: { max: 0 },
      diff: { storageDir: path.join(TMP, 'meta-diff') },
      validate: { title: { required: true, minLength: 3 } },
    });
    const data = await scraper.extract(`${BASE}/html`, { title: 'h1' }, { strict: true });
    assert.strictEqual(data.title, 'Hello Sengkrep');
    assert.ok(data._sengkrep);
    assert.strictEqual(data._sengkrep.responseType, 'html');
    assert.strictEqual(data._sengkrep.validation.valid, true);
    assert.strictEqual(data._sengkrep.diff.firstRun, true);
    assert.ok(!Object.keys(data).includes('_sengkrep'));
    assert.ok(!JSON.stringify(data).includes('_sengkrep'));
  });

  await test('batch runs with concurrency and progress callbacks', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const seen = [];
    const results = await scraper.batch(
      [`${BASE}/html`, `${BASE}/items`, `${BASE}/fallback-html`],
      { h1: 'h1' },
      { concurrency: 2, delay: 10, onProgress: (done, total) => seen.push([done, total]) },
    );
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].url, `${BASE}/html`);
    assert.strictEqual(results[0].error, null);
    assert.deepStrictEqual(seen[seen.length - 1], [3, 3]);
  });

  await test('batch isolates failures per url', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const results = await scraper.batch(
      [`${BASE}/html`, `${BASE}/does-not-exist`],
      { h1: 'h1' },
      { concurrency: 2, delay: 10 },
    );
    assert.strictEqual(results[0].error, null);
    assert.strictEqual(results[1].data, null);
    assert.strictEqual(results[1].error.code, 'HTTP_ERROR');
  });

  await test('stream yields results as an async generator', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const urls = [`${BASE}/html`, `${BASE}/items`, `${BASE}/fallback-html`];
    const collected = [];
    for await (const item of scraper.stream(urls, { h1: 'h1' }, { concurrency: 2, delay: 10 })) {
      collected.push(item);
    }
    assert.strictEqual(collected.length, 3);
    assert.strictEqual(collected[0].url, urls[0]);
  });

  await test('paginate collects items and stops on duplicate pages', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const items = await scraper.paginate(
      `${BASE}/dup-page-1`,
      { nextSelector: 'auto', maxPages: 10, delayBetweenPages: 10 },
      { h1: 'h1' },
    );
    assert.deepStrictEqual(items.map((i) => i.h1), ['Item A', 'Item B']);
  });

  await test('paginate can disable duplicate detection', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const items = await scraper.paginate(
      `${BASE}/dup-page-1`,
      { nextSelector: 'auto', maxPages: 3, delayBetweenPages: 10, stopOnDuplicate: false },
      { h1: 'h1' },
    );
    assert.strictEqual(items.length, 3);
  });

  await test('login submits a csrf protected form', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const ok = await scraper.login(`${BASE}/csrf-login`, { user: 'me', password: 'secret' });
    assert.strictEqual(ok, true);
  });

  await test('submitForm parses and posts an arbitrary form', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const res = await scraper.submitForm(`${BASE}/simple-form`, 'form', { q: 'laptop' });
    assert.strictEqual(res.status, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.q, 'laptop');
    assert.strictEqual(body.token, 'form-tok-1');
  });

  await test('export serializes to json, csv, ndjson and markdown', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const schema = { items: ['.card .t'] };

    const json = await scraper.export(`${BASE}/items`, schema, { format: 'json' });
    assert.deepStrictEqual(JSON.parse(json)[0].items, ['Item One', 'Item Two']);

    const csv = await scraper.export(`${BASE}/items`, schema, { format: 'csv' });
    assert.ok(csv.startsWith('items'));

    const ndjson = await scraper.export(`${BASE}/items`, schema, { format: 'ndjson' });
    assert.ok(ndjson.includes('Item One'));

    const md = await scraper.export(`${BASE}/items`, schema, { format: 'markdown' });
    assert.ok(md.includes('| items |'));

    const file = path.join(TMP, 'out.json');
    await scraper.export(`${BASE}/items`, schema, { format: 'json', path: file });
    assert.ok(fs.existsSync(file));
  });

  await test('discover walks robots.txt into the sitemap', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const urls = await scraper.discover(BASE);
    assert.ok(urls.includes(`${BASE}/html`));
    assert.ok(urls.includes(`${BASE}/json`));
  });

  await test('isAllowed and getCrawlDelay read robots.txt', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    assert.strictEqual(await scraper.isAllowed(`${BASE}/private/secret`), false);
    assert.strictEqual(await scraper.isAllowed(`${BASE}/private/public-page`), true);
    assert.strictEqual(await scraper.getCrawlDelay(BASE), 2000);
  });

  await test('plugins mutate extracted data through hooks', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const logFile = path.join(TMP, 'log.jsonl');
    scraper.plugins.use(sengkrep.plugins.timestamp());
    scraper.plugins.use(sengkrep.plugins.fieldMapper({ title: 'heading' }));
    scraper.plugins.use(sengkrep.plugins.logToFile(logFile));

    const data = await scraper.extract(`${BASE}/html`, { title: 'h1' });
    assert.ok(data.scrapedAt);
    assert.ok(data.heading);
    assert.strictEqual(data.title, undefined);
    assert.ok(fs.readFileSync(logFile, 'utf8').includes('Hello Sengkrep'));
  });

  await test('cache short-circuits the network on the second call', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 }, cache: { ttl: 60 } });
    const first = await scraper.extract(`${BASE}/html`, { title: 'h1' });
    const second = await scraper.extract(`${BASE}/html`, { title: 'h1' });
    assert.strictEqual(first._sengkrep.cache.hit, false);
    assert.strictEqual(second._sengkrep.cache.hit, true);
    assert.strictEqual(second.title, 'Hello Sengkrep');
  });

  await test('incremental requests short-circuit on 304 Not Modified', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 }, incremental: true });
    const first = await scraper.extract(`${BASE}/etag`, { content: 'content' }, { responseType: 'json' });
    const second = await scraper.extract(`${BASE}/etag`, { content: 'content' }, { responseType: 'json' });
    assert.strictEqual(first.content, 'fresh data');
    assert.strictEqual(second.content, 'fresh data');
    scraper.incremental.clear();
    fs.rmSync('.sengkrep-incremental', { recursive: true, force: true });
  });

  await test('crawl follows links breadth-first', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const job = scraper.crawl({
      seed: `${BASE}/crawl-a`,
      schema: { h1: 'h1' },
      follow: /\/crawl/,
      maxUrls: 10,
      concurrency: 2,
    });
    const results = await job.start();
    assert.strictEqual(results.length, 4);
    assert.deepStrictEqual(job.stats().visited, 4);
  });

  await test('batch supports randomOrder and progressBar flags', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const results = await scraper.batch([`${BASE}/html`, `${BASE}/items`], { h1: 'h1' }, {
      concurrency: 1,
      delay: 10,
      randomOrder: true,
      progressBar: true,
    });
    assert.strictEqual(results.length, 2);
  });

  finish('02-orchestration');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
