import type { CheerioAPI } from 'cheerio';

export type FieldSelector = string | string[];

export interface FieldDefinition {
  selector: FieldSelector;
  required?: boolean;
  multiple?: boolean;
  attr?: string;
  type?: 'text' | 'html';
  transform?: (value: string) => unknown;
  pattern?: RegExp;
  default?: unknown;
}

export type SchemaField = string | string[] | FieldDefinition;

export type Schema<T = Record<string, unknown>> = {
  [K in keyof T]: SchemaField;
};

export interface JsonFieldDefinition {
  path: string | string[];
  required?: boolean;
  transform?: (value: unknown) => unknown;
  pattern?: RegExp;
  default?: unknown;
}

export type JsonSchemaField = string | string[] | JsonFieldDefinition;

export type JsonSchema<T = Record<string, unknown>> = {
  [K in keyof T]: JsonSchemaField;
};

export interface HealthAlert {
  field: string;
  selector: string;
  type: 'high_empty_rate' | 'count_drop' | 'pattern_mismatch';
  message: string;
}

export interface HealthReport {
  url: string;
  alerts: HealthAlert[];
  healthy: boolean;
}

export interface DiffChange {
  type: string;
  severity: 'info' | 'warn' | 'critical';
  [key: string]: unknown;
}

export interface DiffReport {
  url: string;
  firstRun: boolean;
  changes: DiffChange[];
  hasCritical: boolean;
  hasWarn?: boolean;
  previousTs: number | null;
}

export interface ValidationErrorDetail {
  field: string;
  rule: string;
  message: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationErrorDetail[];
  warnings: ValidationErrorDetail[];
}

export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  resetSeconds: number | null;
}

export interface SengkrepMeta {
  responseType: 'html' | 'json' | 'feed' | 'csv' | 'binary' | 'streamed';
  cache?: { hit: boolean };
  rendered?: boolean;
  health?: HealthReport;
  diff?: DiffReport;
  validation?: ValidationReport;
  sniffedType?: string | null;
  filePath?: string | null;
  size?: number | null;
  rateLimit?: RateLimitInfo;
}

export type ExtractResult<T = Record<string, unknown>> = T & {
  readonly _sengkrep: SengkrepMeta;
};

export interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  url: string;
  body: string;
  binary: boolean;
  bodyBuffer?: Buffer | null;
  streamed: boolean;
  filePath: string | null;
  fromCache: boolean;
  stale?: boolean;
  notModified: boolean;
  charset?: string;
  sniffedType?: string | null;
  size?: number | null;
  rateLimit?: RateLimitInfo | null;
}

export interface RequestConfig {
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
  signal?: AbortSignal;
  rejectUnauthorized?: boolean;
  timeout?: number;
  proxy?: string | null;
}

export interface ExtractOptions {
  strict?: boolean;
  responseType?: 'auto' | 'html' | 'json' | 'rss' | 'csv';
  params?: Record<string, string | number>;
  allowBinary?: boolean;
  allowStreamed?: boolean;
  includeBuffer?: boolean;
  render?: boolean;
  request?: RequestConfig;
}

export interface BatchOptions extends ExtractOptions {
  concurrency?: number;
  delay?: number;
  randomOrder?: boolean;
  progressBar?: boolean;
  onProgress?: (done: number, total: number) => void;
}

export interface BatchResult<T = Record<string, unknown>> {
  url: string;
  data: ExtractResult<T> | null;
  error: Error | null;
}

export interface PaginationConfig {
  nextSelector: string | 'auto';
  itemsSelector?: string | null;
  maxPages?: number;
  delayBetweenPages?: number;
  stopOnDuplicate?: boolean;
}

export interface CrawlOptions {
  seed: string | string[];
  schema?: Record<string, SchemaField>;
  follow?: RegExp | ((url: string) => boolean);
  maxUrls?: number;
  concurrency?: number;
  stateFile?: string | null;
  saveEvery?: number;
  linkOptions?: Record<string, unknown>;
  respectRobotsTxt?: boolean;
  userAgent?: string;
}

export interface CrawlJob {
  queue: unknown;
  start: () => Promise<Array<{ url: string; data: unknown }>>;
  resume: () => Promise<Array<{ url: string; data: unknown }>>;
  pause: () => void;
  on: (event: 'url:done' | 'url:error' | 'progress' | 'start' | 'done', fn: (payload: any) => void) => void;
  results: () => Array<{ url: string; data: unknown }>;
  stats: () => { visited: number; queued: number; results: number };
}

export interface SchemaInferenceField {
  selector: string;
  confidence: number;
  attr?: string;
}

export interface SchemaInferenceResult {
  type: 'list' | 'single';
  container?: string;
  itemCount?: number;
  schema: Record<string, SchemaInferenceField>;
  sample?: Record<string, string>;
}

export interface FingerprintOptions {
  userAgent?: string | 'random';
  rotateUAOnEachRequest?: boolean;
  randomizeHeaderOrder?: boolean;
  randomizeTiming?: boolean;
  profile?: string | null;
  language?: string | null;
}

export interface RetryOptions {
  max?: number;
  jitter?: boolean;
  retryOn?: number[];
  retryOnNetwork?: boolean;
  retryOnTimeout?: boolean;
  respectRetryAfter?: boolean;
  maxRetryAfter?: number;
  budgetMs?: number | null;
  onRetry?: (info: { attempt: number; status: number | null; code: string | null; waitMs: number; respectedRetryAfter: boolean; elapsedMs?: number }) => void;
}

export interface HealthOptions {
  alertThreshold?: number;
  windowSize?: number;
  onAlert?: (report: HealthReport) => void;
}

export interface DiffOptions {
  storageDir?: string;
  sensitivity?: 'structural' | 'value';
  onDiff?: (report: DiffReport) => void;
  maxHistory?: number;
}

export interface CacheOptions {
  ttl?: number;
  storage?: 'memory' | 'disk';
  storageDir?: string;
  maxItems?: number;
  backend?: StorageBackend;
  file?: string;
  table?: string;
  staleWhileRevalidate?: boolean;
  staleTtl?: number;
}

export interface CacheLookup {
  data: RawResponse;
  stale: boolean;
  age: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  stale: number;
  revalidations: number;
  size: number;
  revalidating: number;
  hitRate: number;
}

export interface SingleFlightOptions {
  enabled?: boolean;
  maxKeys?: number;
}

export interface SingleFlightStats {
  flights: number;
  joins: number;
  bypassed: number;
  failures: number;
  inflight: number;
}

export type StorageBackend = 'file' | 'memory' | 'sqlite';

export interface StorageOptions {
  storage?: StorageBackend;
  storageDir?: string;
  file?: string;
  table?: string;
}

export class Storage {
  constructor(dir?: string);
  set(key: string, value: unknown): boolean;
  get(key: string): { ts: number; data: unknown } | null;
  delete(key: string): void;
  list(): string[];
  clear(): boolean;
}

