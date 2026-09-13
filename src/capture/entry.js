const path = require('path');

const API_RESOURCE_TYPES = new Set(['xhr', 'fetch']);
const KNOWN_RESOURCE_TYPES = new Set([
  'document', 'script', 'stylesheet', 'image', 'font', 'media',
  'xhr', 'fetch', 'websocket', 'manifest', 'prefetch', 'other',
]);

const DEFAULT_REDACT_HEADERS = ['authorization', 'cookie', 'set-cookie', 'proxy-authorization', 'x-api-key', 'x-auth-token'];

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'content-length', 'accept-encoding']);

let counter = 0;

function nextId(prefix = 'req') {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

function parseUrl(rawUrl) {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function bodyToText(body) {
  if (body === null || body === undefined) return null;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  return String(body);
}

function byteLength(body) {
  if (body === null || body === undefined) return 0;
  if (Buffer.isBuffer(body)) return body.length;
  return Buffer.byteLength(String(body));
}

function headerMap(headers) {
  const out = {};
  if (!headers) return out;

  if (Array.isArray(headers)) {
    for (const header of headers) {
      if (!header) continue;
      const name = String(header.name ?? '').toLowerCase();
      if (!name || out[name] !== undefined) continue;
      out[name] = String(header.value ?? '');
    }
    return out;
  }

  for (const [name, value] of Object.entries(headers)) {
    const key = String(name).toLowerCase();
    if (value === undefined || value === null) continue;
    out[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

function headersToHar(headers) {
  return Object.entries(headerMap(headers)).map(([name, value]) => ({ name, value }));
}

function redactHeaders(headers, names = DEFAULT_REDACT_HEADERS) {
  const blocked = new Set((names ?? []).map((name) => String(name).toLowerCase()));
  const out = {};
  for (const [name, value] of Object.entries(headerMap(headers))) {
    out[name] = blocked.has(name) ? '<redacted>' : value;
  }
  return out;
}

function isJsonMime(mimeType) {
  return typeof mimeType === 'string' && /(application|text)\/(?:.+\+)?(json|graphql)|application\/graphql/i.test(mimeType);
}

function isTextMime(mimeType) {
  return typeof mimeType === 'string' && /^text\/|json|xml|javascript|graphql|x-www-form-urlencoded|csv/i.test(mimeType);
}

function extensionType(rawUrl) {
  const parsed = parseUrl(rawUrl);
  if (!parsed) return null;
  const ext = path.extname(parsed.pathname).toLowerCase();
  if (['.js', '.mjs', '.cjs', '.jsx'].includes(ext)) return 'script';
  if (ext === '.css') return 'stylesheet';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico'].includes(ext)) return 'image';
  if (['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext)) return 'font';
  if (['.mp4', '.webm', '.mp3', '.ogg', '.wav'].includes(ext)) return 'media';
  if (['.json', '.jsonl', '.ndjson'].includes(ext)) return 'fetch';
  if (['.html', '.htm'].includes(ext)) return 'document';
  return null;
}

function classifyResourceType(input) {
  const declared = input.resourceType ? String(input.resourceType).toLowerCase() : null;
  if (declared && KNOWN_RESOURCE_TYPES.has(declared)) return declared;

  const mime = String(input.mimeType ?? '').toLowerCase();
  if (isJsonMime(mime)) return 'fetch';
  if (/javascript|ecmascript/.test(mime)) return 'script';
  if (/css/.test(mime)) return 'stylesheet';
  if (/^image\//.test(mime)) return 'image';
  if (/^font\/|woff/.test(mime)) return 'font';
  if (/^video\/|^audio\//.test(mime)) return 'media';
  if (/html|xml/.test(mime)) return 'document';

  return extensionType(input.url) ?? 'other';
}

function createEntry(input = {}) {
  const requestHeaders = headerMap(input.requestHeaders);
  const responseHeaders = headerMap(input.responseHeaders);
  const requestBody = bodyToText(input.requestBody);
  const responseBody = bodyToText(input.responseBody);
  const mimeType = input.mimeType ?? responseHeaders['content-type'] ?? requestHeaders['content-type'] ?? '';

  const entry = {
    id: input.id ?? nextId(),
    source: input.source ?? 'memory',
    method: String(input.method ?? 'GET').toUpperCase(),
    url: String(input.url ?? ''),
    status: Number.isFinite(input.status) ? input.status : 0,
    statusText: input.statusText ?? '',
    httpVersion: input.httpVersion ?? 'HTTP/1.1',
    resourceType: '',
    mimeType: String(mimeType),
    requestHeaders,
    responseHeaders,
    requestBody,
    responseBody,
    requestSize: input.requestSize ?? byteLength(requestBody),
    responseSize: input.responseSize ?? byteLength(responseBody),
    startedDateTime: input.startedDateTime ?? new Date().toISOString(),
    time: Number.isFinite(input.time) ? input.time : 0,
    initiator: input.initiator ?? null,
    fromCache: Boolean(input.fromCache),
    failed: Boolean(input.failed),
    errorText: input.errorText ?? null,
    redirectURL: input.redirectURL ?? null,
    bodyBase64: Boolean(input.bodyBase64),
  };

  entry.resourceType = input.resourceType ? classifyResourceType(input) : classifyResourceType(entry);
  return entry;
}

function isApiEntry(entry) {
  if (!entry) return false;
  if (entry.resourceType === 'websocket') return false;
  if (API_RESOURCE_TYPES.has(entry.resourceType)) return true;
  if (entry.resourceType === 'document' && isJsonMime(entry.mimeType)) return true;
  if (isJsonMime(entry.mimeType) && entry.method !== 'GET') return true;
  return false;
}

function entryKind(entry) {
  if (entry.failed) return 'failed';
  if (entry.status >= 200 && entry.status < 300) return 'success';
  if (entry.status >= 300 && entry.status < 400) return 'redirect';
  if (entry.status >= 400 && entry.status < 500) return 'client-error';
  if (entry.status >= 500) return 'server-error';
  return 'unknown';
}

function parseJsonBody(entry) {
  if (!entry || !entry.responseBody) return null;
  if (!isJsonMime(entry.mimeType) && !/^\s*[[{]/.test(entry.responseBody)) return null;
  try {
    return JSON.parse(entry.responseBody);
  } catch {
    return null;
  }
}

module.exports = {
  API_RESOURCE_TYPES,
  DEFAULT_REDACT_HEADERS,
  HOP_BY_HOP,
  bodyToText,
  byteLength,
  classifyResourceType,
  createEntry,
  entryKind,
  headerMap,
  headersToHar,
  isApiEntry,
  isJsonMime,
  isTextMime,
  nextId,
  parseJsonBody,
  parseUrl,
  redactHeaders,
};
