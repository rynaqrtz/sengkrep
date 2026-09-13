const fs = require('fs');
const os = require('os');
const path = require('path');
const sengkrep = require('../index');
const Sink = require('../src/sinks/Sink');
const FileSink = require('../src/sinks/FileSink');
const { ready, closeAll } = require('./server');
const { test, rejects, assert, finish } = require('./harness');

const BASE = 'http://127.0.0.1:9911';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sengkrep-sinks-'));

class FlakySink extends Sink {
  constructor(options, failures) {
    super(options);
    this.failures = failures;
    this.attempts = 0;
    this.batches = [];
  }

  async _onBatch(batch) {
    this.attempts += 1;
    if (this.attempts <= this.failures) throw new Error('transient sink failure');
    this.batches.push(batch);
  }
}

async function main() {
  await ready;

  await test('memory sink batches on the batch size and reports stats', async () => {
    const sink = new sengkrep.MemorySink({ batchSize: 3 });

    assert.strictEqual(await sink.write({ id: 1 }), 1);
    assert.strictEqual(sink.size, 1);
    assert.strictEqual(await sink.write([{ id: 2 }, { id: 3 }]), 2);

    assert.strictEqual(sink.rows.length, 3);
    assert.strictEqual(sink.stats().written, 3);
    assert.strictEqual(sink.stats().batches, 1);
    assert.strictEqual(sink.stats().buffered, 0);
    assert.strictEqual(sink.length, 3);
  });

  await test('a key replaces the row that already holds it', async () => {
    const sink = new sengkrep.MemorySink({ key: 'id', batchSize: 100 });

    await sink.write([{ id: 1, name: 'first' }, { id: 2, name: 'other' }, { id: 1, name: 'second' }]);
    await sink.flush();

    assert.strictEqual(sink.rows.length, 2);
    assert.deepStrictEqual(sink.rows[0], { id: 1, name: 'second' });
    assert.strictEqual(sink.stats().duplicates, 1);
  });

  await test('without a key, or with replace off, every row is kept', async () => {
    const keyless = new sengkrep.MemorySink({});
    await keyless.write([{ id: 1 }, { id: 1 }]);
    await keyless.close();
    assert.strictEqual(keyless.rows.length, 2);

    const appending = new sengkrep.MemorySink({ key: 'id', replace: false });
    await appending.write([{ id: 1, name: 'a' }, { id: 1, name: 'b' }]);
    await appending.close();
    assert.strictEqual(appending.rows.length, 2);
    assert.strictEqual(appending.stats().duplicates, 0);
  });

  await test('a composite key tracks every column together', async () => {
    const sink = new sengkrep.MemorySink({ key: ['sku', 'locale'] });

    await sink.write([
      { sku: 'X', locale: 'id', price: 10 },
      { sku: 'X', locale: 'en', price: 20 },
      { sku: 'X', locale: 'id', price: 15 },
    ]);
    await sink.close();

    assert.strictEqual(sink.rows.length, 2);
    assert.strictEqual(sink.rows[0].price, 15);
    assert.strictEqual(sink.rows[1].price, 20);
  });

  await test('a row missing its key field is rejected', async () => {
    const sink = new sengkrep.MemorySink({ key: 'id' });

    await rejects(sink.write({ name: 'no id' }), /missing the key field "id"/);
    assert.strictEqual(sink.stats().written, 0);
  });

  await test('an empty flush is a no-op and close refuses later writes', async () => {
    const sink = new sengkrep.MemorySink({});

    assert.strictEqual(await sink.flush(), 0);
    await sink.write({ id: 1 });
    await sink.close();

    assert.strictEqual(sink.stats().closed, true);
    assert.strictEqual(sink.rows.length, 1);
    await rejects(sink.write({ id: 2 }), /already closed/);
  });

  await test('a failing batch is retried and then reported', async () => {
    const recovering = new FlakySink({ retries: 2, retryDelayMs: 1, batchSize: 1 }, 2);
    await recovering.write({ id: 1 });

    assert.strictEqual(recovering.attempts, 3);
    assert.strictEqual(recovering.batches.length, 1);
    assert.strictEqual(recovering.stats().written, 1);
    assert.strictEqual(recovering.stats().retried, 2);

    const broken = new FlakySink({ retries: 1, retryDelayMs: 1 }, 5);
    await broken.write({ id: 1 });

    await rejects(broken.flush(), /transient sink failure/);
    assert.strictEqual(broken.attempts, 2);
    assert.strictEqual(broken.stats().failed, 1);
  });

  await test('the transform runs before the key is built', async () => {
    const sink = new sengkrep.MemorySink({
      key: 'id',
      transform: (row) => ({ id: String(row.id).trim(), value: row.value ?? null }),
    });

    await sink.write([{ id: ' 7 ', value: 'a' }, { id: '7', value: 'b' }]);
    await sink.close();

    assert.strictEqual(sink.rows.length, 1);
    assert.deepStrictEqual(sink.rows[0], { id: '7', value: 'b' });
  });

  await test('the file sink upserts into a file it finds', async () => {
    const file = path.join(TMP, 'items.jsonl');

    const first = new sengkrep.FileSink(file, { key: 'id' });
    await first.write([{ id: 1, name: 'one' }, { id: 2, name: 'two' }]);
    await first.close();

    assert.deepStrictEqual(first.count(), 2);

    const second = new sengkrep.FileSink(file, { key: 'id' });
    await second.write([{ id: 2, name: 'two updated' }, { id: 3, name: 'three' }]);
    await second.close();

    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.strictEqual(lines.length, 3);
    assert.strictEqual(lines[1].name, 'two updated');
    assert.strictEqual(lines[2].id, 3);
    assert.strictEqual(second.stats().duplicates, 1);
  });

  await test('the file sink appends when replace is off', async () => {
    const file = path.join(TMP, 'append.jsonl');

    const first = new sengkrep.FileSink(file, { key: 'id', replace: false });
    await first.write([{ id: 1 }]);
    await first.close();
    assert.strictEqual(first.appendOnly, true);

    const second = new sengkrep.FileSink(file, { key: 'id', replace: false });
    await second.write([{ id: 1 }]);
    await second.close();

    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    assert.strictEqual(lines.length, 2);
    assert.strictEqual(second.count(), 1);
  });

  await test('the csv sink writes one header and upserts by key', async () => {
    const file = path.join(TMP, 'items.csv');

    const first = new sengkrep.FileSink(file, { key: 'id' });
    assert.strictEqual(first.format, 'csv');
    await first.write([{ id: 1, name: 'one' }, { id: 2, name: 'two' }]);
    await first.close();

    const second = new sengkrep.FileSink(file, { key: 'id' });
    await second.write([{ id: 2, name: 'two updated' }]);
    await second.close();

    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    assert.deepStrictEqual(lines, ['id,name', '1,one', '2,two updated']);
  });

  await test('the file sink rejects a bad format and a broken jsonl file', async () => {
    assert.throws(() => new FileSink(path.join(TMP, 'x.txt'), { format: 'xml' }), /Unknown file sink format/);
    assert.throws(() => new FileSink(), /requires a file path/);

    const file = path.join(TMP, 'broken.jsonl');
    fs.writeFileSync(file, '{"id":1}\nnot json\n');

    const sink = new sengkrep.FileSink(file, { key: 'id' });
    await sink.write({ id: 2 });
    await rejects(sink.flush(), /line 2/);
  });

  await test('postgres builds a parameterized upsert', async () => {
    const sink = new sengkrep.PostgresSink({ table: 'items', key: 'id', client: { query: async () => {} } });
    const statement = sink.buildStatement([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);

    assert.ok(statement.text.startsWith('INSERT INTO "items" ("id", "name") VALUES ($1, $2), ($3, $4)'));
    assert.ok(statement.text.endsWith('ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name"'));
    assert.deepStrictEqual(statement.values, [1, 'a', 2, 'b']);
  });

  await test('an all key row uses do nothing and no key means no conflict clause', () => {
    const keys = new sengkrep.PostgresSink({ table: 'items', key: 'id', client: { query: async () => {} } });
    assert.ok(keys.buildStatement([{ id: 1 }]).text.endsWith('ON CONFLICT ("id") DO NOTHING'));

    const plain = new sengkrep.PostgresSink({ table: 'items', client: { query: async () => {} } });
    assert.strictEqual(plain.buildStatement([{ id: 1 }]).text.includes('ON CONFLICT'), false);

    const appending = new sengkrep.PostgresSink({ table: 'items', key: 'id', replace: false, client: { query: async () => {} } });
    assert.strictEqual(appending.buildStatement([{ id: 1 }]).text.includes('ON CONFLICT'), false);
  });

  await test('postgres fills missing columns with null and uses a composite target', async () => {
    const calls = [];
    const sink = new sengkrep.PostgresSink({
      table: 'public.items',
      key: ['sku', 'locale'],
      client: { query: async (text, values) => calls.push({ text, values }) },
    });

    await sink.write([{ sku: 'X', locale: 'id', price: 10 }, { sku: 'X', locale: 'en', stock: 3 }]);
    await sink.close();

    assert.strictEqual(calls.length, 1);
    assert.ok(calls[0].text.startsWith('INSERT INTO "public"."items" ("sku", "locale", "price", "stock")'));
    assert.ok(calls[0].text.endsWith('ON CONFLICT ("sku", "locale") DO UPDATE SET "price" = EXCLUDED."price", "stock" = EXCLUDED."stock"'));
    assert.deepStrictEqual(calls[0].values, ['X', 'id', 10, null, 'X', 'en', null, 3]);
  });

  await test('mysql quotes with backticks and its own placeholders', async () => {
    const calls = [];
    const sink = new sengkrep.MySQLSink({
      table: 'items',
      key: 'id',
      client: { execute: async (text, values) => calls.push({ text, values }) },
    });

    await sink.write([{ id: 1, name: 'a' }]);
    await sink.close();

    assert.ok(calls[0].text.startsWith('INSERT INTO `items` (`id`, `name`) VALUES (?, ?)'));
    assert.ok(calls[0].text.endsWith('ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)'));
    assert.deepStrictEqual(calls[0].values, [1, 'a']);
  });

  await test('sql sinks require a table and a client', async () => {
    assert.throws(() => new sengkrep.PostgresSink({ client: { query: async () => {} } }), /requires a table/);
    assert.throws(() => new sengkrep.MySQLSink({}), /requires a table/);

    const sink = new sengkrep.PostgresSink({ table: 'items', client: {}, retries: 0 });
    await sink.write({ id: 1 });
    await rejects(sink.flush(), /query\(\) or execute\(\)/);
  });

  await test('a missing database driver explains how to install it', async () => {
    const sink = new sengkrep.PostgresSink({ table: 'items', driver: 'pg-not-installed-xyz', retries: 0 });
    await sink.write({ id: 1 });

    const error = await rejects(sink.flush(), (err) => err.code === 'MISSING_DRIVER');
    assert.strictEqual(error.driver, 'pg-not-installed-xyz');
    assert.ok(error.message.includes('npm install pg-not-installed-xyz'));
    assert.strictEqual(sink.stats().failed, 1);
  });

  await test('clickhouse inserts json each row and nulls missing columns', async () => {
    const inserts = [];
    const sink = new sengkrep.ClickHouseSink({
      table: 'items',
      key: 'id',
      client: { insert: async (payload) => inserts.push(payload) },
    });

    await sink.write([{ id: 1, name: 'a' }, { id: 2 }]);
    await sink.close();

    assert.strictEqual(inserts.length, 1);
    assert.strictEqual(inserts[0].table, 'items');
    assert.strictEqual(inserts[0].format, 'JSONEachRow');
    assert.deepStrictEqual(inserts[0].values, [{ id: 1, name: 'a' }, { id: 2, name: null }]);
  });

  await test('clickhouse falls back to query when insert is absent', async () => {
    const queries = [];
    const sink = new sengkrep.ClickHouseSink({
      table: 'items',
      key: 'id',
      client: { query: async (payload) => queries.push(payload) },
    });

    await sink.write({ id: 1, name: 'a' });
    await sink.close();

    assert.strictEqual(queries[0].query, 'INSERT INTO "items" ("id", "name") FORMAT JSONEachRow');
    assert.strictEqual(queries[0].format, 'JSONEachRow');
    assert.deepStrictEqual(queries[0].values, [{ id: 1, name: 'a' }]);
  });

  await test('s3 writes one object per key so a rerun overwrites it', async () => {
    const puts = [];
    const sink = new sengkrep.S3Sink({
      bucket: 'bucket',
      prefix: 'catalog',
      key: 'id',
      format: 'json',
      put: async (request) => puts.push(request),
    });

    await sink.write([{ id: 7, name: 'a' }, { id: 8, name: 'b' }]);
    await sink.close();

    assert.deepStrictEqual(puts.map((request) => request.key), ['catalog/id=7.json', 'catalog/id=8.json']);
    assert.strictEqual(puts[0].contentType, 'application/json');
    assert.strictEqual(puts[0].bucket, 'bucket');
    assert.strictEqual(JSON.parse(puts[0].body).name, 'a');

    const again = new sengkrep.S3Sink({ bucket: 'bucket', prefix: 'catalog', key: 'id', put: async (request) => puts.push(request) });
    await again.write({ id: 7, name: 'updated' });
    await again.close();

    assert.strictEqual(puts[2].key, 'catalog/id=7.json');
    assert.strictEqual(JSON.parse(puts[2].body).name, 'updated');
  });

  await test('s3 writes one object per batch when there is no key', async () => {
    const puts = [];
    const sink = new sengkrep.S3Sink({ bucket: 'bucket', prefix: 'runs', format: 'jsonl', put: async (request) => puts.push(request) });

    await sink.write([{ id: 1 }, { id: 2 }]);
    await sink.close();

    assert.strictEqual(puts.length, 1);
    assert.match(puts[0].key, /^runs\/batch-\d+-1\.jsonl$/);
    assert.strictEqual(puts[0].body, '{"id":1}\n{"id":2}');
    assert.strictEqual(puts[0].contentType, 'application/x-ndjson');
  });

  await test('s3 csv objects carry a header and s3 needs a bucket or a put', async () => {
    const puts = [];
    const sink = new sengkrep.S3Sink({ bucket: 'bucket', format: 'csv', put: async (request) => puts.push(request) });

    await sink.write([{ id: 1, name: 'a' }]);
    await sink.close();

    assert.strictEqual(puts[0].contentType, 'text/csv');
    assert.strictEqual(puts[0].body, 'id,name\n1,a');
    assert.match(puts[0].key, /\.csv$/);

    assert.throws(() => new sengkrep.S3Sink({}), /requires a bucket/);
    assert.throws(() => new sengkrep.S3Sink({ bucket: 'x', format: 'xml' }), /Unknown S3 object format/);
  });

  await test('createSink maps every descriptor type', async () => {
    assert.ok(sengkrep.createSink({ type: 'memory' }) instanceof sengkrep.MemorySink);
    assert.ok(sengkrep.createSink({ type: 'jsonl', path: path.join(TMP, 'factory.jsonl') }) instanceof sengkrep.FileSink);
    assert.strictEqual(sengkrep.createSink({ type: 'csv', path: path.join(TMP, 'factory.csv') }).format, 'csv');
    assert.ok(sengkrep.createSink({ type: 'postgres', table: 't' }) instanceof sengkrep.PostgresSink);
    assert.ok(sengkrep.createSink({ type: 'mysql', table: 't' }) instanceof sengkrep.MySQLSink);
    assert.ok(sengkrep.createSink({ type: 'clickhouse', table: 't' }) instanceof sengkrep.ClickHouseSink);
    assert.ok(sengkrep.createSink({ type: 's3', bucket: 'b' }) instanceof sengkrep.S3Sink);

    const existing = new sengkrep.MemorySink({});
    assert.strictEqual(sengkrep.createSink(existing), existing);
    assert.throws(() => sengkrep.createSink({ type: 'kafka' }), /Unknown sink type "kafka"/);
  });

  await test('batch writes every row to a sink it was handed', async () => {
    const sink = new sengkrep.MemorySink({ key: 'title', batchSize: 100 });
    const scraper = sengkrep.create({ logLevel: 'error' });

    const results = await scraper.batch([`${BASE}/html`, `${BASE}/crawl-a`], { title: 'h1' }, { sink, concurrency: 1 });

    assert.strictEqual(results.length, 2);
    assert.strictEqual(sink.rows.length, 2);
    assert.deepStrictEqual(sink.rows.map((row) => row.title).sort(), ['Hello Sengkrep', 'Page A']);
    assert.strictEqual(sink.stats().buffered, 0);
    assert.strictEqual(sink.stats().closed, false);

    scraper.close();
  });

  await test('batch creates and closes a sink it was given as a descriptor', async () => {
    const file = path.join(TMP, 'batch.jsonl');
    const scraper = sengkrep.create({ logLevel: 'error' });

    await scraper.batch([`${BASE}/html`], { title: 'h1' }, { sink: { type: 'jsonl', path: file, key: 'title' } });

    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0].title, 'Hello Sengkrep');

    scraper.close();
  });

  await test('stream flushes the sink even when the consumer stops early', async () => {
    const sink = new sengkrep.MemorySink({ key: 'title', batchSize: 1000 });
    const scraper = sengkrep.create({ logLevel: 'error' });

    for await (const result of scraper.stream([`${BASE}/html`, `${BASE}/json`], { title: 'h1' }, { sink, delay: 0 })) {
      assert.strictEqual(result.error, null);
      break;
    }

    assert.strictEqual(sink.rows.length, 1);
    assert.strictEqual(sink.stats().buffered, 0);

    scraper.close();
  });

  await test('export writes to the sink and still returns the content', async () => {
    const sink = new sengkrep.MemorySink({ key: 'title' });
    const scraper = sengkrep.create({ logLevel: 'error' });

    const csv = await scraper.export([`${BASE}/html`], { title: 'h1' }, { sink, format: 'csv' });

    assert.ok(csv.startsWith('title\n'));
    assert.strictEqual(sink.rows.length, 1);
    assert.strictEqual(sink.stats().closed, false);

    scraper.close();
  });

  await test('crawl writes each page to the sink', async () => {
    const sink = new sengkrep.MemorySink({ key: 'title', batchSize: 100 });
    const scraper = sengkrep.create({ logLevel: 'error' });

    const job = scraper.crawl({
      seed: `${BASE}/crawl-a`,
      schema: { title: 'h1' },
      follow: /\/crawl-/,
      maxUrls: 5,
      concurrency: 1,
      sink,
    });

    await job.start();

    const titles = sink.rows.map((row) => row.title).sort();
    assert.deepStrictEqual(titles, ['Page A', 'Page B', 'Page C', 'Page D']);
    assert.strictEqual(sink.stats().buffered, 0);
    assert.strictEqual(sink.stats().closed, false);

    scraper.close();
  });

  await test('the sink surface is exported from the package root', () => {
    assert.strictEqual(typeof sengkrep.Sink, 'function');
    assert.strictEqual(typeof sengkrep.MemorySink, 'function');
    assert.strictEqual(typeof sengkrep.FileSink, 'function');
    assert.strictEqual(typeof sengkrep.PostgresSink, 'function');
    assert.strictEqual(typeof sengkrep.MySQLSink, 'function');
    assert.strictEqual(typeof sengkrep.ClickHouseSink, 'function');
    assert.strictEqual(typeof sengkrep.S3Sink, 'function');
    assert.strictEqual(typeof sengkrep.createSink, 'function');
    assert.strictEqual(sengkrep.sinks.createSink, sengkrep.createSink);
  });

  finish('13-sinks');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
