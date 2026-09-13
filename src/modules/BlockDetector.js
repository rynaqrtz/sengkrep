class BlockError extends Error {
  constructor(verdict, url) {
    super(BlockError.messageFor(verdict, url));
    this.name      = 'BlockError';
    this.code      = 'BLOCKED';
    this.url       = url ?? null;
    this.vendor    = verdict?.vendor ?? null;
    this.kind      = verdict?.kind ?? null;
    this.confidence = verdict?.confidence ?? null;
    this.status    = verdict?.status ?? null;
    this.signals   = verdict?.signals ?? [];
    this.retryable = verdict?.retryable ?? true;
    this.verdict   = verdict ?? null;
  }

  static messageFor(verdict, url) {
    const vendor = verdict?.vendorName ?? verdict?.vendor ?? 'unknown';
    const kind = verdict?.kind ?? 'block';
    const status = verdict?.status ? ` HTTP ${verdict.status}` : '';
    return `${vendor} ${kind} detected${status}${url ? ` for ${url}` : ''}`;
  }
}

function headerValue(headers, name) {
  if (!headers) return null;
  const wanted = String(name).toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return null;
}

function normalizeHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value === undefined || value === null) continue;
    out[key.toLowerCase()] = Array.isArray(value) ? value.join('; ') : String(value);
  }
  return out;
}

function matchedByHeader(headers, patterns) {
  const hits = [];
  for (const { name, pattern } of patterns) {
    const value = headers[name.toLowerCase()];
    if (value === undefined) continue;
    if (!pattern || pattern.test(value)) hits.push(`header:${name}`);
  }
  return hits;
}

const VENDORS = [
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    kind: 'challenge',
    weight: 4,
    headers: [
      { name: 'cf-mitigated' },
      { name: 'cf-chl-out' },
      { name: 'server', pattern: /cloudflare/i },
    ],
    body: [
      { label: 'cloudflare-challenge', pattern: /cdn-cgi\/challenge-platform/i },
      { label: 'just-a-moment', pattern: /just a moment/i },
      { label: 'checking-browser', pattern: /checking your browser before accessing/i },
      { label: 'attention-required', pattern: /attention required/i },
      { label: 'cf-chl', pattern: /__cf_chl|cf_chl_opt|cf-chl-/i },
      { label: 'turnstile', pattern: /challenges\.cloudflare\.com\/turnstile/i },
      { label: 'js-cookies', pattern: /enable javascript and cookies to continue/i },
    ],
    cookies: [/^cf_clearance$/i, /^__cf_bm$/i],
  },
  {
    id: 'datadome',
    name: 'DataDome',
    kind: 'challenge',
    weight: 4,
    headers: [
      { name: 'x-datadome' },
      { name: 'x-dd-b' },
    ],
    body: [
      { label: 'datadome', pattern: /datadome/i },
      { label: 'captcha-delivery', pattern: /captcha-delivery\.com/i },
      { label: 'dd-challenge', pattern: /dd_cookie_test|geo\.captcha-delivery/i },
    ],
    cookies: [/^datadome$/i, /^dd_cookie_test/i],
  },
  {
    id: 'perimeterx',
    name: 'PerimeterX',
    kind: 'captcha',
    weight: 4,
    headers: [
      { name: 'x-px' },
      { name: 'x-px-block' },
    ],
    body: [
      { label: 'perimeterx', pattern: /perimeterx|human challenge/i },
      { label: 'px-captcha', pattern: /px-captcha|_px[i2]?=|blockScript/i },
      { label: 'access-denied-px', pattern: /access to this page has been denied/i },
    ],
    cookies: [/^_px/i],
  },
  {
    id: 'akamai',
    name: 'Akamai',
    kind: 'denied',
    weight: 3,
    headers: [
      { name: 'akamai-grn' },
      { name: 'x-akamai-transformed' },
      { name: 'server', pattern: /akamaighost|akamai/i },
    ],
    body: [
      { label: 'reference-number', pattern: /reference\s*#?\s*\d+\.\w+/i },
      { label: 'akamai-denied', pattern: /access denied[\s\S]{0,120}akamai/i },
    ],
    cookies: [/^ak_bmsc$/i, /^bm_sz$/i, /^_abck$/i],
  },
  {
    id: 'imperva',
    name: 'Imperva',
    kind: 'challenge',
    weight: 4,
    headers: [
      { name: 'x-iinfo' },
    ],
    body: [
      { label: 'incapsula', pattern: /incapsula|imperva/i },
      { label: 'incapsula-resource', pattern: /_Incapsula_Resource/i },
    ],
    cookies: [/^incap_ses/i, /^visid_incap/i, /^nlbi_/i],
  },
  {
    id: 'kasada',
    name: 'Kasada',
    kind: 'challenge',
    weight: 4,
    headers: [{ name: 'x-kpsdk-ct' }, { name: 'x-kpsdk-cd' }],
    body: [{ label: 'kasada', pattern: /kpsdk|kasada/i }],
    cookies: [/^x-kpsdk/i],
  },
  {
    id: 'awswaf',
    name: 'AWS WAF',
    kind: 'denied',
    weight: 4,
    headers: [{ name: 'x-amzn-waf-action' }],
    body: [{ label: 'awswaf', pattern: /awswaf|aws-waf-token/i }],
    cookies: [/^aws-waf-token$/i],
  },
  {
    id: 'sucuri',
    name: 'Sucuri',
    kind: 'denied',
    weight: 4,
    headers: [{ name: 'x-sucuri-id' }, { name: 'x-sucuri-block' }],
    body: [{ label: 'sucuri', pattern: /sucuri website firewall|cloudproxy/i }],
    cookies: [],
  },
  {
    id: 'google-sorry',
    name: 'Google',
    kind: 'captcha',
    weight: 3,
    headers: [],
    body: [
      { label: 'unusual-traffic', pattern: /our systems have detected unusual traffic/i },
      { label: 'sorry-path', pattern: /\/sorry\/index/i },
    ],
    cookies: [],
  },
];

