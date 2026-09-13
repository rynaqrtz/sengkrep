const { ready, closeAll } = require('./server');
const { test, rejects, assert, finish } = require('./harness');
const sengkrep = require('../index');
const Retry = require('../src/core/Retry');
const { Extractor } = require('../src/core/Extractor');
const { tokenize, resolvePath } = require('../src/core/JsonExtractor');

const BASE = 'http://127.0.0.1:9911';

async function main() {
  await ready;

  await test('fetch returns status, headers and body', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const res = await scraper.fetch(`${BASE}/html`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Hello Sengkrep'));
    assert.strictEqual(res.binary, false);
    assert.strictEqual(res.fromCache, false);
  });

  await test('fetch merges query params and custom headers', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const res = await scraper.fetch(`${BASE}/echo-headers`, {
      params: { q: 'hello', page: 2 },
      request: { headers: { 'X-Test': 'abc' } },
    });
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.query.q, 'hello');
    assert.strictEqual(parsed.query.page, '2');
    assert.strictEqual(parsed.headers['x-test'], 'abc');
  });

  await test('decompresses gzip responses', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const res = await scraper.fetch(`${BASE}/gzip`);
    assert.ok(res.body.includes('gzipped content'));
  });

  await test('follows redirects to the final url', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const res = await scraper.fetch(`${BASE}/redirect`);
    assert.strictEqual(res.url, `${BASE}/html`);
    assert.ok(res.body.includes('Hello Sengkrep'));
  });

  await test('aborts redirect loops with TOO_MANY_REDIRECTS', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 }, maxRedirects: 3 });
    await rejects(scraper.fetch(`${BASE}/redirect-loop`), 'TOO_MANY_REDIRECTS');
  });

  await test('rejects http errors with status attached', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const err = await rejects(scraper.fetch(`${BASE}/does-not-exist`), 'HTTP_ERROR');
    assert.strictEqual(err.status, 404);
  });

  await test('times out slow responses', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 }, timeout: 200 });
    await rejects(scraper.fetch(`${BASE}/slow`), 'TIMEOUT');
  });

  await test('honors AbortSignal with CANCELED', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const controller = new AbortController();
    controller.abort();
    await rejects(scraper.fetch(`${BASE}/slow`, { request: { signal: controller.signal } }), 'CANCELED');
  });

  await test('captures and replays cookies across requests', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    await scraper.fetch(`${BASE}/setcookie`);
    const res = await scraper.fetch(`${BASE}/checkcookie`);
    const parsed = JSON.parse(res.body);
    assert.ok(parsed.cookie.includes('session=abc123'));
    assert.ok(parsed.cookie.includes('theme=dark'));
  });

  await test('extracts html fields with shorthand, multiple and attr', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const data = await scraper.extract(`${BASE}/items`, {
      items: ['.card .t'],
      ids: { selector: '.card', attr: 'data-id', multiple: true },
      html: { selector: '.card', type: 'html' },
    });
    assert.deepStrictEqual(data.items, ['Item One', 'Item Two']);
    assert.deepStrictEqual(data.ids, ['1', '2']);
    assert.ok(data.html.includes('Item One'));
  });

  await test('walks fallback selector chains and records the used selector', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const data = await scraper.extract(`${BASE}/fallback-html`, {
      title: { selector: ['.old-title', '.new-title-class'] },
      price: { selector: ['.price-v1', '.price-v2'] },
    });
    assert.strictEqual(data.title, 'Fallback Title');
    assert.strictEqual(data.price, 'Rp99.000');

    const extractor = new Extractor();
    const out = extractor.extract('<div class="b">ok</div>', { f: { selector: ['.a', '.b'] } });
    assert.strictEqual(out.health.f.selector, '.b');
    assert.deepStrictEqual(out.health.f.selectorsTried, ['.a', '.b']);
  });

  await test('throws ExtractionError for required html fields', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const err = await rejects(
      scraper.extract(`${BASE}/html`, { missing: { selector: '.nope', required: true } }),
      (e) => e.name === 'ExtractionError' && e.field === 'missing',
    );
    assert.ok(err.message.includes('Required field'));
  });

  await test('applies transform, default and pattern health flags', async () => {
    const extractor = new Extractor();
    const out = extractor.extract('<span class="p">  12.50  </span>', {
      price: { selector: '.p', transform: (v) => v.trim(), pattern: /^\d+\.\d{2}$/ },
      missing: { selector: '.absent', default: 'n/a' },
      bad: { selector: '.p', pattern: /^Rp/ },
    });
    assert.strictEqual(out.data.price, '12.50');
    assert.strictEqual(out.data.missing, 'n/a');
    assert.strictEqual(out.health.price.patternMismatch, undefined);
    assert.strictEqual(out.health.bad.patternMismatch, true);
  });

  await test('extracts json with wildcard, index and fallback paths', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const data = await scraper.extract(`${BASE}/json`, {
      name: 'data.user.name',
      first: 'data.items[0].title',
      titles: 'data.items[].title',
      fallback: { path: ['data.nope', 'data.user.name'] },
    });
    assert.strictEqual(data.name, 'qrtz');
    assert.strictEqual(data.first, 'A');
    assert.deepStrictEqual(data.titles, ['A', 'B']);
    assert.strictEqual(data.fallback, 'qrtz');
  });

  await test('auto-detects json bodies without a json content type', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const data = await scraper.extract(`${BASE}/json-no-ct`, { ok: 'ok', n: 'n' });
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.n, 42);
    assert.strictEqual(data._sengkrep.responseType, 'json');
  });

  await test('throws JsonExtractionError for required json fields', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const err = await rejects(
      scraper.extract(`${BASE}/json`, { missing: { path: 'data.nope', required: true } }, { responseType: 'json' }),
      (e) => e.name === 'JsonExtractionError' && e.field === 'missing',
    );
    assert.ok(err.message.includes('Required field'));
  });

  await test('tokenizes json paths with wildcards and indices', () => {
    const tokens = tokenize('a.b[0].c[]');
    assert.strictEqual(tokens.length, 3);
    assert.deepStrictEqual(tokens[1], { key: 'b', indices: [0] });
    assert.deepStrictEqual(tokens[2], { key: 'c', indices: [null] });
    const resolved = resolvePath({ a: { b: [{ c: [1, 2] }] } }, tokenize('a.b[0].c[]'));
    assert.deepStrictEqual(resolved, [1, 2]);
  });

  await test('honors Retry-After over the computed backoff', () => {
    const retry = new Retry({ jitter: false });
    const delayed = retry._delay({ status: 429, retryAfterMs: 1500 }, 1);
    assert.strictEqual(delayed.ms, 1500);
    assert.strictEqual(delayed.usedRetryAfter, true);
  });

  await test('caps Retry-After at maxRetryAfter', () => {
    const retry = new Retry({ jitter: false, maxRetryAfter: 1000 });
    assert.strictEqual(retry._delay({ status: 503, retryAfterMs: 90000 }, 1).ms, 1000);
  });

  await test('computes exponential backoff with status tuning', () => {
    const retry = new Retry({ jitter: false });
    assert.strictEqual(retry._delay({ status: 429 }, 1).ms, 5000);
    assert.strictEqual(retry._delay({ status: 429 }, 2).ms, 10000);
    assert.strictEqual(retry._delay({ status: 408 }, 1).ms, 1000);
  });

  await test('never retries canceled requests', () => {
    const retry = new Retry({ max: 5 });
    assert.strictEqual(retry._shouldRetry({ code: 'CANCELED' }, 1), false);
    assert.strictEqual(retry._shouldRetry({ code: 'TRUNCATED_RESPONSE' }, 1), true);
    assert.strictEqual(retry._shouldRetry({ code: 'NETWORK_ERROR' }, 1), true);
    assert.strictEqual(retry._shouldRetry({ status: 404 }, 1), false);
    assert.strictEqual(retry._shouldRetry({ status: 500 }, 99), false);
  });

  finish('01-fetcher-and-extraction');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
