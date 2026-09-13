class Transport {
  constructor(options = {}) {
    this.fetcher   = options.fetcher;
    this.http2     = options.http2 ?? null;
    this.logger    = options.logger ?? null;
    this.fallback  = options.fallback ?? true;
    this.protocols = new Set();
  }

  get supportsHttp2() {
    return this.http2 !== null;
  }

  async request(url, config = {}) {
    const useHttp2 = this.http2 !== null && !config.proxy && url.startsWith('https:');

    if (useHttp2) {
      try {
        const res = await this.http2.fetch(url, config);
        this.protocols.add('h2');
        return res;
      } catch (err) {
        const hasStatus = err.status !== undefined && err.status !== null;
        const terminal = err.code === 'TIMEOUT' || err.code === 'CANCELED' || err.code === 'SECURITY_BLOCKED' || !this.fallback;
        if (hasStatus || terminal) throw err;
        if (this.logger) {
          this.logger.debug(`HTTP/2 failed for ${url}, falling back to HTTP/1.1 (${err.code ?? err.name})`);
        }
      }
    }

    const res = await this.fetcher.fetch(url, config);
    this.protocols.add('http1');
    return res;
  }

  sweepStreamFiles(ttlMs) {
    if (this.fetcher && typeof this.fetcher.sweepStreamFiles === 'function') {
      return this.fetcher.sweepStreamFiles(ttlMs);
    }
    return 0;
  }

  close() {
    if (this.http2 && typeof this.http2.closeAll === 'function') this.http2.closeAll();
    if (this.fetcher && typeof this.fetcher.close === 'function') this.fetcher.close();
  }
}

module.exports = { Transport };
