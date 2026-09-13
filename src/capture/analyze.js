const { HOP_BY_HOP, isApiEntry, isJsonMime, parseJsonBody, redactHeaders } = require('./entry');

const NUMERIC_SEGMENT = /^\d+$/;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_SEGMENT = /^[0-9a-f]{16,}$/i;
const OPAQUE_SEGMENT = /^[A-Za-z0-9_-]{20,}$/;

function safeDecode(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function isDynamicSegment(segment) {
  if (NUMERIC_SEGMENT.test(segment) || UUID_SEGMENT.test(segment) || HEX_SEGMENT.test(segment)) return true;
  const decoded = safeDecode(segment);
  return OPAQUE_SEGMENT.test(decoded) && /\d/.test(decoded) && /[A-Za-z]/.test(decoded);
}

function urlTemplate(rawUrl, options = {}) {
  const placeholder = options.placeholder ?? ':id';
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return String(rawUrl);
  }

  const segments = parsed.pathname.split('/').map((segment) => {
    if (!segment) return segment;
    return isDynamicSegment(segment) ? placeholder : segment;
  });

  const path = segments.join('/') || '/';
  return `${parsed.origin}${path === '/' && parsed.pathname !== '/' ? '' : path}`;
}

function queryParams(rawUrl) {
  try {
    return [...new URL(rawUrl).searchParams.keys()].sort();
  } catch {
    return [];
  }
}

function inferJsonSchema(value) {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    const items = value.length > 0 ? mergeSchemas(value.map(inferJsonSchema)) : { type: 'unknown' };
    return { type: 'array', items };
  }

  switch (typeof value) {
    case 'string':
      return { type: 'string' };
    case 'number':
      return { type: Number.isInteger(value) ? 'integer' : 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'object': {
      const properties = {};
      for (const [key, item] of Object.entries(value)) properties[key] = inferJsonSchema(item);
      return { type: 'object', properties, required: Object.keys(properties) };
    }
    default:
      return { type: 'unknown' };
  }
}

function mergeSchemas(schemas) {
  const valid = (schemas ?? []).filter(Boolean);
  if (valid.length === 0) return { type: 'unknown' };

  const types = new Set(valid.map((schema) => schema.type));
  if (types.size > 1) {
    const numeric = valid.every((schema) => schema.type === 'number' || schema.type === 'integer');
    if (numeric) return { type: 'number' };
    return { type: [...types].join('|') };
  }

  const [first] = valid;
  if (first.type === 'object') {
    const properties = {};
    const occurrences = new Map();

    for (const schema of valid) {
      const own = schema.properties ?? {};
      for (const [key, value] of Object.entries(own)) {
        properties[key] = properties[key] ? mergeSchemas([properties[key], value]) : value;
      }
      const declared = schema.required ?? Object.keys(own);
      for (const key of declared) occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
    }

    const required = [...occurrences.entries()].filter(([, count]) => count === valid.length).map(([key]) => key);
    return { type: 'object', properties, required };
  }

  if (first.type === 'array') {
    return { type: 'array', items: mergeSchemas(valid.map((schema) => schema.items)) };
  }

  return { type: first.type };
}

function schemaFromSamples(samples) {
  const parsed = (samples ?? []).filter((sample) => sample !== undefined);
  if (parsed.length === 0) return null;
  return mergeSchemas(parsed.map(inferJsonSchema));
}

