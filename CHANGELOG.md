# Changelog

All notable changes to `sengkrep` are listed here. Versions follow [Semantic Versioning](https://semver.org/).

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
