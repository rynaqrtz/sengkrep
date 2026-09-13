class ProxyRotator {
  constructor(options = {}) {
    this.proxies  = options.proxies  ?? [];
    this.strategy = options.strategy ?? 'round-robin';
    this._index   = 0;
    this._sticky  = new Map();
    this._failures = new Map();
    this._sessionBase = new Map();
    this.maxFailures = options.maxFailures ?? 3;
    this.sessionPlaceholder = options.sessionPlaceholder ?? '{session}';
  }

  _resolve(proxy, session) {
    if (!proxy || !session || !proxy.includes(this.sessionPlaceholder)) return proxy;
    return proxy.split(this.sessionPlaceholder).join(encodeURIComponent(session));
  }

  _baseOf(proxyUrl) {
    return this._sessionBase.get(proxyUrl) ?? proxyUrl;
  }

  _emit(base, session) {
    const resolved = this._resolve(base, session);
    if (resolved !== base) this._sessionBase.set(resolved, base);
    return resolved;
  }

  get enabled() {
    return this.proxies.length > 0;
  }

  _healthyPool() {
    if (this._failures.size === 0) return this.proxies;
    const pool = this.proxies.filter(p => (this._failures.get(p) ?? 0) < this.maxFailures);
    return pool.length > 0 ? pool : this.proxies;
  }

  _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  next(hostname = '', options = {}) {
    if (!this.enabled) return null;
    const pool = this._healthyPool();
    const session = options.session ?? null;

    if (this.strategy === 'sticky') {
      const key = `${hostname}|${session ?? ''}`;
      if (this._sticky.has(key) && pool.includes(this._sticky.get(key))) {
        return this._emit(this._sticky.get(key), session);
      }
      const chosen = pool[this._hash(key) % pool.length];
      this._sticky.set(key, chosen);
      return this._emit(chosen, session);
    }

    if (this.strategy === 'random') {
      return this._emit(pool[Math.floor(Math.random() * pool.length)], session);
    }

    const chosen = pool[this._index % pool.length];
    this._index++;
    return this._emit(chosen, session);
  }

  reportFailure(proxyUrl) {
    const base = this._baseOf(proxyUrl);
    const count = (this._failures.get(base) ?? 0) + 1;
    this._failures.set(base, count);
  }

  reportSuccess(proxyUrl) {
    const base = this._baseOf(proxyUrl);
    if (this._failures.has(base)) this._failures.delete(base);
  }

  stats() {
    return this.proxies.map(p => ({
      proxy:    p,
      failures: this._failures.get(p) ?? 0,
      healthy:  (this._failures.get(p) ?? 0) < this.maxFailures,
      sessions: [...this._sessionBase.entries()].filter(([, base]) => base === p).length,
    }));
  }
}

module.exports = ProxyRotator;
