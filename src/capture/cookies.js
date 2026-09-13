const fs = require('fs');
const { CdpCapture } = require('./CdpCapture');

const HTTP_ONLY_PREFIX = '#HttpOnly_';

function toExpiry(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric <= 0) return null;
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function parseCookieFile(text) {
  const cookies = [];

  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    let line = rawLine;
    let httpOnly = false;

    if (line.startsWith(HTTP_ONLY_PREFIX)) {
      line = line.slice(HTTP_ONLY_PREFIX.length);
      httpOnly = true;
    } else if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }
    if (!line.trim()) continue;

    const parts = line.split('\t');

    if (parts.length >= 7) {
      const [domain, , cookiePath, secure, expires, name, value] = parts;
      cookies.push({
        domain: domain.trim().replace(/^\./, ''),
        path: (cookiePath || '/').trim(),
        secure: String(secure).trim().toUpperCase() === 'TRUE',
        httpOnly,
        expires: toExpiry(expires),
        name: name.trim(),
        value: value.trim(),
      });
      continue;
    }

    const parsed = parseSetCookieLine(line);
    if (parsed) cookies.push(parsed);
  }

  return cookies;
}

function parseSetCookieLine(line) {
  const segments = String(line).split(';').map((segment) => segment.trim());
  const [nameValue, ...attrs] = segments;
  if (!nameValue) return null;
  if (nameValue.startsWith('[[')) return null;

  const eq = nameValue.indexOf('=');
  if (eq === -1) return null;

  const cookie = {
    name: nameValue.slice(0, eq).trim(),
    value: nameValue.slice(eq + 1).trim(),
    domain: null,
    path: '/',
    secure: false,
    httpOnly: false,
    expires: null,
  };

  if (!cookie.name) return null;
  if (/^https?:$/i.test(cookie.name)) return null;

  for (const attr of attrs) {
    const index = attr.indexOf('=');
    const key = (index === -1 ? attr : attr.slice(0, index)).trim().toLowerCase();
    const value = index === -1 ? '' : attr.slice(index + 1).trim();

    if (key === 'domain') cookie.domain = value.replace(/^\./, '') || null;
    if (key === 'path') cookie.path = value || '/';
    if (key === 'expires') cookie.expires = toExpiry(value);
    if (key === 'max-age') cookie.expires = Date.now() + (parseInt(value, 10) || 0) * 1000;
    if (key === 'secure') cookie.secure = true;
    if (key === 'httponly') cookie.httpOnly = true;
  }

  return cookie;
}

function parseCookieJson(value) {
  let list = value;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch (err) {
      throw new Error(`Invalid cookie JSON: ${err.message}`);
    }
  }

  if (list && !Array.isArray(list) && Array.isArray(list.cookies)) list = list.cookies;
  if (!Array.isArray(list)) throw new Error('Cookie JSON must be an array or an object with a cookies array');

  return list
    .filter((cookie) => cookie && cookie.name !== undefined)
    .map((cookie) => ({
      name: String(cookie.name),
      value: String(cookie.value ?? ''),
      domain: cookie.domain ? String(cookie.domain).replace(/^\./, '') : null,
      path: cookie.path ? String(cookie.path) : '/',
      secure: Boolean(cookie.secure),
      httpOnly: Boolean(cookie.httpOnly ?? cookie.httponly),
      expires: toExpiry(cookie.expirationDate ?? cookie.expires ?? cookie.expiry),
    }));
}

function normalize(cookie, fallbackDomain) {
  const domain = cookie.domain || fallbackDomain;
  if (!domain || !cookie.name) return null;
  return {
    name: cookie.name,
    value: cookie.value ?? '',
    domain,
    path: cookie.path ?? '/',
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    expires: cookie.expires ?? null,
  };
}

function domainOf(value) {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return String(value).replace(/^\./, '') || null;
  }
}

async function readCookies(options = {}) {
  const from = options.from ?? 'file';

  if (from === 'file') {
    if (!options.path) throw new Error('importCookies({ from: "file" }) needs a path');
    return parseCookieFile(fs.readFileSync(options.path, 'utf8'));
  }

  if (from === 'text') {
    return parseCookieFile(options.text ?? '');
  }

  if (from === 'json') {
    return parseCookieJson(options.value ?? options.text ?? []);
  }

  if (from === 'cdp' || from === 'browser') {
    return CdpCapture.exportCookies(options);
  }

  if (from === 'cookies') {
    if (!Array.isArray(options.cookies)) throw new Error('importCookies({ from: "cookies" }) needs a cookies array');
    return parseCookieJson(options.cookies);
  }

  throw new Error(`Unknown cookie source: ${from}`);
}

async function importCookies(jar, options = {}) {
  if (!jar || typeof jar.setManual !== 'function') {
    throw new Error('importCookies(jar, options) needs a CookieJar with setManual()');
  }

  const fallbackDomain = domainOf(options.url ?? options.domain);
  const allowed = options.domains ? new Set(options.domains.map((domain) => String(domain).replace(/^\./, ''))) : null;
  const list = await readCookies(options);

  let imported = 0;
  for (const item of list) {
    const cookie = normalize(item, fallbackDomain);
    if (!cookie) continue;
    if (allowed && !allowed.has(cookie.domain)) continue;

    jar.setManual(cookie.domain, cookie.name, cookie.value, {
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      expires: cookie.expires,
    });
    imported += 1;
  }

  return imported;
}

module.exports = {
  HTTP_ONLY_PREFIX,
  domainOf,
  importCookies,
  parseCookieFile,
  parseCookieJson,
  parseSetCookieLine,
  readCookies,
  toExpiry,
};
