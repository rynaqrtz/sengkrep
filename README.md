<div align="center">

<a href="https://i.postimg.cc/0ykVqtwd/sengkrep-ryna.gif">
  <img src="https://i.postimg.cc/0ykVqtwd/sengkrep-ryna.gif" alt="sengkrep" width="100%" />
</a>

<h1>sengkrep</h1>

<p>A reliability layer for web scraping in Node.js.</p>

[![npm version](https://img.shields.io/npm/v/sengkrep?color=black&style=flat-square)](https://www.npmjs.com/package/sengkrep)
[![node](https://img.shields.io/badge/node-%3E%3D18-black?style=flat-square)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-1-black?style=flat-square)](./package.json)
[![license](https://img.shields.io/npm/l/sengkrep?color=black&style=flat-square)](./LICENSE)

</div>

---

## What this is

`sengkrep` sits between your scraper and the network. Requests go out through Node's built-in `http`, `https` and `http2` modules, HTML is parsed with cheerio, and the library adds the parts a scraper needs once it runs for longer than a few minutes:

- retries with backoff that honor `Retry-After`
- a circuit breaker per host
- response caching and conditional requests (`ETag`, `Last-Modified`)
- selector health monitoring, so a layout change shows up before your data goes empty
- diff detection between runs against the same URL
- rate limiting and adaptive throttling per host
- proxy rotation, cookie jar, session pool, CSRF handling, token refresh
- resumable crawling, a distributed queue, and three storage backends
- network capture, so you can find the API a page calls without opening DevTools
- TypeScript definitions for the full public surface

Runtime dependency: cheerio. Everything else is Node built-ins.

## Install

```bash
npm install sengkrep
```

Node 18 or newer. Node 22.5 or newer additionally enables the `sqlite` storage backend via `node:sqlite`.

The package was published as `sengkrep-ryna` up to 3.4.0. That name is no longer maintained.

## Quick start

```js
const sengkrep = require('sengkrep');

const data = await sengkrep.extract('https://example.com/product/1', {
  title: 'h1',
  price: { selector: '.price', transform: (value) => parseFloat(value.replace(/[^0-9.]/g, '')) },
  stock: { selector: '.stock', default: 'unknown' },
});

console.log(data.title, data.price);
console.log(data._sengkrep.health, data._sengkrep.diff);
```

With configuration and your own instance:

```js
const scraper = sengkrep.create({
  retry: { max: 3 },
  circuitBreaker: { threshold: 5, cooldown: 60000 },
  cache: { ttl: 300, storage: 'memory' },
  rateLimit: { requestsPerSecond: 2 },
});

const page = await scraper.fetch('https://example.com');
const rows = await scraper.batch(['https://example.com/a', 'https://example.com/b'], { title: 'h1' });
```

## Command line

The package installs a `sengkrep` binary.

```bash
sengkrep help
sengkrep fetch <url>
sengkrep discover <origin>
sengkrep scrape <url> --schema '<json>' [options]
sengkrep capture <har|browser|proxy|playwright> [target] [options]
```

`sengkrep fetch <url>` prints the raw response body. `sengkrep discover <origin>` prints every URL found through `robots.txt` and `sitemap.xml`, one per line, then exits.

`sengkrep scrape` accepts these flags:

| Flag | Meaning |
|---|---|
| `--schema <json>` | Required. Extraction schema as a JSON string |
| `--format <fmt>` | `json` (default), `csv`, `ndjson`, `markdown` |
| `--output <path>` | Write to a file instead of stdout |
| `--pages <n>` | Follow pagination up to n pages |
| `--next <selector>` | CSS selector for the next link, or `auto` |
| `--items <selector>` | CSS selector for repeated item containers |
| `--proxy <url>` | Route requests through a proxy |
| `--delay <ms>` | Base delay between requests |

```bash
sengkrep scrape https://books.toscrape.com \
  --schema '{"title":"h1","price":".price_color"}' \
  --format csv --output books.csv \
  --pages 5 --next auto
```

`sengkrep capture` is documented under [Network capture](#network-capture).

## Network capture

Finding the API behind a JavaScript-heavy page usually means opening DevTools and copying requests by hand. The capture layer does that step for you. Four sources feed one analyzer:

| Source | Extra dependencies | What it sees |
|---|---|---|
| `CdpCapture` | none. The DevTools Protocol client and its WebSocket are built in | Full requests, responses, headers, bodies, websockets |
| `HarImporter` | none | Whatever a HAR file contains |
| `CaptureProxy` | none | Full bodies for plain HTTP, plus `CONNECT` metadata for HTTPS tunnels |
| `PlaywrightCapture` | your own Playwright install, never bundled | Full requests and responses |

### From a running browser

Start Chrome with the DevTools port open:

```bash
chrome --headless=new --remote-debugging-port=9222 https://app.example.com
```

Then capture:

```js
const sengkrep = require('sengkrep');

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

For `https://` targets a proxy without TLS interception only reports `CONNECT` metadata: host, port, bytes and duration. Use `CdpCapture` or `PlaywrightCapture` when the bodies matter.

### From a HAR file

```js
const capture = sengkrep.NetworkCapture.fromHar('./session.har');
console.log(capture.endpoints({ bodies: true }));
```

### Reading the results

| Call | Returns |
|---|---|
| `capture.entries` | Every normalized request and response |
| `capture.api()` | Only XHR, fetch and JSON traffic |
| `capture.filter({ method, status, host, url, api, failed })` | A filtered capture |
| `capture.endpoints()` | Grouped endpoints with `template`, `count`, `statuses`, `params` and an inferred JSON `schema` |
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

The capture CLI writes the same data:

```bash
sengkrep capture har session.har --out api.har --json
sengkrep capture browser https://app.example.com --cdp http://127.0.0.1:9222
sengkrep capture proxy --port 8899 --seconds 60 --out session.har
sengkrep capture playwright https://app.example.com --out session.har
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

Nested objects become dotted paths, arrays become wildcards and collisions take a longer key:

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

### Rendering without a browser package

`sengkrep.renderers.cdp()` returns a renderer backed by the DevTools Protocol, so `render: true` works against a Chrome you already run, with no Playwright or Puppeteer install.

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
| `cdp` | `Network.getAllCookies` from the browser |
| `cookies` | An array of cookie objects you already have |

```bash
sengkrep capture cookies cookies.txt --domain app.example.com
sengkrep capture cookies cookies.txt --out jar.json
```

## Core API

These methods exist on the default export (which holds one shared instance) and on any instance from `sengkrep.create(options)`.

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
| `nextSelector` | required | CSS selector for the next link, or `auto` for the built-in detector (`rel="next"`, common link text, common class names, numeric URL increments) |
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

Health, diff, validation and rate-limit metadata are attached to extraction results under `_sengkrep`, which is non-enumerable so it stays out of `JSON.stringify(data)`.

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
| `CircuitBreaker` | Opens after repeated failures on a key and closes again after a cooldown |
| `HealthMonitor` | Tracks field fill rates and selector matches over a rolling window, then alerts |
| `DiffDetector` | Compares structured results across runs and reports changes by severity |
| `SchemaValidator` | Per-field rules: `required`, `type`, `pattern`, `minLength`, `maxItems`, `custom` |
| `Incremental` | Sends `If-None-Match` and `If-Modified-Since`, and reports `notModified` |
| `Cache` | TTL cache with an LRU cap, in memory or on disk |
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
| `Storage` / `MemoryStorage` / `SqliteStorage` | Backends behind one `createStorage()` factory |
| `PluginSystem` | `beforeRequest` and `afterExtract` hooks |
| `PluginSystem` built-ins | `timestamp`, `logToFile`, `fieldMapper` |
| `ProgressBar` | Terminal progress for long runs |
| `SessionPool`, `WordPress`, `GraphQLClient` | Session reuse, WP REST helper, GraphQL client |
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
  cache: { ttl: 300, storage: 'memory' },
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
| `health` | enabled | `{ alertThreshold: 0.5, windowSize: 10, onAlert }` or `false` |
| `diff` | enabled | `{ storageDir: '.sengkrep', sensitivity: 'structural', onDiff, maxHistory: 500, backend }` or `false` |
| `cache` | `false` | `{ ttl, storage: 'memory' \| 'disk', storageDir, maxItems, backend }` |
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

### Validation rules

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

### Plugins

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

Always present, whatever the configuration: `sessionPool`, `wordpress`, `graphql`, `formHandler`, `deduplicator`, `proxyRotator`, `rateLimiter`, `fingerprint`, `observability`, `interceptors`, `cookieJar`.

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

## Testing

183 tests run against local fixture servers. No external network access is needed, so the suite works in CI, offline and on devices where outbound traffic is restricted.

```bash
npm test            # every test file
npm run typecheck   # tsc --noEmit against index.d.ts
npm run coverage    # c8 coverage summary
npm run bench       # local micro-benchmarks
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

## Version history

| Version | Changes |
|---|---|
| 5.3.0 | `CdpRenderer` and `sengkrep.renderers.cdp()` for `render: true` without Playwright, `capture.toSchema()` and `capture.toScript()` to turn a capture into working code, WebSocket frames recorded and read with `capture.frames()`, cookie import from CDP or a `cookies.txt` file, and `scraper.close()` so a script can exit on its own |
| 5.2.0 | Redirect hops go through the security guard, cross-origin redirects drop `Authorization` and `Cookie`, the pinned lookup is dropped when the host changes, every `::ffff:` IPv6 form is classified, `CaptureProxy` strips `Proxy-Authorization`, `PaginationDetector` and the `capture` namespace are typed, and `test/types/usage.ts` is part of `npm run typecheck` |
| 5.1.0 | Network capture: `NetworkCapture`, `CdpCapture`, `CaptureProxy`, `PlaywrightCapture`, `HarImporter`, and the `sengkrep capture` command |
| 5.0.0 | Package renamed to `sengkrep`. Main class renamed to `Sengkrep`, result metadata moved to `data._sengkrep`, state files named `.sengkrep*` |
| 4.0.0 | Unified transport, coherent browser fingerprints, adaptive throttling, content dedup, storage backends, distributed queue leases, compliance mode, Prometheus metrics |
| 3.4.x | `Retry-After` handling, truncated-response detection, `robots.txt` checks, duplicate pagination detection |

## Architecture

```
sengkrep/
├── index.js / index.d.ts   Entry point and TypeScript definitions
├── bin/sengkrep.js         CLI
├── test/                   Fixture-driven test suite
└── src/
    ├── Sengkrep.js         Orchestrator, wires every module together
    ├── core/               Transport, Fetcher, Http2Fetcher, ProxyTunnel, Extractor, JsonExtractor, Retry
    ├── capture/            NetworkCapture, CdpCapture, CaptureProxy, PlaywrightCapture,
    │                       HarImporter, WebSocketClient, analyze
    ├── modules/            Reliability, identity, performance and operations modules
    └── utils/              contentSafety, encodingUtils, microdata, scriptExtractor,
                            urlUtils, streamWriter, exporter, contentHandlers
```

The `extract()` path, in order:

```
plugins.beforeRequest
  -> SecurityGuard -> CircuitBreaker -> Cache
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

## Behavior notes

**Transport.** HTTPS origins use HTTP/2 when `http2: true`. If the server refuses h2, the request falls back to HTTP/1.1. Timeouts and HTTP status errors are never retried on the other protocol, so a 500 stays a 500.

**Fingerprints.** A single browser profile drives the User-Agent and client hints together, so `Sec-CH-UA` never contradicts the UA. `Accept-Encoding` only advertises `zstd` when the running Node build can decompress it. `rotateUAOnEachRequest` defaults to `false`, because real browsers keep one identity for a session.

**Compliance.** `robots.txt`, `Retry-After`, `X-Robots-Tag`, audit logs and field masking are off by default and only run when configured. What the library does with them is up to you.

**Lifecycle.** A scraper holds keep-alive sockets and, when `observability.enabled` is set, a metrics server. Call `scraper.close()` when a script is done, otherwise Node keeps the process alive. Generated scripts from `capture.toScript()` already do this.

**Redirects.** Every hop is checked, not just the first URL. When a hop changes origin, `Authorization`, `Cookie`, `Proxy-Authorization`, `X-Api-Key` and `X-Auth-Token` are dropped and any pinned IP is released, so the new host resolves on its own. A 302 or 303 turns a POST into a bodyless GET, while 307 and 308 keep the method and body. Chains that cross more than `maxCrossHostHops` hosts stop with `TOO_MANY_REDIRECTS`.

### Migrating to 5.2.0

If a target relied on credentials being replayed across a cross-origin redirect, set `redirectPolicy: { forwardSensitiveHeaders: true }` to restore that. If a target relied on the IP pinned for the first host, redirects to a different host now re-resolve, which is the intended fix for DNS rebinding. `redirectPolicy.validateEachHop` can be turned off, but leaving it on is the point of the release.

## License

MIT. See [LICENSE](./LICENSE).