const GENERIC_MARKERS = [
  { label: 'captcha', pattern: /\bg-recaptcha\b|\bh-captcha\b|\brecaptcha\b|hcaptcha/i },
  { label: 'cf-turnstile', pattern: /challenges\.cloudflare\.com/i },
  { label: 'access-denied', pattern: /access denied|access is denied/i },
  { label: 'forbidden', pattern: /<title>\s*(?:403|forbidden)|^\s*forbidden\s*$/im },
  { label: 'rate-limit', pattern: /too many requests|rate limit exceeded|slow down/i },
  { label: 'robot-check', pattern: /are you a robot|verify you are human|unusual traffic/i },
];

const DEFAULT_STATUSES = new Set([401, 403, 405, 406, 409, 418, 429, 451, 500, 502, 503, 520, 521, 522, 523, 524]);

const KIND_BY_STATUS = {
  429: 'rate-limit',
  401: 'denied',
  403: 'denied',
  451: 'denied',
};

const MAX_BODY_SCAN = 200_000;

function bodySnippet(body) {
  if (!body) return '';
  if (typeof body === 'string') return body.slice(0, MAX_BODY_SCAN);
  if (Buffer.isBuffer(body)) return body.toString('utf8', 0, MAX_BODY_SCAN);
  return '';
}

class BlockDetector {
  constructor(options = {}) {
    const config = options === true ? {} : options ?? {};
    this.vendors = config.vendors ?? VENDORS;
    this.statuses = config.statuses ? new Set(config.statuses) : DEFAULT_STATUSES;
    this.extra = Array.isArray(config.signatures) ? config.signatures : [];
    this.minConfidence = config.minConfidence ?? 'low';
    this._stats = { checked: 0, blocked: 0, byVendor: {} };
  }

