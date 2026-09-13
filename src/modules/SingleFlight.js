const { createHash } = require('crypto');

class SingleFlight {
  constructor(options = {}) {
    const config = options === true ? { enabled: true } : options;
    this.enabled = config.enabled ?? false;
    this.maxKeys = config.maxKeys ?? 1000;
    this._flights = new Map();
    this._stats = { flights: 0, joins: 0, bypassed: 0, failures: 0 };
  }

  get size() {
    return this._flights.size;
  }

  key(method, url, body = null) {
    const name = String(method ?? 'GET').toUpperCase();
    if (!body) return `${name}:${url}`;
    const hash = createHash('sha1').update(String(body)).digest('hex').slice(0, 16);
    return `${name}:${url}:${hash}`;
  }

  run(key, fn) {
    const existing = this._flights.get(key);
    if (existing) {
      this._stats.joins += 1;
      return existing;
    }

    if (this._flights.size >= this.maxKeys) {
      this._stats.bypassed += 1;
      return Promise.resolve().then(fn);
    }

    const flight = Promise.resolve().then(fn);
    flight.catch(() => {
      this._stats.failures += 1;
    });

    const tracked = flight.finally(() => {
      this._flights.delete(key);
    });

    this._flights.set(key, tracked);
    this._stats.flights += 1;
    return tracked;
  }

  stats() {
    return { ...this._stats, inflight: this._flights.size };
  }

  clear() {
    this._flights.clear();
  }
}

module.exports = SingleFlight;