export class MemoryStorage {
  set(key: string, value: unknown): boolean;
  get(key: string): { ts: number; data: unknown } | null;
  delete(key: string): void;
  list(): string[];
  clear(): boolean;
}

export class SqliteStorage {
  constructor(options?: { file?: string; table?: string });
  set(key: string, value: unknown): boolean;
  get(key: string): { ts: number; data: unknown } | null;
  delete(key: string): void;
  list(): string[];
  clear(): boolean;
  close(): void;
}

export function createStorage(options?: StorageOptions): Storage | MemoryStorage | SqliteStorage;

export interface RateLimitOptions {
  requestsPerSecond?: number | null;
  concurrency?: number | null;
}

export interface SecurityOptions {
  blockPrivateIPs?: boolean;
  allowDomains?: string[] | null;
  blockDomains?: string[];
  blockedPorts?: number[];
}

export interface RedirectPolicyOptions {
  validateEachHop?: boolean;
  forwardSensitiveHeaders?: boolean;
  maxCrossHostHops?: number;
}

export interface ComplianceOptions {
  userAgent?: string;
  respectXRobotsTag?: boolean;
  maskFields?: string[];
  auditLog?: string;
  purpose?: string;
}

export interface CircuitBreakerOptions {
  threshold?: number;
  cooldown?: number;
  halfOpenMaxAttempts?: number;
  onOpen?: (info: { key: string; failures: number }) => void;
  onClose?: (info: { key: string }) => void;
}

export interface AuthOptions {
  type?: 'bearer';
  token?: string | null;
  refresh?: ((oldToken: string | null) => Promise<string>) | null;
  refreshOn?: number[];
  headerName?: string;
  onRefresh?: (newToken: string) => void;
}

export interface CsrfOptions {
  auto?: boolean;
  headerName?: string;
  fieldName?: string;
  cookieNames?: string[];
  metaSelectors?: string[];
  inputSelectors?: string[];
}

export interface SessionPoolOptions {
  size?: number;
  strategy?: 'round-robin' | 'least-used';
  recycleAfter?: number | null;
  fingerprint?: FingerprintOptions;
}

export interface ObservabilityOptions {
  enabled?: boolean;
  port?: number | null;
}

export interface WebhookOptions {
  onStart?: string | null;
  onComplete?: string | null;
  onError?: string | null;
  onProgress?: string | null;
  retries?: number;
  backoffMs?: number;
  timeout?: number;
  secret?: string | null;
  onDelivered?: (result: WebhookDeliveryResult) => void;
}

export interface WebhookDeliveryResult {
  event: string;
  url?: string;
  delivered: boolean;
  status?: number;
  attempts?: number;
  error?: Error | null;
  skipped?: boolean;
}

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'date';
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  notEmpty?: boolean;
  custom?: (value: unknown, allData: Record<string, unknown>) => true | string;
}

export interface SengkrepOptions {
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  logPretty?: boolean;
  baseURL?: string | null;
  timeout?: number;
  maxRedirects?: number;
  redirectPolicy?: RedirectPolicyOptions;
  keepAlive?: boolean;
  delay?: number;
  delayMin?: number;
  delayMax?: number;
  maxMemoryBuffer?: number;
  responseType?: 'auto' | 'html' | 'json' | 'rss' | 'csv';
  cookies?: boolean;
  http2?: boolean;
  fingerprint?: FingerprintOptions;
  retry?: RetryOptions;
  health?: HealthOptions | false;
  diff?: DiffOptions | false;
  cache?: CacheOptions | false;
  circuitBreaker?: CircuitBreakerOptions | false;
  incremental?: { storageDir?: string } | boolean;
  rateLimit?: RateLimitOptions;
  proxies?: string[];
  proxyStrategy?: 'round-robin' | 'random' | 'sticky';
  proxyMaxFailures?: number;
  dns?: { ttl?: number } | boolean;
  sessionPool?: SessionPoolOptions;
  security?: SecurityOptions;
  auth?: AuthOptions;
  csrf?: CsrfOptions;
  observability?: ObservabilityOptions;
  webhook?: WebhookOptions;
  har?: boolean;
  validate?: Record<string, ValidationRule>;
  dedup?: Record<string, unknown>;
  adaptive?: AdaptiveThrottleOptions | boolean;
  dedupContent?: ContentDedupOptions | boolean;
  compliance?: ComplianceOptions | false;
  renderer?: RendererInput;
  render?: boolean;
  singleFlight?: SingleFlightOptions | boolean;
  robotsTtl?: number;
  tempFileTtl?: number;
  connectTimeout?: number;
  totalTimeout?: number;
  storage?: StorageOptions;
}

export type RenderOutput = string | { html: string };
export type RendererFn = (url: string, options?: ExtractOptions) => Promise<RenderOutput>;
export type RendererInput = RendererFn | { render: RendererFn } | null;

export class FetchError extends Error {
  status: number | null;
  code: string;
  retryAfterMs?: number | null;
  headers?: Record<string, string | string[] | undefined>;
}
export class TimeoutError extends FetchError {}
export class CanceledError extends FetchError {}
export class ProxyError extends Error {
  code: string;
}
export class Http2Error extends Error {
  code: string;
  status?: number;
  retryAfterMs?: number | null;
}

export class Retry {
  constructor(options?: RetryOptions);
  run<T>(fn: (attempt: number) => Promise<T>): Promise<T>;
}

export class Fetcher {
  constructor(options?: Record<string, unknown>);
  fetch<T = RawResponse>(url: string, options?: RequestConfig & Record<string, unknown>): Promise<T>;
  sweepStreamFiles(ttlMs?: number): number;
  close(): void;
}

export class Http2Fetcher {
  constructor(options?: Record<string, unknown>);
  fetch<T = RawResponse>(url: string, config?: RequestConfig): Promise<T>;
  closeAll(): void;
}
export class ExtractionError extends Error {
  field: string;
  selector: string;
}
export class JsonExtractionError extends Error {
  field: string | null;
  path: string | null;
}
export class ValidationError extends Error {
  errors: ValidationErrorDetail[];
}
export class SecurityError extends Error {
  code: string;
}
export class CircuitOpenError extends Error {
  code: string;
  key: string;
  retryAt: number;
}

export interface BrowserProfile {
  id: string;
  browser: 'chrome' | 'edge' | 'firefox' | 'safari' | 'unknown';
  platform: string;
  platformVersion: string;
  ua: string;
}

export class Fingerprint {
  constructor(options?: FingerprintOptions);
  readonly profile: BrowserProfile;
  setProfile(id: string): BrowserProfile;
  buildHeaders(extra?: Record<string, string>, context?: { referer?: string; targetUrl?: string } | null): Record<string, string>;
  getUA(): string;
  delay(base?: number): Promise<void>;
  humanDelay(min?: number, max?: number): Promise<void>;
  static PROFILES: BrowserProfile[];
  static ACCEPT_ENCODING: string;
  static ZSTD_SUPPORTED: boolean;
}

