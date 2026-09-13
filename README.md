<div align="center">

<a href="https://i.postimg.cc/0ykVqtwd/sengkrep-ryna.gif">
  <img src="https://i.postimg.cc/0ykVqtwd/sengkrep-ryna.gif" alt="sengkrep" width="100%" />
</a>

<h1>sengkrep</h1>

<p>A reliability layer for web scraping in Node.js.</p>

[![npm version](https://img.shields.io/npm/v/sengkrep?color=black&style=flat-square)](https://www.npmjs.com/package/sengkrep)
[![node](https://img.shields.io/badge/node-%3E%3D20.18.1-black?style=flat-square)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-1-black?style=flat-square)](./package.json)
[![tests](https://img.shields.io/badge/tests-271-black?style=flat-square)](./test)
[![license](https://img.shields.io/npm/l/sengkrep?color=black&style=flat-square)](./LICENSE)

</div>

## Contents

- [What this is](#what-this-is)
- [Install](#install)
- [Quick start](#quick-start)
- [Three ways to read a page](#three-ways-to-read-a-page)
- [Step by step](#step-by-step)
- [Scheduling](#scheduling)
- [Data sinks](#data-sinks)
- [Network capture](#network-capture)
- [Core API](#core-api)
- [Schema syntax](#schema-syntax)
- [Modules](#modules)
- [Configuration](#configuration)
- [Validation rules](#validation-rules)
- [Plugins](#plugins)
- [Property naming](#property-naming)
- [Errors](#errors)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)
- [API reference](./docs/api/README.md)
- [Version history](#version-history)
- [Architecture](#architecture)
- [Behavior notes](#behavior-notes)
- [License](#license)

## What this is

`sengkrep` sits between your scraper and the network. Requests leave through Node's built-in `http`, `https` and `http2` modules, HTML is parsed with cheerio, and the library adds the parts a scraper needs once it runs for longer than a few minutes.

- retries with backoff that honor `Retry-After`
- a circuit breaker per host
- response caching, conditional requests and single-flight request sharing
- selector health monitoring, so a layout change shows up before your data goes empty
- diff detection between runs against the same URL
- rate limiting and adaptive throttling per host
- proxy rotation, cookie jar, session pool, CSRF handling, token refresh
- resumable crawling, a distributed queue, and three storage backends
- a scheduler with persistent job state, so a cadence survives a restart
- data sinks with upsert by key, to Postgres, MySQL, ClickHouse, S3, a file or memory
- network capture, so you can find the API behind a page without opening DevTools
- TypeScript definitions for the full public surface

The only runtime dependency is cheerio. Everything else is Node built-ins, including the DevTools Protocol client and its WebSocket.

Every exported interface, class, type and function is listed in the [API reference](./docs/api/README.md), which is generated from `index.d.ts` and checked in CI.

## Install

```bash
npm install sengkrep
```

Node 20.18.1 or newer. That floor comes from the cheerio dependency, which pulls `undici`, which needs 20.18.1. Node 22.5 or newer additionally enables the `sqlite` storage backend through `node:sqlite`.

The package was published as `sengkrep-ryna` up to 3.4.0. That name is deprecated and receives no updates.

## Quick start

```js
const sengkrep = require('sengkrep');

const data = await sengkrep.extract('https://example.com/product/1', {
  title: 'h1',
  price: { selector: '.price', transform: (v) => parseFloat(v.replace(/[^0-9.]/g, '')) },
  stock: { selector: '.stock', default: 'unknown' },
});

console.log(data.title, data.price);
console.log(data._sengkrep.health, data._sengkrep.diff);
```

With your own configured instance:

```js
const scraper = sengkrep.create({
  retry: { max: 3 },
  circuitBreaker: { threshold: 5, cooldown: 60000 },
  cache: { ttl: 300, storage: 'memory' },
  rateLimit: { requestsPerSecond: 2 },
});

const page = await scraper.fetch('https://example.com');
const rows = await scraper.batch(['https://example.com/a', 'https://example.com/b'], { title: 'h1' });

await scraper.close();
```

## Three ways to read a page

A page can hand you its data in three different shapes, and they need three different approaches. Pick the cheapest one that works.

| | 1. Plain HTTP | 2. DevTools Protocol | 3. Playwright |
|---|---|---|---|
| What it needs | nothing | a Chrome you already run | `npm i playwright` yourself |
| Bundled with sengkrep | yes | yes | no, by design |
| Sees server-rendered HTML | yes | yes | yes |
| Sees HTML built by JavaScript | no | yes | yes |
| Sees JSON the page fetches | yes, if you call the API directly | yes, through network capture | yes, through network capture |
| Speeds | fastest | middle | slowest |
| Memory | lowest | middle | highest |

Most sites can be handled with option 1, either by scraping the HTML or by calling the JSON API the page itself uses. Reach for option 2 when the HTML only exists after JavaScript runs. Option 3 is for when Playwright is already in your project and you would rather reuse it than run Chrome yourself.

### 1. Plain HTTP

```js
const data = await sengkrep.extract('https://example.com/items', { title: 'h2.title' });
```

If the page calls a JSON API, capture that call once (see [Network capture](#network-capture)) and then hit the endpoint directly. This is the fastest and most stable option, because the response is data rather than markup.

### 2. DevTools Protocol, no extra install

`sengkrep.renderers.cdp()` returns a renderer backed by the DevTools Protocol. Start Chrome with the debugging port open, then let sengkrep ask it for the rendered HTML.

```bash
chrome --headless=new --remote-debugging-port=9222 https://app.example.com
```

```js
const scraper = sengkrep.create({
  renderer: sengkrep.renderers.cdp({
    host: 'http://127.0.0.1:9222',
    waitForSelector: '#app',
  }),
  render: true,
});

const data = await scraper.extract('https://app.example.com/dashboard', { title: 'h1' });
```

| Option | Default | Notes |
|---|---|---|
| `host` | `http://127.0.0.1:9222` | DevTools endpoint |
| `idleMs` | `400` | Quiet time after load before reading the DOM |
| `waitForSelector` | `null` | Poll until the selector exists, then continue |
| `waitForSelectorTimeout` | `10000` | How long to keep polling before failing |
| `expression` | `document.documentElement.outerHTML` | What to evaluate, returned as a string |
| `includeMeta` | `false` | Return `{ html, url, title, readyState, consoleMsgs }` instead of a string |
| `bodies`, `timeout`, `debuggerUrl`, `connect` | same as `CdpCapture` | Browsers that need custom connection handling can pass `connect` and `debuggerUrl` |

### 3. Playwright, when it is already installed

Playwright is never bundled, and nothing breaks if it is missing. `PlaywrightCapture` requires the module at call time and fails with a clear message when it is absent. It drives capture on its own, and it becomes a renderer through a two-line adapter, since a renderer is any function that returns an HTML string or an object with an `html` property.

```js
const capture = new sengkrep.PlaywrightCapture({ headless: true });

const scraper = sengkrep.create({
  renderer: async (url) => {
    const { html } = await capture.capture(url, { html: true });
    return html;
  },
  render: true,
});
```

`capture()` launches its own browser, waits for `networkidle` by default, returns the recorded entries alongside the HTML, and closes the browser again. Set `waitUntil` or `timeout` in the options when a site needs something different.

```bash
sengkrep capture playwright https://app.example.com --out session.har
sengkrep capture playwright https://app.example.com --headless=false
```

## Step by step

The sections below go from a single request to a long-running job. Each one works on its own.

### 1. Get the raw response

```js
const res = await scraper.fetch('https://example.com');
console.log(res.status, res.headers['content-type'], res.body.length);
```

The return value is `{ status, headers, url, body, binary, streamed, filePath, fromCache, notModified }`. Nothing is parsed. Use it when you want the bytes, a status code, or a response you plan to handle yourself.

### 2. Extract with a schema

```js
const data = await scraper.extract('https://books.toscrape.com', {
  title: { selector: 'h1', required: true },
  price: { selector: '.price_color', transform: (v) => parseFloat(v.replace(/[^0-9.]/g, '')) },
  tags: { selector: '.tag', multiple: true },
});
```

The response type is detected from the content. HTML uses CSS selectors, JSON uses path expressions, and RSS, Atom and CSV are parsed for you.

### 3. Run many URLs

```js
const results = await scraper.batch(urls, { title: 'h1' }, { concurrency: 5 });

for await (const { url, data, error } of scraper.stream(urls, { title: 'h1' })) {
  if (!error) await save(data);
}
```

`batch()` returns `[{ url, data, error }]` in the order you passed the URLs. `stream()` is the same work as an async generator, so you can save each result while the rest are still running.

### 4. Follow pagination

```js
const pages = await scraper.paginate(
  'https://example.com/items',
  { nextSelector: 'auto', itemsSelector: '.product', maxPages: 10, delayBetweenPages: 1200 },
  { title: 'h2', price: '.price' },
);
```

`nextSelector: 'auto'` looks for `rel="next"`, common link text, common class names and numeric URL increments. Set `stopOnDuplicate: false` if a site legitimately repeats content across pages.

### 5. Crawl a site

```js
const job = scraper.crawl({
  seed: 'https://example.com',
  schema: { title: 'h1' },
  follow: /\/article\//,
  maxUrls: 5000,
  concurrency: 3,
  stateFile: './crawl-state.json',
});

job.on('url:done', ({ url }) => console.log(url));
await job.start();
```

With `stateFile` the queue lives on disk, so a killed process resumes with `job.resume()` instead of starting over. `respectRobotsTxt: true` skips disallowed paths.

### 6. Export what you collected

```js
const csv = await scraper.export(urls, { title: 'h1', price: '.price' }, {
  format: 'csv',
  path: './out.csv',
  pagination: { nextSelector: 'auto', itemsSelector: '.product', maxPages: 5 },
});
```

Formats are `csv`, `json`, `ndjson` and `markdown`. For result sets too large for memory, `StreamWriter` writes CSV or JSONL to disk as it goes, and `Storage`, `MemoryStorage` and `SqliteStorage` provide a keyed backend behind one `createStorage()` factory.

### 7. Turn on the reliability you need

```js
const scraper = sengkrep.create({
  retry: { max: 3, respectRetryAfter: true },
  rateLimit: { requestsPerSecond: 2, concurrency: 4 },
  circuitBreaker: { threshold: 5, cooldown: 60000 },
  cache: { ttl: 300, staleWhileRevalidate: true, staleTtl: 120 },
  singleFlight: true,
  adaptive: true,
  dedupContent: true,
  health: { alertThreshold: 0.5, onAlert: (report) => console.warn(report) },
});
```

`singleFlight: true` merges identical in-flight requests, so fifty parallel calls for the same URL become one request and forty-nine waiters on its result. `cache.staleWhileRevalidate` serves a stale entry immediately and refreshes it in the background; `await scraper.flush()` waits for those background refreshes to finish. A cached response carries `fromCache: true`, and a stale one also carries `stale: true`.

### 8. Schedule the work

`.start()` runs a crawl once. When a job needs to run on a cadence and survive a restart, hand it to the scheduler.

```js
const scheduler = scraper.scheduler;

scheduler.add({ id: 'catalog', schedule: '0 3 * * *' }, async () => {
  const rows = await scraper.batch(catalogUrls, { title: 'h1', price: '.price' });
  await save(rows);
});

scheduler.on('run:error', ({ job, error }) => console.error(job.id, error.message));
await scheduler.start();
```

The schedule and the last run are on disk, so after a restart `start()` picks the jobs back up. Details in [Scheduling](#scheduling).

### 9. Send the rows somewhere

```js
const sink = sengkrep.createSink({ type: 'postgres', table: 'items', key: 'id' });

await scraper.batch(urls, { id: '.sku', name: 'h1', price: '.price' }, { sink });
await sink.close();
```

Rows are written as they arrive, a row that carries an existing key replaces the stored one, and one failing batch is retried before it is reported. That is what the next section covers.

### 10. Close the scraper

```js
await scraper.close();
```

A scraper holds keep-alive sockets and, when `observability.enabled` is set, a metrics server. Without `close()` a finished script hangs. Scripts generated by `capture.toScript()` already call it.

## Scheduling

A scraper that runs once is a script. A scraper that runs on a cadence needs to know what is due, what already ran, and what to do about a run that was missed while the process was down. `Scheduler` and `JobStore` handle that, and both sit on top of the same storage backends as the cache.

```js
const scraper = sengkrep.create({
  logLevel: 'info',
  scheduler: {
    backend: 'file',
    storageDir: '.sengkrep-jobs',
    concurrency: 2,
    catchUp: false,
    jobs: [
      { id: 'catalog', schedule: '*/15 * * * *', handler: (job) => syncCatalog(job.data) },
      { id: 'report', schedule: { every: '6h' }, handler: () => buildReport() },
      { id: 'cleanup', schedule: { at: '2026-10-01T00:00:00Z' }, handler: () => dropTemp() },
    ],
  },
});

await scraper.scheduler.start();
```

The same jobs can be registered after the fact, which is how you keep a handler that needs the scraper itself.

```js
const scheduler = scraper.scheduler ?? sengkrep.create({ scheduler: true }).scheduler;

scheduler.add({ id: 'catalog', schedule: '*/15 * * * *', data: { origin: 'https://example.com' } }, async (job, own) => {
  const rows = await scraper.batch(urlsFor(job.data.origin), { title: 'h1' });
  return rows.length;
});
```

### Schedules

| Form | Example | Meaning |
|---|---|---|
| Cron | `'0 3 * * *'` | Five fields: minute, hour, day of month, month, day of week. UTC |
| Interval | `{ every: '30s' }` | `ms`, `s`, `m`, `h` or `d`. Also `{ everyMs: 30000 }` or `{ ms: 30000 }` |
| One shot | `{ at: '2026-10-01T00:00:00Z' }` | Runs once, then disables itself |

Cron fields accept `*`, a value, a range, a list, a step, or a name for months and weekdays: `*/5`, `9-17`, `0,30`, `9-17/2`, `jan-mar`, `mon-fri`. When both day fields are restricted, a day matches either one, which is what cron does. An expression that cannot match anything, like `*/0 * * * *` or `0 25 * * *`, throws when the job is added rather than failing silently later.

An interval keeps its alignment to the last run and skips missed slots instead of firing a burst to catch up.

### Restarts and missed runs

Every change is written to the job store, so a restart does not lose the schedule. What happens to a run that was due while the process was down depends on `catchUp`.

| `catchUp` | Behaviour at `start()` |
|---|---|
| `false` (default) | The missed run is skipped, `missed` goes up by one, and the next slot is computed from now |
| `true` | The job runs once as soon as the scheduler ticks, then returns to its normal cadence |

A missed run never turns into several runs. If the process was down for a week with a daily job, `catchUp: true` runs it once.

### Running jobs

A job whose next slot arrives while it is still running is skipped, and `stats().skipped` counts it. That is the whole overlap policy: one instance of a job at a time. `concurrency` limits how many different jobs run in parallel.

| Call | Result |
|---|---|
| `scheduler.add(job, handler)` | Register or update a job, returns the stored record |
| `scheduler.list()` | Every record, ordered by the next run |
| `scheduler.get(id)` | One record, or `null` |
| `scheduler.runNow(id)` | Run a job immediately, ignoring its schedule |
| `scheduler.pause(id)` / `resume(id)` | Disable a job, or enable it with a fresh next run |
| `scheduler.remove(id)` | Drop the record and its handler |
| `scheduler.tick()` | Process everything that is due, returns how many jobs started |
| `scheduler.start()` / `stop()` | Run the timer, or clear it. `stop()` waits for running jobs unless `{ wait: false }` |
| `scheduler.stats()` | `ticks`, `runs`, `errors`, `skipped`, `jobs`, `enabled`, `running`, `started` |

`tick()` is public on purpose: a test or a custom trigger can drive the schedule without waiting on a timer.

Events are `run` (`{ job, result }`), `run:error` (`{ job, error }`), `tick` (`{ at, started }`), `start` and `stop`.

### What a job record holds

```js
{
  id: 'catalog',
  name: 'catalog',
  schedule: '*/15 * * * *',
  enabled: true,
  data: null,
  nextRunAt: 1789000000000,
  lastRunAt: '2026-09-13T03:15:00.042Z',
  lastStatus: 'ok',
  lastError: null,
  lastDurationMs: 1840,
  runs: 96,
  failures: 0,
  missed: 1,
  createdAt: '2026-09-01T03:14:58.900Z',
  updatedAt: '2026-09-13T03:15:01.882Z',
}
```

`nextRunAt` is epoch milliseconds and always points at the future once a run has finished, so a job cannot strand itself in the past. A handler that throws does not stop the scheduler: the record keeps `lastStatus: 'error'`, `lastError` and a `failures` count, and the next slot still runs.

`JobStore` can be used on its own, and any object with `get`, `set`, `delete` and `list` can be injected as its storage.

```js
const store = new sengkrep.JobStore({ backend: 'sqlite', file: 'jobs.db' });
store.save({ id: 'nightly', schedule: '0 3 * * *', enabled: true, nextRunAt: Date.now() });
console.log(store.list(), store.all());
```

The cron helpers are exported too, which makes it possible to check what an expression means before trusting it.

```js
sengkrep.cron.nextRunTime('*/5 * * * *', { now: Date.now() });
sengkrep.cron.scheduleLabel({ every: '6h' }); // 'every 6h'
```

Nothing in the scheduler is timezone aware. Schedules are evaluated in UTC, and a `Date` or ISO string in `at` carries its own offset.

## Data sinks

Extraction produces rows. A sink moves them somewhere, in batches, with a key that decides whether a row is an insert or an update.

```js
const sink = sengkrep.createSink({
  type: 'postgres',
  table: 'items',
  key: 'sku',
  batchSize: 500,
  connection: { connectionString: process.env.DATABASE_URL },
});

await scraper.batch(urls, { sku: '.sku', name: 'h1', price: '.price' }, { sink });
await sink.close();
```

```sql
INSERT INTO "items" ("sku", "name", "price") VALUES ($1, $2, $3), ($4, $5, $6)
ON CONFLICT ("sku") DO UPDATE SET "name" = EXCLUDED."name", "price" = EXCLUDED."price"
```

That statement is what the Postgres sink builds, and the same shape is available without a database.

| Sink | Driver | What `key` does |
|---|---|---|
| `MemorySink` | none | a row with an existing key replaces the stored one |
| `FileSink` (JSONL) | none | the file is loaded, the row is replaced, the file is rewritten |
| `FileSink` (CSV) | none | the same, and the header is written once |
| `PostgresSink` | `pg` | `ON CONFLICT (...) DO UPDATE` |
| `MySQLSink` | `mysql2/promise` | `ON DUPLICATE KEY UPDATE` |
| `ClickHouseSink` | `@clickhouse/client` | deduplicates inside the batch; the table needs `ReplacingMergeTree` for real upsert |
| `S3Sink` | `@aws-sdk/client-s3` | one object per key, so a rerun overwrites that object |

No driver is a dependency of this package. Each one is required the first time it is needed, and a missing one fails with the exact `npm install` command in the message. You can also inject a client and skip the driver entirely, which is how the test suite exercises every statement without a database.

### Options

| Option | Default | Meaning |
|---|---|---|
| `key` | none | Field name, or an array of them for a composite key. Without a key every row is appended |
| `replace` | `true` | When `false`, rows are appended and the key is ignored |
| `batchSize` | `500` | Buffered rows before a flush is triggered |
| `flushInterval` | none | Milliseconds between automatic flushes for rows that arrive slowly |
| `retries` | `2` | Extra attempts for a failed batch, with exponential backoff |
| `retryDelayMs` | `200` | Base delay for that backoff |
| `transform` | none | Runs on each row before the key is read |
| `onError` | none | Called when a timer-driven flush fails |
| `columns` | discovered | Explicit column list for the SQL, file and S3 sinks |

### Behaviour

A row whose key is missing stops the batch with a clear error rather than landing somewhere unexpected. Two rows with the same key in one buffer collapse to the last one, and `stats().duplicates` counts that. A batch that keeps failing after `retries` throws, and the thrown error is the last real error, not a wrapper.

Buffered rows are held until `batchSize` is reached, a `flushInterval` fires, or you call `flush()`. `close()` flushes what is left, stops the timer and marks the sink closed, after which `write()` throws.

```js
const sink = sengkrep.createSink({ type: 'memory', key: 'id' });

await sink.write([{ id: 1, name: 'a' }, { id: 1, name: 'b' }]);
await sink.flush();

sink.rows;      // [{ id: 1, name: 'b' }]
sink.stats();   // { written: 1, batches: 1, duplicates: 1, retried: 0, buffered: 0, closed: false, ... }
```

### Passing a sink to the scraper

`batch`, `stream`, `export` and `crawl` all take a `sink`. Either form works, and the difference matters.

| What you pass | Ownership |
|---|---|
| A sink instance, for example `new sengkrep.MemorySink({ key: 'id' })` | Yours. The scraper writes and flushes it, and leaves it open |
| A descriptor, for example `{ type: 'jsonl', path: 'out.jsonl', key: 'id' }` | The scraper creates it, flushes it and closes it when the run ends |

```js
await scraper.batch(urls, schema, { sink: { type: 'jsonl', path: 'items.jsonl', key: 'sku' } });

for await (const { data, error } of scraper.stream(urls, schema, { sink: { type: 's3', bucket: 'data', prefix: 'items', key: 'sku' } })) {
  if (error) continue;
  console.log(data.sku);
}
```

A stream that is abandoned early still flushes, because the flush sits in a `finally`. Crawl writes each page as it is visited, so a long crawl does not have to hold every result in memory.

### File sinks

`FileSink` infers the format from the extension. With `replace` on it loads the file once, keeps the keys in memory and rewrites the file on each flush, which is convenient up to a few hundred thousand rows and the wrong tool past that. Set `replace: false` to append instead, and give `columns` explicitly if later rows do not carry the same fields.

```js
const sink = new sengkrep.FileSink('items.csv', { key: 'sku' });
await sink.write({ sku: 'A1', name: 'Roti' });
await sink.close();

fs.readFileSync('items.csv', 'utf8'); // 'sku,name\nA1,Roti\n'
```

A CSV file that cannot be parsed stops the batch, and the file is left exactly as it was.

### Database and object storage

```js
new sengkrep.PostgresSink({ table: 'items', key: 'sku', connection: { connectionString } });
new sengkrep.MySQLSink({ table: 'items', key: 'sku', connection: { uri } });
new sengkrep.ClickHouseSink({ table: 'items', connection: { url, username, password } });
new sengkrep.S3Sink({ bucket: 'data', prefix: 'items', key: 'sku', format: 'json' });
```

Any client you already have can be injected, and injected clients are never closed by the sink.

```js
const sink = new sengkrep.PostgresSink({ table: 'items', key: 'sku', client: existingPool });
const mysql = new sengkrep.MySQLSink({ table: 'items', key: 'sku', client: pool });
const ch = new sengkrep.ClickHouseSink({ table: 'items', client: chClient });
const s3 = new sengkrep.S3Sink({ bucket: 'data', key: 'sku', put: async ({ key, body, contentType }) => upload(key, body, contentType) });
```

ClickHouse has no upsert, so the sink deduplicates within a batch and inserts with `FORMAT JSONEachRow`. Use a `ReplacingMergeTree(key)` table and query with `FINAL` if you need one row per key at read time. S3 has no upsert either, and does not need one: with a key set, each row becomes its own object named from that key, so writing the same key again replaces the same object.

## Network capture

Finding the API behind a JavaScript-heavy page usually means opening DevTools and copying requests by hand. The capture layer does that step for you.

![Network capture measured against the fixture server](docs/capture-stats.svg)

Four sources feed one analyzer.

![What each capture source records](docs/capture-sources.svg)

| Source | Extra dependencies | What it sees |
|---|---|---|
| `CdpCapture` | none, the DevTools Protocol client and its WebSocket are built in | Full requests, responses, headers, bodies, WebSocket frames |
| `HarImporter` | none | Whatever a HAR file contains |
| `CaptureProxy` | none | Full bodies for plain HTTP, plus `CONNECT` metadata for HTTPS tunnels |
| `PlaywrightCapture` | your own Playwright install, never bundled | Full requests and responses |

### From a running browser

```bash
chrome --headless=new --remote-debugging-port=9222 https://app.example.com
```

```js
const capture = await sengkrep.NetworkCapture.fromCdp({
  url: 'https://app.example.com/dashboard',
  host: 'http://127.0.0.1:9222',
});

for (const endpoint of capture.endpoints()) {
  console.log(endpoint.method, endpoint.template, endpoint.statuses, endpoint.params);
}
```

`CdpCapture` creates its own target, enables `Page` and `Network`, waits for `Page.loadEventFired`, reads response bodies with `Network.getResponseBody`, and closes the target when it is done.

### Through a local proxy

```js
const { capture, proxy } = await sengkrep.NetworkCapture.fromProxy({ port: 8899 });
console.log(`route your client through ${proxy.address.url}`);

const scraper = sengkrep.create({ proxies: [proxy.address.url] });
await scraper.fetch('http://example.com/catalog');

await new Promise((resolve) => setTimeout(resolve, 2000));
capture.pull(proxy);
await proxy.stop();
console.log(capture.summary());
```

For `https://` targets a proxy without TLS interception only reports `CONNECT` metadata: host, port, bytes and duration. That is how TLS works, not a gap in the library. Use `CdpCapture` or `PlaywrightCapture` when the bodies matter.

### From a HAR file

```js
const capture = sengkrep.NetworkCapture.fromHar('./session.har');
console.log(capture.endpoints({ bodies: true }));
```

### Reading the results

| Call | Returns |
|---|---|
| `capture.entries` | Every normalized request and response |
| `capture.api()` | Only XHR, fetch and JSON traffic, as another capture |
| `capture.filter({ method, status, host, url, api, failed })` | A filtered capture |
| `capture.endpoints({ all })` | Grouped endpoints with `template`, `count`, `statuses`, `params` and an inferred JSON `schema`. Static requests are excluded unless `all: true` |
| `capture.summary()` | Counts by resource type, status and source |
| `capture.toFetchCode(entry)` | A `fetch()` snippet for one request |
| `capture.toCurl(entry)` | The same request as a curl command |
| `capture.toSchema(endpoint)` | An extraction schema derived from the captured JSON body |
| `capture.toScript(endpoint)` | A runnable scraper script for that endpoint |
| `capture.frames(id)` | WebSocket frames recorded for one socket |
| `capture.saveHar('out.har')` | HAR 1.2 export |
| `capture.json()` | The whole analysis as a JSON-serializable object |

Numeric, UUID and opaque segments collapse into `:id`, so `/v1/items/17` and `/v1/items/8321` land in the same row:

```js
const [endpoint] = capture.endpoints();
// endpoint.template === 'https://api.example.com/v1/items/:id'
// endpoint.schema   === { type: 'object', properties: { id: { type: 'integer' }, ... } }
```

`toHAR()`, `toCurl()` and `toFetchCode()` redact `Authorization`, `Cookie`, `Set-Cookie`, proxy credentials and API key headers by default. Pass `{ redact: false }` to keep the original values.

### From capture to a scraper

Open the page once, then let the capture write the code you would otherwise type by hand. The schema step needs a JSON response, because JSON is what the library can turn into paths.

```js
const capture = await sengkrep.captureUrl('https://app.example.com/dashboard');
const [endpoint] = capture.endpoints();

const schema = capture.toSchema(endpoint);
// { title: 'items[].title', total: 'total' }

const script = capture.toScript(endpoint);
// a complete .js file using extract(), Retry and RateLimiter
```

Nested objects become dotted paths, arrays become wildcards, and collisions take a longer key.

| Captured JSON | Schema |
|---|---|
| `{ items: [{ id }] }` | `{ id: 'items[].id' }` |
| `{ data: { user: { name } } }` | `{ name: 'data.user.name' }` |
| `{ id, data: { id } }` | `{ id: 'id', data_id: 'data.id' }` |
| `{ tags: ['a'] }` | `{ tags: 'tags[]' }` |

`toScript()` writes a file that ends with `scraper.close()`, so it exits on its own. Options: `{ require, logLevel, schemaObject, params, headers, body, redact, maxDepth }`. Headers and bodies are redacted by default, the same way `toFetchCode()` does it.

```bash
sengkrep capture har session.har --schema
sengkrep capture har session.har --script-out scraper.js
```

### WebSocket frames

`Network.webSocketFrameSent` and `Network.webSocketFrameReceived` are recorded per socket. Read them back with `capture.frames(id)`, and cap them with `maxFramesPerSocket`. When the cap is hit, `framesTruncated` is set on the entry.

### Cookies

The same DevTools connection can hand its cookies to a `CookieJar`, and a `cookies.txt` file works too. This saves a login round trip when the session already exists in the browser.

```js
const scraper = sengkrep.create({ cookies: true });

await sengkrep.importCookies(scraper.cookieJar, { from: 'cdp' });
await sengkrep.importCookies(scraper.cookieJar, { from: 'file', path: 'cookies.txt', domains: ['app.example.com'] });
```

| `from` | Reads |
|---|---|
| `file` | Netscape `cookies.txt`, including `#HttpOnly_` lines. Needs `path` |
| `text` | The same format from a string. Needs `text` |
| `json` | Cookie JSON, either a bare array or `{ cookies: [...] }` |
| `cdp` | `Network.getAllCookies` from the browser. `browser` is an accepted alias |
| `cookies` | An array of cookie objects you already have |

In the Netscape format the second column marks whether a cookie applies to subdomains. It is not the HttpOnly flag; that comes from the `#HttpOnly_` prefix on the line.

### Capture from the command line

```bash
sengkrep capture har session.har --out api.har --json
sengkrep capture browser https://app.example.com --cdp http://127.0.0.1:9222
sengkrep capture proxy --port 8899 --seconds 60 --out session.har
sengkrep capture playwright https://app.example.com --out session.har
sengkrep capture cookies cookies.txt --domain app.example.com --out jar.json
```

| Flag | Meaning |
|---|---|
| `--out <path>` | Write a HAR file with every captured request |
| `--json` | Print the full analysis as JSON |
| `--all` | Include static assets as well as API calls |
| `--code` | Print a `fetch()` snippet for the first endpoint |
| `--schema` | Print an extraction schema for the first JSON endpoint |
| `--script` | Print a runnable scraper script for the first JSON endpoint |
| `--script-out <path>` | Write that script to a file |
| `--cdp <host>` | DevTools endpoint, default `http://127.0.0.1:9222` |
| `--port <n>` | Local capture proxy port, default `8899` |
| `--seconds <n>` | How long to keep the proxy open, default `30` |
| `--headless=false` | Show the browser when using Playwright |

When `--schema`, `--script` or `--script-out` is used, the text report is not printed, so stdout stays clean for a pipe.

## Core API

These methods exist on the default export, which holds one shared instance, and on any instance from `sengkrep.create(options)`.

### `fetch(url, options?)`

Returns the raw response: `{ status, headers, url, body, binary, streamed, filePath, fromCache, notModified }`. No extraction, no schema.

```js
const res = await scraper.fetch('https://example.com');
console.log(res.status, res.body.length);
```

### `load(html)`

Loads an HTML string into cheerio for manual inspection. No network call.

```js
const $ = scraper.load('<h1>Hi</h1>');
console.log($('h1').text());
```

### `extract<T>(url, schema, options?)`

Fetches a URL, runs the schema, then records health, diff and validation metadata on `data._sengkrep`. The response type is detected from the content: HTML, JSON, RSS/Atom, or CSV.

Options include `strict` (throw on validation failure), `render` (use the configured renderer for this call), and `request` (per-call request config such as headers, timeout or `rejectUnauthorized`).

### `batch<T>(urls, schema, options?)`

Runs `extract()` over a list with a concurrency limit. Returns `[{ url, data, error }]` in the order the URLs were given.

```js
const results = await scraper.batch(urls, { title: 'h1' }, { concurrency: 5 });
```

### `stream<T>(urls, schema, options?)`

An async generator over the same work, so results can be handled while the rest are still running.

```js
for await (const { url, data, error } of scraper.stream(urls, schema, { concurrency: 5 })) {
  if (!error) await save(data);
}
```

### `paginate<T>(startUrl, config, schema, options?)`

Follows a next-page link and collects items from every page.

| Option | Default | Meaning |
|---|---|---|
| `nextSelector` | required | CSS selector for the next link, or `auto` for the built-in detector |
| `itemsSelector` | none | Selector for repeated item containers. Without it each page is one object |
| `maxPages` | `10` | Page limit |
| `delayBetweenPages` | `1200` | Delay between pages, jittered |
| `stopOnDuplicate` | `true` | Stop when a page extracts the same content as the previous one |

### `crawl(options)`

Breadth-first crawler with optional disk-backed state, so a crashed process can resume where it stopped.

| Option | Default | Meaning |
|---|---|---|
| `seed` | required | Starting URL or list of URLs |
| `schema` | required | Schema applied to every page |
| `follow` | none | `RegExp` or predicate that decides which links enter the queue |
| `maxUrls` | `1000` | Queue limit |
| `concurrency` | `3` | Parallel requests |
| `stateFile` | none | JSON file for progress. Omit for an in-memory run |
| `respectRobotsTxt` | `false` | Skip paths disallowed by `robots.txt` |

Returns a `CrawlJob` with `.start()`, `.resume()`, `.pause()`, `.results()`, `.stats()` and `.on(event, fn)` for `url:done`, `url:error`, `progress`, `start` and `done`.

```js
const job = scraper.crawl({
  seed: 'https://example.com',
  schema: { title: 'h1' },
  follow: /\/article\//,
  maxUrls: 5000,
  stateFile: './crawl-state.json',
});

job.on('url:done', ({ url }) => console.log(url));
await job.start();
```

### `export(input, schema?, options?)`

Runs the pipeline and serializes the result as `csv`, `json`, `ndjson` or `markdown`. Accepts a URL, a list of URLs, or data that is already extracted.

```js
const csv = await scraper.export(urls, { title: 'h1', price: '.price' }, {
  format: 'csv',
  path: './out.csv',
  pagination: { nextSelector: 'auto', itemsSelector: '.product_pod', maxPages: 5 },
});
```

### `discover(origin, options?)`

Reads `robots.txt` and `sitemap.xml` for an origin and returns the URLs they list.

### `isAllowed(url, userAgent?)` and `getCrawlDelay(origin, userAgent?)`

Check `robots.txt` for a single URL before requesting it. `getCrawlDelay()` returns the `Crawl-delay` value in seconds, or `null`.

### `login(url, formData?, options?)`

Submits a login form through `FormHandler` and keeps the resulting cookies in the jar. Returns `true` when the response does not look like a failed login.

### `submitForm(url, formSelector, overrides?)`

Reads a form from the page, fills the fields with the overrides, and submits it.

### `inferSchema(url, options?)`

Reads a page and suggests selectors for common fields, plus any repeating container it finds.

```js
const suggestion = await scraper.inferSchema('https://books.toscrape.com');
console.log(suggestion.type, suggestion.container, suggestion.schema);
```

### `flush()` and `close()`

`flush()` waits for background cache revalidations and resolves to how many were pending. `close()` releases keep-alive sockets, temp files and the metrics server.

Health, diff, validation and rate-limit metadata are attached to extraction results under `_sengkrep`, which is non-enumerable, so it stays out of `JSON.stringify(data)`.

## Schema syntax

A schema is an object of field name to selector. Short form:

```js
const schema = { title: 'h1', price: '.price_color' };
```

Long form:

```js
const schema = {
  title: { selector: ['h1.title', 'h1'], required: true },
  image: { selector: 'img.cover', attr: 'src' },
  tags: { selector: '.tag', multiple: true },
  price: { selector: '.price', transform: (v) => parseFloat(v.replace(/[^0-9.]/g, '')) },
  published: { selector: 'time', attr: 'datetime', pattern: /^\d{4}-\d{2}-\d{2}$/ },
  stock: { selector: '.stock', default: 'unknown' },
};
```

A selector can be a string or an array, and an array is tried in order until one matches. `type: 'html'` returns inner HTML instead of trimmed text. `required: true` raises `ExtractionError` when the field comes back empty.

For JSON responses the schema follows the same shape with `path` instead of `selector`:

```js
const schema = {
  id: { path: 'data.items[0].id', required: true },
  names: 'data.items[*].name',
  total: { path: 'meta.total', transform: (v) => Number(v) },
};
```

## Modules

Every class below is exported from the package root and covered by `index.d.ts`.

Reliability:

| Class | Purpose |
|---|---|
| `Retry` | Backoff with jitter, status allowlist, `Retry-After` support and an optional total `budgetMs` |
| `SingleFlight` | Merges identical in-flight requests into one and shares the result or the error with every waiter |
| `CircuitBreaker` | Opens after repeated failures on a key and closes again after a cooldown |
| `HealthMonitor` | Tracks field fill rates and selector matches over a rolling window, then alerts |
| `DiffDetector` | Compares structured results across runs and reports changes by severity |
| `SchemaValidator` | Per-field rules: `required`, `type`, `pattern`, `minLength`, `maxItems`, `custom` |
| `Incremental` | Sends `If-None-Match` and `If-Modified-Since`, and reports `notModified` |
| `Cache` | TTL cache with an LRU cap, in memory or on disk, with optional stale-while-revalidate |
| `CrawlQueue` | Disk-backed URL queue with deduplication and resume |

Identity and access:

| Class | Purpose |
|---|---|
| `Fingerprint` | One browser profile drives the User-Agent, client hints, `Sec-Fetch-*` and language together |
| `CookieJar` | Cookie storage per registrable host, including IPv4 and IPv6 hosts |
| `RateLimiter` | Serialized per-host spacing at a fixed rate |
| `ProxyRotator` | Round robin, random or sticky proxy selection with failure tracking |
| `SessionPool` | Reusable sessions with cookies and user agents, round robin or least used |
| `AuthManager` | Bearer or JWT auth with a refresh hook on 401 |
| `CsrfHandler` | Reads CSRF tokens from meta tags, hidden inputs and cookies, then replays them |
| `SecurityGuard` | Blocks private address ranges, allowlisted and blocklisted domains, and configured ports |

Transport and performance:

| Class | Purpose |
|---|---|
| `Transport` | One interface over HTTP/1.1 and HTTP/2, with automatic downgrade when the server refuses h2 |
| `Fetcher` | HTTP/1.1 with manual redirects, streaming decompression and truncated-response detection |
| `Http2Fetcher` | The same contract over HTTP/2, including cancellation and byte accounting |
| `DnsCache` | Caches DNS lookups for a TTL, which `SecurityGuard` also uses to pin addresses |
| `AdaptiveThrottle` | AIMD concurrency and delay per host, fed by `429`, `503` and timeouts |
| `ContentDedup` | SimHash and Hamming distance to drop near-duplicate pages |
| `StreamWriter` | Writes large result sets to disk as CSV or JSONL instead of holding them in memory |

Extraction and data:

| Class | Purpose |
|---|---|
| `Extractor` | CSS extraction with fallback chains and transforms |
| `JsonExtractor` | Path expressions with wildcards for JSON responses |
| `SchemaInference` | Suggests selectors for common fields and finds repeating containers |
| `FormHandler` | Reads, fills and submits forms |

Operations and storage:

| Class | Purpose |
|---|---|
| `Observability` | Counters per domain with a Prometheus text endpoint |
| `Webhook` | Event delivery with exponential backoff and optional HMAC-SHA256 signing |
| `HarRecorder` | Records requests through the interceptors and writes a HAR file |
| `DistributedQueue` | Multi-worker queue with leases, priorities, per-worker streaks and a dead-letter list |
| `Scheduler` | Runs stored jobs on cron, interval or one-shot schedules, with catch-up and skip policies |
| `JobStore` | Persistent job records behind the same `file`, `memory` and `sqlite` backends as the cache |
| `Sink` | Batching, key-based upsert, retries and stats shared by every sink |
| `MemorySink`, `FileSink` | In-memory rows, or JSONL and CSV files with an append mode |
| `PostgresSink`, `MySQLSink`, `ClickHouseSink`, `S3Sink` | Driver-backed sinks behind `createSink()` |
| `Storage` / `MemoryStorage` / `SqliteStorage` | Backends behind one `createStorage()` factory |
| `PluginSystem` | `beforeRequest`, `afterExtract` and `onError` hooks, with `timestamp`, `logToFile` and `fieldMapper` built in |
| `ProgressBar` | Terminal progress for long runs |
| `WordPress`, `GraphQLClient` | WP REST helper and GraphQL client |
| `UrlDeduplicator` | Normalized-URL deduplication, also used by `crawl()` |

Capture:

| Class | Purpose |
|---|---|
| `NetworkCapture` | Merges capture sources and produces endpoints, schemas and code snippets |
| `CdpCapture` | DevTools Protocol capture with no extra dependencies |
| `CdpRenderer` | Renders a page through the DevTools Protocol and returns its HTML |
| `CaptureProxy` | Local HTTP proxy that records what passes through it |
| `PlaywrightCapture` | Attaches to Playwright pages when Playwright is installed |
| `HarImporter` | Parses and writes HAR 1.2 |

## Configuration

```js
const scraper = sengkrep.create({
  logLevel: 'info',
  timeout: 30000,
  retry: { max: 3, respectRetryAfter: true },
  rateLimit: { requestsPerSecond: 2, concurrency: 4 },
  cache: { ttl: 300, storage: 'memory', staleWhileRevalidate: true, staleTtl: 120 },
  singleFlight: true,
  circuitBreaker: { threshold: 5, cooldown: 60000 },
  proxies: ['http://user:pass@proxy1:8080', 'http://proxy2:8080'],
  http2: true,
  adaptive: true,
  dedupContent: true,
});
```

Options and defaults:

| Option | Default | Notes |
|---|---|---|
| `logLevel` | `'info'` | `error`, `warn`, `info` or `debug` |
| `logPretty` | `true` | Human-readable log lines |
| `baseURL` | `null` | Prefix for relative URLs |
| `timeout` | `30000` | Per-request timeout in ms |
| `connectTimeout` | `null` | Overrides the connect phase only |
| `totalTimeout` | `null` | Hard deadline for a whole request |
| `maxRedirects` | `5` | Manual redirect following |
| `redirectPolicy` | `{ validateEachHop: true, forwardSensitiveHeaders: false, maxCrossHostHops: 3 }` | Security guard runs on every hop, credentials are dropped when the origin changes, and cross-host hops are capped |
| `keepAlive` | `true` | Reuse sockets |
| `delay` | none | Fixed-ish delay in ms. The actual wait is jittered between 0.8x and 1.2x |
| `delayMin`, `delayMax` | `500`, `2500` | Range for the jittered delay, used when `delay` is not set |
| `maxMemoryBuffer` | `10 MB` | Above this, responses stream to disk |
| `responseType` | `'auto'` | `auto`, `html`, `json`, `rss` or `csv` |
| `cookies` | `true` | Enable the cookie jar |
| `http2` | `false` | Use HTTP/2 for HTTPS origins, with fallback |
| `fingerprint` | see below | `{ userAgent, rotateUAOnEachRequest, randomizeHeaderOrder, randomizeTiming }` |
| `retry` | `{ max: 3 }` | `retryOn`, `retryOnNetwork`, `retryOnTimeout`, `respectRetryAfter`, `maxRetryAfter`, `budgetMs`, `jitter` |
| `singleFlight` | `false` | `true` or `{ maxKeys }`. Identical in-flight requests share one response |
| `scheduler` | disabled | `true` or `{ backend, storageDir, file, table, concurrency, catchUp, pollInterval, now, jobs, store }` |
| `health` | enabled | `{ alertThreshold: 0.5, windowSize: 10, onAlert }` or `false` |
| `diff` | enabled | `{ storageDir: '.sengkrep', sensitivity: 'structural', onDiff, maxHistory: 500, backend }` or `false` |
| `cache` | `false` | `{ ttl, storage: 'memory' \| 'disk', storageDir, maxItems, backend, staleWhileRevalidate, staleTtl }` |
| `circuitBreaker` | `false` | `{ threshold, cooldown, halfOpenMaxAttempts, onOpen, onClose }` |
| `incremental` | `false` | `true` or `{ storageDir, backend }`. Default directory is `.sengkrep-incremental` |
| `rateLimit` | disabled | `{ requestsPerSecond, concurrency }` |
| `proxies` | `[]` | URL list for `ProxyRotator` |
| `proxyStrategy` | `'round-robin'` | `round-robin`, `random` or `sticky` |
| `proxyMaxFailures` | `3` | Failures before a proxy is skipped |
| `dns` | `false` | `true` or `{ ttl }` |
| `sessionPool` | `{ size: 1 }` | `strategy` is `round-robin` or `least-used` |
| `security` | disabled ports only | `{ blockPrivateIPs, allowDomains, blockDomains, blockedPorts }` |
| `auth` | none | `{ type: 'bearer', token, refresh, refreshOn }` |
| `csrf` | `{ auto: true }` | Automatic token replay |
| `observability` | `{ enabled: false }` | `{ enabled, port }` for the metrics endpoint |
| `webhook` | none | `{ onStart, onComplete, onError, onProgress, retries, secret }` |
| `har` | `false` | Record every request into a HAR file |
| `robotsTtl`, `tempFileTtl` | `3600000` | Cache lifetime for `robots.txt`, cleanup age for streamed temp files |
| `adaptive` | `false` | `true` or `{ minConcurrency, maxConcurrency, backoffFactor, baseDelay }` |
| `dedupContent` | `false` | `true` or `{ threshold, shingleSize, maxEntries }` |
| `backend` | `'file'` | Storage backend for `cache`, `diff` and `incremental`: `file`, `memory` or `sqlite`. Each of those modules also takes `storageDir`, `file` and `table` |
| `renderer`, `render` | none | `renderer(url, options)` returns HTML, or `sengkrep.renderers.cdp()` for the built-in one; `render: true` applies it to every `extract()` |
| `compliance` | `false` | `{ userAgent, respectXRobotsTag, maskFields, auditLog, purpose }` |
| `validate` | `{}` | Per-field validation rules |

## Validation rules

```js
sengkrep.create({
  validate: {
    price: { required: true, type: 'number', pattern: /^\d+(\.\d{2})?$/ },
    email: { type: 'email' },
    tags: { minItems: 1 },
    name: { minLength: 2, maxLength: 200, notEmpty: true },
    score: { custom: (value) => (value >= 0 && value <= 100) || 'score out of range' },
  },
});
```

`type` accepts `string`, `number`, `boolean`, `url`, `email` or `date`. Results appear at `data._sengkrep.validation`, and `extract(url, schema, { strict: true })` throws `ValidationError` instead.

## Plugins

Hooks run at three points: `beforeRequest`, `afterExtract` and `onError`. Register one with `scraper.plugins.use(plugin)` or `scraper.plugins.hook(name, fn)`.

```js
const scraper = sengkrep.create();

scraper.plugins.use(sengkrep.plugins.timestamp('scrapedAt'));
scraper.plugins.use(sengkrep.plugins.fieldMapper({ priceText: 'price' }));

scraper.plugins.hook('afterExtract', ({ data, meta }) => {
  return { data: { ...data, source: 'example.com' }, meta };
});
```

The built-in factories are `timestamp(fieldName)`, `logToFile(filePath)` and `fieldMapper(mapping)`. A hook returning `undefined` leaves the payload untouched.

## Property naming

Some sub-clients are reachable under two names. Both names point to the same instance.

| Short | Long |
|---|---|
| `scraper.auth` | `scraper.authManager` |
| `scraper.security` | `scraper.securityGuard` |
| `scraper.csrf` | `scraper.csrfHandler` |
| `scraper.health` | `scraper.healthMonitor` |
| `scraper.diff` | `scraper.diffDetector` |
| `scraper.plugins` | `scraper.pluginSystem` |
| `scraper.cache` | `scraper.cacheManager` |
| `scraper.scheduler` | only exists when the scheduler is configured, otherwise `null` |

Always present, whatever the configuration: `sessionPool`, `wordpress`, `graphql`, `formHandler`, `deduplicator`, `proxyRotator`, `rateLimiter`, `fingerprint`, `observability`, `singleFlight`, `interceptors`, `cookieJar`.

Present only when enabled, otherwise `null`: `cache`, `circuitBreaker`, `incremental`, `diff`, `health`.

## Errors

```js
const { errors } = require('sengkrep');
```

| Class | `code` | Meaning |
|---|---|---|
| `FetchError` | `HTTP_ERROR` | Status 400 or above. `err.status` holds the code |
| `FetchError` | `NETWORK_ERROR` | The connection failed |
| `FetchError` | `UNSUPPORTED_ENCODING` | The server used a `Content-Encoding` this Node build cannot decompress |
| `FetchError` | `TRUNCATED_RESPONSE` | The connection dropped before the response ended. Retried automatically |
| `TimeoutError` | `TIMEOUT` | The request passed its timeout |
| `CanceledError` | `CANCELED` | An `AbortSignal` fired |
| `ProxyError` | `PROXY_ERROR` | The proxy tunnel failed |
| `SecurityError` | `SECURITY_BLOCKED` | `SecurityGuard` blocked the target |
| `CircuitOpenError` | `CIRCUIT_OPEN` | The breaker is open. `err.retryAt` holds the retry timestamp |
| `ExtractionError` | | A required HTML field was empty. `err.field` and `err.selector` say which |
| `JsonExtractionError` | | A required JSON field was empty. `err.field` and `err.path` say which |
| `ValidationError` | | Strict validation failed. `err.errors` lists every failure |

Four more codes arrive as plain `Error` objects with `err.code` set, so match on the code rather than on a class:

| `code` | Raised by | Meaning |
|---|---|---|
| `BINARY_RESPONSE` | `extract()` | The body looked like binary or streamed content. `err.meta.sniffedType` holds the sniffed type. Pass `{ allowBinary: true }` to receive it |
| `ROBOTS_DISALLOWED` | `crawl()` with `respectRobotsTxt: true` | A URL was disallowed by `robots.txt` |
| `X_ROBOTS_DISALLOWED` | `extract()` with `compliance.respectXRobotsTag: true` | The response carried `X-Robots-Tag: none` or `noindex` |
| `DUPLICATE_CONTENT` | `crawl()` with `dedupContent: true` | The page matched an earlier page within the SimHash threshold |

```js
try {
  await scraper.extract(url, schema, { strict: true });
} catch (err) {
  if (err.name === 'ValidationError') {
    for (const detail of err.errors) console.log(detail.field, detail.message);
  } else {
    console.log(err.code, err.message);
  }
}
```

## Troubleshooting

### The process never exits

`keepAlive` sockets, and the metrics server when `observability.enabled` is set, keep the event loop alive on purpose. Call `await scraper.close()` when the job is done. Scripts generated by `capture.toScript()` already end with it. Use `await scraper.flush()` before closing if you also want pending background cache refreshes to finish.

### `Cannot find module 'playwright'`

Playwright is not a dependency, so `PlaywrightCapture` and `renderers.playwright()` only work after you install it yourself. If you would rather not, use `renderers.cdp()` against a Chrome you already run, or export the session to a HAR file and use `HarImporter`.

### A field suddenly comes back empty

That is the case `HealthMonitor` exists for. Every extraction result carries `data._sengkrep.health`, and a low fill rate calls `onAlert`. To find the new selector, run `inferSchema(url)`, which reads the live page and suggests selectors. Give a field a fallback chain (`selector: ['h1.title', 'h1']`) and a `default` so one layout change does not empty your column.

### HTTP 403 or 429

A 429 usually means too fast. Set `rateLimit: { requestsPerSecond }`, or turn on `adaptive: true` and let the library read `Retry-After` and back off. Respect a `Crawl-delay` from `robots.txt` with `getCrawlDelay()`. For 403, check whether the page needs a session, a cookie from a real login (`importCookies`), or a CSRF token (`csrf.auto`), before assuming the request looks suspicious.

### `SECURITY_BLOCKED`

`SecurityGuard` blocked the target. This is most often a redirect that lands on a private address, which is exactly the case the check is there for. If you are intentionally scraping an internal host, add it to `security.allowDomains` and set `blockPrivateIPs` deliberately.

### `TOO_MANY_REDIRECTS`

Either `maxRedirects` is too low, or the chain keeps crossing hosts past `redirectPolicy.maxCrossHostHops` (default 3). Raise the value that fits the site, and check the chain first: a redirect loop looks the same from here.

### `CIRCUIT_OPEN`

The breaker tripped after `threshold` failures on that host. `err.retryAt` says when it will try again. Look at the underlying failures first, then raise `threshold` or shorten `cooldown`.

### `TIMEOUT` on a page that does load in a browser

The server sent headers but keeps the body open, or the page only fills in after JavaScript. `timeout` covers the whole request. If the content needs a browser, nothing in the HTTP layer will help: use a renderer or capture the JSON the page calls. Setting `connectTimeout` separately helps when the delay is in DNS or the TCP handshake.

### `TRUNCATED_RESPONSE`

The connection dropped mid-response. `Retry` treats this as retryable and tries again. If it repeats on every attempt, the server or a middlebox is cutting the response, and a different proxy or a lower concurrency is the next thing to test.

### `BINARY_RESPONSE`

`extract()` refuses to run a schema over bytes. If you want the bytes, use `fetch()` and read `res.body` or `res.filePath`, or pass `{ allowBinary: true }` to `extract()`. `err.meta.sniffedType` tells you what it detected.

### Cache does not refresh

`cache.ttl` is in seconds. A fresh entry is served without a network call and returns `fromCache: true`. With `staleWhileRevalidate: true`, an entry past its TTL is still served once with `stale: true` while a background request refreshes it; `await scraper.flush()` waits for that. Without the option, an expired entry is a miss and the next call refetches.

### The same URL is requested many times in parallel

Turn on `singleFlight: true`. Concurrent callers for the same method, URL and body get one request and share its result, and an error is shared the same way. Add a cache on top if the repeats arrive over minutes rather than milliseconds.

### The capture proxy shows no body for an HTTPS site

A proxy without TLS interception cannot read inside a TLS tunnel, so it records `CONNECT` metadata only. Use `CdpCapture` against the browser, `PlaywrightCapture`, or a HAR file exported from DevTools.

### `render: true` returns HTML without the content

The page had not finished when the DOM was read. Add `waitForSelector` for an element that only appears with the data, or raise `idleMs`. If the site streams updates over WebSocket, no static wait is reliable: capture the frame (`capture.frames(id)`) or the API call instead.

### `backend: 'sqlite'` fails on startup

`node:sqlite` exists from Node 22.5. On older Node, use `backend: 'file'` or `backend: 'memory'`. The default is `file`, so this only comes up when you set it.

### Empty or `[object Object]` cells in CSV output

A `transform` that returns an object is serialized as-is. Return a string or number from the transform, or flatten the field in a plugin before export. `fieldMapper` is the shortest path.

### Node 18 reports `File is not defined`

Node 18 is not supported. The cheerio dependency pulls `undici`, which needs Node 20.18.1 to even load. Upgrade Node.

## Testing

![Test suite results per file](docs/test-results.svg)

271 tests run against local fixture servers, so the suite needs no external network access and works offline, in CI, and on machines where outbound traffic is restricted.

```bash
npm test            # every test file
npm run typecheck   # tsc --noEmit against index.d.ts and test/types/usage.ts
npm run coverage    # c8 coverage summary
npm run bench       # local micro-benchmarks
npm run docs        # regenerate docs/api from index.d.ts
npm run docs:check  # fail when docs/api no longer matches index.d.ts
```

| File | Covers |
|---|---|
| `01-fetcher-and-extraction.js` | Fetcher, HTML and JSON extraction, retry backoff |
| `02-orchestration.js` | The `Sengkrep` orchestrator, batch, pagination, login |
| `03-reliability-modules.js` | Circuit breaker, health monitor, crawl queue, observability, proxies |
| `04-content-safety-and-utils.js` | Charset and binary detection, encoding utilities, HTTP/2 |
| `05-bugfixes-and-schema-inference.js` | Regression tests, schema inference, distributed queue |
| `06-robots-retry-pagination.js` | `Retry-After`, truncated responses, `robots.txt`, duplicate pagination |
| `07-transport-fingerprint-storage.js` | Transport parity, fingerprint coherence, storage backends, SimHash, adaptive throttling, webhooks, compliance |
| `08-network-capture.js` | HAR round trip, capture proxy, CDP session handling, WebSocket framing, endpoint analysis |
| `09-security-redirect.js` | Redirect guard per hop, credential stripping, private IPv6 classification, cross-host budget, proxy header stripping |
| `10-renderer-and-codegen.js` | CDP renderer, capture to schema and script, WebSocket frames, cookie import |
| `11-single-flight-and-cache.js` | Single-flight sharing, cache hit and stale behaviour, background revalidation, `flush()` |
| `12-scheduler.js` | Cron parsing and rejection, durations, the job store and its index, tick and runNow, catch-up after a restart, one-shot jobs, concurrency, events |
| `13-sinks.js` | Batching, key and composite-key upserts, retries, transforms, JSONL and CSV files, generated SQL per dialect, ClickHouse inserts, S3 object keys, and sink wiring into batch, stream, export and crawl |
| `14-api-docs.js` | The generator: every export is parsed, properties and methods are read, overloads group, links resolve, output is deterministic, and the committed reference is up to date |

The two images at the top of this file are generated from the same fixtures by `node docs/charts.js`. Nothing in them is typed in by hand.

## Version history

| Version | Changes |
|---|---|
| 5.7.0 | `scripts/api-docs.js` and `npm run docs` generate `docs/api`, a page per export plus an index and a machine-readable `api.json`. `npm run docs:check` fails when the reference drifts from `index.d.ts`, and CI runs it. The test matrix gained a macOS runner |
| 5.6.0 | Data sinks with upsert by key: `Sink`, `MemorySink`, `FileSink` (JSONL and CSV), `PostgresSink`, `MySQLSink`, `ClickHouseSink`, `S3Sink` and `createSink()`. `batch`, `stream`, `export` and `crawl` accept a `sink`, either as an instance you own or a descriptor the scraper creates and closes |
| 5.5.0 | `Scheduler` and `JobStore` run jobs on cron, interval or one-shot schedules with persistent state, `catchUp` for runs missed while the process was down, `runNow`, `pause` and `resume`; the fingerprint now sends navigation headers only for actual page loads and fetch headers for JSON or body-bearing requests; caller headers override generated ones case-insensitively |
| 5.4.0 | `singleFlight` merges identical in-flight requests, `cache.staleWhileRevalidate` and `cache.staleTtl` serve stale entries while refreshing them in the background, `res.stale` marks a stale response, and `scraper.flush()` waits for pending revalidations |
| 5.3.1 | Corrected `engines.node` to `>=20.18.1`, the version the package can actually load, and dropped Node 18 from CI |
| 5.3.0 | `CdpRenderer` and `sengkrep.renderers.cdp()` for `render: true` without Playwright, `capture.toSchema()` and `capture.toScript()` to turn a capture into working code, WebSocket frames recorded and read with `capture.frames()`, cookie import from CDP or a `cookies.txt` file, and `scraper.close()` so a script can exit on its own |
| 5.2.0 | Redirect hops go through the security guard, cross-origin redirects drop `Authorization` and `Cookie`, the pinned lookup is dropped when the host changes, every `::ffff:` IPv6 form is classified, `CaptureProxy` strips `Proxy-Authorization`, `PaginationDetector` and the `capture` namespace are typed, and `test/types/usage.ts` is part of `npm run typecheck` |
| 5.1.0 | Network capture: `NetworkCapture`, `CdpCapture`, `CaptureProxy`, `PlaywrightCapture`, `HarImporter`, and the `sengkrep capture` command |
| 5.0.0 | Package renamed to `sengkrep`. Main class renamed to `Sengkrep`, result metadata moved to `data._sengkrep`, state files named `.sengkrep*` |
| 4.0.0 | Unified transport, coherent browser fingerprints, adaptive throttling, content dedup, storage backends, distributed queue leases, compliance mode, Prometheus metrics |
| 3.4.x | `Retry-After` handling, truncated-response detection, `robots.txt` checks, duplicate pagination detection |

The full list, including patch releases, is in [CHANGELOG.md](./CHANGELOG.md).

## Architecture

```
sengkrep/
├── index.js / index.d.ts   Entry point and TypeScript definitions
├── bin/sengkrep.js         CLI
├── docs/                   Charts generated from the fixtures
├── test/                   Fixture-driven test suite
└── src/
    ├── Sengkrep.js         Orchestrator, wires every module together
    ├── core/               Transport, Fetcher, Http2Fetcher, ProxyTunnel, Extractor, JsonExtractor, Retry
    ├── capture/            NetworkCapture, CdpCapture, CdpRenderer, CaptureProxy, PlaywrightCapture,
    │                       HarImporter, WebSocketClient, analyze
    ├── modules/            Reliability, identity, performance and operations modules
    └── utils/              contentSafety, encodingUtils, microdata, scriptExtractor,
                            urlUtils, streamWriter, exporter, contentHandlers
```

The `extract()` path, in order:

```
plugins.beforeRequest
  -> SecurityGuard -> CircuitBreaker -> Cache (fresh or stale hit returns here)
  -> SingleFlight
       -> Retry
            -> RateLimiter -> ProxyRotator -> DnsCache
            -> Fetcher or Http2Fetcher
                 -> Interceptors.request -> Fingerprint headers -> CookieJar -> AuthManager
                 -> decompress as a stream
                 -> verify the response completed
                 -> contentSafety: binary, stream to disk, or decode charset
                 -> Interceptors.response
            -> on 401: AuthManager.refresh(), then retry once
            -> on 429 or 503 with Retry-After: wait the time the server asked for
  -> Extractor, JsonExtractor, feed parser or CSV parser
  -> HealthMonitor, DiffDetector, SchemaValidator, plugins.afterExtract
  -> Observability record, Webhook fire
  -> ExtractResult with a non-enumerable _sengkrep
```

On a stale cache hit the request returns immediately and the refresh runs through the same path in the background, tracked so `flush()` can wait for it.

## Behavior notes

**Transport.** HTTPS origins use HTTP/2 when `http2: true`. If the server refuses h2, the request falls back to HTTP/1.1. Timeouts and HTTP status errors are never retried on the other protocol, so a 500 stays a 500.

**Fingerprints.** One browser profile drives the User-Agent and client hints together, so `Sec-CH-UA` never contradicts the UA. `Accept-Encoding` only advertises `zstd` when the running Node build can decompress it. `rotateUAOnEachRequest` defaults to `false`, because real browsers keep one identity for a session.

**Request shape.** The fingerprint matches the kind of request being made. A plain GET looks like a page load: `Sec-Fetch-Dest: document`, `Sec-Fetch-Mode: navigate`, `Sec-Fetch-User: ?1`, `Upgrade-Insecure-Requests: 1`, and an HTML `Accept`. A request with a JSON `Accept` header, or any request with a body, looks like a fetch: `Sec-Fetch-Dest: empty`, `Sec-Fetch-Mode: cors`, no `Sec-Fetch-User`, no `Upgrade-Insecure-Requests`, and `*/*` or a JSON `Accept`. A `Referer` header also sets `Sec-Fetch-Site` from the two origins. Headers you pass override the generated ones case-insensitively, so `user-agent` and `User-Agent` cannot both end up on the wire.

**Documentation.** `docs/api` is generated, never hand written, and CI fails when it drifts from `index.d.ts`. Windows is not in the test matrix because the fixture server builds its TLS certificate with the `openssl` binary, and the suite would lose HTTPS coverage there instead of failing honestly.

**Sinks.** A batch is retried before it is reported as failed, and a row missing its key field stops that batch instead of being written. Drivers are loaded lazily and never installed for you. File sinks with `replace` rewrite the whole file on every flush and keep the key set in memory, which is why the database sinks exist.

**Scheduling.** Schedules are UTC and use five cron fields. A job whose slot arrives while it is still running is skipped, a missed run is either skipped once or run once depending on `catchUp`, and a one-shot job disables itself after it runs.

**Compliance.** `robots.txt`, `Retry-After`, `X-Robots-Tag`, audit logs and field masking are off by default and only run when configured. What the library does with them is up to you.

**Redirects.** Every hop is checked, not just the first URL. When a hop changes origin, `Authorization`, `Cookie`, `Proxy-Authorization`, `X-Api-Key` and `X-Auth-Token` are dropped and any pinned IP is released, so the new host resolves on its own. A 302 or 303 turns a POST into a bodyless GET, while 307 and 308 keep the method and body. Chains that cross more than `maxCrossHostHops` hosts stop with `TOO_MANY_REDIRECTS`.

**Lifecycle.** A scraper holds keep-alive sockets and, when `observability.enabled` is set, a metrics server. Call `scraper.close()` when a script is done, otherwise Node keeps the process alive.

### Migrating to 5.5.0

Nothing changed by default. The one visible difference is the header set on requests that are not plain page loads: a POST, or a GET that asks for JSON, now sends `Sec-Fetch-Dest: empty` with `Sec-Fetch-Mode: cors` instead of looking like a browser navigation. That is the intended fix, and it makes a request look like what it is. If a target somehow requires the old navigation headers on a POST, set them explicitly with `headers: { 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' }`.

### Migrating to 5.4.0

Nothing changed by default. `singleFlight` is off and `staleWhileRevalidate` is off, so existing behaviour is unchanged until you opt in. If you enable stale-while-revalidate, a response past its TTL is now served once from cache with `stale: true` before the refreshed copy lands. If you have code that treats every `fromCache: true` as final, check `stale` as well.

### Migrating to 5.2.0

If a target relied on credentials being replayed across a cross-origin redirect, set `redirectPolicy: { forwardSensitiveHeaders: true }` to restore that. If a target relied on the IP pinned for the first host, redirects to a different host now re-resolve, which is the intended fix for DNS rebinding. `redirectPolicy.validateEachHop` can be turned off, but leaving it on is the point of that release.

## License

MIT. See [LICENSE](./LICENSE).
