const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ready, closeAll } = require('./server');
const { test, assert, finish } = require('./harness');
const sengkrep = require('../index');
const { Browser, readResult } = require('../src/capture/Browser');
const { auto: autoOnCheerio, tableToObjects } = require('../src/modules/AutoExtract');

const BASE = 'http://127.0.0.1:9911';
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
        case 'Runtime.evaluate': {
          const expression = message.params?.expression ?? '';
          if (options.evaluate) return done({ result: { value: options.evaluate(expression) } });
          if (expression.includes('outerHTML')) return done({ result: { value: '<html><body><h1>Browser Page</h1></body></html>' } });
          if (expression.includes('innerText')) return done({ result: { value: 'Browser Page text' } });
          if (expression.includes('location.href')) return done({ result: { value: 'https://app.example.com/page' } });
          if (expression.includes('document.title')) return done({ result: { value: 'Browser Title' } });
          if (expression.includes('getBoundingClientRect')) return done({ result: { value: { clicked: true, x: 40, y: 60 } } });
          return done({ result: { value: null } });
        }
        case 'Page.navigate': {
          done({ frameId: 'FRAME-1' });
          setTimeout(() => {
            this.emit('message', { method: 'Page.loadEventFired', sessionId: SESSION_ID, params: {} });
          }, options.loadDelay ?? 5);
          return;
        }
        case 'Page.captureScreenshot':
          return done({ data: Buffer.from('fake-png').toString('base64') });
        case 'Page.printToPDF':
          return done({ data: Buffer.from('fake-pdf').toString('base64') });
        default:
          return done({});
      }
    },
  };
}

function browserOnClient(client, options = {}) {
  return new Browser({ connect: async () => client, debuggerUrl: 'ws://fake', idleMs: 1, ...options });
}

