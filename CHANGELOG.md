# Changelog

All notable changes to `sengkrep` are listed here. Versions follow [Semantic Versioning](https://semver.org/).

## 5.5.0

### Added

- `Scheduler` and `sengkrep.Scheduler`. Jobs run on a five-field cron expression in UTC, an interval (`{ every: '30s' }`, `{ everyMs }` or `{ ms }`) or a single time (`{ at }`). A job whose slot arrives while it is still running is skipped, `concurrency` caps how many different jobs run at once, and `runNow`, `pause`, `resume`, `remove` and `tick` are available. Events are `run`, `run:error`, `tick`, `start` and `stop`.
- `JobStore` and `sengkrep.JobStore`. Job records live behind the same `file`, `memory` and `sqlite` backends as the cache, so `nextRunAt`, the last status and the run counters survive a restart. Any object with `get`, `set`, `delete` and `list` can be injected instead.
- `sengkrep.cron` exposes `parseCron`, `nextCronTime`, `parseDuration`, `formatDuration`, `nextRunTime`, `scheduleKind` and `scheduleLabel` for inspecting a schedule without running it.
- `create({ scheduler })` wires a scheduler into the instance, including jobs declared inline with a handler. `scraper.close()` stops it.

### Fixed

- The fingerprint sent navigation headers on every request, so a POST or a JSON call still claimed `Sec-Fetch-Dest: document` with `Sec-Fetch-Mode: navigate`. The headers now follow the request: `document` and `navigate` for a plain GET, `empty` and `cors` for a request that asks for JSON or carries a body, and `Sec-Fetch-Site` is derived from a `Referer` header when one is set.
- Caller headers now override generated ones case-insensitively. Passing `accept` used to leave both `accept` and `Accept` on the same request, and which one won depended on the randomized header order.

## 5.4.0

### Added

- `singleFlight`. Concurrent requests for the same method, URL and body now share one outbound request, and an error is shared the same way. Off by default. `SingleFlight` is exported on its own, with `key()`, `run()`, `stats()` and `clear()`.
- `cache.staleWhileRevalidate` and `cache.staleTtl`. A cache entry past its TTL is served immediately with `stale: true` while a background request refreshes it. Only one revalidation runs per key, even under a burst of concurrent reads, and a failed revalidation keeps the stale entry in place.
- `cache.lookup()` returns `{ data, stale, age }` instead of the raw entry, and `cache.stats()` reports `stale`, `revalidations`, `revalidating` and a `hitRate` that counts stale serves as hits.
- `scraper.flush()` waits for pending background revalidations and resolves to how many were waiting.
- `res.stale` on a response, set only when a stale cache entry was served.

### Changed

- `Cache.get()` still returns the stored value, while `lookup()` now carries the freshness information a caller needs to decide whether to revalidate.

## 5.3.1

### Fixed

- `engines.node` said `>=18.0.0`, but the `cheerio` dependency pulls `undici`, which needs Node 20.18.1 or newer. On Node 18 the package could not even be loaded, so the declared support was wrong. Raised to `>=20.18.1` and dropped Node 18 from CI, which had been failing on every run since.

## 5.3.0

### Added

- `CdpRenderer` and `sengkrep.renderers.cdp()`. `render: true` now works through the DevTools Protocol without installing Playwright or Puppeteer. Options cover `waitForSelector`, `idleMs`, a custom `expression` and `includeMeta`.
- `capture.toSchema(endpoint)` turns the captured JSON schema into path expressions for `extract()`. Nested objects become dotted paths, arrays become `[]` wildcards, and colliding keys get a longer name.
- `capture.toScript(endpoint)` returns a runnable `.js` file that uses `extract()`, `Retry` and `RateLimiter`. Credentials are redacted by default.
- `scraper.close()` releases keep-alive sockets and the metrics server. Generated scripts call it, so they exit on their own.
- WebSocket frames are recorded through `Network.webSocketFrameSent` and `Network.webSocketFrameReceived`, with `maxFramesPerSocket` and `framesTruncated`, and read back with `capture.frames(id)`.
- `sengkrep.importCookies(jar, options)` fills a `CookieJar` from a `cookies.txt` file, a string, cookie JSON, or a running browser via `Network.getAllCookies`. `CdpCapture.exportCookies()` returns the browser list.
- CLI: `sengkrep capture cookies <file>`, plus `--schema`, `--script` and `--script-out` on `sengkrep capture`.
- `test/10-renderer-and-codegen.js`, 17 tests.

### Changed

- `CdpCapture` now stores WebSocket entries in the request index, so later frames attach to the socket they belong to.
- `Fetcher.close()` and `Transport.close()` also destroy the HTTP agents and remove temp stream files.

### Migration

- Nothing breaks. The renderer is opt-in: `render: true` without a renderer behaves as before.
- `capture.frames()` returns an empty array for a request that has no frames, and throws for an unknown id.

## 5.2.0

### Security

- Every redirect hop now goes through `SecurityGuard`. Before this release the guard only ran on the first URL, so a server could answer `302` to an internal address and the request would follow it (`SECURITY_BLOCKED` is raised at the hop that fails).
- Cross-origin redirects drop `Authorization`, `Cookie`, `Proxy-Authorization`, `X-Api-Key` and `X-Auth-Token`. Set `redirectPolicy.forwardSensitiveHeaders: true` to keep the old behaviour.
- The pinned IP from the first hop is released when the hostname changes, so the new host resolves on its own. This closes a DNS rebinding window.
- `isPrivateIPv6()` decodes every `::ffff:` form, including hex-only mapped addresses such as `::ffff:7f00:1`.
- `CaptureProxy` strips `Proxy-Authorization` before forwarding a request upstream.

### Added

- `redirectPolicy` option: `validateEachHop` (default `true`), `forwardSensitiveHeaders` (default `false`), `maxCrossHostHops` (default `3`).
- `TOO_MANY_REDIRECTS` is raised when a chain crosses more hosts than the cap allows.
- `test/09-security-redirect.js`, 12 tests covering the fixes above.
- `test/types/usage.ts`, a TypeScript sample that is part of `npm run typecheck`.

### Changed

- `HTTP/2` requests no longer fall back to HTTP/1.1 after a `SECURITY_BLOCKED` result.
- `PaginationDetector` and the `capture` namespace in `index.d.ts` are fully typed instead of `unknown` and `Record<string, never[]>`.

### Migration

- If a target relied on credentials surviving a cross-origin redirect, enable `redirectPolicy.forwardSensitiveHeaders`.
- If a target relied on the pinned IP surviving a redirect to another host, that no longer happens. This is the intended fix.
- `validateEachHop` can be disabled, but the default is what the release is for.

## 5.1.0

- Network capture: `NetworkCapture`, `CdpCapture`, `CaptureProxy`, `PlaywrightCapture`, `HarImporter`, a zero dependency WebSocket client, endpoint and JSON schema analysis, and the `sengkrep capture` command.

## 5.0.0

- Package renamed from `sengkrep-ryna` to `sengkrep`.
- Main class renamed from `Ryna` to `Sengkrep`, result metadata moved to `data._sengkrep`, state files named `.sengkrep*`, metrics renamed to `sengkrep_*`.

## 4.0.0

- Unified HTTP/1.1 and HTTP/2 transport.
- Coherent browser fingerprints, adaptive throttling, content dedup, pluggable storage backends, distributed queue leases, compliance mode, Prometheus metrics.

## 3.4.x

- `Retry-After` handling, truncated response detection, `robots.txt` checks, duplicate pagination detection.
