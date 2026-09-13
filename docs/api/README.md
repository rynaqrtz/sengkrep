# API reference

197 exports: 67 classes, 3 functions, 111 interfaces, 16 types.

Generated from `index.d.ts` by `npm run docs`. Do not edit this directory by hand; `npm run docs:check` fails when it drifts.

Start here: [Sengkrep](./sengkrep.md) · [SengkrepOptions](./sengkrep-options.md) · [Sink](./sink.md) · [Scheduler](./scheduler.md) · [createSink](./create-sink.md) · [NetworkCapture](./network-capture.md)

## Errors (10)

| Name | Kind |
| --- | --- |
| [CanceledError](./canceled-error.md) | `class` |
| [CircuitOpenError](./circuit-open-error.md) | `class` |
| [ExtractionError](./extraction-error.md) | `class` |
| [FetchError](./fetch-error.md) | `class` |
| [Http2Error](./http2-error.md) | `class` |
| [JsonExtractionError](./json-extraction-error.md) | `class` |
| [ProxyError](./proxy-error.md) | `class` |
| [SecurityError](./security-error.md) | `class` |
| [TimeoutError](./timeout-error.md) | `class` |
| [ValidationError](./validation-error.md) | `class` |

## Scheduling (14)

| Name | Kind |
| --- | --- |
| [CronModule](./cron-module.md) | `interface` |
| [JobRecord](./job-record.md) | `interface` |
| [JobStore](./job-store.md) | `class` |
| [JobStoreOptions](./job-store-options.md) | `interface` |
| [Schedule](./schedule.md) | `type` |
| [ScheduledJob](./scheduled-job.md) | `interface` |
| [ScheduleInterval](./schedule-interval.md) | `interface` |
| [ScheduleOnce](./schedule-once.md) | `interface` |
| [Scheduler](./scheduler.md) | `class` |
| [SchedulerErrorEvent](./scheduler-error-event.md) | `interface` |
| [SchedulerOptions](./scheduler-options.md) | `interface` |
| [SchedulerRunEvent](./scheduler-run-event.md) | `interface` |
| [SchedulerStats](./scheduler-stats.md) | `interface` |
| [SchedulerTickEvent](./scheduler-tick-event.md) | `interface` |

## Data sinks (22)

| Name | Kind |
| --- | --- |
| [ClickHouseSink](./click-house-sink.md) | `class` |
| [ClickHouseSinkOptions](./click-house-sink-options.md) | `interface` |
| [createSink](./create-sink.md) | `function` |
| [FileSink](./file-sink.md) | `class` |
| [FileSinkFormat](./file-sink-format.md) | `type` |
| [FileSinkOptions](./file-sink-options.md) | `interface` |
| [MemorySink](./memory-sink.md) | `class` |
| [MySQLSink](./my-sqlsink.md) | `class` |
| [MySQLSinkOptions](./my-sqlsink-options.md) | `interface` |
| [PostgresSink](./postgres-sink.md) | `class` |
| [PostgresSinkOptions](./postgres-sink-options.md) | `interface` |
| [S3Sink](./s3-sink.md) | `class` |
| [S3SinkFormat](./s3-sink-format.md) | `type` |
| [S3SinkOptions](./s3-sink-options.md) | `interface` |
| [Sink](./sink.md) | `class` |
| [SinkDescriptor](./sink-descriptor.md) | `type` |
| [SinkInput](./sink-input.md) | `type` |
| [SinkKey](./sink-key.md) | `type` |
| [SinkOptions](./sink-options.md) | `interface` |
| [SinkStats](./sink-stats.md) | `interface` |
| [SqlSink](./sql-sink.md) | `class` |
| [SqlSinkOptions](./sql-sink-options.md) | `interface` |

## Network capture (48)

