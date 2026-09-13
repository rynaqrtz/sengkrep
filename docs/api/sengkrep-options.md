# SengkrepOptions

interface

Category: Options · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `logLevel` | `'error' \| 'warn' \| 'info' \| 'debug'` | no |  |
| `logPretty` | `boolean` | no |  |
| `baseURL` | `string \| null` | no |  |
| `timeout` | `number` | no |  |
| `maxRedirects` | `number` | no |  |
| `redirectPolicy` | `RedirectPolicyOptions` | no |  |
| `keepAlive` | `boolean` | no |  |
| `delay` | `number` | no |  |
| `delayMin` | `number` | no |  |
| `delayMax` | `number` | no |  |
| `maxMemoryBuffer` | `number` | no |  |
| `responseType` | `'auto' \| 'html' \| 'json' \| 'rss' \| 'csv'` | no |  |
| `cookies` | `boolean` | no |  |
| `http2` | `boolean` | no |  |
| `fingerprint` | `FingerprintOptions` | no |  |
| `retry` | `RetryOptions` | no |  |
| `health` | `HealthOptions \| false` | no |  |
| `diff` | `DiffOptions \| false` | no |  |
| `cache` | `CacheOptions \| false` | no |  |
| `circuitBreaker` | `CircuitBreakerOptions \| false` | no |  |
| `incremental` | `{ storageDir?: string } \| boolean` | no |  |
| `rateLimit` | `RateLimitOptions` | no |  |
| `proxies` | `string[]` | no |  |
| `proxyStrategy` | `'round-robin' \| 'random' \| 'sticky'` | no |  |
| `proxyMaxFailures` | `number` | no |  |
| `dns` | `{ ttl?: number } \| boolean` | no |  |
| `sessionPool` | `SessionPoolOptions` | no |  |
| `security` | `SecurityOptions` | no |  |
| `auth` | `AuthOptions` | no |  |
| `csrf` | `CsrfOptions` | no |  |
| `observability` | `ObservabilityOptions` | no |  |
| `webhook` | `WebhookOptions` | no |  |
| `har` | `boolean` | no |  |
| `validate` | `Record<string, ValidationRule>` | no |  |
| `dedup` | `Record<string, unknown>` | no |  |
| `adaptive` | `AdaptiveThrottleOptions \| boolean` | no |  |
| `dedupContent` | `ContentDedupOptions \| boolean` | no |  |
| `compliance` | `ComplianceOptions \| false` | no |  |
| `renderer` | `RendererInput` | no |  |
| `render` | `boolean` | no |  |
| `singleFlight` | `SingleFlightOptions \| boolean` | no |  |
| `blocks` | `BlockOptions \| boolean` | no |  |
| `identity` | `IdentityPoolOptions \| boolean` | no |  |
| `identities` | `Array<Identity \| IdentitySpec>` | no |  |
| `identitySession` | `string` | no |  |
| `scheduler` | `SchedulerOptions \| boolean` | no |  |
| `robotsTtl` | `number` | no |  |
| `tempFileTtl` | `number` | no |  |
| `connectTimeout` | `number` | no |  |
| `totalTimeout` | `number` | no |  |
| `storage` | `StorageOptions` | no |  |

## Related

- [AdaptiveThrottleOptions](./adaptive-throttle-options.md)
- [AuthOptions](./auth-options.md)
- [BlockOptions](./block-options.md)
- [CacheOptions](./cache-options.md)
- [CircuitBreakerOptions](./circuit-breaker-options.md)
- [ComplianceOptions](./compliance-options.md)
- [ContentDedupOptions](./content-dedup-options.md)
- [CsrfOptions](./csrf-options.md)
- [DiffOptions](./diff-options.md)
- [FingerprintOptions](./fingerprint-options.md)
- [HealthOptions](./health-options.md)
- [Identity](./identity.md)
- [IdentityPoolOptions](./identity-pool-options.md)
- [IdentitySpec](./identity-spec.md)
- [ObservabilityOptions](./observability-options.md)
- [RateLimitOptions](./rate-limit-options.md)
- [RedirectPolicyOptions](./redirect-policy-options.md)
- [RendererInput](./renderer-input.md)
- [RetryOptions](./retry-options.md)
- [SchedulerOptions](./scheduler-options.md)
- [SecurityOptions](./security-options.md)
- [SessionPoolOptions](./session-pool-options.md)
- [SingleFlightOptions](./single-flight-options.md)
- [StorageOptions](./storage-options.md)
- [ValidationRule](./validation-rule.md)
- [WebhookOptions](./webhook-options.md)

## Declaration

```ts
interface SengkrepOptions { ... }
```
