const { ready, closeAll } = require('./server');
const { test, rejects, assert, finish } = require('./harness');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cheerio = require('cheerio');
const sengkrep = require('../index');
const contentSafety = require('../src/utils/contentSafety');
const encodingUtils = require('../src/utils/encodingUtils');
const exporter = require('../src/utils/exporter');
const { parseFeed, parseCSV } = require('../src/utils/contentHandlers');
const { extractScripts, extractSourceMapUrl, beautify } = require('../src/utils/scriptExtractor');
const { normalizeUrl, extractLinks, UrlDeduplicator } = require('../src/utils/urlUtils');
const StreamWriter = require('../src/utils/streamWriter');
const Logger = require('../src/utils/logger');
const { parseRateLimitHeaders } = require('../src/utils/rateLimitHeaders');

const BASE = 'http://127.0.0.1:9911';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sengkrep-utils-'));

async function main() {
  const { httpsAvailable } = await ready;

  await test('content safety sniffs magic bytes', () => {
    assert.strictEqual(contentSafety.sniffContentType(Buffer.from('89504e470d0a1a0a', 'hex')), 'image/png');
    assert.strictEqual(contentSafety.sniffContentType(Buffer.from('%PDF-1.4', 'utf8')), 'application/pdf');
    assert.strictEqual(contentSafety.sniffContentType(Buffer.from([0x1f, 0x8b, 0x08])), 'application/gzip');
    assert.strictEqual(contentSafety.sniffContentType(Buffer.from('wOFF', 'utf8')), 'font/woff');
    assert.strictEqual(contentSafety.sniffContentType(Buffer.from('just text')), null);
  });

  await test('content safety detects binary data and charsets', () => {
    assert.strictEqual(contentSafety.isLikelyBinary(Buffer.from('plain ascii text')), false);
    assert.strictEqual(contentSafety.isLikelyBinary(Buffer.from([0x00, 0x01, 0x02, 0x03])), true);
    assert.strictEqual(contentSafety.detectCharsetFromContentType('text/html; charset=Shift_JIS'), 'shift_jis');
    assert.strictEqual(contentSafety.detectCharsetFromMeta('<meta charset="gbk">'), 'gbk');
    assert.strictEqual(contentSafety.detectBOM(Buffer.from([0xef, 0xbb, 0xbf, 0x41])), 'utf-8');
    assert.strictEqual(contentSafety.normalizeCharset('shift-jis'), 'shift_jis');
    assert.strictEqual(contentSafety.normalizeCharset('latin1'), 'iso-8859-1');
  });

  await test('content safety decodes buffers with charset precedence', () => {
    const ascii = contentSafety.decodeBuffer(Buffer.from('héllo', 'utf8'));
    assert.strictEqual(ascii.text, 'héllo');
    assert.strictEqual(ascii.charset, 'utf-8');
    assert.strictEqual(ascii.source, 'default');

    const declared = contentSafety.decodeBuffer(Buffer.from('abc'), { headerCharset: 'ISO-8859-1' });
    assert.strictEqual(declared.source, 'header');
    assert.strictEqual(declared.charset, 'iso-8859-1');

    const inspected = contentSafety.inspect(Buffer.from('%PDF-1.4'), 'application/pdf');
    assert.strictEqual(inspected.sniffedType, 'application/pdf');
    assert.strictEqual(inspected.isBinary, false);
    assert.strictEqual(inspected.size, 8);
  });

  await test('encoding utilities decode entities, escapes and payloads', () => {
    assert.strictEqual(encodingUtils.decodeHtmlEntities('&amp;&lt;&#65;&#x42;'), '&<AB');
    assert.strictEqual(encodingUtils.decodeUnicodeEscapes('\\u0041\\x42'), 'AB');
    assert.strictEqual(encodingUtils.decodeBase64('SGVsbG8='), 'Hello');
    assert.strictEqual(encodingUtils.decodeHex('48656c6c6f'), 'Hello');
    assert.strictEqual(encodingUtils.detectAndDecode('48656c6c6f').encoding, 'hex');
    assert.strictEqual(encodingUtils.detectAndDecode('SGVsbG8=').encoding, 'base64');
    assert.strictEqual(encodingUtils.detectAndDecode('plain text!').encoding, null);
    assert.strictEqual(encodingUtils.caesarDecode('uryyb', 13), 'hello');
    assert.strictEqual(encodingUtils.rot13('hello'), 'uryyb');
    assert.deepStrictEqual(encodingUtils.parseJSONP('cb({"a":1});'), { callback: 'cb', data: { a: 1 } });
    assert.strictEqual(encodingUtils.parseJSONP('not jsonp'), null);
    const xorred = encodingUtils.xorDecode('abc', 'k');
    assert.strictEqual(encodingUtils.xorDecode(xorred, 'k').toString(), 'abc');
  });

  await test('exporter serializes every format', () => {
    const rows = [{ a: 'x,y', b: 'q"z' }, { a: 1, b: null }];
    const csv = exporter.toCSV(rows);
    assert.ok(csv.startsWith('a,b'));
    assert.ok(csv.includes('"x,y"'));
    assert.ok(csv.includes('"q""z"'));

    assert.strictEqual(exporter.toJSON({ a: 1 }), '[\n  {\n    "a": 1\n  }\n]');
    assert.strictEqual(exporter.toNDJSON([{ a: 1 }, { a: 2 }]), '{"a":1}\n{"a":2}');
    const md = exporter.toMarkdownTable([{ a: 1, b: 2 }]);
    assert.ok(md.includes('| a | b |'));
    assert.ok(md.includes('| --- | --- |'));

    assert.throws(() => exporter.exportData([], { format: 'xml' }), /Unknown export format/);
    const file = path.join(TMP, 'data.csv');
    exporter.exportData(rows, { format: 'csv', path: file });
    assert.ok(fs.existsSync(file));
  });

  await test('content handlers parse rss and csv', () => {
    const rss = parseFeed('<?xml version="1.0"?><rss><channel><title>Feed</title><item><title>One</title><link>http://l/1</link></item></channel></rss>');
    assert.strictEqual(rss.type, 'rss');
    assert.strictEqual(rss.title, 'Feed');
    assert.strictEqual(rss.items[0].title, 'One');

    const atom = parseFeed('<?xml version="1.0"?><feed><title>Atom</title><entry><title>E1</title><link href="http://a/1"/></entry></feed>');
    assert.strictEqual(atom.type, 'atom');
    assert.strictEqual(atom.items[0].link, 'http://a/1');
    assert.strictEqual(parseFeed('<html></html>').type, 'unknown');

    const rows = parseCSV('name,price\n"Buku A",50000\n"Buku B, edisi 2",75000\n');
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[1].name, 'Buku B, edisi 2');
    assert.strictEqual(rows[1].price, '75000');
  });

  await test('extracts json-ld, microdata and data attributes', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const ld = await scraper.extractJsonLd(`${BASE}/structured`);
    assert.strictEqual(ld[0]['@type'], 'Product');

    const micro = await scraper.extractMicrodata(`${BASE}/structured`);
    assert.strictEqual(micro[0]['@type'], 'Person');
    assert.strictEqual(micro[0].name, 'Budi');
    assert.strictEqual(micro[0].jobTitle, 'Developer');

    const attrs = await scraper.extractDataAttributes(`${BASE}/structured`, '[data-product-id]');
    assert.deepStrictEqual(attrs[0], { productId: '42', inStock: 'true' });
  });

  await test('script extractor collects scripts and source maps', () => {
    const $ = cheerio.load('<script>var x = 1;</script><script src="/app.js"></script>');
    const scripts = extractScripts($, 'http://site/page');
    assert.strictEqual(scripts.length, 2);
    assert.strictEqual(scripts[0].inline, true);
    assert.strictEqual(scripts[1].src, 'http://site/app.js');
    assert.strictEqual(extractSourceMapUrl('var a=1;\n//# sourceMappingURL=app.js.map'), 'app.js.map');
    assert.strictEqual(extractSourceMapUrl('var a=1;'), null);
    assert.ok(beautify('function a(){return 1;}').includes('\n'));
  });

  await test('url utilities normalize, extract and deduplicate', () => {
    assert.strictEqual(normalizeUrl('HTTP://Example.com/a?b=2&a=1#x'), 'http://example.com/a?a=1&b=2');
    assert.strictEqual(normalizeUrl('http://example.com/path/?q=1', { stripTrailingSlash: true }), 'http://example.com/path?q=1');

    const $ = cheerio.load('<a href="/one">1</a><a href="javascript:void(0)">x</a><a href="http://other.com/two">2</a>');
    const links = extractLinks($, 'http://example.com/root');
    assert.ok(links.includes('http://example.com/one'));
    assert.ok(links.includes('http://other.com/two'));
    assert.strictEqual(links.length, 2);

    const same = extractLinks($, 'http://example.com/root', { sameOriginOnly: true });
    assert.deepStrictEqual(same, ['http://example.com/one']);

    const dedup = new UrlDeduplicator();
    assert.deepStrictEqual(dedup.filterNew(['http://a/', 'http://a/#x']), ['http://a/']);
    assert.strictEqual(dedup.isDuplicate('http://a/'), true);
    assert.strictEqual(dedup.size(), 1);
    dedup.clear();
    assert.strictEqual(dedup.size(), 0);
  });

  await test('stream writer emits csv and jsonl', async () => {
    const csvPath = path.join(TMP, 'stream.csv');
    const writer = new StreamWriter(csvPath, { format: 'csv' });
    writer.write({ a: 'x,y', b: 1 });
    writer.writeMany([{ a: 'z', b: 2 }]);
    assert.strictEqual(writer.count(), 2);
    await writer.close();
    const csv = fs.readFileSync(csvPath, 'utf8');
    assert.ok(csv.startsWith('a,b'));
    assert.ok(csv.includes('"x,y"'));

    const jsonlPath = path.join(TMP, 'stream.jsonl');
    const jsonl = new StreamWriter(jsonlPath, { format: 'jsonl' });
    jsonl.write({ a: 1 });
    await jsonl.close();
    assert.strictEqual(fs.readFileSync(jsonlPath, 'utf8').trim(), '{"a":1}');
  });

  await test('logger respects levels without throwing', () => {
    const logger = new Logger('error');
    logger.error('visible error line');
    logger.debug('suppressed debug line');
    const plain = new Logger('debug', false);
    plain.warn('plain warning');
    assert.ok(true);
  });

  await test('rate limit headers are parsed into numbers', () => {
    const info = parseRateLimitHeaders({ 'ratelimit-limit': '100', 'x-ratelimit-remaining': '3', 'ratelimit-reset': '60' });
    assert.deepStrictEqual(info, { limit: 100, remaining: 3, resetSeconds: 60 });
    assert.strictEqual(parseRateLimitHeaders({}), null);
  });

  await test('extract decodes shift-jis responses natively', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const data = await scraper.extract(`${BASE}/shift-jis`, { h1: 'h1' });
    assert.strictEqual(data.h1, 'こんにちは');
  });

  await test('extract rejects unsupported content encodings clearly', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    await rejects(scraper.fetch(`${BASE}/bogus-encoding`), 'UNSUPPORTED_ENCODING');
  });

  await test('large responses stream to disk instead of memory', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 }, maxMemoryBuffer: 64 * 1024 });
    const res = await scraper.fetch(`${BASE}/large-file`);
    assert.strictEqual(res.streamed, true);
    assert.ok(res.filePath);
    assert.strictEqual(fs.statSync(res.filePath).size, 12 * 1024 * 1024);
    fs.rmSync(res.filePath, { force: true });
  });

  await test('binary responses are detected and can be opted into', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const raw = await scraper.fetch(`${BASE}/binary-image`);
    assert.strictEqual(raw.binary, true);

    const err = await rejects(scraper.extract(`${BASE}/binary-image`, { a: 'a' }), 'BINARY_RESPONSE');
    assert.strictEqual(err.meta.sniffedType, 'image/png');

    const allowed = await scraper.extract(`${BASE}/binary-image`, { a: 'a' }, { allowBinary: true });
    assert.strictEqual(allowed.binary, true);
    assert.strictEqual(allowed.sniffedType, 'image/png');
  });

  await test('http2 option still serves plain http targets', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 }, http2: true });
    const res = await scraper.fetch(`${BASE}/html`);
    assert.ok(res.body.includes('Hello Sengkrep'));
  });

  await test('http2 falls back to http/1.1 on non-h2 tls servers', async () => {
    if (!httpsAvailable) {
      assert.ok(true);
      return;
    }
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 }, http2: true });
    const res = await scraper.fetch('https://127.0.0.1:9912/html', { request: { rejectUnauthorized: false } });
    assert.ok(res.body.includes('Hello Sengkrep'));
  });

  await test('wordpress helper uses the rest api and ajax nonces', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const detected = await scraper.wordpress.detect(BASE);
    assert.strictEqual(detected.isWordPress, false);

    const { data, total, totalPages } = await scraper.wordpress.restApi(BASE, 'wp/v2/posts');
    assert.strictEqual(total, 2);
    assert.strictEqual(totalPages, 1);
    assert.strictEqual(data.length, 2);

    const all = await scraper.wordpress.restApiAll(BASE, 'wp/v2/posts', { per_page: 100 });
    assert.strictEqual(all.length, 2);

    const page = await scraper.fetch(`${BASE}/wp-page`);
    assert.strictEqual(scraper.wordpress.extractNonce(page.body), 'wp-nonce-123');

    const ajax = await scraper.wordpress.ajaxAction(BASE, 'load_more', {}, { nonceFromPage: '/wp-page' });
    assert.strictEqual(ajax.success, true);
    assert.strictEqual(ajax.data.action, 'load_more');
  });

  await test('graphql client introspects and pages connections', async () => {
    const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
    const endpoint = `${BASE}/graphql`;

    const schema = await scraper.graphql.introspect(endpoint);
    assert.strictEqual(schema.queryType, 'Query');
    assert.strictEqual(schema.types.Product.fields[1].name, 'title');

    const data = await scraper.graphql.query(endpoint, 'query { products { edges { node { id } } } }');
    assert.strictEqual(data.products.edges.length, 2);

    const nodes = await scraper.graphql.queryAllPages(endpoint, 'query($first:Int!,$after:String){ products { edges { node { id } } } }', { connectionPath: 'products' });
    assert.deepStrictEqual(nodes.map((n) => n.id), ['1', '2']);

    assert.deepStrictEqual(scraper.graphql.flattenConnection({ edges: [{ node: { id: 1 } }, { node: { id: 2 } }] }), [{ id: 1 }, { id: 2 }]);
    assert.deepStrictEqual(scraper.graphql.flattenConnection({}), []);
  });

  await test('error classes are exported with stable codes', () => {
    const { errors } = sengkrep;
    assert.strictEqual(new errors.TimeoutError('x').code, 'TIMEOUT');
    assert.strictEqual(new errors.CanceledError('x').code, 'CANCELED');
    assert.strictEqual(new errors.FetchError('x', 500, 'HTTP_ERROR').status, 500);
    assert.strictEqual(new errors.SecurityError('x').code, 'SECURITY_BLOCKED');
    assert.strictEqual(new errors.CircuitOpenError('k', Date.now()).code, 'CIRCUIT_OPEN');
    assert.ok(new errors.ValidationError('x', []).errors);
  });

  finish('04-content-safety-and-utils');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
