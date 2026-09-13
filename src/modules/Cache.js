const { createStorage } = require('../utils/storage');

class Cache {
  constructor(options = {}) {
    this.ttl = options.ttl ?? 3600;
    this.maxItems = options.maxItems ?? 1000;
    this.disk = options.storage === 'disk';
    this._mem = new Map();
    this._stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };

    if (this.disk) {
      this._store = createStorage({ storage: options.backend, storageDir: options.storageDir ?? '.sengkrep-cache', file: options.file, table: options.table });
    }
  }

  _key(url, method = 'GET') {
    return `${method}:${url}`;
  }

  get(url, method = 'GET') {
    const key = this._key(url, method);

    if (this.disk) {
      const entry = this._store.get(key);
      if (!entry) { this._stats.misses += 1; return null; }
      if (this._ttl(entry.data) > 0 && Date.now() - entry.ts > this._ttl(entry.data)) {
        this._store.delete(key);
        this._stats.misses += 1;
        return null;
      }
      this._stats.hits += 1;
      return entry.data;
    }

    const entry = this._mem.get(key);
    if (!entry) { this._stats.misses += 1; return null; }
    if (Date.now() - entry.ts > this._ttl(entry.data)) {
      this._mem.delete(key);
      this._stats.misses += 1;
      return null;
    }

    this._mem.delete(key);
    this._mem.set(key, entry);
    this._stats.hits += 1;
    return entry.data;
  }

  _ttl(data) {
    if (data && typeof data.cacheTtl === 'number') return data.cacheTtl * 1000;
    return this.ttl * 1000;
  }

  set(url, data, method = 'GET', options = {}) {
    const key = this._key(url, method);
    this._stats.sets += 1;

    if (this.disk) {
      this._store.set(key, options.ttl ? { ...data, cacheTtl: options.ttl } : data);
      return;
    }

    if (this._mem.has(key)) this._mem.delete(key);

    while (this._mem.size >= this.maxItems) {
      const oldestKey = this._mem.keys().next().value;
      this._mem.delete(oldestKey);
      this._stats.evictions += 1;
    }

    this._mem.set(key, { ts: Date.now(), data: options.ttl ? { ...data, cacheTtl: options.ttl } : data });
  }

  has(url, method = 'GET') {
    return this.get(url, method) !== null;
  }

  delete(url, method = 'GET') {
    const key = this._key(url, method);
    if (this.disk) {
      this._store.delete(key);
    } else {
      this._mem.delete(key);
    }
  }

  clear() {
    if (this.disk) {
      this._store.clear();
    } else {
      this._mem.clear();
    }
  }

  stats() {
    const size = this.disk ? this._store.list().length : this._mem.size;
    const lookups = this._stats.hits + this._stats.misses;
    return {
      ...this._stats,
      size,
      hitRate: lookups > 0 ? Math.round((this._stats.hits / lookups) * 100) : 0,
    };
  }
}

module.exports = Cache;