export class HealthMonitor {
  constructor(options?: HealthOptions);
  record(url: string, healthMap: Record<string, unknown>): HealthReport;
  getReport(url: string): unknown;
  getAllReports(): unknown[];
  reset(url?: string): void;
}

export class DiffDetector {
  constructor(options?: DiffOptions);
  check(url: string, data: unknown): DiffReport;
  getAllChanges(url?: string): DiffReport[];
  getChangedOnly(url?: string): DiffReport[];
  clearHistory(): void;
  clearSnapshot(url: string): void;
  clearAll(): void;
}

export class SchemaValidator {
  constructor(rules: Record<string, ValidationRule>);
  validate(data: Record<string, unknown>): ValidationReport;
  validateMany(items: Record<string, unknown>[]): (ValidationReport & { index: number })[];
}

export class SingleFlight {
  constructor(options?: SingleFlightOptions | boolean);
  enabled: boolean;
  maxKeys: number;
  readonly size: number;
  key(method: string, url: string, body?: string | null): string;
  run<T>(key: string, fn: () => Promise<T> | T): Promise<T>;
  stats(): SingleFlightStats;
  clear(): void;
}

export class Cache {
  constructor(options?: CacheOptions);
  ttl: number;
  staleTtl: number;
  staleWhileRevalidate: boolean;
  get(url: string, method?: string): unknown;
  lookup(url: string, method?: string): CacheLookup | null;
  set(url: string, data: unknown, method?: string, options?: { ttl?: number }): void;
  beginRevalidate(url: string, method?: string): boolean;
  endRevalidate(url: string, method?: string): void;
  isRevalidating(url: string, method?: string): boolean;
  has(url: string, method?: string): boolean;
  delete(url: string, method?: string): void;
  clear(): void;
  stats(): CacheStats;
}

export class CookieJar {
  getCookieHeader(hostname: string): string | null;
  getAll(hostname: string): unknown[];
  setManual(hostname: string, name: string, value: string, options?: Record<string, unknown>): void;
  export(): Record<string, unknown[]>;
  import(snapshot: Record<string, unknown[]>): void;
  clear(hostname?: string): void;
}

export class RateLimiter {
  constructor(options?: RateLimitOptions);
  readonly enabled: boolean;
  acquire(hostname: string): Promise<() => void>;
  reset(hostname?: string): void;
}

