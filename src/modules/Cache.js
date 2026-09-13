const { createStorage } = require('../utils/storage');

class Cache {
  constructor(options = {}) {
    this.ttl = options.ttl ?? 3600;
    this.maxItems = options.maxItems ?? 1000;
    this.disk = options.storage === 'disk';
    this.staleTtl = options.staleTtl ?? 0;
    this.staleWhileRevalidate = options.staleWhileRevalidate === true;
    this._mem = new Map();
    this._revalidating = new Set();
    this._stats = { hits: 0, misses: 0, sets: 0, evictions: 0, stale: 0, revalidations: 0 };

    if (this.disk) {
      this._store = createStorage({ storage: options.backend, storageDir: options.storageDir ?? '.sengkrep-cache', file: options.file, table: options.table });
    }
  }

  _key(url, method = 'GET') {
    return `${method}:${url}`;
  }

  _ttl(data) {
    if (data && typeof data.cacheTtl === 'number') return data.cacheTtl * 1000;
    return this.ttl * 1000;
  }

  _read(key) {
    return this.disk ? this._store.get(key) : this._mem.get(key) ?? null;
  }

  _touch(key, entry) {
    if (this.disk) return;
    this._mem.delete(key);
    this._mem.set(key, entry);
  }

  _drop(key) {
    if (this.disk) this._store.delete(key);
    else this._mem.delete(key);
  }

  lookup(url, method = 'GET') {
    const key = this._key(url, method);
    const entry = this._read(key);

    if (!entry) {
      this._stats.misses += 1;
      return null;
    }

    const age = Date.now() - entry.ts;
    const ttl = this._ttl(entry.data);

    if (age <= ttl) {
      this._touch(key, entry);
      this._stats.hits += 1;
      return { data: entry.data, stale: false, age };
    }

    if (this.staleWhileRevalidate && age <= ttl + this.staleTtl * 1000) {
      this._touch(key, entry);
      this._stats.stale += 1;
      return { data: entry.data, stale: true, age };
    }

    this._drop(key);
    this._stats.misses += 1;
    return null;
  }

  get(url, method = 'GET') {
    const found = this.lookup(url, method);
    return found ? found.data : null;
  }

  set(url, data, method = 'GET', options = {}) {
    const key = this._key(url, method);
    this._stats.sets += 1;
    const payload = options.ttl ? { ...data, cacheTtl: options.ttl } : data;

    if (this.disk) {
      this._store.set(key, payload);
      return;
    }

    this._mem.delete(key);

    while (this._mem.size >= this.maxItems) {
      const oldestKey = this._mem.keys().next().value;
      this._mem.delete(oldestKey);
      this._stats.evictions += 1;
    }

    this._mem.set(key, { ts: Date.now(), data: payload });
  }

  beginRevalidate(url, method = 'GET') {
    const key = this._key(url, method);
    if (this._revalidating.has(key)) return false;
    this._revalidating.add(key);
    this._stats.revalidations += 1;
    return true;
  }

  endRevalidate(url, method = 'GET') {
    this._revalidating.delete(this._key(url, method));
  }

  isRevalidating(url, method = 'GET') {
    return this._revalidating.has(this._key(url, method));
  }

  has(url, method = 'GET') {
    return this.get(url, method) !== null;
  }

  delete(url, method = 'GET') {
    this._drop(this._key(url, method));
  }

  clear() {
    if (this.disk) this._store.clear();
    else this._mem.clear();
  }

  stats() {
    const size = this.disk ? this._store.list().length : this._mem.size;
    const lookups = this._stats.hits + this._stats.misses + this._stats.stale;
    return {
      ...this._stats,
      size,
      revalidating: this._revalidating.size,
      hitRate: lookups > 0 ? Math.round(((this._stats.hits + this._stats.stale) / lookups) * 100) : 0,
    };
  }
}

module.exports = Cache;
