const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class MemoryAdapter {
  constructor() {
    this._queue  = [];
    this._locked = new Map();
    this._done   = new Set();
  }

  _queued(item) {
    return this._queue.some((entry) => entry.value === item);
  }

  async enqueue(items, options = {}) {
    const list = Array.isArray(items) ? items : [items];
    const priority = options.priority ?? 0;

    for (const item of list) {
      if (this._done.has(item) || this._queued(item)) continue;
      this._queue.push({ value: item, priority, at: Date.now() });
    }
  }

  _expireLeases(leaseMs) {
    if (!leaseMs) return;
    const now = Date.now();
    for (const [value, lease] of this._locked.entries()) {
      if (now - lease.at >= leaseMs) {
        this._locked.delete(value);
        if (!this._done.has(value) && !this._queued(value)) {
          this._queue.push({ value, priority: lease.priority ?? 0, at: now });
        }
      }
    }
  }

  async dequeue(leaseMs) {
    this._expireLeases(leaseMs);

    while (this._queue.length > 0) {
      this._queue.sort((a, b) => a.priority - b.priority || a.at - b.at);
      const entry = this._queue.shift();
      if (this._locked.has(entry.value) || this._done.has(entry.value)) continue;
      this._locked.set(entry.value, { at: Date.now(), priority: entry.priority });
      return entry.value;
    }

    return null;
  }

  async complete(item) {
    this._locked.delete(item);
    this._done.add(item);
  }

  async release(item) {
    this._locked.delete(item);
    if (!this._done.has(item) && !this._queued(item)) {
      this._queue.push({ value: item, priority: 0, at: Date.now() });
    }
  }

  async size() {
    return { queued: this._queue.length, locked: this._locked.size, done: this._done.size };
  }
}

class DistributedQueue {
  constructor(options = {}) {
    this.adapter          = options.adapter          ?? new MemoryAdapter();
    this.workerId         = options.workerId         ?? `worker-${Math.random().toString(36).slice(2, 8)}`;
    this.pollInterval     = options.pollInterval     ?? 500;
    this.emptyRetries     = options.emptyRetries     ?? 3;
    this.maxItemRetries   = options.maxItemRetries   ?? 3;
    this.leaseTimeoutMs   = options.leaseTimeoutMs   ?? 30000;
    this.deadLetter       = [];
  }

  async enqueue(items, options = {}) {
    return this.adapter.enqueue(Array.isArray(items) ? items : [items], options);
  }

  async run(visitFn, options = {}) {
    const concurrency = options.concurrency ?? 1;
    const results     = [];
    const failureCounts = new Map();

    const worker = async () => {
      let emptyStreak = 0;

      while (emptyStreak < this.emptyRetries) {
        const item = await this.adapter.dequeue(this.leaseTimeoutMs);

        if (item === null) {
          emptyStreak += 1;
          await sleep(this.pollInterval);
          continue;
        }

        emptyStreak = 0;

        try {
          const result = await visitFn(item, this.workerId);
          await this.adapter.complete(item);
          failureCounts.delete(item);
          results.push({ item, result, error: null });
        } catch (err) {
          const attempts = (failureCounts.get(item) ?? 0) + 1;
          failureCounts.set(item, attempts);

          if (attempts >= this.maxItemRetries) {
            await this.adapter.complete(item);
            this.deadLetter.push({ item, error: err, attempts });
            results.push({ item, result: null, error: err, droppedAfterRetries: attempts });
          } else {
            await this.adapter.release(item);
            results.push({ item, result: null, error: err, attempts });
          }
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results;
  }

  deadLettered() {
    return [...this.deadLetter];
  }

  async size() {
    return this.adapter.size();
  }
}

module.exports = { DistributedQueue, MemoryAdapter };