export interface AdaptiveThrottleOptions {
  enabled?: boolean;
  minConcurrency?: number;
  maxConcurrency?: number;
  initialConcurrency?: number;
  increaseEvery?: number;
  backoffFactor?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export class AdaptiveThrottle {
  constructor(options?: AdaptiveThrottleOptions);
  acquire(hostname: string): Promise<() => void>;
  onSuccess(hostname: string): void;
  onFailure(hostname: string, info?: { retryAfterMs?: number | null; status?: number | null }): void;
  concurrencyFor(hostname: string): number;
  delayFor(hostname: string): number;
  stats(): Array<{ hostname: string; concurrency: number; active: number; delay: number; backoffs: number }>;
  reset(hostname?: string): void;
}

export interface ContentDedupOptions {
  threshold?: number;
  shingleSize?: number;
  maxEntries?: number;
}

export class ContentDedup {
  constructor(options?: ContentDedupOptions);
  fingerprint(text: string): bigint;
  add(text: string): bigint;
  find(text: string): { fingerprint: bigint; distance: number | null };
  isDuplicate(text: string): { duplicate: boolean; distance: number | null; fingerprint: bigint };
  check(text: string, options?: { add?: boolean }): { duplicate: boolean; distance: number | null; fingerprint: bigint };
  size(): number;
  clear(): void;
  static simhash(text: string, bits?: number, shingleSize?: number): bigint;
  static hammingDistance(a: bigint, b: bigint): number;
  static tokenize(text: string): string[];
}

export class ProxyRotator {
  constructor(options?: { proxies?: string[]; strategy?: string; maxFailures?: number });
  readonly enabled: boolean;
  next(hostname?: string): string | null;
  reportSuccess(proxy: string): void;
  reportFailure(proxy: string): void;
  stats(): Array<{ proxy: string; failures: number; healthy: boolean }>;
}

export class Interceptors {
  request: { use: (onFulfilled?: Function, onRejected?: Function) => number; eject: (id: number) => void };
  response: { use: (onFulfilled?: Function, onRejected?: Function) => number; eject: (id: number) => void };
}

export class Webhook {
  constructor(config?: WebhookOptions);
  results: WebhookDeliveryResult[];
  sign(body: string): string | null;
  fire(event: string, payload?: Record<string, unknown>): Promise<WebhookDeliveryResult>;
}

export class Discover {
  constructor(fetcher: unknown, options?: { robotsTtl?: number });
  run(origin: string, options?: { maxDepth?: number; maxEntries?: number; pattern?: RegExp }): Promise<string[]>;
  isAllowed(url: string, userAgent?: string): Promise<boolean>;
  getCrawlDelay(origin: string, userAgent?: string): Promise<number | null>;
  clearRobotsCache(origin?: string): void;
}

export class UrlDeduplicator {
  constructor(options?: Record<string, unknown>);
  isDuplicate(url: string): boolean;
  markSeen(url: string): void;
  filterNew(urls: string[]): string[];
  size(): number;
  clear(): void;
}

export class SecurityGuard {
  constructor(options?: SecurityOptions);
  readonly enabled: boolean;
  resolve(hostname: string): Promise<{ address: string; family: number }>;
  checkAddress(hostname: string): Promise<{ address: string; family: number } | null>;
  resolveForRequest(url: string): Promise<{ address: string; family: number } | null>;
  check(url: string): Promise<boolean>;
}

export class CircuitBreaker {
  constructor(options?: CircuitBreakerOptions);
  canRequest(key: string): boolean;
  assertCanRequest(key: string): void;
  recordSuccess(key: string): void;
  recordFailure(key: string): void;
  getState(key: string): { key: string; state: string; failures: number; openedAt: number | null };
  getAllStates(): unknown[];
  reset(key?: string): void;
}

export class Incremental {
  constructor(options?: { storageDir?: string });
  getConditionalHeaders(url: string): Record<string, string>;
  hasSnapshot(url: string): boolean;
  getSnapshot(url: string): unknown;
  record(url: string, headers: Record<string, unknown>, extracted: unknown): void;
  clear(url?: string): void;
}

export class CsrfHandler {
  constructor(options?: CsrfOptions);
  readonly enabled: boolean;
  extractFromHtml($: CheerioAPI): string | null;
  extractFromCookies(cookieJar: CookieJar | null, hostname: string): string | null;
  buildFormBody(fields: Record<string, unknown>, token: string | null): string;
  buildHeaders(token: string | null, extra?: Record<string, string>): Record<string, string>;
}

export class AuthManager {
  constructor(options?: AuthOptions);
  readonly enabled: boolean;
  token: string | null;
  buildHeaders(extra?: Record<string, string>): Record<string, string>;
  shouldRefresh(status: number): boolean;
  refresh(): Promise<string | null>;
}

export interface SessionPoolSession {
  id: number;
  cookieJar: CookieJar;
  fingerprint: Fingerprint;
  useCount: number;
  createdAt: number;
}

export class SessionPool {
  constructor(options?: SessionPoolOptions);
  next(): SessionPoolSession;
  get(id: number): SessionPoolSession | null;
  stats(): Array<{ id: number; useCount: number; createdAt: number }>;
  resetAll(): void;
}

export interface PluginHooks {
  beforeRequest?: (payload: { url: string; options: ExtractOptions }) => unknown;
  afterExtract?: (payload: { data: Record<string, unknown>; meta: SengkrepMeta }) => unknown;
  onError?: (payload: { url: string; error: Error }) => unknown;
}

export class PluginSystem {
  use(plugin: PluginHooks | ((system: PluginSystem) => void)): this;
  hook(name: string, fn: Function): this;
  run(hookName: string, payload: unknown): Promise<unknown>;
}

export class CrawlQueue {
  constructor(options: CrawlOptions);
  start(visitFn: (url: string) => Promise<{ data: unknown; links: string[] }>): Promise<Array<{ url: string; data: unknown }>>;
  resume(visitFn: (url: string) => Promise<{ data: unknown; links: string[] }>): Promise<Array<{ url: string; data: unknown }>>;
  pause(): void;
  on(event: string, fn: (payload: any) => void): void;
  results(): Array<{ url: string; data: unknown }>;
  stats(): { visited: number; queued: number; results: number };
}

export interface ObservabilityReport {
  total: number;
  success: number;
  failed: number;
  successRate: number;
  rps: number;
  elapsedSec: number;
  domains: Record<string, { requests: number; success: number; failed: number }>;
  categories: Record<string, number>;
  bytes: { sent: number; received: number };
  topErrors: Array<{ code: string; count: number }>;
}

export class Observability {
  constructor(options?: ObservabilityOptions);
  recordSuccess(url: string): void;
  recordFailure(url: string, err: Error): void;
  trackBytes(sent: number, received: number): void;
  report(): ObservabilityReport;
  prometheus(): string;
  close(): void;
}

export class HarRecorder {
  attach(interceptors: Interceptors): this;
  toHAR(): Record<string, unknown>;
  save(filePath: string): void;
  clear(): void;
}

export class WordPress {
  detect(origin: string): Promise<{ isWordPress: boolean; name?: string | null; namespaces?: string[] }>;
  restApi(origin: string, endpoint: string, params?: Record<string, unknown>): Promise<{ data: unknown; total: number | null; totalPages: number | null }>;
  restApiAll(origin: string, endpoint: string, params?: Record<string, unknown>, options?: { maxPages?: number }): Promise<unknown[]>;
  extractNonce(html: string): string | null;
  ajaxAction(origin: string, action: string, data?: Record<string, unknown>, options?: { nonce?: string; nonceFromPage?: string }): Promise<unknown>;
}

export class GraphQLClient {
  introspect(endpoint: string, options?: { headers?: Record<string, string> }): Promise<{ queryType: string | null; types: Record<string, unknown> }>;
  query<T = unknown>(endpoint: string, queryString: string, variables?: Record<string, unknown>, options?: { headers?: Record<string, string> }): Promise<T>;
  flattenConnection<T = unknown>(connectionObj: { edges: Array<{ node: T }> }): T[];
  queryAllPages<T = unknown>(endpoint: string, queryString: string, options: { variables?: Record<string, unknown>; connectionPath: string; maxPages?: number; pageSize?: number; headers?: Record<string, string> }): Promise<T[]>;
}

export class DnsCache {
  constructor(options?: { ttl?: number; enabled?: boolean });
  lookup(hostname: string): Promise<string>;
  invalidate(hostname?: string): void;
  stats(): Array<{ hostname: string; addresses: string[]; ageMs: number }>;
}

export interface ParsedForm {
  action: string;
  method: string;
  fields: Record<string, unknown>;
}

export class FormHandler {
  constructor(options?: { csrf?: CsrfOptions });
  parse($: CheerioAPI, selector: string, baseUrl: string): ParsedForm | null;
  buildSubmission(parsedForm: ParsedForm, overrides?: Record<string, unknown>): { url: string; method: string; body: string; headers: Record<string, string> };
}

export class ProgressBar {
  constructor(options?: { total?: number; width?: number; label?: string; enabled?: boolean });
  update(current: number, extra?: string): void;
  increment(step?: number, extra?: string): void;
  finish(message?: string): void;
}

export class StreamWriter {
  constructor(filePath: string, options?: { format?: 'csv' | 'jsonl'; keys?: string[] });
  write(row: Record<string, unknown>): void;
  writeMany(rows: Record<string, unknown>[]): void;
  count(): number;
  close(): Promise<void>;
}

export interface DistributedAdapter {
  enqueue(items: unknown[]): Promise<void>;
  dequeue(): Promise<unknown | null>;
  complete(item: unknown): Promise<void>;
  release(item: unknown): Promise<void>;
  size(): Promise<Record<string, number>>;
}

export class MemoryAdapter implements DistributedAdapter {
  enqueue(items: unknown[]): Promise<void>;
  dequeue(): Promise<unknown | null>;
  complete(item: unknown): Promise<void>;
  release(item: unknown): Promise<void>;
  size(): Promise<{ queued: number; locked: number; done: number }>;
}

export interface DistributedQueueResult<T = unknown> {
  item: unknown;
  result: T | null;
  error: Error | null;
  droppedAfterRetries?: number;
}

export class DistributedQueue {
  constructor(options?: { adapter?: DistributedAdapter; workerId?: string; pollInterval?: number; emptyRetries?: number; maxItemRetries?: number; leaseTimeoutMs?: number });
  deadLetter: Array<{ item: unknown; error: Error; attempts: number }>;
  enqueue(items: unknown | unknown[], options?: { priority?: number }): Promise<void>;
  run<T = unknown>(visitFn: (item: unknown, workerId: string) => Promise<T>, options?: { concurrency?: number }): Promise<DistributedQueueResult<T>[]>;
  deadLettered(): Array<{ item: unknown; error: Error; attempts: number }>;
  size(): Promise<Record<string, number>>;
}

export class Transport {
  constructor(options: { fetcher: unknown; http2?: unknown; logger?: unknown; fallback?: boolean });
  readonly supportsHttp2: boolean;
  request<T = unknown>(url: string, config?: RequestConfig): Promise<T>;
  sweepStreamFiles(ttlMs?: number): number;
  close(): void;
}

export interface CaptureHeaders {
  [name: string]: string;
}

export interface CaptureEntryInit {
  id?: string;
  source?: string;
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  httpVersion?: string;
  resourceType?: string;
  mimeType?: string;
  requestHeaders?: CaptureHeaders | Array<{ name: string; value: string }>;
  responseHeaders?: CaptureHeaders | Array<{ name: string; value: string }>;
  requestBody?: string | Buffer | null;
  responseBody?: string | Buffer | null;
  requestSize?: number;
  responseSize?: number;
  startedDateTime?: string;
  time?: number;
  initiator?: string | null;
  fromCache?: boolean;
  failed?: boolean;
  errorText?: string | null;
  redirectURL?: string | null;
  bodyBase64?: boolean;
}

export interface CaptureEntry {
  id: string;
  source: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  httpVersion: string;
  resourceType: string;
  mimeType: string;
  requestHeaders: CaptureHeaders;
  responseHeaders: CaptureHeaders;
  requestBody: string | null;
  responseBody: string | null;
  requestSize: number;
  responseSize: number;
  startedDateTime: string;
  time: number;
  initiator: string | null;
  fromCache: boolean;
  failed: boolean;
  errorText: string | null;
  redirectURL: string | null;
  bodyBase64: boolean;
  done?: boolean;
  truncated?: boolean;
  frames?: CaptureWebSocketFrameRecord[];
  framesTruncated?: boolean;
}

export interface CaptureWebSocketFrameRecord {
  direction: 'sent' | 'received';
  opcode: number;
  payloadData: string;
  size: number;
  timestamp: number;
}

export interface CaptureJsonSchema {
  type: string;
  properties?: Record<string, CaptureJsonSchema>;
  required?: string[];
  items?: CaptureJsonSchema;
}

export interface CaptureEndpoint {
  method: string;
  template: string;
  path: string;
  host: string;
  api: boolean;
  count: number;
  statuses: Record<string, number>;
  params: string[];
  mimeTypes: string[];
  sources: string[];
  resourceTypes: string[];
  averageTime: number;
  sampleIds: string[];
  schema: CaptureJsonSchema | null;
  sample?: string;
}

export interface CaptureSummary {
  total: number;
  byResourceType: Record<string, number>;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  failed: number;
  truncated: number;
}

export interface CaptureFilter {
  method?: string;
  type?: string;
  status?: number | string;
  host?: string;
  url?: string | RegExp;
  body?: string | RegExp;
  since?: string | number | Date;
  api?: boolean;
  failed?: boolean;
}

export interface CaptureEndpointOptions {
  all?: boolean;
  schema?: boolean;
  bodies?: boolean;
  maxSample?: number;
}

export interface HarLog {
  log: {
    version: string;
    creator: { name: string; version: string };
    pages?: unknown[];
    entries: unknown[];
  };
}

export class NetworkCapture {
  constructor(options?: { source?: string; includeStatic?: boolean });
  source: string;
  entries: CaptureEntry[];
  meta: Record<string, unknown>;
  readonly size: number;
  static fromHar(input: string | HarLog, options?: Record<string, unknown>): NetworkCapture;
  static fromCdp(options: CdpCaptureOptions & { url: string }): Promise<NetworkCapture>;
  static fromProxy(options?: CaptureProxyOptions): Promise<{ capture: NetworkCapture; proxy: CaptureProxy }>;
  static fromPlaywright(url: string, options?: PlaywrightCaptureOptions): Promise<NetworkCapture>;
  static run(options?: Record<string, unknown>): Promise<NetworkCapture>;
  add(input: CaptureEntryInit | CaptureEntryInit[]): this;
  pull(source: { entries: CaptureEntry[] } | CaptureEntry[]): number;
  filter(criteria?: CaptureFilter | ((entry: CaptureEntry) => boolean)): NetworkCapture;
  api(): NetworkCapture;
  find(target: string | ((entry: CaptureEntry) => boolean)): CaptureEntry | null;
  summary(): CaptureSummary;
  endpoints(options?: CaptureEndpointOptions): CaptureEndpoint[];
  schemas(options?: CaptureEndpointOptions): Record<string, CaptureJsonSchema>;
  toHAR(options?: { redact?: boolean; creator?: string }): HarLog;
  saveHar(filePath: string, options?: { redact?: boolean }): string;
  toFetchCode(target: string | CaptureEntry, options?: { redact?: boolean }): string;
  toCurl(target: string | CaptureEntry, options?: { redact?: boolean }): string;
  toSchema(target: string | CaptureEntry | CaptureEndpoint, options?: CaptureSchemaOptions): Record<string, string>;
  toScript(target: string | CaptureEntry | CaptureEndpoint, options?: CaptureScriptOptions): string;
  frames(target: string | CaptureEntry): CaptureWebSocketFrameRecord[];
  json(options?: CaptureEndpointOptions): { source: string; meta: Record<string, unknown>; summary: CaptureSummary; endpoints: CaptureEndpoint[] };
  toJSON(options?: CaptureEndpointOptions): { source: string; meta: Record<string, unknown>; summary: CaptureSummary; endpoints: CaptureEndpoint[] };
  clear(): this;
}

export interface CaptureSchemaOptions {
  maxDepth?: number;
}

export interface CaptureScriptOptions extends CaptureSchemaOptions {
  schemaObject?: Record<string, string>;
  require?: string;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  url?: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string | null;
  redact?: boolean;
}

export interface CdpClient {
  on(event: string, handler: (payload: unknown) => void): void;
  send(payload: unknown): void;
  close(): void;
}

export interface CdpCaptureOptions {
  url?: string;
  host?: string;
  debuggerUrl?: string | null;
  timeout?: number;
  idleMs?: number;
  maxEntries?: number;
  maxBodyBytes?: number;
  bodies?: boolean;
  readAllBodies?: boolean;
  frames?: boolean;
  maxFramesPerSocket?: number;
  connect?: (url: string, options?: { timeout?: number }) => Promise<CdpClient>;
  discover?: (options?: CdpCaptureOptions) => Promise<{ webSocketDebuggerUrl: string }>;
}

export interface CdpCaptureResult {
  entries: CaptureEntry[];
  url: string;
  title: string | null;
  session: { targetId: string; browser: string | null };
}

export interface CdpTargetDescription {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export class CdpSession {
  constructor(client: CdpClient, options?: { timeout?: number });
  readonly closed: boolean;
  on(method: string, handler: (params: Record<string, unknown>, sessionId: string) => void, sessionId?: string): this;
  once(method: string, handler: (params: Record<string, unknown>, sessionId: string) => void, sessionId?: string): this;
  send<T = Record<string, unknown>>(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<T>;
  close(): void;
}

export class CdpCapture {
  constructor(options?: CdpCaptureOptions);
  host: string;
  timeout: number;
  static version(host?: string, options?: { timeout?: number }): Promise<Record<string, unknown>>;
  static targets(host?: string, options?: { timeout?: number }): Promise<CdpTargetDescription[]>;
  static discover(host?: string, options?: { timeout?: number }): Promise<{ webSocketDebuggerUrl: string; Browser?: string; [key: string]: unknown }>;
  static captureUrl(url: string, options?: CdpCaptureOptions): Promise<CdpCaptureResult>;
  static exportCookies(options?: CdpCaptureOptions): Promise<CaptureCookie[]>;
  open(options?: CdpCaptureOptions): Promise<{ session: CdpSession; client: CdpClient; targetId: string; sessionId: string; browser: Record<string, unknown> }>;
  exportCookies(options?: CdpCaptureOptions): Promise<CaptureCookie[]>;
  capture(options: CdpCaptureOptions & { url: string }): Promise<CdpCaptureResult>;
  fetchBodies(session: CdpSession, sessionId: string, records: unknown[], options?: CdpCaptureOptions): Promise<unknown[]>;
}

export interface CdpRendererOptions extends CdpCaptureOptions {
  capture?: CdpCapture;
  idleMs?: number;
  waitForSelector?: string | null;
  waitForSelectorTimeout?: number;
  waitForSelectorInterval?: number;
  expression?: string;
  includeMeta?: boolean;
  consoleMsgs?: boolean;
}

export interface CdpRenderResult {
  html: string;
  url: string;
  title: string | null;
  readyState: string | null;
  consoleMsgs: Array<{ type: string; text: string }>;
}

export class CdpRenderer {
  constructor(options?: CdpRendererOptions);
  capture: CdpCapture;
  render(url: string, options?: CdpRendererOptions): Promise<string | CdpRenderResult>;
}

export function createCdpRenderer(options?: CdpRendererOptions): CdpRenderer;

export interface CaptureCookie {
  name: string;
  value: string;
  domain: string | null;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expires: number | null;
}

export interface CookieImportOptions extends CdpCaptureOptions {
  from?: 'file' | 'text' | 'json' | 'cdp' | 'browser' | 'cookies';
  path?: string;
  text?: string;
  value?: unknown;
  cookies?: CaptureCookie[];
  url?: string;
  domain?: string;
  domains?: string[];
}

export interface CaptureCookies {
  HTTP_ONLY_PREFIX: string;
  parseCookieFile(text: string): CaptureCookie[];
  parseCookieJson(value: unknown): CaptureCookie[];
  parseSetCookieLine(line: string): CaptureCookie | null;
  toExpiry(value: unknown): number | null;
  domainOf(value: string | null | undefined): string | null;
  readCookies(options?: CookieImportOptions): Promise<CaptureCookie[]>;
  importCookies(jar: CookieJar, options?: CookieImportOptions): Promise<number>;
}

export interface CaptureCodegen {
  jsonPathsFromSchema(schema: CaptureJsonSchema, options?: CaptureSchemaOptions): Record<string, string>;
  buildScript(options: CaptureScriptOptions & { endpoint: CaptureEndpoint; schema: Record<string, string>; entry?: CaptureEntry | null }): string;
  collectPaths(schema: CaptureJsonSchema, prefix: string, depth: number, maxDepth: number, out: Array<{ path: string; schema: CaptureJsonSchema }>): void;
  keyForPath(path: string): string;
  uniqueKey(base: string, path: string, used: Set<string>): string;
  queryParamsOf(rawUrl: string): Record<string, string>;
  stripQuery(rawUrl: string): string;
}

export interface CaptureProxyOptions {
  host?: string;
  port?: number;
  maxBodyBytes?: number;
  captureTunnels?: boolean;
  onEntry?: (entry: CaptureEntry) => void;
}

export interface CaptureProxyAddress {
  host: string;
  port: number;
  url: string;
}

export class CaptureProxy {
  constructor(options?: CaptureProxyOptions);
  entries: CaptureEntry[];
  address: CaptureProxyAddress | null;
  server: unknown;
  requestCount: number;
  tunnelCount: number;
  start(): Promise<CaptureProxyAddress>;
  stop(): Promise<number>;
  captured(): CaptureEntry[];
}

export interface PlaywrightCaptureOptions {
  module?: unknown;
  moduleName?: string;
  bodies?: boolean;
  headless?: boolean;
  args?: string[];
  context?: Record<string, unknown>;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeout?: number;
  html?: boolean;
  browserType?: unknown;
}

export interface PlaywrightAttachment {
  entries: CaptureEntry[];
  stop(): void;
}

export class PlaywrightCapture {
  constructor(options?: PlaywrightCaptureOptions);
  resolve(): unknown;
  attach(page: { on: (event: string, handler: (...args: never[]) => void) => void; off?: (event: string, handler: (...args: never[]) => void) => void }, options?: PlaywrightCaptureOptions): PlaywrightAttachment;
  capture(url: string, options?: PlaywrightCaptureOptions): Promise<{ entries: CaptureEntry[]; title: string; html: string | null; url: string }>;
}

export interface PaginationNext {
  selector: string | null;
  url: string;
  method: 'rel' | 'text' | 'class' | 'url-param' | 'url-path';
  currentPage?: number;
}

export interface PaginationDetectorModule {
  detectNextLink($: CheerioAPI, currentUrl: string): PaginationNext | null;
  detectFromUrlPattern(currentUrl: string): PaginationNext | null;
  detectTotalPages($: CheerioAPI): number;
}

export interface CaptureAnalyzeOptions {
  includeStatic?: boolean;
  includeBodies?: boolean;
  maxSample?: number;
  schema?: boolean;
}

export interface CaptureAnalyze {
  groupEndpoints(entries: CaptureEntry[], options?: CaptureAnalyzeOptions): CaptureEndpoint[];
  inferJsonSchema(value: unknown): CaptureJsonSchema;
  mergeSchemas(schemas: Array<CaptureJsonSchema | null | undefined>): CaptureJsonSchema;
  queryParams(rawUrl: string): string[];
  safeHeaders(headers: CaptureHeaders | unknown, redact?: boolean): CaptureHeaders;
  schemaFromSamples(samples: unknown[]): CaptureJsonSchema | null;
  summarize(entries: CaptureEntry[]): CaptureSummary;
  toCurl(entry: CaptureEntry, options?: { redact?: boolean }): string;
  toFetchCode(entry: CaptureEntry, options?: { redact?: boolean }): string;
  truncate(text: unknown, max: number): string;
  urlTemplate(rawUrl: string, options?: { placeholder?: string }): string;
}

export interface CaptureEntryClassifyInput {
  resourceType?: string;
  mimeType?: string;
  url?: string;
}

export interface CaptureEntryModule {
  API_RESOURCE_TYPES: Set<string>;
  DEFAULT_REDACT_HEADERS: string[];
  HOP_BY_HOP: Set<string>;
  bodyToText(body: unknown): string | null;
  byteLength(body: unknown): number;
  classifyResourceType(input: CaptureEntryClassifyInput): string;
  createEntry(input?: CaptureEntryInit): CaptureEntry;
  entryKind(entry: { status: number; failed?: boolean }): 'failed' | 'success' | 'redirect' | 'client-error' | 'server-error' | 'unknown';
  headerMap(headers: unknown): CaptureHeaders;
  headersToHar(headers: unknown): Array<{ name: string; value: string }>;
  isApiEntry(entry: CaptureEntry | null | undefined): boolean;
  isJsonMime(mimeType: string | null | undefined): boolean;
  isTextMime(mimeType: string | null | undefined): boolean;
  nextId(prefix?: string): string;
  parseJsonBody(entry: CaptureEntry): unknown;
  parseUrl(rawUrl: string): URL | null;
  redactHeaders(headers: unknown, names?: string[]): CaptureHeaders;
}

export interface CaptureWebSocketFrame {
  opcode: number;
  payload: Buffer;
  fin: boolean;
}

export interface CaptureDecodeResult {
  frames: CaptureWebSocketFrame[];
  rest: Buffer;
}

export interface CaptureWebSocketClient {
  socket: unknown;
  maxPayload: number;
  send(data: string | Buffer, options?: { binary?: boolean }): void;
  close(code?: number, reason?: string): void;
  on(event: string, handler: (...args: never[]) => void): void;
  off?(event: string, handler: (...args: never[]) => void): void;
}

export interface CaptureWs {
  GUID: string;
  OPCODES: Record<string, number>;
  WebSocketClient: new (socket: unknown, options?: { maxPayload?: number }) => CaptureWebSocketClient;
  acceptKey(key: string): string;
  connect(url: string, options?: { timeout?: number; maxPayload?: number; headers?: Record<string, string> }): Promise<CaptureWebSocketClient>;
  decodeFrames(buffer: Buffer, options?: { maxPayload?: number }): CaptureDecodeResult;
  encodeFrame(opcode: number, data: string | Buffer, options?: { mask?: boolean; key?: Buffer; fin?: boolean }): Buffer;
}

export const HarImporter: {
  isHar(value: unknown): boolean;
  parseHar(input: string | HarLog, options?: { maxEntries?: number; source?: string }): CaptureEntry[];
  importHarFile(filePath: string, options?: { maxEntries?: number; source?: string }): CaptureEntry[];
  entryFromHar(harEntry: unknown, options?: { source?: string; resourceType?: string }): CaptureEntry;
  createEntryFromHar(harEntry: unknown, options?: { source?: string; resourceType?: string }): CaptureEntry;
  entryToHar(entry: CaptureEntry, options?: { redact?: boolean }): Record<string, unknown>;
  toHar(entries: CaptureEntry[], options?: { redact?: boolean; creator?: string; pages?: unknown[] }): HarLog;
  saveHar(entries: CaptureEntry[], filePath: string, options?: { redact?: boolean; creator?: string }): string;
};

export class Sengkrep {
  constructor(options?: SengkrepOptions);

