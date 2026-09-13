const Fingerprint = require('./Fingerprint');

const LOCALE_TIMEZONES = {
  'en-US': ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Denver'],
  'en-GB': ['Europe/London'],
  'en-AU': ['Australia/Sydney'],
  'en-CA': ['America/Toronto'],
  'de-DE': ['Europe/Berlin'],
  'fr-FR': ['Europe/Paris'],
  'es-ES': ['Europe/Madrid'],
  'it-IT': ['Europe/Rome'],
  'nl-NL': ['Europe/Amsterdam'],
  'pt-BR': ['America/Sao_Paulo'],
  'id-ID': ['Asia/Jakarta', 'Asia/Makassar'],
  'ja-JP': ['Asia/Tokyo'],
  'ko-KR': ['Asia/Seoul'],
  'zh-CN': ['Asia/Shanghai'],
  'ru-RU': ['Europe/Moscow'],
  'tr-TR': ['Europe/Istanbul'],
  'pl-PL': ['Europe/Warsaw'],
  'sv-SE': ['Europe/Stockholm'],
  'ar-SA': ['Asia/Riyadh'],
  'hi-IN': ['Asia/Kolkata'],
};

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1600, height: 900 },
  { width: 2560, height: 1440 },
];

const DEVICE_MEMORY = [4, 8, 8, 16, 16];
const HARDWARE_CONCURRENCY = [4, 8, 8, 12, 16];

