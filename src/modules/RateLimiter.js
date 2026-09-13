const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class RateLimiter {
  constructor(options = {}) {
    this.requestsPerSecond = options.requestsPerSecond ?? null;
    this.concurrency = options.concurrency ?? null;
    this._lastRequest = new Map();
    this._active = new Map();
    this._slots = new Map();
    this._chains = new Map();
  }

  get enabled() {
    return this.requestsPerSecond !== null || this.concurrency !== null;
  }

  async _waitForSlot(hostname) {
    if (!this.concurrency) return;
    if (!this._active.has(hostname)) this._active.set(hostname, 0);

    while (this._active.get(hostname) >= this.concurrency) {
      await new Promise((resolve) => {
        if (!this._slots.has(hostname)) this._slots.set(hostname, []);
        this._slots.get(hostname).push(resolve);
      });
    }

    this._active.set(hostname, this._active.get(hostname) + 1);
  }

  _releaseSlot(hostname) {
    if (!this.concurrency) return;
    const current = this._active.get(hostname) ?? 1;
    this._active.set(hostname, Math.max(0, current - 1));

    const queue = this._slots.get(hostname);
    if (queue && queue.length > 0) queue.shift()();
  }

  _gateInterval(hostname) {
    if (!this.requestsPerSecond) return Promise.resolve();

    const previous = this._chains.get(hostname) ?? Promise.resolve();
    const next = previous
      .then(async () => {
        const minInterval = 1000 / this.requestsPerSecond;
        const last = this._lastRequest.get(hostname) ?? 0;
        const elapsed = Date.now() - last;
        if (elapsed < minInterval) await sleep(minInterval - elapsed);
        this._lastRequest.set(hostname, Date.now());
      })
      .catch(() => {});

    this._chains.set(hostname, next);
    next.then(() => {
      if (this._chains.get(hostname) === next) this._chains.delete(hostname);
    });
    return next;
  }

  async acquire(hostname) {
    await this._waitForSlot(hostname);
    await this._gateInterval(hostname);
    return () => this._releaseSlot(hostname);
  }

  reset(hostname) {
    if (hostname) {
      this._lastRequest.delete(hostname);
      this._chains.delete(hostname);
      return;
    }
    this._lastRequest.clear();
    this._chains.clear();
  }
}

module.exports = RateLimiter;