  fingerprint: Fingerprint;
  cookieJar: CookieJar | null;
  interceptors: Interceptors;
  plugins: PluginSystem;
  pluginSystem: PluginSystem;
  cache: Cache | null;
  rateLimiter: RateLimiter;
  proxyRotator: ProxyRotator;
  security: SecurityGuard;
  securityGuard: SecurityGuard;
  circuitBreaker: CircuitBreaker | null;
  incremental: Incremental | null;
  csrf: CsrfHandler;
  csrfHandler: CsrfHandler;
  auth: AuthManager;
  authManager: AuthManager;
  sessionPool: SessionPool;
  observability: Observability;
  dnsCache: DnsCache | null;
  formHandler: FormHandler;
  deduplicator: UrlDeduplicator;
  health: HealthMonitor | null;
  healthMonitor: HealthMonitor | null;
  diff: DiffDetector | null;
  diffDetector: DiffDetector | null;
  validator: SchemaValidator | null;
  wordpress: WordPress;
  graphql: GraphQLClient;
  transport: Transport;
  singleFlight: SingleFlight;
  adaptive: AdaptiveThrottle | null;
  contentDedup: ContentDedup | null;
  compliance: ComplianceOptions | null;
  renderer: RendererFn | null;
  renderEnabled: boolean;

