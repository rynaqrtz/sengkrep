const { safeHeaders } = require('./analyze');

const UNION_TYPES = /[|]/;

function schemaType(schema) {
  if (!schema || typeof schema !== 'object') return '';
  return typeof schema.type === 'string' ? schema.type : '';
}

function collectPaths(schema, prefix, depth, maxDepth, out) {
  if (!schema || typeof schema !== 'object') {
    if (prefix) out.push({ path: prefix, schema });
    return;
  }

  const type = schemaType(schema);

  if (UNION_TYPES.test(type)) {
    if (prefix) out.push({ path: prefix, schema });
    return;
  }

  if (type === 'object') {
    const properties = schema.properties ?? {};
    const keys = Object.keys(properties);
    if (keys.length === 0 || depth >= maxDepth) {
      if (prefix) out.push({ path: prefix, schema });
      return;
    }
    for (const key of keys) {
      collectPaths(properties[key], prefix ? `${prefix}.${key}` : key, depth + 1, maxDepth, out);
    }
    return;
  }

  if (type === 'array') {
    const items = schema.items;
    if (!items || depth >= maxDepth) {
      if (prefix) out.push({ path: prefix, schema });
      return;
    }
    collectPaths(items, `${prefix}[]`, depth + 1, maxDepth, out);
    return;
  }

  if (prefix) out.push({ path: prefix, schema });
}

function keyForPath(path) {
  const segments = String(path).split('.').filter(Boolean);
  const last = segments[segments.length - 1] ?? '';
  const cleaned = last.replace(/\[\]/g, '').trim();
  return cleaned || 'value';
}

function uniqueKey(base, path, used) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  const parts = String(path)
    .split('.')
    .filter(Boolean)
    .map((segment) => segment.replace(/\[\]/g, ''))
    .filter(Boolean);

  for (let take = 2; take <= parts.length; take += 1) {
    const candidate = parts.slice(-take).join('_');
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }

  const full = parts.join('_') || base;
  if (!used.has(full)) {
    used.add(full);
    return full;
  }

  let suffix = 2;
  while (used.has(`${full}_${suffix}`)) suffix += 1;
  const candidate = `${full}_${suffix}`;
  used.add(candidate);
  return candidate;
}

function jsonPathsFromSchema(schema, options = {}) {
  const maxDepth = options.maxDepth ?? Infinity;
  const found = [];
  collectPaths(schema, '', 0, maxDepth, found);

  const used = new Set();
  const out = {};
  for (const item of found) {
    if (!item.path) continue;
    out[uniqueKey(keyForPath(item.path), item.path, used)] = item.path;
  }
  return out;
}

function queryParamsOf(rawUrl) {
  try {
    const params = {};
    for (const [key, value] of new URL(rawUrl).searchParams.entries()) params[key] = value;
    return params;
  } catch {
    return {};
  }
}

function stripQuery(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    parsed.search = '';
    parsed.hash = '';
    return parsed.href;
  } catch {
    return rawUrl;
  }
}

function jsValue(value, indent) {
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${' '.repeat(indent)}${line}`))
    .join('\n');
}

function buildScript(options = {}) {
  const endpoint = options.endpoint ?? {};
  const schema = options.schema ?? {};
  const entry = options.entry ?? null;
  const redact = options.redact ?? true;
  const requirePath = options.require ?? 'sengkrep';
  const logLevel = options.logLevel ?? 'info';
  const method = String(endpoint.method ?? 'GET').toUpperCase();

  const source = options.url ?? entry?.url ?? endpoint.template;
  if (!source) throw new Error('buildScript() needs an endpoint with a template or url');

  const params = options.params ?? (entry ? queryParamsOf(entry.url) : {});
  const url = Object.keys(params).length > 0 ? stripQuery(source) : source;
  const headers = options.headers ?? (entry ? safeHeaders(entry.requestHeaders, redact) : {});
  const body = options.body ?? (method !== 'GET' && method !== 'HEAD' ? entry?.requestBody ?? null : null);

  const request = { method, headers };
  if (body) request.body = body;

  const lines = [
    `const sengkrep = require(${JSON.stringify(requirePath)});`,
    '',
    `const URL = ${JSON.stringify(url)};`,
    `const SCHEMA = ${jsValue(schema, 0)};`,
    '',
    `const PARAMS = ${jsValue(params, 0)};`,
    `const REQUEST = ${jsValue(request, 0)};`,
    '',
    'async function main() {',
    '  const scraper = sengkrep.create({',
    `    logLevel: ${JSON.stringify(logLevel)},`,
    '    retry: { max: 3, respectRetryAfter: true },',
    '    rateLimit: { requestsPerSecond: 2, concurrency: 2 },',
    '  });',
    '',
    '  const data = await scraper.extract(URL, SCHEMA, {',
    '    params: PARAMS,',
    '    request: REQUEST,',
    '  });',
    '',
    '  console.log(JSON.stringify(data, null, 2));',
    '  scraper.close();',
    '}',
    '',
    'main().catch((err) => {',
    '  console.error(err);',
    '  process.exit(1);',
    '});',
    '',
  ];

  return lines.join('\n');
}

module.exports = {
  buildScript,
  collectPaths,
  jsonPathsFromSchema,
  keyForPath,
  queryParamsOf,
  stripQuery,
  uniqueKey,
};