| Name | Kind |
| --- | --- |
| [CaptureAnalyze](./capture-analyze.md) | `interface` |
| [CaptureAnalyzeOptions](./capture-analyze-options.md) | `interface` |
| [CaptureCodegen](./capture-codegen.md) | `interface` |
| [CaptureCookie](./capture-cookie.md) | `interface` |
| [CaptureCookies](./capture-cookies.md) | `interface` |
| [CaptureDecodeResult](./capture-decode-result.md) | `interface` |
| [CaptureEndpoint](./capture-endpoint.md) | `interface` |
| [CaptureEndpointOptions](./capture-endpoint-options.md) | `interface` |
| [CaptureEntry](./capture-entry.md) | `interface` |
| [CaptureEntryClassifyInput](./capture-entry-classify-input.md) | `interface` |
| [CaptureEntryInit](./capture-entry-init.md) | `interface` |
| [CaptureEntryModule](./capture-entry-module.md) | `interface` |
| [CaptureFilter](./capture-filter.md) | `interface` |
| [CaptureHeaders](./capture-headers.md) | `interface` |
| [CaptureJsonSchema](./capture-json-schema.md) | `interface` |
| [CaptureProxy](./capture-proxy.md) | `class` |
| [CaptureProxyAddress](./capture-proxy-address.md) | `interface` |
| [CaptureProxyOptions](./capture-proxy-options.md) | `interface` |
| [CaptureSchemaOptions](./capture-schema-options.md) | `interface` |
| [CaptureScriptOptions](./capture-script-options.md) | `interface` |
| [CaptureSummary](./capture-summary.md) | `interface` |
| [CaptureWebSocketClient](./capture-web-socket-client.md) | `interface` |
| [CaptureWebSocketFrame](./capture-web-socket-frame.md) | `interface` |
| [CaptureWebSocketFrameRecord](./capture-web-socket-frame-record.md) | `interface` |
| [CaptureWs](./capture-ws.md) | `interface` |
| [CdpCapture](./cdp-capture.md) | `class` |
| [CdpCaptureOptions](./cdp-capture-options.md) | `interface` |
| [CdpCaptureResult](./cdp-capture-result.md) | `interface` |
| [CdpClient](./cdp-client.md) | `interface` |
| [CdpRenderer](./cdp-renderer.md) | `class` |
| [CdpRendererOptions](./cdp-renderer-options.md) | `interface` |
| [CdpRenderResult](./cdp-render-result.md) | `interface` |
| [CdpSession](./cdp-session.md) | `class` |
| [CdpTargetDescription](./cdp-target-description.md) | `interface` |
| [CookieImportOptions](./cookie-import-options.md) | `interface` |
| [CookieJar](./cookie-jar.md) | `class` |
| [createCdpRenderer](./create-cdp-renderer.md) | `function` |
| [HarLog](./har-log.md) | `interface` |
| [HarRecorder](./har-recorder.md) | `class` |
| [NetworkCapture](./network-capture.md) | `class` |
| [PlaywrightAttachment](./playwright-attachment.md) | `interface` |
| [PlaywrightCapture](./playwright-capture.md) | `class` |
| [PlaywrightCaptureOptions](./playwright-capture-options.md) | `interface` |
| [RendererFn](./renderer-fn.md) | `type` |
| [RendererInput](./renderer-input.md) | `type` |
| [SessionPool](./session-pool.md) | `class` |
| [SessionPoolOptions](./session-pool-options.md) | `interface` |
| [SessionPoolSession](./session-pool-session.md) | `interface` |

## Options (24)

| Name | Kind |
| --- | --- |
| [AdaptiveThrottleOptions](./adaptive-throttle-options.md) | `interface` |
| [AuthOptions](./auth-options.md) | `interface` |
| [BatchOptions](./batch-options.md) | `interface` |
| [CacheOptions](./cache-options.md) | `interface` |
| [CircuitBreakerOptions](./circuit-breaker-options.md) | `interface` |
| [ComplianceOptions](./compliance-options.md) | `interface` |
| [ContentDedupOptions](./content-dedup-options.md) | `interface` |
| [CrawlOptions](./crawl-options.md) | `interface` |
| [CsrfOptions](./csrf-options.md) | `interface` |
| [DiffOptions](./diff-options.md) | `interface` |
| [ExtractOptions](./extract-options.md) | `interface` |
| [FingerprintOptions](./fingerprint-options.md) | `interface` |
| [HealthOptions](./health-options.md) | `interface` |
| [ObservabilityOptions](./observability-options.md) | `interface` |
| [PaginationConfig](./pagination-config.md) | `interface` |
| [RateLimitOptions](./rate-limit-options.md) | `interface` |
| [RedirectPolicyOptions](./redirect-policy-options.md) | `interface` |
| [RequestConfig](./request-config.md) | `interface` |
| [RetryOptions](./retry-options.md) | `interface` |
| [SecurityOptions](./security-options.md) | `interface` |
| [SengkrepOptions](./sengkrep-options.md) | `interface` |
| [SingleFlightOptions](./single-flight-options.md) | `interface` |
| [StorageOptions](./storage-options.md) | `interface` |
| [WebhookOptions](./webhook-options.md) | `interface` |

## Results (12)

| Name | Kind |
| --- | --- |
| [BatchResult](./batch-result.md) | `interface` |
| [CacheStats](./cache-stats.md) | `interface` |
| [DiffReport](./diff-report.md) | `interface` |
| [DistributedQueueResult](./distributed-queue-result.md) | `interface` |
| [ExtractResult](./extract-result.md) | `type` |
| [HealthReport](./health-report.md) | `interface` |
| [ObservabilityReport](./observability-report.md) | `interface` |
| [RateLimitInfo](./rate-limit-info.md) | `interface` |
| [SchemaInferenceResult](./schema-inference-result.md) | `interface` |
| [SingleFlightStats](./single-flight-stats.md) | `interface` |
| [ValidationReport](./validation-report.md) | `interface` |
| [WebhookDeliveryResult](./webhook-delivery-result.md) | `interface` |

