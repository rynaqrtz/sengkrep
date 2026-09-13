const http = require('http');
const sengkrep = require('../index');
const { ready, closeAll } = require('./server');
const { test, assert, delay, finish } = require('./harness');
const SingleFlight = require('../src/modules/SingleFlight');
const Cache = require('../src/modules/Cache');

const BASE = 'http://127.0.0.1:9911';

const unhandled = [];
process.on('unhandledRejection', (err) => unhandled.push(err));

function client(options = {}) {
  return sengkrep.create({ logLevel: 'error', retry: { max: 0 }, ...options });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve(JSON.parse(raw)));
    });
    request.on('error', reject);
  });
}

async function resetCounter() {
  await getJson(`${BASE}/counter/reset`);
}

async function counterHits() {
  return (await getJson(`${BASE}/counter/read`)).count;
}

async function resetSwr() {
  await getJson(`${BASE}/swr/reset`);
}

async function main() {
  await ready;

  await test('single flight shares one call between concurrent callers', async () => {
    const flight = new SingleFlight({ enabled: true });
    let calls = 0;

    const work = () => new Promise((resolve) => setTimeout(() => {
      calls += 1;
      resolve('value');
    }, 20));

    const key = flight.key('GET', 'https://a.test/x');
    const results = await Promise.all(Array.from({ length: 20 }, () => flight.run(key, work)));

    assert.strictEqual(calls, 1);
    assert.deepStrictEqual([...new Set(results)], ['value']);
    assert.strictEqual(flight.stats().flights, 1);
    assert.strictEqual(flight.stats().joins, 19);
    assert.strictEqual(flight.size, 0);
  });

  await test('single flight keeps separate keys apart and clears after settling', async () => {
    const flight = new SingleFlight({ enabled: true });
    const calls = [];

    const run = (label, ms) => flight.run(flight.key('GET', label), () => new Promise((resolve) => {
      calls.push(label);
      setTimeout(() => resolve(label), ms);
    }));

    const [a, b] = await Promise.all([run('a', 10), run('b', 30)]);
    assert.strictEqual(a, 'a');
    assert.strictEqual(b, 'b');
    assert.deepStrictEqual(calls.sort(), ['a', 'b']);
    assert.strictEqual(flight.stats().flights, 2);
    assert.strictEqual(flight.stats().joins, 0);

    assert.strictEqual(flight.key('GET', 'https://a.test/x'), 'GET:https://a.test/x');
    assert.strictEqual(flight.key('post', 'https://a.test/x'), 'POST:https://a.test/x');
    assert.match(flight.key('POST', 'https://a.test/x', '{"a":1}'), /^POST:https:\/\/a\.test\/x:[0-9a-f]{16}$/);

    flight.clear();
    assert.strictEqual(flight.size, 0);
  });

  await test('single flight shares errors without an unhandled rejection', async () => {
    const flight = new SingleFlight({ enabled: true });
    let calls = 0;
    const boom = () => {
      calls += 1;
      return Promise.reject(new Error('nope'));
    };

    const key = 'GET:https://a.test/boom';
    const settled = await Promise.allSettled([flight.run(key, boom), flight.run(key, boom), flight.run(key, boom)]);

    assert.strictEqual(calls, 1);
    assert.ok(settled.every((item) => item.status === 'rejected'));
    assert.strictEqual(settled[1].reason.message, 'nope');
    assert.strictEqual(flight.stats().failures, 1);

    await delay(20);
    assert.deepStrictEqual(unhandled, []);
  });

  await test('single flight bypasses the map once maxKeys is reached', async () => {
    const flight = new SingleFlight({ enabled: true, maxKeys: 1 });
    let release;
    const held = new Promise((resolve) => { release = resolve; });

    const first = flight.run('a', () => held);
    const second = flight.run('b', () => Promise.resolve('b'));

    assert.strictEqual(await second, 'b');
    assert.strictEqual(flight.stats().bypassed, 1);

    release('a');
    assert.strictEqual(await first, 'a');
  });

  await test('parallel scrapes collapse into one outbound request', async () => {
    await resetCounter();
    const scraper = client({ singleFlight: true });

    const responses = await Promise.all(Array.from({ length: 50 }, () => scraper.fetch(`${BASE}/counter/slow`)));

    assert.strictEqual(await counterHits(), 1);
    assert.deepStrictEqual([...new Set(responses.map((res) => res.body))], ['{"count":1}']);
    assert.strictEqual(scraper.singleFlight.stats().flights, 1);
    assert.strictEqual(scraper.singleFlight.stats().joins, 49);
  });

  await test('single flight is off by default', async () => {
    await resetCounter();
    const scraper = client();

    await Promise.all(Array.from({ length: 5 }, () => scraper.fetch(`${BASE}/counter`)));

    assert.strictEqual(await counterHits(), 5);
    assert.strictEqual(scraper.singleFlight.enabled, false);
    assert.strictEqual(scraper.singleFlight.stats().flights, 0);
  });

  await test('identical post bodies share a flight but different bodies do not', async () => {
    await resetCounter();
    const scraper = client({ singleFlight: true });

    const same = await Promise.all([
      scraper.fetch(`${BASE}/counter`, { request: { method: 'POST', body: '{"page":1}' } }),
      scraper.fetch(`${BASE}/counter`, { request: { method: 'POST', body: '{"page":1}' } }),
    ]);
    assert.strictEqual(same[0].body, same[1].body);
    assert.strictEqual(await counterHits(), 1);

    await scraper.fetch(`${BASE}/counter`, { request: { method: 'POST', body: '{"page":2}' } });

    assert.strictEqual(await counterHits(), 2);
    assert.strictEqual(scraper.singleFlight.stats().flights, 2);
    assert.strictEqual(scraper.singleFlight.stats().joins, 1);
  });

  await test('cache lookup reports fresh, stale and expired entries', async () => {
    const cache = new Cache({ ttl: 0.05, staleTtl: 5, staleWhileRevalidate: true });

    cache.set('https://a.test/x', { v: 1 });
    assert.strictEqual(cache.lookup('https://a.test/x').stale, false);
    assert.strictEqual(cache.get('https://a.test/x').v, 1);

    await delay(80);
    const stale = cache.lookup('https://a.test/x');
    assert.strictEqual(stale.stale, true);
    assert.strictEqual(stale.data.v, 1);
    assert.ok(stale.age >= 50, `expected an age past the ttl, got ${stale.age}`);

    cache.set('https://a.test/y', { v: 2 });
    await delay(80);
    assert.strictEqual(cache.lookup('https://a.test/y').stale, true);

    const plain = new Cache({ ttl: 0.05 });
    plain.set('https://a.test/z', { v: 3 });
    await delay(80);
    assert.strictEqual(plain.lookup('https://a.test/z'), null);
    assert.strictEqual(plain.get('https://a.test/z'), null);

    const stats = cache.stats();
    assert.strictEqual(stats.stale, 2);
    assert.strictEqual(stats.misses, 0);
    assert.strictEqual(stats.hitRate, 100);

    assert.strictEqual(cache.beginRevalidate('https://a.test/x'), true);
    assert.strictEqual(cache.beginRevalidate('https://a.test/x'), false);
    assert.strictEqual(cache.isRevalidating('https://a.test/x'), true);
    cache.endRevalidate('https://a.test/x');
    assert.strictEqual(cache.isRevalidating('https://a.test/x'), false);
    assert.strictEqual(cache.stats().revalidations, 1);
    assert.strictEqual(cache.stats().revalidating, 0);
  });

  await test('a fresh cache hit does not touch the network', async () => {
    await resetCounter();
    const scraper = client({ cache: { ttl: 60 } });

    const first = await scraper.fetch(`${BASE}/counter`);
    const second = await scraper.fetch(`${BASE}/counter`);

    assert.strictEqual(first.fromCache, false);
    assert.strictEqual(second.fromCache, true);
    assert.strictEqual(second.stale, false);
    assert.strictEqual(second.body, first.body);
    assert.strictEqual(await counterHits(), 1);
  });

  await test('a stale hit is served immediately and revalidated in the background', async () => {
    await resetSwr();
    const scraper = client({ cache: { ttl: 0.05, staleWhileRevalidate: true, staleTtl: 30 } });

    const fresh = await scraper.fetch(`${BASE}/swr`);
    assert.strictEqual(fresh.fromCache, false);
    assert.deepStrictEqual(JSON.parse(fresh.body), { version: 1 });

    await delay(90);

    const stale = await scraper.fetch(`${BASE}/swr`);
    assert.strictEqual(stale.fromCache, true);
    assert.strictEqual(stale.stale, true);
    assert.deepStrictEqual(JSON.parse(stale.body), { version: 1 });

    assert.strictEqual(scraper.cache.stats().revalidations, 1);
    assert.strictEqual(await scraper.flush(), 1);

    const after = await scraper.fetch(`${BASE}/swr`);
    assert.strictEqual(after.fromCache, true);
    assert.strictEqual(after.stale, false);
    assert.deepStrictEqual(JSON.parse(after.body), { version: 2 });
  });

  await test('concurrent stale reads start only one revalidation', async () => {
    await resetSwr();
    const scraper = client({ cache: { ttl: 0.05, staleWhileRevalidate: true, staleTtl: 30 } });

    await scraper.fetch(`${BASE}/swr`);
    await delay(90);

    const responses = await Promise.all(Array.from({ length: 10 }, () => scraper.fetch(`${BASE}/swr`)));
    assert.ok(responses.every((res) => res.stale === true && res.fromCache === true));

    await scraper.flush();
    assert.strictEqual(scraper.cache.stats().revalidations, 1);

    const versions = await Promise.all([scraper.fetch(`${BASE}/swr`), scraper.fetch(`${BASE}/swr`)]);
    assert.deepStrictEqual(JSON.parse(versions[0].body), { version: 2 });
    assert.strictEqual(versions[0].stale, false);
  });

  await test('expired entries are a miss when staleWhileRevalidate is off', async () => {
    await resetSwr();
    const scraper = client({ cache: { ttl: 0.05 } });

    const first = await scraper.fetch(`${BASE}/swr`);
    assert.strictEqual(first.fromCache, false);

    await delay(90);

    const second = await scraper.fetch(`${BASE}/swr`);
    assert.strictEqual(second.fromCache, false);
    assert.strictEqual(second.stale, false);
    assert.deepStrictEqual(JSON.parse(second.body), { version: 2 });
    assert.strictEqual(scraper.cache.stats().revalidations, 0);
  });

  await test('a failed revalidation keeps the stale entry and stays quiet', async () => {
    await resetSwr();
    const scraper = client({ cache: { ttl: 0.05, staleWhileRevalidate: true, staleTtl: 30 } });

    const first = await scraper.fetch(`${BASE}/swr-flaky`);
    assert.strictEqual(first.status, 200);

    await delay(90);

    const stale = await scraper.fetch(`${BASE}/swr-flaky`);
    assert.strictEqual(stale.stale, true);
    await scraper.flush();

    const stillThere = await scraper.fetch(`${BASE}/swr-flaky`);
    assert.strictEqual(stillThere.stale, true);
    assert.deepStrictEqual(JSON.parse(stillThere.body), { version: 1 });

    await scraper.flush();
    await delay(30);
    assert.deepStrictEqual(unhandled, []);
  });

  await test('flush resolves to zero when nothing is pending', async () => {
    const scraper = client({ cache: { ttl: 60, staleWhileRevalidate: true, staleTtl: 30 } });
    assert.strictEqual(await scraper.flush(), 0);
    scraper.close();
  });

  await test('single flight and the cache work together without extra requests', async () => {
    await resetCounter();
    const scraper = client({ singleFlight: true, cache: { ttl: 0.05, staleWhileRevalidate: true, staleTtl: 30 } });

    const burst = await Promise.all(Array.from({ length: 25 }, () => scraper.fetch(`${BASE}/counter/slow`)));
    assert.ok(burst.every((res) => res.body === '{"count":1}'));

    await delay(90);

    const stale = await Promise.all(Array.from({ length: 25 }, () => scraper.fetch(`${BASE}/counter/slow`)));
    assert.ok(stale.every((res) => res.stale === true));

    await scraper.flush();
    assert.strictEqual(scraper.cache.stats().revalidations, 1);
    assert.strictEqual(await counterHits(), 2);
  });

  await test('single flight is exported with the documented defaults', () => {
    assert.strictEqual(typeof sengkrep.SingleFlight, 'function');
    assert.strictEqual(new sengkrep.SingleFlight(true).enabled, true);
    assert.strictEqual(new sengkrep.SingleFlight().enabled, false);
    assert.strictEqual(sengkrep.create({ logLevel: 'error' }).singleFlight.enabled, false);
  });

  finish('11-single-flight-and-cache');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
