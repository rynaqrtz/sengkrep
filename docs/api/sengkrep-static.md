# SengkrepStatic

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Call signatures

```ts
(url: string, schema: Schema<T>, options?: ExtractOptions) => Promise<ExtractResult<T>>
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `Sengkrep` | `typeof Sengkrep` | yes |  |
| `Fingerprint` | `typeof Fingerprint` | yes |  |
| `HealthMonitor` | `typeof HealthMonitor` | yes |  |
| `DiffDetector` | `typeof DiffDetector` | yes |  |
| `SchemaValidator` | `typeof SchemaValidator` | yes |  |
| `Cache` | `typeof Cache` | yes |  |
| `CookieJar` | `typeof CookieJar` | yes |  |
| `RateLimiter` | `typeof RateLimiter` | yes |  |
| `ProxyRotator` | `typeof ProxyRotator` | yes |  |
| `Interceptors` | `typeof Interceptors` | yes |  |
| `Webhook` | `typeof Webhook` | yes |  |
| `Discover` | `typeof Discover` | yes |  |
| `SecurityGuard` | `typeof SecurityGuard` | yes |  |
| `CircuitBreaker` | `typeof CircuitBreaker` | yes |  |
| `Incremental` | `typeof Incremental` | yes |  |
| `CsrfHandler` | `typeof CsrfHandler` | yes |  |
| `AuthManager` | `typeof AuthManager` | yes |  |
| `SessionPool` | `typeof SessionPool` | yes |  |
| `PluginSystem` | `typeof PluginSystem` | yes |  |
| `CrawlQueue` | `typeof CrawlQueue` | yes |  |
| `Observability` | `typeof Observability` | yes |  |
| `HarRecorder` | `typeof HarRecorder` | yes |  |
| `NetworkCapture` | `typeof NetworkCapture` | yes |  |
| `CdpCapture` | `typeof CdpCapture` | yes |  |
| `CaptureProxy` | `typeof CaptureProxy` | yes |  |
| `PlaywrightCapture` | `typeof PlaywrightCapture` | yes |  |
| `HarImporter` | `typeof HarImporter` | yes |  |
| `CdpRenderer` | `typeof CdpRenderer` | yes |  |
| `renderers` | `{ cdp: typeof createCdpRenderer; }` | yes |  |
| `capture` | `{ NetworkCapture: typeof NetworkCapture; CdpCapture: typeof CdpCapture; CdpSession: typeof CdpSession; CdpRenderer: typeof CdpRenderer; Browser: typeof Browser; CaptureProxy: typeof CaptureProxy; PlaywrightCapture: typeof PlaywrightCapture; HarImporter: typeof HarImporter; createCdpRenderer: typeof createCdpRenderer; renderers: { cdp: typeof createCdpRenderer; }; importCookies(jar: CookieJar, options?: CookieImportOptions): Promise<number>; parseCookieFile(text: string): CaptureCookie[]; DEFAULT_CDP_HOST: string; httpGetJson(url: string, options?: { timeout?: number }): Promise<unknown>; analyze: CaptureAnalyze; codegen: CaptureCodegen; cookies: CaptureCookies; entry: CaptureEntryModule; ws: CaptureWs; }` | yes |  |
| `WordPress` | `typeof WordPress` | yes |  |
| `GraphQLClient` | `typeof GraphQLClient` | yes |  |
| `DnsCache` | `typeof DnsCache` | yes |  |
| `FormHandler` | `typeof FormHandler` | yes |  |
| `ProgressBar` | `typeof ProgressBar` | yes |  |
| `PaginationDetector` | `PaginationDetectorModule` | yes |  |
| `DistributedQueue` | `typeof DistributedQueue` | yes |  |
| `MemoryAdapter` | `typeof MemoryAdapter` | yes |  |
| `StreamWriter` | `typeof StreamWriter` | yes |  |
| `Sink` | `typeof Sink` | yes |  |
| `MemorySink` | `typeof MemorySink` | yes |  |
| `FileSink` | `typeof FileSink` | yes |  |
| `SqlSink` | `typeof SqlSink` | yes |  |
| `PostgresSink` | `typeof PostgresSink` | yes |  |
| `MySQLSink` | `typeof MySQLSink` | yes |  |
| `ClickHouseSink` | `typeof ClickHouseSink` | yes |  |
| `S3Sink` | `typeof S3Sink` | yes |  |
| `sinks` | `{ Sink: typeof Sink; MemorySink: typeof MemorySink; FileSink: typeof FileSink; SqlSink: typeof SqlSink; PostgresSink: typeof PostgresSink; MySQLSink: typeof MySQLSink; ClickHouseSink: typeof ClickHouseSink; S3Sink: typeof S3Sink; createSink: typeof createSink; }` | yes |  |
| `createSink` | `typeof createSink` | yes |  |
| `UrlDeduplicator` | `typeof UrlDeduplicator` | yes |  |
| `Retry` | `typeof Retry` | yes |  |
| `Fetcher` | `typeof Fetcher` | yes |  |
| `Http2Fetcher` | `typeof Http2Fetcher` | yes |  |
| `Transport` | `typeof Transport` | yes |  |
| `AdaptiveThrottle` | `typeof AdaptiveThrottle` | yes |  |
| `SingleFlight` | `typeof SingleFlight` | yes |  |
| `BlockDetector` | `typeof BlockDetector` | yes |  |
| `BlockError` | `typeof BlockError` | yes |  |
| `Identity` | `typeof Identity` | yes |  |
| `IdentityPool` | `typeof IdentityPool` | yes |  |
| `jsonPath` | `typeof jsonPath` | yes |  |
| `isJsonPath` | `typeof isJsonPath` | yes |  |
| `auto` | `typeof auto` | yes |  |
| `Browser` | `typeof Browser` | yes |  |
| `Doctor` | `{ (options?: DoctorOptions): Promise<DoctorReport>; MIN_NODE: string; SQLITE_NODE: string; OPTIONAL_DRIVERS: DoctorDriver[]; compareVersions(left: string, right: string): number; }` | yes |  |
| `Scheduler` | `typeof Scheduler` | yes |  |
| `JobStore` | `typeof JobStore` | yes |  |
| `cron` | `CronModule` | yes |  |
| `ContentDedup` | `typeof ContentDedup` | yes |  |
| `SqliteStorage` | `typeof SqliteStorage` | yes |  |
| `Storage` | `typeof Storage` | yes |  |
| `MemoryStorage` | `typeof MemoryStorage` | yes |  |
| `createStorage` | `typeof createStorage` | yes |  |
| `cheerio` | `{ load: (html: string) => CheerioAPI }` | yes |  |
| `plugins` | `{ timestamp: (fieldName?: string) => PluginHooks; logToFile: (filePath: string) => PluginHooks; fieldMapper: (mapping: Record<string, string>) => PluginHooks; }` | yes |  |
| `contentSafety` | `{ sniffContentType(buffer: Buffer): string \| null; isLikelyBinary(buffer: Buffer): boolean; decodeBuffer(buffer: Buffer, options?: { headerCharset?: string \| null }): { text: string; charset: string; source: string }; inspect(buffer: Buffer, contentType?: string \| null): { isBinary: boolean; sniffedType: string \| null; declaredType: string \| null; mismatch: boolean; size: number }; }` | yes |  |
| `errors` | `{ FetchError: typeof FetchError; TimeoutError: typeof TimeoutError; CanceledError: typeof CanceledError; ProxyError: typeof ProxyError; Http2Error: typeof Http2Error; ExtractionError: typeof ExtractionError; JsonExtractionError: typeof JsonExtractionError; ValidationError: typeof ValidationError; SecurityError: typeof SecurityError; CircuitOpenError: typeof CircuitOpenError; BlockError: typeof BlockError; }` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `create` | `options?: SengkrepOptions` | `Sengkrep` |  |
| `fetch` | `url: string, options?: { params?: Record<string, unknown>; request?: RequestConfig }` | `Promise<RawResponse>` |  |
| `load` | `html: string` | `CheerioAPI` |  |
| `extract` | `url: string, schema: Schema<T>, options?: ExtractOptions` | `Promise<ExtractResult<T>>` |  |
| `batch` | `urls: string[], schema: Schema<T>, options?: BatchOptions` | `Promise<BatchResult<T>[]>` |  |
| `stream` | `urls: string[], schema: Schema<T>, options?: BatchOptions` | `AsyncGenerator<BatchResult<T>>` |  |
| `paginate` | `startUrl: string, config: PaginationConfig, schema: Schema<T>, options?: ExtractOptions` | `Promise<T[]>` |  |
| `login` | `url: string, formData?: Record<string, unknown>, options?: Record<string, unknown>` | `Promise<boolean>` |  |
| `discover` | `origin: string, options?: Record<string, unknown>` | `Promise<string[]>` |  |
| `isAllowed` | `url: string, userAgent?: string` | `Promise<boolean>` |  |
| `getCrawlDelay` | `origin: string, userAgent?: string` | `Promise<number \| null>` |  |
| `export` | `input: string \| string[] \| unknown, schema?: Record<string, SchemaField>, options?: Record<string, unknown>` | `Promise<string>` |  |
| `crawl` | `options: CrawlOptions` | `CrawlJob` |  |
| `submitForm` | `url: string, formSelector: string, overrides?: Record<string, unknown>` | `Promise<unknown>` |  |
| `inferSchema` | `url: string, options?: Record<string, unknown>` | `Promise<SchemaInferenceResult>` |  |
| `probe` | `url: string, options?: { request?: RequestConfig; detector?: BlockDetector }` | `Promise<ProbeResult>` |  |
| `auto` | `url: string, options?: AutoOptions` | `Promise<AutoResult>` |  |
| `captureHar` | `input: string \| HarLog, options?: Record<string, unknown>` | `NetworkCapture` |  |
| `captureUrl` | `url: string, options?: CdpCaptureOptions` | `Promise<NetworkCapture>` |  |
| `importCookies` | `jar: CookieJar, options?: CookieImportOptions` | `Promise<number>` |  |
| `parseCookieFile` | `text: string` | `CaptureCookie[]` |  |
| `doctor` | `options?: DoctorOptions` | `Promise<DoctorReport>` |  |
| `exportData` | `data: unknown, options?: { format?: string; path?: string }` | `string` |  |
| `toCSV` | `data: unknown[]` | `string` |  |
| `toJSON` | `data: unknown` | `string` |  |
| `toNDJSON` | `data: unknown[]` | `string` |  |
| `toMarkdownTable` | `data: unknown[]` | `string` |  |
| `parseFeed` | `xml: string` | `{ type: 'rss' \| 'atom' \| 'unknown'; title: string \| null; items: unknown[] }` |  |
| `parseCSV` | `text: string` | `Record<string, string>[]` |  |
| `extractJsonLd` | `$: CheerioAPI` | `Record<string, unknown>[]` |  |
| `extractMicrodata` | `$: CheerioAPI` | `Record<string, unknown>[]` |  |
| `extractDataAttributes` | `$: CheerioAPI, selector: string` | `Record<string, unknown>[]` |  |
| `extractScripts` | `$: CheerioAPI, baseUrl: string` | `Array<{ inline: boolean; src: string \| null; type: string; content: string \| null }>` |  |
| `extractSourceMapUrl` | `jsText: string` | `string \| null` |  |
| `beautifyJs` | `jsText: string, indentSize?: number` | `string` |  |
| `normalizeUrl` | `url: string, options?: Record<string, unknown>` | `string` |  |
| `extractLinks` | `$: CheerioAPI, baseUrl: string, options?: Record<string, unknown>` | `string[]` |  |
| `decodeHtmlEntities` | `text: string` | `string` |  |
| `decodeUnicodeEscapes` | `text: string` | `string` |  |
| `decodeBase64` | `str: string` | `string` |  |
| `decodeHex` | `str: string` | `string` |  |
| `detectAndDecode` | `str: string` | `{ encoding: 'base64' \| 'hex' \| null; decoded: string }` |  |
| `xorDecode` | `str: string \| Buffer, key: string` | `Buffer` |  |
| `caesarDecode` | `str: string, shift: number` | `string` |  |
| `rot13` | `str: string` | `string` |  |
| `parseJSONP` | `text: string` | `{ callback: string; data: unknown } \| null` |  |

## Related

- [AdaptiveThrottle](./adaptive-throttle.md)
- [AuthManager](./auth-manager.md)
- [AutoOptions](./auto-options.md)
- [AutoResult](./auto-result.md)
- [BatchOptions](./batch-options.md)
- [BatchResult](./batch-result.md)
- [BlockDetector](./block-detector.md)
- [BlockError](./block-error.md)
- [Browser](./browser.md)
- [Cache](./cache.md)
- [CanceledError](./canceled-error.md)
- [CaptureAnalyze](./capture-analyze.md)
- [CaptureCodegen](./capture-codegen.md)
- [CaptureCookie](./capture-cookie.md)
- [CaptureCookies](./capture-cookies.md)
- [CaptureEntryModule](./capture-entry-module.md)
- [CaptureProxy](./capture-proxy.md)
- [CaptureWs](./capture-ws.md)
- [CdpCapture](./cdp-capture.md)
- [CdpCaptureOptions](./cdp-capture-options.md)
- [CdpRenderer](./cdp-renderer.md)
- [CdpSession](./cdp-session.md)
- [CircuitBreaker](./circuit-breaker.md)
- [CircuitOpenError](./circuit-open-error.md)
- [ClickHouseSink](./click-house-sink.md)
- [ContentDedup](./content-dedup.md)
- [CookieImportOptions](./cookie-import-options.md)
- [CookieJar](./cookie-jar.md)
- [CrawlJob](./crawl-job.md)
- [CrawlOptions](./crawl-options.md)
- [CrawlQueue](./crawl-queue.md)
- [CronModule](./cron-module.md)
- [CsrfHandler](./csrf-handler.md)
- [DiffDetector](./diff-detector.md)
- [Discover](./discover.md)
- [DistributedQueue](./distributed-queue.md)
- [DnsCache](./dns-cache.md)
- [DoctorDriver](./doctor-driver.md)
- [DoctorOptions](./doctor-options.md)
- [DoctorReport](./doctor-report.md)
- [ExtractOptions](./extract-options.md)
- [ExtractResult](./extract-result.md)
- [ExtractionError](./extraction-error.md)
- [FetchError](./fetch-error.md)
- [Fetcher](./fetcher.md)
- [FileSink](./file-sink.md)
- [Fingerprint](./fingerprint.md)
- [FormHandler](./form-handler.md)
- [GraphQLClient](./graph-qlclient.md)
- [HarLog](./har-log.md)
- [HarRecorder](./har-recorder.md)
- [HealthMonitor](./health-monitor.md)
- [Http2Error](./http2-error.md)
- [Http2Fetcher](./http2-fetcher.md)
- [Identity](./identity.md)
- [IdentityPool](./identity-pool.md)
- [Incremental](./incremental.md)
- [Interceptors](./interceptors.md)
- [JobStore](./job-store.md)
- [JsonExtractionError](./json-extraction-error.md)
- [MemoryAdapter](./memory-adapter.md)
- [MemorySink](./memory-sink.md)
- [MemoryStorage](./memory-storage.md)
- [MySQLSink](./my-sqlsink.md)
- [NetworkCapture](./network-capture.md)
- [Observability](./observability.md)
- [PaginationConfig](./pagination-config.md)
- [PaginationDetectorModule](./pagination-detector-module.md)
- [PlaywrightCapture](./playwright-capture.md)
- [PluginHooks](./plugin-hooks.md)
- [PluginSystem](./plugin-system.md)
- [PostgresSink](./postgres-sink.md)
- [ProbeResult](./probe-result.md)
- [ProgressBar](./progress-bar.md)
- [ProxyError](./proxy-error.md)
- [ProxyRotator](./proxy-rotator.md)
- [RateLimiter](./rate-limiter.md)
- [RawResponse](./raw-response.md)
- [RequestConfig](./request-config.md)
- [Retry](./retry.md)
- [S3Sink](./s3-sink.md)
- [Scheduler](./scheduler.md)
- [Schema](./schema.md)
- [SchemaField](./schema-field.md)
- [SchemaInferenceResult](./schema-inference-result.md)
- [SchemaValidator](./schema-validator.md)
- [SecurityError](./security-error.md)
- [SecurityGuard](./security-guard.md)
- [Sengkrep](./sengkrep.md)
- [SengkrepOptions](./sengkrep-options.md)
- [SessionPool](./session-pool.md)
- [SingleFlight](./single-flight.md)
- [Sink](./sink.md)
- [SqlSink](./sql-sink.md)
- [SqliteStorage](./sqlite-storage.md)
- [Storage](./storage.md)
- [StreamWriter](./stream-writer.md)
- [TimeoutError](./timeout-error.md)
- [Transport](./transport.md)
- [UrlDeduplicator](./url-deduplicator.md)
- [ValidationError](./validation-error.md)
- [Webhook](./webhook.md)
- [WordPress](./word-press.md)
- [auto](./auto.md)
- [createCdpRenderer](./create-cdp-renderer.md)
- [createSink](./create-sink.md)
- [createStorage](./create-storage.md)
- [doctor](./doctor.md)
- [isJsonPath](./is-json-path.md)
- [jsonPath](./json-path.md)

## Declaration

```ts
interface SengkrepStatic { ... }
```
