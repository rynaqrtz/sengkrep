import sengkrep from '../../index';
import type {
  CaptureEntry,
  CaptureEndpoint,
  CaptureJsonSchema,
  CaptureSummary,
  PaginationNext,
  RawResponse,
  Sengkrep,
  SengkrepOptions,
} from '../../index';

const options: SengkrepOptions = {
  logLevel: 'error',
  timeout: 5000,
  retry: { max: 2 },
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
