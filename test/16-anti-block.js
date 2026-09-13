const { ready, closeAll } = require('./server');
const { test, assert, finish } = require('./harness');
const sengkrep = require('../index');
const { BlockDetector, BlockError } = require('../src/modules/BlockDetector');
const { Identity, IdentityPool } = require('../src/modules/Identity');
const { query, isJsonPath } = require('../src/utils/jsonpath');

const BASE = 'http://127.0.0.1:9911';

function echoHeaders(client, path = '/echo-headers') {
  return client.fetch(`${BASE}${path}`).then((res) => JSON.parse(res.body).headers);
}

async function main() {
  await ready;

  await test('detects Cloudflare, DataDome, PerimeterX, Akamai and Imperva', () => {
    const detector = new BlockDetector();

    const cloudflare = detector.detect({
      status: 403,
      headers: { server: 'cloudflare', 'cf-ray': 'abc' },
      body: '<title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page"></script>',
    });
    assert.strictEqual(cloudflare.blocked, true);
    assert.strictEqual(cloudflare.vendor, 'cloudflare');
    assert.strictEqual(cloudflare.kind, 'challenge');
    assert.strictEqual(cloudflare.confidence, 'high');
    assert.ok(cloudflare.signals.includes('header:server'));

    const datadome = detector.detect({ status: 403, headers: { 'x-datadome': 'protected' }, body: 'datadome' });
    assert.strictEqual(datadome.vendor, 'datadome');

    const perimeterx = detector.detect({ status: 403, headers: {}, body: 'PerimeterX px-captcha' });
    assert.strictEqual(perimeterx.vendor, 'perimeterx');
    assert.strictEqual(perimeterx.kind, 'captcha');

    const akamai = detector.detect({ status: 403, headers: { 'akamai-grn': '0.1' }, body: 'Reference #18.abc' });
    assert.strictEqual(akamai.vendor, 'akamai');

    const imperva = detector.detect({ status: 403, headers: { 'x-iinfo': '1-2-3' }, body: '_Incapsula_Resource' });
    assert.strictEqual(imperva.vendor, 'imperva');
  });

  await test('leaves a normal page and a plain 404 alone', () => {
    const detector = new BlockDetector();

    assert.strictEqual(detector.detect({ status: 200, headers: {}, body: '<html><body>hello</body></html>' }).blocked, false);
    assert.strictEqual(detector.detect({ status: 404, headers: {}, body: 'not found' }).blocked, false);

    const plain = detector.detect({ status: 403, headers: {}, body: '' });
    assert.strictEqual(plain.blocked, false);
    assert.strictEqual(plain.kind, 'denied');
  });

  await test('classifies a CAPTCHA page and a generic rate limit', () => {
    const detector = new BlockDetector();

    const captcha = detector.detect({ status: 200, headers: {}, body: '<div class="g-recaptcha"></div>Verify you are human' });
    assert.strictEqual(captcha.blocked, true);
    assert.strictEqual(captcha.kind, 'captcha');
    assert.strictEqual(captcha.vendor, 'generic');

    const limited = detector.detect({ status: 429, headers: {}, body: 'Too Many Requests' });
    assert.strictEqual(limited.blocked, true);
    assert.strictEqual(limited.retryable, true);
  });

  await test('honors minConfidence and custom signatures', () => {
    const strict = new BlockDetector({ minConfidence: 'high' });
    const weak = strict.detect({ status: 200, headers: {}, body: 'Verify you are human' });
    assert.strictEqual(weak.blocked, false);
    assert.strictEqual(weak.confidence, 'low');

    const custom = new BlockDetector({ signatures: [{ id: 'acme', name: 'Acme WAF', kind: 'denied', headers: [{ name: 'x-acme-block' }] }] });
    const verdict = custom.detect({ status: 403, headers: { 'x-acme-block': '1' }, body: '' });
    assert.strictEqual(verdict.vendor, 'acme');
    assert.strictEqual(verdict.vendorName, 'Acme WAF');
  });

  await test('counts what it saw', () => {
    const detector = new BlockDetector();
    detector.detect({ status: 200, headers: {}, body: 'ok' });
    detector.detect({ status: 403, headers: { server: 'cloudflare' }, body: 'Just a moment...' });

    const stats = detector.stats();
    assert.strictEqual(stats.checked, 2);
    assert.strictEqual(stats.blocked, 1);
    assert.strictEqual(stats.byVendor.cloudflare, 1);
    detector.addSignature({ id: 'again', body: [{ label: 'x', pattern: /x/ }] });
    assert.strictEqual(detector.stats().checked, 2);
  });

  await test('BlockError carries the verdict', () => {
    const verdict = new BlockDetector().detect({ status: 403, headers: { server: 'cloudflare' }, body: 'Just a moment...' });
    const error = new BlockError(verdict, 'https://example.com');

    assert.strictEqual(error.code, 'BLOCKED');
    assert.strictEqual(error.vendor, 'cloudflare');
    assert.strictEqual(error.retryable, true);
    assert.strictEqual(error.url, 'https://example.com');
    assert.ok(error.message.includes('Cloudflare'));
  });

  await test('probe reports a bot wall without throwing, and exits the status alone', async () => {
    const client = sengkrep.create({ logLevel: 'error' });

    const normal = await client.probe(`${BASE}/html`);
    assert.strictEqual(normal.status, 200);
    assert.strictEqual(normal.blocked, false);

    const wall = await client.probe(`${BASE}/bot-wall`);
    assert.strictEqual(wall.status, 403);
    assert.strictEqual(wall.blocked, true);
    assert.strictEqual(wall.verdict.vendor, 'cloudflare');
    assert.strictEqual(wall.verdict.kind, 'challenge');

    const captcha = await client.probe(`${BASE}/captcha-wall`);
    assert.strictEqual(captcha.status, 200);
    assert.strictEqual(captcha.blocked, true);
    assert.strictEqual(captcha.verdict.kind, 'captcha');

    client.close();
  });

  await test('fetch still rejects a 403, and probe only survives it on purpose', async () => {
    const client = sengkrep.create({ logLevel: 'error' });

    let caught = null;
    try {
      await client.fetch(`${BASE}/bot-wall`);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'expected fetch to reject on 403');
    assert.strictEqual(caught.status, 403);

    const probed = await client.fetch(`${BASE}/bot-wall`, { request: { allowErrorStatus: true } });
    assert.strictEqual(probed.status, 403);
    assert.ok(probed.body.includes('Just a moment'));

    client.close();
  });

  await test('extract attaches the verdict in report mode', async () => {
    const client = sengkrep.create({ logLevel: 'error', blocks: true });

    const result = await client.extract(`${BASE}/bot-wall`, { title: 'title' }, { responseType: 'html' });
    assert.ok(result._sengkrep.block, 'expected block metadata');
    assert.strictEqual(result._sengkrep.block.vendor, 'cloudflare');

    client.close();
  });

  await test('a 404 is still an error when block detection is on', async () => {
    const client = sengkrep.create({ logLevel: 'error', blocks: true });

    let caught = null;
    try {
      await client.extract(`${BASE}/missing-page`, { title: 'h1' });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught, 'expected 404 to throw');
    assert.strictEqual(caught.status, 404);
    client.close();
  });

  await test('throw mode raises BlockError on the first block', async () => {
    const client = sengkrep.create({ logLevel: 'error', blocks: { mode: 'throw' } });

    let caught = null;
    try {
      await client.extract(`${BASE}/bot-wall`, { title: 'title' });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof BlockError, `expected BlockError, got ${caught && caught.name}`);
    assert.strictEqual(caught.vendor, 'cloudflare');
    assert.strictEqual(caught.retryable, true);
    client.close();
  });

  await test('retry mode tries again with a fresh identity', async () => {
    const retries = [];
    const client = sengkrep.create({
      logLevel: 'error',
      identity: { size: 4 },
      blocks: { mode: 'retry' },
      retry: { max: 1, onRetry: (info) => retries.push(info) },
    });

    let caught = null;
    try {
      await client.extract(`${BASE}/bot-wall`, { title: 'title' });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof BlockError, 'expected the block to survive the retries');
    assert.strictEqual(retries.length, 1);
    assert.strictEqual(retries[0].code, 'BLOCKED');
    assert.ok(client.identityPool.stats().rotations >= 1);
    client.close();
  });

  await test('an identity keeps one user agent per host and rotates on demand', async () => {
    const pool = new IdentityPool({ size: 6 });

    const first = pool.get('a.example');
    assert.strictEqual(pool.get('a.example').id, first.id);
    assert.notStrictEqual(pool.get('b.example').id === undefined, true);

    const rotated = pool.rotate('a.example');
    assert.notStrictEqual(rotated.id, first.id);
    assert.strictEqual(pool.get('a.example').id, rotated.id);

    const stats = pool.stats();
    assert.strictEqual(stats.size, 6);
    assert.strictEqual(stats.rotations, 1);
    assert.strictEqual(stats.active, 2);
  });

  await test('identity headers are coherent', () => {
    const identity = new IdentityPool({ size: 1 }).get('seed');
    const headers = identity.headers;

    assert.ok(headers['User-Agent'].includes('Mozilla/5.0'));
    assert.ok(headers['Accept-Language'].startsWith(identity.locale));
    assert.strictEqual(headers['Sec-CH-UA-Platform'], `"${identity.platform}"`);
    assert.ok(identity.timezone.length > 0);
    assert.ok(identity.viewport.width >= 390);
  });

  await test('round-robin and random rotations both return a pool member', () => {
    const roundRobin = new IdentityPool({ rotation: 'round-robin', size: 3 });
    const seen = new Set([roundRobin.get('1').id, roundRobin.get('2').id, roundRobin.get('3').id]);
    assert.strictEqual(seen.size, 3);

    const random = new IdentityPool({ rotation: 'random', size: 3 });
    const ids = new Set(random.list().map((identity) => identity.id));
    assert.ok(ids.has(random.get('x').id));
  });

  await test('setIdentity drives the request headers and getUA', async () => {
    const client = sengkrep.create({ logLevel: 'error' });
    const identity = client.identityPool === null ? new Identity({ userAgent: 'Mozilla/5.0 (Test) Test/1.0', locale: 'id-ID', platform: 'Linux' }) : null;

    client.fingerprint.setIdentity(identity);
    assert.strictEqual(client.fingerprint.getUA(), identity.userAgent);

    const headers = await echoHeaders(client);
    assert.strictEqual(headers['user-agent'], identity.userAgent);
    assert.ok(headers['accept-language'].startsWith('id-ID'));
    assert.strictEqual(headers['sec-ch-ua-platform'], '"Linux"');

    client.fingerprint.setIdentity(null);
    assert.notStrictEqual(client.fingerprint.getUA(), identity.userAgent);
    client.close();
  });

  await test('identity pool pairs with a proxy session', async () => {
    const client = sengkrep.create({
      logLevel: 'error',
      identity: { size: 4 },
      proxies: ['http://user-{session}:pass@proxy.invalid:8080'],
      proxyStrategy: 'sticky',
    });

    const identity = client.identityPool.get('127.0.0.1');
    const first = client.proxyRotator.next('127.0.0.1', { session: identity.id });
    const second = client.proxyRotator.next('127.0.0.1', { session: identity.id });

    assert.strictEqual(first, second);
    assert.ok(first.includes(identity.id));
    assert.ok(!first.includes('{session}'));
    client.close();
  });

  await test('proxy failures count against the template, not the session', () => {
    const rotator = new sengkrep.ProxyRotator({ proxies: ['http://u-{session}:p@proxy.invalid:8080'], strategy: 'sticky' });
    const resolved = rotator.next('host', { session: 'aa' });

    rotator.reportFailure(resolved);
    rotator.reportFailure(resolved);

    const stats = rotator.stats();
    assert.strictEqual(stats[0].failures, 2);
    assert.strictEqual(stats[0].healthy, true);
  });

  await test('jsonpath handles the common shapes', () => {
    const doc = {
      store: { book: [{ title: 'A', price: 10, author: { name: 'x' } }, { title: 'B', price: 20 }, { title: 'C', price: 30 }] },
      total: 3,
    };

    assert.deepStrictEqual(query(doc, '$.store.book[*].title'), ['A', 'B', 'C']);
    assert.deepStrictEqual(query(doc, '$.store.book[0].title'), ['A']);
    assert.deepStrictEqual(query(doc, '$.store.book[-1].title'), ['C']);
    assert.deepStrictEqual(query(doc, '$.store.book[0:2].title'), ['A', 'B']);
    assert.deepStrictEqual(query(doc, '$.store.book[0,2].title'), ['A', 'C']);
    assert.deepStrictEqual(query(doc, '$.store.book[?(@.price > 15)].title'), ['B', 'C']);
    assert.deepStrictEqual(query(doc, '$.total'), [3]);
    assert.deepStrictEqual(query(doc, '$.missing'), []);
    assert.deepStrictEqual(query(doc, '..name'), ['x']);
    assert.strictEqual(isJsonPath('$.a'), true);
    assert.strictEqual(isJsonPath('a.b'), false);
  });

  await test('a schema field accepts a jsonpath expression', () => {
    const body = JSON.stringify({ data: { items: [{ title: 'A', id: 1 }, { title: 'B', id: 2 }], user: { name: 'qrtz' } }, total: 2 });
    const client = sengkrep.create({ logLevel: 'error' });

    const wildcard = client.jsonExtractor.extract(body, { titles: '$.data.items[*].title', name: '$.data.user.name', total: '$.total' });
    assert.deepStrictEqual(wildcard.data.titles, ['A', 'B']);
    assert.strictEqual(wildcard.data.name, 'qrtz');
    assert.strictEqual(wildcard.data.total, 2);

    const filtered = client.jsonExtractor.extract(body, { picked: { jsonpath: '$.data.items[?(@.id == 2)].title' } });
    assert.deepStrictEqual(filtered.data.picked, ['B']);

    const legacy = client.jsonExtractor.extract(body, { items: 'data.items[].title' });
    assert.deepStrictEqual(legacy.data.items, ['A', 'B']);

    client.close();
  });

  await test('the exported jsonPath helper matches the internal engine', () => {
    assert.deepStrictEqual(sengkrep.jsonPath({ a: [{ b: 1 }, { b: 2 }] }, '$.a[*].b'), [1, 2]);
    assert.strictEqual(sengkrep.isJsonPath('$..b'), true);
    assert.strictEqual(typeof sengkrep.BlockDetector, 'function');
    assert.strictEqual(typeof sengkrep.IdentityPool, 'function');
    assert.strictEqual(sengkrep.errors.BlockError, BlockError);
  });

  finish('16-anti-block');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