  fetch(url: string, options?: { params?: Record<string, unknown>; request?: RequestConfig }): Promise<RawResponse>;
  load(html: string): CheerioAPI;

  extract<T = Record<string, unknown>>(url: string, schema: Schema<T>, options?: ExtractOptions): Promise<ExtractResult<T>>;
  batch<T = Record<string, unknown>>(urls: string[], schema: Schema<T>, options?: BatchOptions): Promise<BatchResult<T>[]>;
  stream<T = Record<string, unknown>>(urls: string[], schema: Schema<T>, options?: BatchOptions): AsyncGenerator<BatchResult<T>>;
  paginate<T = Record<string, unknown>>(startUrl: string, config: PaginationConfig, schema: Schema<T>, options?: ExtractOptions): Promise<T[]>;
  crawl(options: CrawlOptions): CrawlJob;

  login(url: string, formData?: Record<string, unknown>, options?: { headers?: Record<string, string> }): Promise<boolean>;
  submitForm(url: string, formSelector: string, overrides?: Record<string, unknown>): Promise<{ status: number; headers: Record<string, unknown>; body: string; url: string }>;
  discover(origin: string, options?: { maxDepth?: number; maxEntries?: number; pattern?: RegExp }): Promise<string[]>;
  isAllowed(url: string, userAgent?: string): Promise<boolean>;
  getCrawlDelay(origin: string, userAgent?: string): Promise<number | null>;
  export(input: string | string[] | unknown, schema?: Record<string, SchemaField>, options?: Record<string, unknown>): Promise<string>;

