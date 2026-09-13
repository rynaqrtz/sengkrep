import sengkrep from '../../index';
import type {
  CacheLookup,
  CacheStats,
  CaptureCookie,
  CaptureEntry,
  CaptureEndpoint,
  CaptureJsonSchema,
  CaptureScriptOptions,
  CaptureSummary,
  CaptureWebSocketFrameRecord,
  CdpRenderer,
  CdpRenderResult,
  CookieJar,
  JobRecord,
  PaginationNext,
  RawResponse,
  Schedule,
  Scheduler,
  SchedulerStats,
  Sengkrep,
  SengkrepOptions,
  Sink,
  SinkDescriptor,
  SinkStats,
  SingleFlightStats,
} from '../../index';

const options: SengkrepOptions = {
  logLevel: 'error',
  timeout: 5000,
  retry: { max: 2 },
  singleFlight: { enabled: true, maxKeys: 500 },
  cache: { ttl: 60, staleWhileRevalidate: true, staleTtl: 300 },
  scheduler: { backend: 'memory', catchUp: true, jobs: [{ id: 'sync', schedule: { every: '1h' } }] },
  redirectPolicy: { validateEachHop: true, forwardSensitiveHeaders: false, maxCrossHostHops: 2 },
  security: { allowDomains: ['example.com'], blockPrivateIPs: false },
};

const client: Sengkrep = sengkrep.create(options);

async function fetchPage(): Promise<number> {
  const res: RawResponse = await client.fetch('https://example.com/items', {
    params: { page: 2 },
    request: { headers: { 'X-Test': '1' }, method: 'GET', timeout: 3000 },
  });
  return res.status;
}

async function extractPage(): Promise<string> {
  const out = await sengkrep.extract<{ title: string }>('https://example.com', { title: 'h1' });
  return out.title;
}

const next: PaginationNext | null = sengkrep.PaginationDetector.detectFromUrlPattern('https://example.com/page/2');
const nextUrl: string | undefined = next?.url;
const totalPages: number = sengkrep.PaginationDetector.detectTotalPages(sengkrep.load('<nav></nav>'));

const template: string = sengkrep.capture.analyze.urlTemplate('https://api.example.com/v1/items/42');
const params: string[] = sengkrep.capture.analyze.queryParams('https://api.example.com/v1/items?limit=10&page=2');

const entry: CaptureEntry = sengkrep.capture.entry.createEntry({
  method: 'post',
  url: 'https://api.example.com/v1/items/42',
  responseBody: '{"id":42}',
  requestHeaders: { 'Content-Type': 'application/json' },
});
const kind: string = sengkrep.capture.entry.entryKind(entry);
const isApi: boolean = sengkrep.capture.entry.isApiEntry(entry);
const headers: Record<string, string> = sengkrep.capture.entry.headerMap({ Accept: 'application/json' });

const capture = new sengkrep.NetworkCapture();
capture.add(entry);
const endpoints: CaptureEndpoint[] = capture.endpoints({ all: true, schema: true });
const first: CaptureEndpoint | undefined = endpoints[0];
const schema: CaptureJsonSchema | null | undefined = first?.schema;
const summary: CaptureSummary = capture.summary();
const rest: Buffer = sengkrep.capture.ws.decodeFrames(Buffer.from([0x81, 0x01, 0x61])).rest;

const renderer: CdpRenderer = sengkrep.renderers.cdp({ idleMs: 100, waitForSelector: '#app' });
const rendered: Promise<string | CdpRenderResult> = renderer.render('https://app.example.com/page');

const paths: Record<string, string> = capture.toSchema(entry);
const scriptOptions: CaptureScriptOptions = { require: 'sengkrep', logLevel: 'error', maxDepth: 3 };
const script: string = capture.toScript(entry, scriptOptions);
const frames: CaptureWebSocketFrameRecord[] = capture.frames(entry);
const direction: 'sent' | 'received' | undefined = frames[0]?.direction;

const jar: CookieJar = new sengkrep.CookieJar();
const imported: Promise<number> = sengkrep.importCookies(jar, {
  from: 'file',
  path: 'cookies.txt',
  domains: ['example.com'],
});
const parsedCookies: CaptureCookie[] = sengkrep.parseCookieFile('sid=1');
const codegenPaths: Record<string, string> = sengkrep.capture.codegen.jsonPathsFromSchema({ type: 'object', properties: { id: { type: 'integer' } } });
const cookieHelpers: typeof sengkrep.capture.cookies = sengkrep.capture.cookies;

void fetchPage;
void extractPage;
void nextUrl;
void totalPages;
void template;
void params;
void kind;
void isApi;
void headers;
void schema;
void summary;
void rest;
void rendered;
void paths;
void script;
void direction;
void imported;
void parsedCookies;
void codegenPaths;
void cookieHelpers;

async function sharedRequests(): Promise<number> {
  const stats: SingleFlightStats = client.singleFlight.stats();
  const key: string = client.singleFlight.key('GET', 'https://example.com/items');
  const lookup: CacheLookup | null = client.cache?.lookup('https://example.com/items') ?? null;
  const cacheStats: CacheStats | null = client.cache?.stats() ?? null;
  const stale: boolean = lookup ? lookup.stale : false;
  void key;
  void stats;
  void cacheStats;
  void stale;
  return client.flush();
}

void sharedRequests;

async function scheduled(): Promise<SchedulerStats> {
  const scheduler: Scheduler | null = client.scheduler;
  const schedule: Schedule = '*/5 * * * *';

  if (scheduler) {
    const record: JobRecord = scheduler.add({ id: 'sync', schedule }, (job: JobRecord, own: Scheduler) => {
      void job.runs;
      void own.stats();
    });
    scheduler.on('run', (event) => { void event.job.id; });
    scheduler.on('run:error', (event) => { void event.error.message; });
    scheduler.on('tick', (event) => { void event.started; });
    void record.nextRunAt;
    await scheduler.start();
    await scheduler.tick();
    await scheduler.runNow('sync');
  }

  return scheduler ? scheduler.stats() : { ticks: 0, runs: 0, errors: 0, skipped: 0, jobs: 0, enabled: 0, running: 0, started: false };
}

void scheduled;

async function toSink(): Promise<SinkStats> {
  const descriptor: SinkDescriptor = { type: 'postgres', table: 'items', key: 'id' };
  const sink: Sink = sengkrep.createSink(descriptor);

  await sink.write({ id: 1, name: 'a' });
  await sink.write([{ id: 2, name: 'b' }]);
  await sink.upsert({ id: 2, name: 'c' });
  await sink.flush();

  const memory = new sengkrep.MemorySink({ key: ['sku', 'locale'] });
  await memory.write({ sku: 'X', locale: 'en' });
  void memory.rows;

  const file = new sengkrep.FileSink('/tmp/out.jsonl', { key: 'id', batchSize: 10 });
  void file.format;
  void file.count();

  const s3 = new sengkrep.S3Sink({ bucket: 'b', prefix: 'runs', key: 'id', put: async (request) => request.key });
  void s3.objectKeyFor({ id: 1 });

  return sink.close();
}

void toSink;

async function scrapeIntoSink(): Promise<number> {
  const sink = new sengkrep.MemorySink({ key: 'title' });
  const results = await client.batch(['https://example.com'], { title: 'h1' }, { sink, concurrency: 2 });
  await client.export(['https://example.com'], { title: 'h1' }, { sink, format: 'csv' });
  return results.length;
}

void scrapeIntoSink;