## Classes (38)

| Name | Kind |
| --- | --- |
| [AdaptiveThrottle](./adaptive-throttle.md) | `class` |
| [AuthManager](./auth-manager.md) | `class` |
| [Cache](./cache.md) | `class` |
| [CircuitBreaker](./circuit-breaker.md) | `class` |
| [ContentDedup](./content-dedup.md) | `class` |
| [CrawlQueue](./crawl-queue.md) | `class` |
| [CsrfHandler](./csrf-handler.md) | `class` |
| [DiffDetector](./diff-detector.md) | `class` |
| [Discover](./discover.md) | `class` |
| [DistributedQueue](./distributed-queue.md) | `class` |
| [DnsCache](./dns-cache.md) | `class` |
| [Fetcher](./fetcher.md) | `class` |
| [Fingerprint](./fingerprint.md) | `class` |
| [FormHandler](./form-handler.md) | `class` |
| [GraphQLClient](./graph-qlclient.md) | `class` |
| [HealthMonitor](./health-monitor.md) | `class` |
| [Http2Fetcher](./http2-fetcher.md) | `class` |
| [Incremental](./incremental.md) | `class` |
| [Interceptors](./interceptors.md) | `class` |
| [MemoryAdapter](./memory-adapter.md) | `class` |
| [MemoryStorage](./memory-storage.md) | `class` |
| [Observability](./observability.md) | `class` |
| [PluginSystem](./plugin-system.md) | `class` |
| [ProgressBar](./progress-bar.md) | `class` |
| [ProxyRotator](./proxy-rotator.md) | `class` |
| [RateLimiter](./rate-limiter.md) | `class` |
| [Retry](./retry.md) | `class` |
| [SchemaValidator](./schema-validator.md) | `class` |
| [SecurityGuard](./security-guard.md) | `class` |
| [Sengkrep](./sengkrep.md) | `class` |
| [SingleFlight](./single-flight.md) | `class` |
| [SqliteStorage](./sqlite-storage.md) | `class` |
| [Storage](./storage.md) | `class` |
| [StreamWriter](./stream-writer.md) | `class` |
| [Transport](./transport.md) | `class` |
| [UrlDeduplicator](./url-deduplicator.md) | `class` |
| [Webhook](./webhook.md) | `class` |
| [WordPress](./word-press.md) | `class` |

## Interfaces (21)

| Name | Kind |
| --- | --- |
| [BrowserProfile](./browser-profile.md) | `interface` |
| [CacheLookup](./cache-lookup.md) | `interface` |
| [CrawlJob](./crawl-job.md) | `interface` |
| [DiffChange](./diff-change.md) | `interface` |
| [DistributedAdapter](./distributed-adapter.md) | `interface` |
| [FieldDefinition](./field-definition.md) | `interface` |
| [FingerprintContext](./fingerprint-context.md) | `interface` |
| [HealthAlert](./health-alert.md) | `interface` |
| [JsonFieldDefinition](./json-field-definition.md) | `interface` |
| [PaginationDetectorModule](./pagination-detector-module.md) | `interface` |
| [PaginationNext](./pagination-next.md) | `interface` |
| [ParsedForm](./parsed-form.md) | `interface` |
| [PluginHooks](./plugin-hooks.md) | `interface` |
| [RawResponse](./raw-response.md) | `interface` |
| [S3PutRequest](./s3-put-request.md) | `interface` |
| [SchemaInferenceField](./schema-inference-field.md) | `interface` |
| [SengkrepMeta](./sengkrep-meta.md) | `interface` |
| [SengkrepStatic](./sengkrep-static.md) | `interface` |
| [SqlStatement](./sql-statement.md) | `interface` |
| [ValidationErrorDetail](./validation-error-detail.md) | `interface` |
| [ValidationRule](./validation-rule.md) | `interface` |

## Types (7)

| Name | Kind |
| --- | --- |
| [FieldSelector](./field-selector.md) | `type` |
| [JsonSchema](./json-schema.md) | `type` |
| [JsonSchemaField](./json-schema-field.md) | `type` |
| [RenderOutput](./render-output.md) | `type` |
| [Schema](./schema.md) | `type` |
| [SchemaField](./schema-field.md) | `type` |
| [StorageBackend](./storage-backend.md) | `type` |

## Functions (1)

| Name | Kind |
| --- | --- |
| [createStorage](./create-storage.md) | `function` |