  inferSchema(url: string, options?: { hints?: string[]; list?: boolean }): Promise<SchemaInferenceResult>;
  distributedQueue(options?: ConstructorParameters<typeof DistributedQueue>[0]): DistributedQueue;

  extractJsonLd(url: string): Promise<Record<string, unknown>[]>;
  extractMicrodata(url: string): Promise<Record<string, unknown>[]>;
  extractDataAttributes(url: string, selector: string): Promise<Record<string, unknown>[]>;
  extractScripts(url: string): Promise<Array<{ inline: boolean; src: string | null; type: string; content: string | null }>>;

  getObservabilityReport(): ObservabilityReport;
  saveHar(filePath: string): void;
  flush(): Promise<number>;
  close(): void;
}

export interface SengkrepStatic {
  <T = Record<string, unknown>>(url: string, schema: Schema<T>, options?: ExtractOptions): Promise<ExtractResult<T>>;

  create(options?: SengkrepOptions): Sengkrep;
  fetch(url: string, options?: { params?: Record<string, unknown>; request?: RequestConfig }): Promise<RawResponse>;
  load(html: string): CheerioAPI;
  extract<T = Record<string, unknown>>(url: string, schema: Schema<T>, options?: ExtractOptions): Promise<ExtractResult<T>>;
  batch<T = Record<string, unknown>>(urls: string[], schema: Schema<T>, options?: BatchOptions): Promise<BatchResult<T>[]>;
  stream<T = Record<string, unknown>>(urls: string[], schema: Schema<T>, options?: BatchOptions): AsyncGenerator<BatchResult<T>>;
  paginate<T = Record<string, unknown>>(startUrl: string, config: PaginationConfig, schema: Schema<T>, options?: ExtractOptions): Promise<T[]>;
  login(url: string, formData?: Record<string, unknown>, options?: Record<string, unknown>): Promise<boolean>;
  discover(origin: string, options?: Record<string, unknown>): Promise<string[]>;
  isAllowed(url: string, userAgent?: string): Promise<boolean>;
  getCrawlDelay(origin: string, userAgent?: string): Promise<number | null>;
  export(input: string | string[] | unknown, schema?: Record<string, SchemaField>, options?: Record<string, unknown>): Promise<string>;
  crawl(options: CrawlOptions): CrawlJob;
  submitForm(url: string, formSelector: string, overrides?: Record<string, unknown>): Promise<unknown>;
  inferSchema(url: string, options?: Record<string, unknown>): Promise<SchemaInferenceResult>;