function hash(value) {
  let h = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(list, seed) {
  return list[hash(seed) % list.length];
}

function acceptLanguage(locale) {
  const base = locale.split('-')[0];
  if (base === locale) return `${locale},en;q=0.9`;
  return `${locale},${base};q=0.9,en;q=0.8`;
}

function clientHintBrands(browser, ua) {
  if (typeof Fingerprint.clientHintBrands === 'function') {
    return Fingerprint.clientHintBrands(browser, ua);
  }
  const match = String(ua).match(/(?:Chrome|Edg)\/(\d+)/);
  const major = match ? Number(match[1]) : 140;
  if (browser === 'edge') return `"Chromium";v="${major}", "Microsoft Edge";v="${major}", "Not-A.Brand";v="99"`;
  if (browser === 'chrome') return `"Chromium";v="${major}", "Google Chrome";v="${major}", "Not-A.Brand";v="99"`;
  return null;
}

class Identity {
  constructor(spec = {}) {
    const profile = spec.profile ?? {};
    this.id          = spec.id ?? `${profile.id ?? 'custom'}-${hash(JSON.stringify(spec)).toString(36)}`;
    this.browser     = spec.browser ?? profile.browser ?? 'chrome';
    this.platform    = spec.platform ?? (String(profile.platform ?? '').replaceAll('"', '') || null);
    this.userAgent   = spec.userAgent ?? profile.ua ?? Fingerprint.PROFILES[0].ua;
    this.locale      = spec.locale ?? 'en-US';
    this.timezone    = spec.timezone ?? pick(LOCALE_TIMEZONES[this.locale] ?? LOCALE_TIMEZONES['en-US'], spec.seed ?? this.id);
    this.viewport    = spec.viewport ?? VIEWPORTS[0];
    this.deviceMemory = spec.deviceMemory ?? DEVICE_MEMORY[0];
    this.hardwareConcurrency = spec.hardwareConcurrency ?? HARDWARE_CONCURRENCY[0];
    this.isMobile    = spec.isMobile ?? false;
    this.label       = spec.label ?? profile.id ?? 'custom';
  }

  get headers() {
    const headers = {
      'User-Agent': this.userAgent,
      'Accept-Language': acceptLanguage(this.locale),
    };

    const brands = clientHintBrands(this.browser, this.userAgent);
    if (brands) {
      headers['Sec-CH-UA'] = brands;
      headers['Sec-CH-UA-Mobile'] = this.isMobile ? '?1' : '?0';
      headers['Sec-CH-UA-Platform'] = `"${this.platform ?? ''}"`;
      headers['Sec-CH-UA-Platform-Version'] = '"15.0.0"';
    }

    return headers;
  }

  get mobile() {
    return this.isMobile;
  }

  toJSON() {
    return {
      id: this.id,
      label: this.label,
      browser: this.browser,
      platform: this.platform,
      userAgent: this.userAgent,
      locale: this.locale,
      timezone: this.timezone,
      viewport: { ...this.viewport },
      deviceMemory: this.deviceMemory,
      hardwareConcurrency: this.hardwareConcurrency,
      mobile: this.isMobile,
    };
  }
}

class IdentityPool {
  constructor(options = {}) {
    const config = options === true ? {} : options ?? {};

    this.identities = (config.identities ?? []).map((identity) => (
      identity instanceof Identity ? identity : new Identity(identity)
    ));

    if (this.identities.length === 0) this.identities = IdentityPool.generate(config.size ?? 12, config);

    this._assigned = new Map();
    this._rotation = config.rotation ?? 'sticky';
    this.rotateOnBlock = config.rotateOnBlock !== false;
    this._index = 0;
    this._stats = { assigned: 0, rotations: 0 };
  }

  get enabled() {
    return this.identities.length > 0;
  }

  get size() {
    return this.identities.length;
  }

  list() {
    return [...this.identities];
  }

  get(seed = 'default') {
    if (this._assigned.has(seed)) return this._assigned.get(seed);

    let identity;
    if (this._rotation === 'random') {
      identity = this.identities[Math.floor(Math.random() * this.identities.length)];
    } else if (this._rotation === 'round-robin') {
      identity = this.identities[this._index % this.identities.length];
      this._index += 1;
    } else {
      identity = this.identities[hash(seed) % this.identities.length];
    }

    this._assigned.set(seed, identity);
    this._stats.assigned += 1;
    return identity;
  }

  next(seed = 'default') {
    return this.get(seed);
  }

  rotate(seed = 'default') {
    const current = this._assigned.get(seed);
    const currentIndex = current ? this.identities.indexOf(current) : -1;
    const next = this.identities[(currentIndex + 1 + this.identities.length) % this.identities.length];

    this._assigned.set(seed, next);
    this._stats.rotations += 1;
    return next;
  }

  release(seed) {
    return this._assigned.delete(seed);
  }

  reset() {
    this._assigned.clear();
    this._index = 0;
  }

  stats() {
    return {
      ...this._stats,
      size: this.identities.length,
      active: this._assigned.size,
      rotation: this._rotation,
    };
  }

  static generate(size = 12, options = {}) {
    const profiles = options.profiles ?? Fingerprint.PROFILES;
    const locales = options.locales ?? Object.keys(LOCALE_TIMEZONES);
    const out = [];

    for (let i = 0; i < size; i += 1) {
      const profile = profiles[i % profiles.length];
      const locale = locales[i % locales.length];
      const timezones = LOCALE_TIMEZONES[locale] ?? LOCALE_TIMEZONES['en-US'];
      const mobile = /Android|iPhone|Mobile/i.test(profile.ua);

      out.push(new Identity({
        id: `${profile.id}-${locale}-${i}`,
        label: profile.id,
        profile,
        locale,
        timezone: timezones[i % timezones.length],
        viewport: mobile ? { width: 390, height: 844 } : VIEWPORTS[i % VIEWPORTS.length],
        deviceMemory: DEVICE_MEMORY[i % DEVICE_MEMORY.length],
        hardwareConcurrency: HARDWARE_CONCURRENCY[i % HARDWARE_CONCURRENCY.length],
        isMobile: mobile,
        seed: i,
      }));
    }

    return out;
  }
}

Identity.LOCALE_TIMEZONES = LOCALE_TIMEZONES;
Identity.VIEWPORTS = VIEWPORTS;
IdentityPool.hash = hash;

module.exports = { Identity, IdentityPool };