function truncate(text, max) {
  const value = String(text ?? '');
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n... (truncated)`;
}

function groupEndpoints(entries, options = {}) {
  const includeStatic = options.includeStatic ?? false;
  const includeBodies = options.includeBodies ?? false;
  const maxSample = options.maxSample ?? 4000;
  const groups = new Map();

  for (const entry of entries) {
    const api = isApiEntry(entry);
    if (!includeStatic && !api) continue;

    const template = urlTemplate(entry.url);
    const key = `${entry.method} ${template}`;

    if (!groups.has(key)) {
      groups.set(key, {
        method: entry.method,
        template,
        path: template.replace(/^[a-z]+:\/\/[^/]+/i, ''),
        host: (() => {
          try {
            return new URL(entry.url).host;
          } catch {
            return '';
          }
        })(),
        count: 0,
        sources: new Set(),
        statuses: {},
        params: new Set(),
        mimeTypes: new Set(),
        samples: [],
        resourceTypes: new Set(),
        totalTime: 0,
        candidates: [],
        kinds: {},
      });
    }

    const group = groups.get(key);
    group.count += 1;
    group.sources.add(entry.source);
    group.resourceTypes.add(entry.resourceType);
    group.statuses[entry.status] = (group.statuses[entry.status] ?? 0) + 1;
    for (const param of queryParams(entry.url)) group.params.add(param);
    if (entry.mimeType) group.mimeTypes.add(entry.mimeType.split(';')[0].trim());
    group.totalTime += entry.time ?? 0;
    if (entry.responseBody) group.candidates.push(entry.responseBody);
    if (group.samples.length < 3) group.samples.push(entry.id);
  }

  const endpoints = [...groups.values()].map((group) => {
    const schema = options.schema === false ? null : schemaFromSamples(group.candidates.map((body) => {
      try {
        return JSON.parse(body);
      } catch {
        return undefined;
      }
    }).filter((value) => value !== undefined));

    return {
      method: group.method,
      template: group.template,
      path: group.path,
      host: group.host,
      api: group.resourceTypes.size === 0 || ![...group.resourceTypes].every((type) => type === 'document'),
      count: group.count,
      statuses: group.statuses,
      params: [...group.params].sort(),
      mimeTypes: [...group.mimeTypes],
      sources: [...group.sources].sort(),
      resourceTypes: [...group.resourceTypes].sort(),
      averageTime: Math.round(group.totalTime / group.count),
      sampleIds: group.samples,
      schema,
      sample: includeBodies && group.candidates.length > 0 ? truncate(group.candidates[0], maxSample) : undefined,
    };
  });

  return endpoints.sort((a, b) => b.count - a.count || a.template.localeCompare(b.template));
}

function safeHeaders(headers, redact = true) {
  const source = redact ? redactHeaders(headers) : headers;
  const out = {};
  for (const [name, value] of Object.entries(source ?? {})) {
    if (HOP_BY_HOP.has(name)) continue;
    if (/^sec-ch-ua|^sec-fetch|^user-agent|^accept$|^accept-language/.test(name)) continue;
    out[name] = value;
  }
  return out;
}

function quote(value) {
  return String(value).replace(/'/g, `'\\''`);
}

function toCurl(entry, options = {}) {
  const redact = options.redact ?? true;
  const headers = safeHeaders(entry.requestHeaders, redact);
  const lines = [`curl -X ${entry.method} '${quote(entry.url)}'`];

  for (const [name, value] of Object.entries(headers)) {
    lines.push(`  -H '${name}: ${quote(value)}'`);
  }

  if (entry.requestBody) {
    lines.push(`  --data-raw '${quote(entry.requestBody)}'`);
  }

  return lines.join(' \\\n');
}

function toFetchCode(entry, options = {}) {
  const redact = options.redact ?? true;
  const headers = safeHeaders(entry.requestHeaders, redact);
  const lines = ['const res = await fetch(' + JSON.stringify(entry.url) + ', {'];

  lines.push(`  method: ${JSON.stringify(entry.method)},`);
  if (Object.keys(headers).length > 0) {
    lines.push('  headers: {');
    for (const [name, value] of Object.entries(headers)) {
      lines.push(`    ${JSON.stringify(name)}: ${JSON.stringify(value)},`);
    }
    lines.push('  },');
  }
  if (entry.requestBody) {
    lines.push(`  body: ${JSON.stringify(entry.requestBody)},`);
  }
  lines.push('});');
  lines.push('');
  lines.push('if (!res.ok) throw new Error(`HTTP ${res.status}`);');
  lines.push(`const data = await res.${isJsonMime(entry.mimeType) ? 'json' : 'text'}();`);

  return lines.join('\n');
}

function summarize(entries) {
  const summary = {
    total: entries.length,
    byResourceType: {},
    byStatus: {},
    bySource: {},
    failed: 0,
    truncated: 0,
  };

  for (const entry of entries) {
    summary.byResourceType[entry.resourceType] = (summary.byResourceType[entry.resourceType] ?? 0) + 1;
    const status = String(entry.status);
    summary.byStatus[status] = (summary.byStatus[status] ?? 0) + 1;
    summary.bySource[entry.source] = (summary.bySource[entry.source] ?? 0) + 1;
    if (entry.failed) summary.failed += 1;
    if (entry.truncated) summary.truncated += 1;
  }

  return summary;
}

module.exports = {
  groupEndpoints,
  inferJsonSchema,
  mergeSchemas,
  queryParams,
  safeHeaders,
  schemaFromSamples,
  summarize,
  toCurl,
  toFetchCode,
  truncate,
  urlTemplate,
};
