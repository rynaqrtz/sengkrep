const { ready, closeAll } = require('./server');
const { test, assert, finish } = require('./harness');
const cheerio = require('cheerio');
const sengkrep = require('../index');
const { detectNextLink, detectFromUrlPattern, detectTotalPages } = require('../src/modules/PaginationDetector');
const { parseRobotsRules } = require('../src/modules/Discover');

const BASE = 'http://127.0.0.1:9911';

async function main() {
  await ready;

  await test('isAllowed honors disallow and allow directives', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    assert.strictEqual(await scraper.isAllowed(`${BASE}/private/secret`), false);
    assert.strictEqual(await scraper.isAllowed(`${BASE}/private/public-page`), true);
    assert.strictEqual(await scraper.isAllowed(`${BASE}/public-page`), true);
  });

  await test('isAllowed matches user-agent specific groups', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    assert.strictEqual(await scraper.isAllowed(`${BASE}/html`, 'badbot'), false);
    assert.strictEqual(await scraper.isAllowed(`${BASE}/html`, 'goodbot'), true);
    assert.strictEqual(await scraper.getCrawlDelay(BASE), 2000);
    assert.strictEqual(await scraper.getCrawlDelay(BASE, 'badbot'), null);
  });

  await test('crawl skips disallowed urls and reports them', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const job = scraper.crawl({
      seed: `${BASE}/private/secret`,
      schema: { h1: 'h1' },
      respectRobotsTxt: true,
      maxUrls: 5,
    });
    const errors = [];
    job.on('url:error', ({ error }) => errors.push(error));
    const results = await job.start();
    assert.strictEqual(results.length, 0);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].code, 'ROBOTS_DISALLOWED');
  });

  await test('crawl respects robots.txt while following allowed links', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const job = scraper.crawl({
      seed: `${BASE}/crawl-a`,
      schema: { h1: 'h1' },
      follow: /\/crawl/,
      respectRobotsTxt: true,
      maxUrls: 20,
      concurrency: 2,
    });
    const results = await job.start();
    assert.strictEqual(results.length, 4);
  });

  await test('robots rules parse into grouped directives', () => {
    const groups = parseRobotsRules('User-agent: *\nDisallow: /a\nAllow: /a/b\nCrawl-delay: 1.5\nUser-agent: bot\nDisallow: /\n');
    assert.strictEqual(groups.length, 2);
    assert.strictEqual(groups[0].rules.length, 2);
    assert.strictEqual(groups[0].crawlDelay, 1500);
    assert.deepStrictEqual(groups[1].agents, ['bot']);
  });

  await test('pagination detector resolves next links by rel, text and class', () => {
    const rel = detectNextLink(cheerio.load('<link rel="next" href="/n">'), 'http://x/p');
    assert.strictEqual(rel.url, 'http://x/n');
    assert.strictEqual(rel.method, 'rel');

    const text = detectNextLink(cheerio.load('<a href="/next">Next</a>'), 'http://x/p');
    assert.strictEqual(text.url, 'http://x/next');
    assert.strictEqual(text.method, 'text');

    const cls = detectNextLink(cheerio.load('<a class="pagination-next" href="/n2">go</a>'), 'http://x/p');
    assert.strictEqual(cls.method, 'class');
  });

  await test('pagination detector infers url patterns', () => {
    const param = detectFromUrlPattern('http://x/list?page=2');
    assert.strictEqual(param.method, 'url-param');
    assert.strictEqual(param.url, 'http://x/list?page=3');

    const path = detectFromUrlPattern('http://x/news/page/2');
    assert.strictEqual(path.method, 'url-path');
    assert.strictEqual(path.url, 'http://x/news/page/3');

    assert.strictEqual(detectFromUrlPattern('http://x/list'), null);
  });

  await test('detectTotalPages reads pagination widgets', () => {
    const $ = cheerio.load('<nav class="pagination"><a class="page-numbers">1</a><a class="page-numbers">2</a><a class="page-numbers">3</a><a class="next page-numbers">Next</a></nav>');
    assert.strictEqual(detectTotalPages($), 3);
    assert.strictEqual(detectTotalPages(cheerio.load('<div>none</div>')), 1);
  });

  await test('paginate stops when a repeated page is served', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const items = await scraper.paginate(
      `${BASE}/dup-page-1`,
      { nextSelector: 'auto', maxPages: 10, delayBetweenPages: 10 },
      { h1: 'h1' },
    );
    assert.deepStrictEqual(items.map((i) => i.h1), ['Item A', 'Item B']);
  });

  await test('paginate respects explicit next selectors', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const items = await scraper.paginate(
      `${BASE}/items`,
      { nextSelector: 'a.next-link', maxPages: 5, delayBetweenPages: 10 },
      { t: ['.t'] },
    );
    assert.strictEqual(items.length, 2);
    assert.deepStrictEqual(items[0].t, ['Item One', 'Item Two']);
    assert.deepStrictEqual(items[1].t, ['Item Three']);
  });

  await test('rate limit headers are surfaced on extract results', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const data = await scraper.extract(`${BASE}/rate-limited-api`, { ok: 'ok' });
    assert.strictEqual(data.ok, true);
    assert.deepStrictEqual(data._sengkrep.rateLimit, { limit: 100, remaining: 3, resetSeconds: 60 });
  });

  await test('disabling respectRetryAfter uses the computed backoff', () => {
    const Retry = require('../src/core/Retry');
    const retry = new Retry({ jitter: false, respectRetryAfter: false });
    const delayed = retry._delay({ status: 429, retryAfterMs: 1000 }, 1);
    assert.strictEqual(delayed.usedRetryAfter, false);
    assert.strictEqual(delayed.ms, 5000);
  });

  finish('06-robots-retry-pagination');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
