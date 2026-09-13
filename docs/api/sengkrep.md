# Sengkrep

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Sengkrep(options?: SengkrepOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `fingerprint` | `Fingerprint` | yes |  |
| `cookieJar` | `CookieJar \| null` | yes |  |
| `interceptors` | `Interceptors` | yes |  |
| `plugins` | `PluginSystem` | yes |  |
| `pluginSystem` | `PluginSystem` | yes |  |
| `cache` | `Cache \| null` | yes |  |
| `rateLimiter` | `RateLimiter` | yes |  |
| `proxyRotator` | `ProxyRotator` | yes |  |
| `security` | `SecurityGuard` | yes |  |
| `securityGuard` | `SecurityGuard` | yes |  |
| `circuitBreaker` | `CircuitBreaker \| null` | yes |  |
| `incremental` | `Incremental \| null` | yes |  |
| `csrf` | `CsrfHandler` | yes |  |
| `csrfHandler` | `CsrfHandler` | yes |  |
| `auth` | `AuthManager` | yes |  |
| `authManager` | `AuthManager` | yes |  |
| `sessionPool` | `SessionPool` | yes |  |
| `observability` | `Observability` | yes |  |
| `dnsCache` | `DnsCache \| null` | yes |  |
| `formHandler` | `FormHandler` | yes |  |
| `deduplicator` | `UrlDeduplicator` | yes |  |
| `health` | `HealthMonitor \| null` | yes |  |
| `healthMonitor` | `HealthMonitor \| null` | yes |  |
| `diff` | `DiffDetector \| null` | yes |  |
| `diffDetector` | `DiffDetector \| null` | yes |  |
| `validator` | `SchemaValidator \| null` | yes |  |
| `wordpress` | `WordPress` | yes |  |
| `graphql` | `GraphQLClient` | yes |  |
| `transport` | `Transport` | yes |  |
| `singleFlight` | `SingleFlight` | yes |  |
| `blockDetector` | `BlockDetector \| null` | yes |  |
| `blockMode` | `'report' \| 'retry' \| 'throw' \| null` | yes |  |
| `identityPool` | `IdentityPool \| null` | yes |  |
| `scheduler` | `Scheduler \| null` | yes |  |
| `adaptive` | `AdaptiveThrottle \| null` | yes |  |
| `contentDedup` | `ContentDedup \| null` | yes |  |
| `compliance` | `ComplianceOptions \| null` | yes |  |
| `renderer` | `RendererFn \| null` | yes |  |
| `renderEnabled` | `boolean` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `fetch` | `url: string, options?: { params?: Record<string, unknown>; request?: RequestConfig }` | `Promise<RawResponse>` |  |
| `load` | `html: string` | `CheerioAPI` |  |
| `probe` | `url: string, options?: { request?: RequestConfig; detector?: BlockDetector }` | `Promise<ProbeResult>` |  |
| `auto` | `url: string, options?: AutoOptions` | `Promise<AutoResult>` |  |
| `extract` | `url: string, schema: Schema<T>, options?: ExtractOptions` | `Promise<ExtractResult<T>>` |  |
| `batch` | `urls: string[], schema: Schema<T>, options?: BatchOptions` | `Promise<BatchResult<T>[]>` |  |
| `stream` | `urls: string[], schema: Schema<T>, options?: BatchOptions` | `AsyncGenerator<BatchResult<T>>` |  |
| `paginate` | `startUrl: string, config: PaginationConfig, schema: Schema<T>, options?: ExtractOptions` | `Promise<T[]>` |  |
| `crawl` | `options: CrawlOptions` | `CrawlJob` |  |
| `login` | `url: string, formData?: Record<string, unknown>, options?: { headers?: Record<string, string> }` | `Promise<boolean>` |  |
| `submitForm` | `url: string, formSelector: string, overrides?: Record<string, unknown>` | `Promise<{ status: number; headers: Record<string, unknown>; body: string; url: string }>` |  |
| `discover` | `origin: string, options?: { maxDepth?: number; maxEntries?: number; pattern?: RegExp }` | `Promise<string[]>` |  |
| `isAllowed` | `url: string, userAgent?: string` | `Promise<boolean>` |  |
| `getCrawlDelay` | `origin: string, userAgent?: string` | `Promise<number \| null>` |  |
| `export` | `input: string \| string[] \| unknown, schema?: Record<string, SchemaField>, options?: Record<string, unknown>` | `Promise<string>` |  |
| `inferSchema` | `url: string, options?: { hints?: string[]; list?: boolean }` | `Promise<SchemaInferenceResult>` |  |
| `distributedQueue` | `options?: ConstructorParameters<typeof DistributedQueue>[0]` | `DistributedQueue` |  |
| `extractJsonLd` | `url: string` | `Promise<Record<string, unknown>[]>` |  |
| `extractMicrodata` | `url: string` | `Promise<Record<string, unknown>[]>` |  |
| `extractDataAttributes` | `url: string, selector: string` | `Promise<Record<string, unknown>[]>` |  |
| `extractScripts` | `url: string` | `Promise<Array<{ inline: boolean; src: string \| null; type: string; content: string \| null }>>` |  |
| `getObservabilityReport` |  | `ObservabilityReport` |  |
| `saveHar` | `filePath: string` | `void` |  |
| `flush` |  | `Promise<number>` |  |
| `close` |  | `void` |  |

## Related

- [AdaptiveThrottle](./adaptive-throttle.md)
- [AuthManager](./auth-manager.md)
- [AutoOptions](./auto-options.md)
- [AutoResult](./auto-result.md)
- [BatchOptions](./batch-options.md)
- [BatchResult](./batch-result.md)
- [BlockDetector](./block-detector.md)
- [Cache](./cache.md)
- [CircuitBreaker](./circuit-breaker.md)
- [ComplianceOptions](./compliance-options.md)
- [ContentDedup](./content-dedup.md)
- [CookieJar](./cookie-jar.md)
- [CrawlJob](./crawl-job.md)
- [CrawlOptions](./crawl-options.md)
- [CsrfHandler](./csrf-handler.md)
- [DiffDetector](./diff-detector.md)
- [DistributedQueue](./distributed-queue.md)
- [DnsCache](./dns-cache.md)
- [ExtractOptions](./extract-options.md)
- [ExtractResult](./extract-result.md)
- [Fingerprint](./fingerprint.md)
- [FormHandler](./form-handler.md)
- [GraphQLClient](./graph-qlclient.md)
- [HealthMonitor](./health-monitor.md)
- [IdentityPool](./identity-pool.md)
- [Incremental](./incremental.md)
- [Interceptors](./interceptors.md)
- [Observability](./observability.md)
- [ObservabilityReport](./observability-report.md)
- [PaginationConfig](./pagination-config.md)
- [PluginSystem](./plugin-system.md)
- [ProbeResult](./probe-result.md)
- [ProxyRotator](./proxy-rotator.md)
- [RateLimiter](./rate-limiter.md)
- [RawResponse](./raw-response.md)
- [RendererFn](./renderer-fn.md)
- [RequestConfig](./request-config.md)
- [Scheduler](./scheduler.md)
- [Schema](./schema.md)
- [SchemaField](./schema-field.md)
- [SchemaInferenceResult](./schema-inference-result.md)
- [SchemaValidator](./schema-validator.md)
- [SecurityGuard](./security-guard.md)
- [SengkrepOptions](./sengkrep-options.md)
- [SessionPool](./session-pool.md)
- [SingleFlight](./single-flight.md)
- [Transport](./transport.md)
- [UrlDeduplicator](./url-deduplicator.md)
- [WordPress](./word-press.md)
- [auto](./auto.md)

## Declaration

```ts
class Sengkrep { ... }
```