  Sengkrep: typeof Sengkrep;
  Fingerprint: typeof Fingerprint;
  HealthMonitor: typeof HealthMonitor;
  DiffDetector: typeof DiffDetector;
  SchemaValidator: typeof SchemaValidator;
  Cache: typeof Cache;
  CookieJar: typeof CookieJar;
  RateLimiter: typeof RateLimiter;
  ProxyRotator: typeof ProxyRotator;
  Interceptors: typeof Interceptors;
  Webhook: typeof Webhook;
  Discover: typeof Discover;
  SecurityGuard: typeof SecurityGuard;
  CircuitBreaker: typeof CircuitBreaker;
  Incremental: typeof Incremental;
  CsrfHandler: typeof CsrfHandler;
  AuthManager: typeof AuthManager;
  SessionPool: typeof SessionPool;
  PluginSystem: typeof PluginSystem;
  CrawlQueue: typeof CrawlQueue;
  Observability: typeof Observability;
  HarRecorder: typeof HarRecorder;
  NetworkCapture: typeof NetworkCapture;
  CdpCapture: typeof CdpCapture;
  CaptureProxy: typeof CaptureProxy;
  PlaywrightCapture: typeof PlaywrightCapture;
  HarImporter: typeof HarImporter;
  captureHar(input: string | HarLog, options?: Record<string, unknown>): NetworkCapture;
  captureUrl(url: string, options?: CdpCaptureOptions): Promise<NetworkCapture>;
  CdpRenderer: typeof CdpRenderer;
  renderers: {
    cdp: typeof createCdpRenderer;
  };
  importCookies(jar: CookieJar, options?: CookieImportOptions): Promise<number>;
  parseCookieFile(text: string): CaptureCookie[];
  capture: {
    NetworkCapture: typeof NetworkCapture;
    CdpCapture: typeof CdpCapture;
    CdpSession: typeof CdpSession;
    CdpRenderer: typeof CdpRenderer;
    CaptureProxy: typeof CaptureProxy;
    PlaywrightCapture: typeof PlaywrightCapture;
    HarImporter: typeof HarImporter;
    createCdpRenderer: typeof createCdpRenderer;
    renderers: {
      cdp: typeof createCdpRenderer;
    };
    importCookies(jar: CookieJar, options?: CookieImportOptions): Promise<number>;
    parseCookieFile(text: string): CaptureCookie[];
    DEFAULT_CDP_HOST: string;
    httpGetJson(url: string, options?: { timeout?: number }): Promise<unknown>;
    analyze: CaptureAnalyze;
    codegen: CaptureCodegen;
    cookies: CaptureCookies;
    entry: CaptureEntryModule;
    ws: CaptureWs;
  };
  WordPress: typeof WordPress;
  GraphQLClient: typeof GraphQLClient;
  DnsCache: typeof DnsCache;
  FormHandler: typeof FormHandler;
  ProgressBar: typeof ProgressBar;
  PaginationDetector: PaginationDetectorModule;
  DistributedQueue: typeof DistributedQueue;
  MemoryAdapter: typeof MemoryAdapter;
  StreamWriter: typeof StreamWriter;
  UrlDeduplicator: typeof UrlDeduplicator;
  Retry: typeof Retry;
  Fetcher: typeof Fetcher;
  Http2Fetcher: typeof Http2Fetcher;
  Transport: typeof Transport;
  AdaptiveThrottle: typeof AdaptiveThrottle;
  SingleFlight: typeof SingleFlight;
  ContentDedup: typeof ContentDedup;
  SqliteStorage: typeof SqliteStorage;
  Storage: typeof Storage;
  MemoryStorage: typeof MemoryStorage;
  createStorage: typeof createStorage;

  cheerio: { load: (html: string) => CheerioAPI };
  plugins: {
    timestamp: (fieldName?: string) => PluginHooks;
    logToFile: (filePath: string) => PluginHooks;
    fieldMapper: (mapping: Record<string, string>) => PluginHooks;
  };

  exportData(data: unknown, options?: { format?: string; path?: string }): string;
  toCSV(data: unknown[]): string;
  toJSON(data: unknown): string;
  toNDJSON(data: unknown[]): string;
  toMarkdownTable(data: unknown[]): string;
  parseFeed(xml: string): { type: 'rss' | 'atom' | 'unknown'; title: string | null; items: unknown[] };
  parseCSV(text: string): Record<string, string>[];
  extractJsonLd($: CheerioAPI): Record<string, unknown>[];
  extractMicrodata($: CheerioAPI): Record<string, unknown>[];
  extractDataAttributes($: CheerioAPI, selector: string): Record<string, unknown>[];
  extractScripts($: CheerioAPI, baseUrl: string): Array<{ inline: boolean; src: string | null; type: string; content: string | null }>;
  extractSourceMapUrl(jsText: string): string | null;
  beautifyJs(jsText: string, indentSize?: number): string;
  normalizeUrl(url: string, options?: Record<string, unknown>): string;
  extractLinks($: CheerioAPI, baseUrl: string, options?: Record<string, unknown>): string[];
  contentSafety: {
    sniffContentType(buffer: Buffer): string | null;
    isLikelyBinary(buffer: Buffer): boolean;
    decodeBuffer(buffer: Buffer, options?: { headerCharset?: string | null }): { text: string; charset: string; source: string };
    inspect(buffer: Buffer, contentType?: string | null): { isBinary: boolean; sniffedType: string | null; declaredType: string | null; mismatch: boolean; size: number };
  };

  decodeHtmlEntities(text: string): string;
  decodeUnicodeEscapes(text: string): string;
  decodeBase64(str: string): string;
  decodeHex(str: string): string;
  detectAndDecode(str: string): { encoding: 'base64' | 'hex' | null; decoded: string };
  xorDecode(str: string | Buffer, key: string): Buffer;
  caesarDecode(str: string, shift: number): string;
  rot13(str: string): string;
  parseJSONP(text: string): { callback: string; data: unknown } | null;

  errors: {
    FetchError: typeof FetchError;
    TimeoutError: typeof TimeoutError;
    CanceledError: typeof CanceledError;
    ProxyError: typeof ProxyError;
    Http2Error: typeof Http2Error;
    ExtractionError: typeof ExtractionError;
    JsonExtractionError: typeof JsonExtractionError;
    ValidationError: typeof ValidationError;
    SecurityError: typeof SecurityError;
    CircuitOpenError: typeof CircuitOpenError;
  };
}

declare const sengkrep: SengkrepStatic;
export default sengkrep;