  detect(response = {}) {
    this._stats.checked += 1;

    const status = Number(response.status ?? 0);
    const headers = normalizeHeaders(response.headers);
    const body = bodySnippet(response.body);
    const cookies = new Set(
      (Array.isArray(response.cookies) ? response.cookies : [])
        .map((cookie) => (typeof cookie === 'string' ? cookie : cookie?.name))
        .filter(Boolean),
    );

    const statusSuspicious = this.statuses.has(status);
    let best = null;

    for (const vendor of [...this.vendors, ...this.extra]) {
      const signals = [];
      let score = 0;

      const headerHits = matchedByHeader(headers, vendor.headers ?? []);
      if (headerHits.length > 0) {
        score += vendor.weight ?? 2;
        signals.push(...headerHits);
      }

      for (const marker of vendor.body ?? []) {
        if (marker.pattern.test(body)) {
          score += 2;
          signals.push(`body:${marker.label}`);
        }
      }

      for (const pattern of vendor.cookies ?? []) {
        for (const cookie of cookies) {
          if (pattern.test(cookie)) {
            score += 1;
            signals.push(`cookie:${cookie}`);
            break;
          }
        }
      }

      if (statusSuspicious && score > 0) score += 1;

      if (score > 0 && (!best || score > best.score)) {
        best = {
          vendor: vendor.id,
          vendorName: vendor.name,
          kind: vendor.kind ?? 'challenge',
          retryable: vendor.retryable ?? true,
          score,
          signals,
        };
      }
    }

    if (!best) {
      const signals = [];
      for (const marker of GENERIC_MARKERS) {
        if (marker.pattern.test(body)) signals.push(`body:${marker.label}`);
      }
      if (signals.length === 0 && !statusSuspicious) {
        return this._verdict({ blocked: false, status, signals: [] });
      }
      if (signals.length === 0) {
        return this._verdict({
          blocked: false,
          status,
          signals: [`status:${status}`],
          kind: KIND_BY_STATUS[status] ?? null,
          retryable: status === 429 || status >= 500,
          score: 1,
        });
      }
      best = {
        vendor: 'generic',
        vendorName: 'Generic block or bot wall',
        kind: GENERIC_MARKERS.find((marker) => signals[0].endsWith(marker.label))?.label === 'captcha' ? 'captcha' : 'challenge',
        retryable: true,
        score: signals.length + (statusSuspicious ? 1 : 0),
        signals,
      };
    }

    this._stats.blocked += 1;
    this._stats.byVendor[best.vendor] = (this._stats.byVendor[best.vendor] ?? 0) + 1;

    return this._verdict({
      blocked: true,
      status,
      vendor: best.vendor,
      vendorName: best.vendorName,
      kind: best.kind,
      retryable: best.retryable,
      score: best.score,
      signals: best.signals.slice(0, 12),
    });
  }

  _verdict(input) {
    const confidence = input.blocked
      ? (input.score >= 4 ? 'high' : input.score >= 2 ? 'medium' : 'low')
      : 'none';

    const verdict = {
      blocked: input.blocked,
      confidence,
      vendor: input.vendor ?? null,
      vendorName: input.vendorName ?? null,
      kind: input.blocked ? (input.kind ?? 'challenge') : (input.kind ?? null),
      retryable: input.retryable ?? false,
      status: input.status ?? null,
      signals: input.signals ?? [],
      at: new Date().toISOString(),
    };

    if (input.blocked && !this._meetsBar(confidence)) verdict.blocked = false;
    return verdict;
  }

  _meetsBar(confidence) {
    const order = { none: 0, low: 1, medium: 2, high: 3 };
    return order[confidence] >= order[this.minConfidence];
  }

  isBlocked(response) {
    return this.detect(response).blocked;
  }

  addSignature(signature) {
    if (!signature || !signature.id) throw new Error('A block signature needs an id');
    this.extra.push({ weight: 2, ...signature });
    return this;
  }

  stats() {
    return { ...this._stats, byVendor: { ...this._stats.byVendor } };
  }
}

BlockDetector.VENDORS = VENDORS;
BlockDetector.GENERIC_MARKERS = GENERIC_MARKERS;
BlockDetector.BlockError = BlockError;

module.exports = { BlockDetector, BlockError, VENDORS };
