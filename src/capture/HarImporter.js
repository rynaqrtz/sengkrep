const fs = require('fs');
const { version } = require('../../package.json');
const { createEntry, headersToHar, headerMap, redactHeaders } = require('./entry');

function isHar(value) {
  return Boolean(value && typeof value === 'object' && value.log && Array.isArray(value.log.entries));
}

function textFromContent(content) {
  if (!content || content.text === undefined) return null;
  if (String(content.encoding ?? '').toLowerCase() === 'base64') {
    try {
      return Buffer.from(String(content.text), 'base64').toString('utf8');
    } catch {
      return String(content.text);
    }
  }
  return String(content.text);
}

function queryStringFrom(url) {
  try {
    return [...new URL(url).searchParams.entries()].map(([name, value]) => ({ name, value }));
  } catch {
    return [];
  }
}

function requestBodyFrom(request) {
  if (!request || !request.postData) return null;
  if (typeof request.postData.text === 'string') return request.postData.text;
  if (Array.isArray(request.postData.params)) {
    return request.postData.params.map((param) => `${param.name}=${param.value ?? ''}`).join('&');
  }
  return null;
}

function entryFromHar(harEntry, options = {}) {
  const request = harEntry.request ?? {};
  const response = harEntry.response ?? {};
  const responseHeaders = headerMap(response.headers);
  const content = response.content ?? {};

  const status = Number(response.status) || 0;
  const errorText = response._error ?? harEntry._error ?? null;

  return createEntry({
    source: options.source ?? 'har',
    method: request.method ?? 'GET',
    url: request.url ?? '',
    status,
    statusText: response.statusText ?? '',
    httpVersion: response.httpVersion ?? request.httpVersion ?? 'HTTP/1.1',
    resourceType: harEntry._resourceType ?? options.resourceType,
    mimeType: content.mimeType ?? responseHeaders['content-type'] ?? '',
    requestHeaders: request.headers,
    responseHeaders: response.headers,
    requestBody: requestBodyFrom(request),
    responseBody: textFromContent(content),
    requestSize: request.bodySize ?? undefined,
    responseSize: content.size ?? response.bodySize ?? undefined,
    startedDateTime: harEntry.startedDateTime,
    time: Number(harEntry.time) || 0,
    initiator: typeof harEntry._initiator === 'object' ? harEntry._initiator?.type ?? null : null,
    fromCache: status === 304 || harEntry._fromCache === true,
    failed: Boolean(errorText) || (status === 0 && !content.text),
    errorText,
    redirectURL: response.redirectURL || null,
    bodyBase64: String(content.encoding ?? '').toLowerCase() === 'base64',
  });
}

function parseHar(input, options = {}) {
  const har = typeof input === 'string' ? JSON.parse(input) : input;
  if (!isHar(har)) throw new Error('Invalid HAR: expected an object with log.entries');
  if (har.log.entries.length > (options.maxEntries ?? Infinity)) {
    return har.log.entries.slice(0, options.maxEntries).map((entry) => entryFromHar(entry, options));
  }
  return har.log.entries.map((entry) => entryFromHar(entry, options));
}

function importHarFile(filePath, options = {}) {
  return parseHar(fs.readFileSync(filePath, 'utf8'), options);
}

function entryToHar(entry, options = {}) {
  const redact = options.redact ?? false;
  const requestHeaders = redact ? redactHeaders(entry.requestHeaders) : entry.requestHeaders;
  const responseHeaders = redact ? redactHeaders(entry.responseHeaders) : entry.responseHeaders;
  const request = {
    method: entry.method,
    url: entry.url,
    httpVersion: entry.httpVersion,
    cookies: [],
    headers: headersToHar(requestHeaders),
    queryString: queryStringFrom(entry.url),
    headersSize: -1,
    bodySize: entry.requestSize,
  };

  if (entry.requestBody !== null && entry.requestBody !== undefined) {
    request.postData = {
      mimeType: entry.requestHeaders['content-type'] ?? 'text/plain',
      text: entry.requestBody,
    };
  }

  const out = {
    startedDateTime: entry.startedDateTime,
    time: entry.time,
    request,
    response: {
      status: entry.status,
      statusText: entry.statusText,
      httpVersion: entry.httpVersion,
      cookies: [],
      headers: headersToHar(responseHeaders),
      content: {
        size: entry.responseSize,
        mimeType: entry.mimeType,
        text: entry.responseBody ?? '',
      },
      redirectURL: entry.redirectURL ?? '',
      headersSize: -1,
      bodySize: entry.responseSize,
    },
    cache: entry.fromCache ? { beforeRequest: { expires: entry.startedDateTime } } : {},
    timings: { send: 0, wait: entry.time, receive: 0 },
    _source: entry.source,
    _resourceType: entry.resourceType,
  };

  if (entry.failed && entry.errorText) out.response._error = entry.errorText;
  return out;
}

function toHar(entries, options = {}) {
  const log = {
    version: '1.2',
    creator: { name: options.creator ?? 'sengkrep', version },
    entries: entries.map((entry) => entryToHar(entry, options)),
  };

  if (options.pages) log.pages = options.pages;
  return { log };
}

function saveHar(entries, filePath, options = {}) {
  fs.writeFileSync(filePath, JSON.stringify(toHar(entries, options), null, 2), 'utf8');
  return filePath;
}

function createEntryFromHar(harEntry, options = {}) {
  return entryFromHar(harEntry, options);
}

module.exports = {
  createEntryFromHar,
  entryFromHar,
  entryToHar,
  importHarFile,
  isHar,
  parseHar,
  saveHar,
  toHar,
};
