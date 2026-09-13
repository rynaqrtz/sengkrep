const fs = require('fs');
const { createEntry, isApiEntry } = require('./entry');
const { groupEndpoints, summarize, toCurl, toFetchCode } = require('./analyze');
const HarImporter = require('./HarImporter');
const { CdpCapture } = require('./CdpCapture');
const { CaptureProxy } = require('./CaptureProxy');
const PlaywrightCapture = require('./PlaywrightCapture');

class NetworkCapture {
  constructor(options = {}) {
    this.options = options;
    this.source = options.source ?? 'memory';
    this.entries = [];
    this.meta = {};
  }

  static fromHar(input, options = {}) {
    const capture = new NetworkCapture({ ...options, source: 'har' });
    const entries = typeof input === 'string' && fs.existsSync(input)
      ? HarImporter.importHarFile(input, options)
      : HarImporter.parseHar(input, options);
    capture.add(entries);
    return capture;
  }

  static async fromCdp(options = {}) {
    const result = await new CdpCapture(options).capture(options);
    const capture = new NetworkCapture({ ...options, source: 'cdp' });
    capture.add(result.entries);
    capture.meta = { url: result.url, title: result.title, target: result.session?.targetId ?? null };
    return capture;
  }

  static async fromProxy(options = {}) {
    const proxy = new CaptureProxy(options);
    await proxy.start();
    const capture = new NetworkCapture({ ...options, source: 'proxy' });
    return { capture, proxy };
  }

  static async fromPlaywright(url, options = {}) {
    const result = await new PlaywrightCapture(options).capture(url, options);
    const capture = new NetworkCapture({ ...options, source: 'playwright' });
    capture.add(result.entries);
    capture.meta = { url: result.url, title: result.title };
    return capture;
  }

  static async run(options = {}) {
    if (options.har) return NetworkCapture.fromHar(options.har, options);
    if (options.cdp) return NetworkCapture.fromCdp(options);
    if (options.playwright) return NetworkCapture.fromPlaywright(options.url, options);
    throw new Error('NetworkCapture.run() needs one of: har, cdp, playwright');
  }

  add(input) {
    const list = Array.isArray(input) ? input : [input];
    for (const item of list) {
      if (!item) continue;
      const entry = item.id && item.method !== undefined && item.requestHeaders !== undefined ? item : createEntry(item);
      if (this.entries.some((existing) => existing.id === entry.id)) continue;
      this.entries.push(entry);
    }
    return this;
  }

  pull(source) {
    const list = source?.entries ?? source;
    if (!Array.isArray(list)) return 0;
    const before = this.entries.length;
    this.add(list);
    return this.entries.length - before;
  }

  get size() {
    return this.entries.length;
  }

  _matcher(criteria) {
    const tests = [];

    if (criteria.method) tests.push((entry) => entry.method === String(criteria.method).toUpperCase());
    if (criteria.type) tests.push((entry) => entry.resourceType === String(criteria.type).toLowerCase());
    if (criteria.status !== undefined) tests.push((entry) => String(entry.status) === String(criteria.status));
    if (criteria.since) tests.push((entry) => new Date(entry.startedDateTime).getTime() >= new Date(criteria.since).getTime());
    if (criteria.host) {
      tests.push((entry) => {
        try {
          return new URL(entry.url).host === criteria.host;
        } catch {
          return false;
        }
      });
    }
    if (criteria.url) {
      const pattern = criteria.url instanceof RegExp ? criteria.url : new RegExp(String(criteria.url));
      tests.push((entry) => pattern.test(entry.url));
    }
    if (criteria.body) {
      const pattern = criteria.body instanceof RegExp ? criteria.body : new RegExp(String(criteria.body));
      tests.push((entry) => pattern.test(String(entry.responseBody ?? '')));
    }
    if (criteria.api) tests.push((entry) => isApiEntry(entry));
    if (criteria.failed === true) tests.push((entry) => entry.failed);
    if (criteria.failed === false) tests.push((entry) => !entry.failed);

    return (entry) => tests.every((test) => test(entry));
  }

  filter(criteria = {}) {
    const test = typeof criteria === 'function' ? criteria : this._matcher(criteria);
    const next = new NetworkCapture(this.options);
    next.source = this.source;
    next.meta = this.meta;
    for (const entry of this.entries) {
      if (test(entry)) next.entries.push(entry);
    }
    return next;
  }

  api() {
    return this.filter({ api: true });
  }

  find(idOrUrl) {
    if (typeof idOrUrl === 'function') return this.entries.find(idOrUrl) ?? null;
    return this.entries.find((entry) => entry.id === idOrUrl || entry.url === idOrUrl) ?? null;
  }

  _resolve(target) {
    if (target && typeof target === 'object' && target.url !== undefined) return target;
    return this.find(target);
  }

  summary() {
    return summarize(this.entries);
  }

  endpoints(options = {}) {
    const all = options.all ?? this.options.includeStatic ?? false;
    return groupEndpoints(this.entries, {
      includeStatic: all,
      schema: options.schema ?? true,
      includeBodies: options.bodies ?? false,
      maxSample: options.maxSample,
    });
  }

  schemas(options = {}) {
    const out = {};
    for (const endpoint of this.endpoints(options)) {
      if (endpoint.schema) out[`${endpoint.method} ${endpoint.template}`] = endpoint.schema;
    }
    return out;
  }

  toHAR(options = {}) {
    return HarImporter.toHar(this.entries, { redact: options.redact ?? true, ...options });
  }

  saveHar(filePath, options = {}) {
    HarImporter.saveHar(this.entries, filePath, { redact: options.redact ?? true, ...options });
    return filePath;
  }

  toFetchCode(target, options = {}) {
    const entry = this._resolve(target);
    if (!entry) throw new Error(`No capture entry for ${target}`);
    return toFetchCode(entry, options);
  }

  toCurl(target, options = {}) {
    const entry = this._resolve(target);
    if (!entry) throw new Error(`No capture entry for ${target}`);
    return toCurl(entry, options);
  }

  json(options = {}) {
    return this.toJSON(options);
  }

  toJSON(options = {}) {
    return {
      source: this.source,
      meta: this.meta,
      summary: this.summary(),
      endpoints: this.endpoints(options),
    };
  }

  clear() {
    this.entries = [];
    return this;
  }
}

module.exports = NetworkCapture;