async function main() {
  await ready;

  await test('browser opens a target, navigates and reads the page', async () => {
    const client = fakeCdpClient();
    const browser = browserOnClient(client);

    await browser.goto('https://app.example.com/page');

    assert.ok(client.sent.includes('Target.createTarget'));
    assert.ok(client.sent.includes('Target.attachToTarget'));
    assert.ok(client.sent.includes('Page.navigate'));

    assert.strictEqual(await browser.html(), '<html><body><h1>Browser Page</h1></body></html>');
    assert.ok(client.sent.includes('Runtime.evaluate'));
    assert.strictEqual(await browser.text(), 'Browser Page text');
    assert.strictEqual(await browser.url(), 'https://app.example.com/page');
    assert.strictEqual(await browser.title(), 'Browser Title');

    browser.close();
  });

  await test('waitForSelector polls until the element appears', async () => {
    let present = false;
    const client = fakeCdpClient({
      evaluate: (expression) => {
        if (expression.includes('found')) return present ? { found: true, visible: true } : { found: false };
        return null;
      },
    });
    const browser = browserOnClient(client);

    const pending = browser.waitForSelector('.late-item', { pollMs: 10, timeout: 2000 });
    setTimeout(() => { present = true; }, 40);
    assert.strictEqual(await pending, true);

    browser.close();
  });

  await test('waitForSelector times out with a clear error', async () => {
    const client = fakeCdpClient({ evaluate: () => ({ found: false }) });
    const browser = browserOnClient(client);

    let caught = null;
    try {
      await browser.waitForSelector('.missing', { pollMs: 5, timeout: 60 });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught, 'expected a timeout');
    assert.strictEqual(caught.code, 'SELECTOR_TIMEOUT');
    assert.ok(caught.message.includes('.missing'));
    browser.close();
  });

  await test('click waits for the element and dispatches real mouse events', async () => {
    const client = fakeCdpClient({
      evaluate: (expression) => {
        if (expression.includes('getBoundingClientRect')) return { clicked: true, x: 40, y: 60 };
        return { found: true, visible: true };
      },
    });
    const browser = browserOnClient(client);

    await browser.click('#buy');

    assert.ok(client.sent.includes('Input.dispatchMouseEvent'));
    const pressed = client.sent.filter((method) => method === 'Input.dispatchMouseEvent').length;
    assert.ok(pressed >= 3, `expected move, press and release, got ${pressed}`);
    browser.close();
  });

  await test('type focuses the field, sends keys and fires input events', async () => {
    const client = fakeCdpClient({
      evaluate: (expression) => {
        if (expression.includes("field.value")) return 'typed value';
        return { found: true };
      },
    });
    const browser = browserOnClient(client);

    await browser.type('#search', 'kopi');

    const keyEvents = client.sent.filter((method) => method === 'Input.dispatchKeyEvent').length;
    assert.strictEqual(keyEvents, 8, 'expected a down and up pair per character');
    browser.close();
  });

  await test('screenshot and pdf return buffers', async () => {
    const client = fakeCdpClient();
    const browser = browserOnClient(client);
    await browser.open();

    const png = await browser.screenshot({ fullPage: true });
    const pdf = await browser.pdf();

    assert.ok(Buffer.isBuffer(png));
    assert.strictEqual(png.toString(), 'fake-png');
    assert.ok(Buffer.isBuffer(pdf));
    assert.strictEqual(pdf.toString(), 'fake-pdf');
    assert.ok(client.sent.includes('Page.captureScreenshot'));
    assert.ok(client.sent.includes('Page.printToPDF'));

    browser.close();
  });

  await test('viewport and userAgent overrides are applied on open', async () => {
    const client = fakeCdpClient();
    const browser = browserOnClient(client, { viewport: { width: 390, height: 844, mobile: true }, userAgent: 'TestAgent/1.0' });

    await browser.open();

    assert.ok(client.sent.includes('Emulation.setDeviceMetricsOverride'));
    assert.ok(client.sent.includes('Network.setUserAgentOverride'));
    browser.close();
  });

  await test('a closed browser refuses to open again', async () => {
    const client = fakeCdpClient();
    const browser = browserOnClient(client);
    await browser.open();
    browser.close();

    let caught = null;
    try {
      await browser.open();
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'expected the closed browser to throw');
    assert.ok(caught.message.includes('closed'));
  });

  await test('readResult unwraps CDP values and surfaces exceptions', () => {
    assert.strictEqual(readResult({ result: { type: 'string', value: 'x' } }), 'x');
    assert.strictEqual(readResult({ result: { type: 'number', value: 5 } }), 5);
    assert.strictEqual(readResult({ result: { type: 'undefined' } }), undefined);
    assert.strictEqual(readResult({ result: { subtype: 'null', value: null } }), null);
    assert.deepStrictEqual(readResult({ result: { type: 'object', value: { a: 1 } } }), { a: 1 });

    let caught = null;
    try {
      readResult({ exceptionDetails: { text: 'Uncaught', exception: { description: 'ReferenceError: nope' } } });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'expected an evaluation error');
    assert.strictEqual(caught.code, 'EVALUATION_FAILED');
    assert.ok(caught.message.includes('nope'));
  });

  await test('the sengkrep client can drive a browser through a renderer-style hook', async () => {
    const client = fakeCdpClient();
    const scraper = sengkrep.create({
      logLevel: 'error',
      renderer: async (url) => {
        const browser = browserOnClient(client);
        await browser.goto(url);
        const html = await browser.html();
        browser.close();
        return html;
      },
    });

    const result = await scraper.extract('https://app.example.com/page', { title: 'h1' }, { render: true });
    assert.strictEqual(result.title, 'Browser Page');
    assert.strictEqual(result._sengkrep.rendered, true);
    scraper.close();
  });

  await test('auto() reads the title, description and JSON-LD item', async () => {
    const client = sengkrep.create({ logLevel: 'error' });
    const result = await client.auto(`${BASE}/auto-page`);

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.title, 'Auto Shop');
    assert.strictEqual(result.description, 'Everything auto extracted');
    assert.strictEqual(result.item.name, 'Kopi Sengkrep');
    assert.strictEqual(result.item.offers.price, '45000');
    assert.ok(result.sources.includes('json-ld'));
    client.close();
  });

  await test('auto() finds repeating containers and tables', async () => {
    const client = sengkrep.create({ logLevel: 'error' });
    const result = await client.auto(`${BASE}/auto-page`, { text: false });

    assert.ok(result.items.length >= 4, `expected the four product cards, got ${result.items.length}`);
    assert.ok(result.items[0].title.startsWith('Kopi'));
    assert.ok(result.items[0].url.endsWith('/a') || result.items[0].url.includes('/a'));
    assert.ok(result.items[0].price.startsWith('1'));

    assert.ok(Array.isArray(result.tables));
    assert.ok(result.tables.length >= 2);
    assert.strictEqual(result.tables[0].size, '250g');
    assert.ok(result.sources.includes('tables'));
    client.close();
  });

  await test('auto() on plain HTML still returns the text', async () => {
    const client = sengkrep.create({ logLevel: 'error' });
    const result = await client.auto(`${BASE}/html`);

    assert.strictEqual(result.title, null);
    assert.strictEqual(result.item, null);
    assert.strictEqual(result.items.length, 0);
    assert.ok(result.text.includes('Hello Sengkrep'));
    client.close();
  });

  await test('the static auto() helper works on cheerio documents', () => {
    const $ = sengkrep.cheerio.load(`<html><head><title>T</title></head><body>
      <table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>
    </body></html>`);

    const result = autoOnCheerio($, { text: false });
    assert.strictEqual(result.title, 'T');
    assert.strictEqual(result.tables[0].a, '1');

    const rows = tableToObjects($, 'table');
    assert.strictEqual(rows[0].b, '2');
  });

  await test('the default export exposes auto()', async () => {
    assert.strictEqual(typeof sengkrep.auto, 'function');
    const result = await sengkrep.auto(`${BASE}/auto-page`, { text: false });
    assert.strictEqual(result.item.name, 'Kopi Sengkrep');
  });

  await test('the package loads through an ESM import', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sengkrep-esm-'));
    const file = path.join(dir, 'check.mjs');
    fs.writeFileSync(file, `
import sengkrep, { create, jsonPath, Browser, BlockDetector, auto, probe } from '${path.join(__dirname, '..').replace(/\\/g, '/')}/index.mjs';

const checks = {
  defaultIsObject: typeof sengkrep.create === 'function',
  create: typeof create === 'function',
  jsonPath: typeof jsonPath === 'function',
  jsonPathWorks: JSON.stringify(jsonPath({ a: [1, 2] }, '$.a[*]')) === '[1,2]',
  browser: typeof Browser === 'function',
  blockDetector: typeof BlockDetector === 'function',
  auto: typeof auto === 'function',
  probe: typeof probe === 'function',
};

if (Object.values(checks).some((value) => value !== true)) {
  console.error(JSON.stringify(checks));
  process.exit(1);
}
`);

    const result = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout: 30000 });
    assert.strictEqual(result.status, 0, `ESM check failed: ${result.stderr || result.stdout}`);
  });

  await test('the engines floor now requires node 22.5', () => {
    const pkg = require('../package.json');
    assert.strictEqual(pkg.engines.node, '>=22.5.0');
    assert.ok(pkg.exports['.'].import.endsWith('index.mjs'));
    assert.ok(pkg.exports['.'].require.endsWith('index.js'));
  });

  finish('17-browser-and-auto');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
