const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class AdaptiveThrottle {
  constructor(options = {}) {
    this.enabled          = options.enabled ?? true;
    this.minConcurrency   = options.minConcurrency ?? 1;
    this.maxConcurrency   = options.maxConcurrency ?? 8;
    this.initialConcurrency = options.initialConcurrency ?? 2;
    this.increaseEvery    = options.increaseEvery ?? 10;
    this.backoffFactor    = options.backoffFactor ?? 0.5;
    this.baseDelay        = options.baseDelay ?? 250;
    this.maxDelay         = options.maxDelay ?? 60000;
    this._state           = new Map();
  }

  _stateOf(hostname) {
    if (!this._state.has(hostname)) {
      this._state.set(hostname, {
        concurrency: Math.max(this.minConcurrency, Math.min(this.maxConcurrency, this.initialConcurrency)),
        active: 0,
        successes: 0,
        delay: 0,
        backoffs: 0,
      });
    }
    return this._state.get(hostname);
  }

  _release(hostname) {
    const state = this._stateOf(hostname);
    state.active = Math.max(0, state.active - 1);
    if (state.waiters && state.waiters.length > 0) state.waiters.shift()();
  }

  async acquire(hostname) {
    const state = this._stateOf(hostname);
    if (!this.enabled) {
      state.active += 1;
      return () => this._release(hostname);
    }

    while (state.active >= state.concurrency) {
      await new Promise((resolve) => {
        if (!state.waiters) state.waiters = [];
        state.waiters.push(resolve);
      });
    }

    state.active += 1;

    if (state.delay > 0) await sleep(state.delay);

    return () => this._release(hostname);
  }

  onSuccess(hostname) {
    const state = this._stateOf(hostname);
    state.successes += 1;
    state.backoffs = 0;
    state.delay = Math.max(0, Math.floor(state.delay / 2));

    if (state.successes >= this.increaseEvery && state.concurrency < this.maxConcurrency) {
      state.concurrency += 1;
      state.successes = 0;
    }
  }

  onFailure(hostname, info = {}) {
    const state = this._stateOf(hostname);
    state.successes = 0;
    state.backoffs += 1;
    state.concurrency = Math.max(this.minConcurrency, Math.floor(state.concurrency * this.backoffFactor));

    const suggested = info.retryAfterMs ?? 0;
    const target = Math.max(suggested, state.delay > 0 ? state.delay * 2 : this.baseDelay);
    state.delay = Math.min(this.maxDelay, target);
  }

  concurrencyFor(hostname) {
    return this._stateOf(hostname).concurrency;
  }

  delayFor(hostname) {
    return this._stateOf(hostname).delay;
  }

  stats() {
    return [...this._state.entries()].map(([hostname, state]) => ({
      hostname,
      concurrency: state.concurrency,
      active: state.active,
      delay: state.delay,
      backoffs: state.backoffs,
    }));
  }

  reset(hostname) {
    if (hostname) {
      this._state.delete(hostname);
    } else {
      this._state.clear();
    }
  }
}

module.exports = AdaptiveThrottle;
