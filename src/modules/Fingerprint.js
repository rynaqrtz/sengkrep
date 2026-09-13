const zlib = require('zlib');

const ZSTD_SUPPORTED = typeof zlib.createZstdDecompress === 'function' || typeof zlib.zstdDecompress === 'function';

const BASE_ENCODINGS = ['gzip', 'deflate', 'br'];
if (ZSTD_SUPPORTED) BASE_ENCODINGS.push('zstd');
const ACCEPT_ENCODING = BASE_ENCODINGS.join(', ');

const ACCEPT_LANGUAGES = [
  'en-US,en;q=0.9',
  'en-GB,en;q=0.9',
  'en-US,en;q=0.8',
  'en-US,en;q=0.9,id;q=0.8',
  'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
];

const PROFILES = [
  {
    id: 'chrome-windows',
    browser: 'chrome',
    platform: '"Windows"',
    platformVersion: '"15.0.0"',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  },
  {
    id: 'chrome-macos',
    browser: 'chrome',
    platform: '"macOS"',
    platformVersion: '"15.5.0"',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  },
  {
    id: 'chrome-linux',
    browser: 'chrome',
    platform: '"Linux"',
    platformVersion: '""',
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  },
  {
    id: 'edge-windows',
    browser: 'edge',
    platform: '"Windows"',
    platformVersion: '"15.0.0"',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
  },
  {
    id: 'firefox-windows',
    browser: 'firefox',
    platform: '"Windows"',
    platformVersion: '"15.0.0"',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0',
  },
  {
    id: 'firefox-linux',
    browser: 'firefox',
    platform: '"Linux"',
    platformVersion: '""',
    ua: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0',
  },
  {
    id: 'safari-macos',
    browser: 'safari',
    platform: '"macOS"',
    platformVersion: '"15.5.0"',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15',
  },
];

function parseProfile(ua) {
  if (!ua || ua === 'random') return null;
  if (/Edg\//.test(ua)) return 'edge';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua)) return 'safari';
  return null;
}

function majorVersion(ua) {
  const match = ua.match(/(?:Chrome|Edg|Firefox|Version)\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function clientHintBrands(profile, ua) {
  if (profile !== 'chrome' && profile !== 'edge') return null;
  const major = majorVersion(ua) ?? 140;
  const vendor = profile === 'edge' ? 'Microsoft Edge' : 'Google Chrome';
  return `"Chromium";v="${major}", "${vendor}";v="${major}", "Not-A.Brand";v="99"`;
}

class Fingerprint {
  constructor(options = {}) {
    this.options = {
      userAgent: options.userAgent ?? 'random',
      rotateUAOnEachRequest: options.rotateUAOnEachRequest ?? false,
      randomizeHeaderOrder: options.randomizeHeaderOrder ?? true,
      randomizeTiming: options.randomizeTiming ?? true,
      profile: options.profile ?? null,
      language: options.language ?? null,
      ...options,
    };
    this._index = 0;
    this._current = this._select();
  }

  _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  _select() {
    const explicit = this.options.profile
      ? PROFILES.find((p) => p.id === this.options.profile)
      : null;
    if (explicit) return explicit;

    const ua = this.options.userAgent;
    if (ua && ua !== 'random') {
      const browser = parseProfile(ua);
      const match = PROFILES.find((p) => p.ua === ua);
      return match ?? { id: 'custom', browser: browser ?? 'unknown', platform: '""', platformVersion: '""', ua };
    }

    if (this.options.rotateUAOnEachRequest) return this._pick(PROFILES);

    const profile = PROFILES[this._index % PROFILES.length];
    this._index += 1;
    return profile;
  }

  get profile() {
    return this._current;
  }

  setProfile(id) {
    const next = PROFILES.find((p) => p.id === id);
    if (!next) throw new Error(`Unknown fingerprint profile: "${id}". Available: ${PROFILES.map((p) => p.id).join(', ')}`);
    this._current = next;
    return next;
  }

  getUA() {
    if (this.options.rotateUAOnEachRequest) this._current = this._select();
    return this._current.ua;
  }

  _secFetchSite(context) {
    if (!context || !context.referer) return 'none';
    try {
      const refUrl = new URL(context.referer);
      const targetUrl = new URL(context.targetUrl);
      if (refUrl.origin === targetUrl.origin) return 'same-origin';
      const refSite = refUrl.hostname.split('.').slice(-2).join('.');
      const targetSite = targetUrl.hostname.split('.').slice(-2).join('.');
      return refSite === targetSite ? 'same-site' : 'cross-site';
    } catch {
      return 'none';
    }
  }

  buildHeaders(extra = {}, context = null) {
    if (this.options.rotateUAOnEachRequest) this._current = this._select();
    const profile = this._current;
    const ua = profile.ua;
    const lang = this.options.language ?? this._pick(ACCEPT_LANGUAGES);
    const site = this._secFetchSite(context);

    const base = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': lang,
      'Accept-Encoding': ACCEPT_ENCODING,
      'User-Agent': ua,
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };

    if (context?.referer) base['Referer'] = context.referer;

    if (Math.random() > 0.5) base['Cache-Control'] = this._pick(['no-cache', 'max-age=0']);

    const brands = clientHintBrands(profile.browser, ua);

    if (brands) {
      base['Sec-CH-UA'] = brands;
      base['Sec-CH-UA-Mobile'] = '?0';
      base['Sec-CH-UA-Platform'] = profile.platform;
      if (profile.platformVersion && profile.platformVersion !== '""') {
        base['Sec-CH-UA-Platform-Version'] = profile.platformVersion;
      }
      base['Sec-Fetch-Dest'] = 'document';
      base['Sec-Fetch-Mode'] = site === 'none' ? 'navigate' : 'cors';
      base['Sec-Fetch-Site'] = site;
      base['Sec-Fetch-User'] = '?1';
      if (Math.random() > 0.6) base['DNT'] = '1';
    }

    if (profile.browser === 'firefox') {
      base['Sec-Fetch-Dest'] = 'document';
      base['Sec-Fetch-Mode'] = site === 'none' ? 'navigate' : 'cors';
      base['Sec-Fetch-Site'] = site;
      base['Sec-Fetch-User'] = '?1';
      base['TE'] = 'trailers';
    }

    const merged = { ...base, ...extra };

    if (this.options.randomizeHeaderOrder) {
      const entries = Object.entries(merged);
      for (let i = entries.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [entries[i], entries[j]] = [entries[j], entries[i]];
      }
      return Object.fromEntries(entries);
    }

    return merged;
  }

  async delay(base = 1000) {
    if (!this.options.randomizeTiming) {
      return new Promise((resolve) => setTimeout(resolve, base));
    }
    const jittered = Math.round(Math.max(0, base * (0.7 + Math.random() * 0.6)));
    return new Promise((resolve) => setTimeout(resolve, jittered));
  }

  async humanDelay(min = 600, max = 2500) {
    const ms = Math.round(min + Math.random() * (max - min));
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

Fingerprint.PROFILES = PROFILES;
Fingerprint.ACCEPT_ENCODING = ACCEPT_ENCODING;
Fingerprint.ZSTD_SUPPORTED = ZSTD_SUPPORTED;

module.exports = Fingerprint;
