const http = require('http');
const sengkrep = require('../index');
const { ready, closeAll } = require('./server');
const { test, rejects, assert, finish } = require('./harness');
const { SecurityGuard, classifyIP } = require('../src/modules/SecurityGuard');
const { CaptureProxy } = require('../src/capture/CaptureProxy');
const { buildRedirectPolicy, prepareRedirectHop } = require('../src/core/redirect');

const BASE = 'http://127.0.0.1:9911';

function scraper(options = {}) {
  return sengkrep.create({ logLevel: 'error', retry: { max: 0 }, ...options });
}

function request(proxy, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: proxy.address.host,
      port: proxy.address.port,
      method: 'POST',
      path,
      headers,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end('{"probe":true}');
  });
}

async function pinAddress(lookup) {
  return new Promise((resolve, reject) => {
    lookup('host.test', {}, (err, address) => (err ? reject(err) : resolve(address)));
  });
}

async function main() {
  await ready;

  await test('private ipv6 classification covers every ::ffff: form', () => {
    assert.strictEqual(classifyIP('::ffff:127.0.0.1'), 'loopback');
    assert.strictEqual(classifyIP('::ffff:7f00:1'), 'loopback');
    assert.strictEqual(classifyIP('::ffff:7f00:0001'), 'loopback');
    assert.strictEqual(classifyIP('::ffff:a00:1'), 'private-a');
    assert.strictEqual(classifyIP('::ffff:c0a8:1'), 'private-c');
    assert.strictEqual(classifyIP('::ffff:a9fe:1'), 'link-local');
    assert.strictEqual(classifyIP('::ffff:8.8.8.8'), null);
    assert.strictEqual(classifyIP('::ffff:808:808'), null);
    assert.strictEqual(classifyIP('::1'), 'loopback');
    assert.strictEqual(classifyIP('fe80::1'), 'link-local');
    assert.strictEqual(classifyIP('fd00::1'), 'unique-local');
    assert.strictEqual(classifyIP('2001:4860:4860::8888'), null);
  });

  await test('guard blocks a redirect hop that leaves the allowlist', async () => {
    const client = scraper({ security: { allowDomains: ['127.0.0.1'] } });

    await rejects(client.fetch(`${BASE}/redirect-to-localhost`), 'SECURITY_BLOCKED');
    assert.strictEqual(await client.security.check(`${BASE}/html`), true);
  });

  await test('guard still blocks the first url before any redirect', async () => {
    const client = scraper({ security: { allowDomains: ['example.com'] } });

    await rejects(client.fetch(`${BASE}/html`), 'SECURITY_BLOCKED');
    await rejects(client.fetch(`${BASE}/redirect-to-localhost`), 'SECURITY_BLOCKED');
  });

  await test('cross-origin redirect drops credentials by default', async () => {
    const client = scraper();
    const res = await client.fetch(`${BASE}/redirect-cross-origin`, {
      request: { headers: { Authorization: 'Bearer SECRET-XYZ', Cookie: 'manual=1' } },
    });
    const echoed = JSON.parse(res.body);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(echoed.authorization, null);
    assert.strictEqual(echoed.cookie, null);
  });

  await test('forwardSensitiveHeaders restores the old behaviour', async () => {
    const client = scraper({ redirectPolicy: { forwardSensitiveHeaders: true } });
    const res = await client.fetch(`${BASE}/redirect-cross-origin`, {
      request: { headers: { Authorization: 'Bearer SECRET-XYZ' } },
    });
    const echoed = JSON.parse(res.body);

    assert.strictEqual(echoed.authorization, 'Bearer SECRET-XYZ');
  });

  await test('redirect hop rebuilds the pinned lookup when the host changes', async () => {
    const policy = buildRedirectPolicy({});
    const originalPin = (host, options, callback) => callback(null, '1.2.3.4', 4);
    const seen = [];

    const config = {
      headers: { Authorization: 'Bearer x', Cookie: 'a=1', 'X-Keep': 'yes' },
      lookup: originalPin,
      onRedirect: async (next, meta) => {
        seen.push({ next, crossOrigin: meta.crossOrigin });
        return { address: '9.9.9.9', family: 4 };
      },
    };

    const cross = await prepareRedirectHop(config, policy, {
      url: 'http://a.test/one',
      next: 'http://b.test/two',
      statusCode: 302,
      hops: 0,
    });

    assert.strictEqual(cross.crossOrigin, true);
    assert.strictEqual(cross.hopConfig.headers.Authorization, undefined);
    assert.strictEqual(cross.hopConfig.headers.Cookie, undefined);
    assert.strictEqual(cross.hopConfig.headers['X-Keep'], 'yes');
    assert.strictEqual(await pinAddress(cross.hopConfig.lookup), '9.9.9.9');
    assert.deepStrictEqual(seen, [{ next: 'http://b.test/two', crossOrigin: true }]);

    const plainConfig = { headers: {}, lookup: originalPin };
    const same = await prepareRedirectHop(plainConfig, policy, {
      url: 'http://a.test/one',
      next: 'http://a.test/two',
      statusCode: 302,
      hops: 0,
    });

    assert.strictEqual(same.crossOrigin, false);
    assert.strictEqual(same.hopConfig, plainConfig);
    assert.strictEqual(same.hopConfig.lookup, originalPin);
  });

  await test('redirect hop clears the pin when the guard returns nothing', async () => {
    const policy = buildRedirectPolicy({});
    const originalPin = (host, options, callback) => callback(null, '1.2.3.4', 4);

    const { hopConfig } = await prepareRedirectHop({
      headers: {},
      lookup: originalPin,
      onRedirect: async () => null,
    }, policy, {
      url: 'http://a.test/one',
      next: 'http://b.test/two',
      statusCode: 301,
      hops: 0,
    });

    assert.strictEqual(hopConfig.lookup, undefined);
  });

  await test('302 turns a post into a bodyless get and 307 preserves it', async () => {
    const client = scraper();

    const downgraded = await client.fetch(`${BASE}/redirect-302-post`, {
      request: { method: 'POST', body: '{"a":1}' },
    });
    const afterPost = JSON.parse(downgraded.body);
    assert.strictEqual(afterPost.method, 'GET');
    assert.strictEqual(afterPost.body, '');

    const preserved = await client.fetch(`${BASE}/redirect-307-post`, {
      request: { method: 'POST', body: '{"a":1}' },
    });
    const after307 = JSON.parse(preserved.body);
    assert.strictEqual(after307.method, 'POST');
    assert.strictEqual(after307.body, '{"a":1}');
  });

  await test('cross-host redirect budget stops runaway chains', async () => {
    const client = scraper({ redirectPolicy: { maxCrossHostHops: 1 } });

    const err = await rejects(client.fetch(`${BASE}/redirect-cross-origin`), 'TOO_MANY_REDIRECTS');
    assert.ok(/cross-host/i.test(err.message));
  });

  await test('capture proxy strips proxy authorization before forwarding', async () => {
    const proxy = new CaptureProxy({});
    await proxy.start();

    const res = await request(proxy, `${BASE}/echo-request`, {
      'Proxy-Authorization': 'Basic c2VjcmV0LXByb3h5',
      'Content-Type': 'application/json',
    });
    const echoed = JSON.parse(res.body);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(echoed.proxyAuthorization, null);
    assert.strictEqual(echoed.method, 'POST');

    await proxy.stop();
  });

  await test('a plainly configured scraper keeps following redirects', async () => {
    const client = scraper();
    const res = await client.fetch(`${BASE}/redirect`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Hello Sengkrep'));
  });

  await test('guard constructor stays inert when nothing is configured', () => {
    assert.strictEqual(new SecurityGuard({}).enabled, false);
    assert.strictEqual(buildRedirectPolicy({}).validateEachHop, true);
    assert.strictEqual(buildRedirectPolicy({}).forwardSensitiveHeaders, false);
    assert.strictEqual(buildRedirectPolicy({}).maxCrossHostHops, 3);
  });

  finish('09-security-redirect');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
