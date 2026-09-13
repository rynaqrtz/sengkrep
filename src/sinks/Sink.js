const { KEY_SEPARATOR } = require('./sql');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Sink {
  constructor(options = {}) {
    const config = options ?? {};

    this.key = config.key ?? null;
    this.keys = Array.isArray(this.key) ? [...this.key] : (this.key ? [this.key] : []);
    this.replace = config.replace !== false;
    this.batchSize = config.batchSize ?? 500;
    this.flushInterval = config.flushInterval ?? null;
    this.retries = config.retries ?? 2;
    this.retryDelayMs = config.retryDelayMs ?? 200;
    this.transform = typeof config.transform === 'function' ? config.transform : null;
    this.onError = typeof config.onError === 'function' ? config.onError : null;

    this._buffer = [];
    this._index = new Map();
    this._timer = null;
    this._closed = false;
    this._stats = { written: 0, batches: 0, failed: 0, retried: 0, duplicates: 0 };

    if (this.flushInterval) this._startTimer();
  }

  get size() {
    return this._buffer.length;
  }

  keyOf(row) {
    if (this.keys.length === 0) throw new Error('This sink has no key, so keyOf() has nothing to build');
    return this.keys.map((name) => {
      const value = row ? row[name] : undefined;
      if (value === undefined || value === null) {
        throw new Error(`A sink row is missing the key field "${name}"`);
      }
      return String(value);
    }).join(KEY_SEPARATOR);
  }

  async write(rows) {
    if (this._closed) throw new Error(`${this.constructor.name} is already closed`);
    const list = this._normalize(rows);

    for (const row of list) this._push(row);

    if (this._buffer.length >= this.batchSize) {
      await this.flush();
    }

    return list.length;
  }

  async upsert(rows) {
    return this.write(rows);
  }

  async flush() {
    if (this._buffer.length === 0) return 0;

    const batch = this._buffer;
    this._buffer = [];
    this._index.clear();

    let lastError = null;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        await this._onBatch(batch);
        this._stats.written += batch.length;
        this._stats.batches += 1;
        return batch.length;
      } catch (error) {
        lastError = error;
        if (attempt < this.retries) {
          this._stats.retried += 1;
          if (this.retryDelayMs > 0) await delay(this.retryDelayMs * (2 ** attempt));
        }
      }
    }

    this._stats.failed += batch.length;
    throw lastError;
  }

  async close() {
    if (this._closed) return this.stats();
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }

    try {
      await this.flush();
    } finally {
      this._closed = true;
      await this._onClose();
    }

    return this.stats();
  }

  stats() {
    return {
      ...this._stats,
      buffered: this._buffer.length,
      closed: this._closed,
    };
  }

  _normalize(rows) {
    if (rows === null || rows === undefined) return [];
    const list = Array.isArray(rows) ? rows : [rows];
    const out = [];
    for (const item of list) {
      if (item === null || item === undefined) continue;
      out.push(this.transform ? this.transform(item) : item);
    }
    return out;
  }

  _push(row) {
    if (this.keys.length === 0 || !this.replace) {
      this._buffer.push(row);
      return;
    }

    const key = this.keyOf(row);
    const at = this._index.get(key);

    if (at !== undefined) {
      this._buffer[at] = row;
      this._stats.duplicates += 1;
      return;
    }

    this._index.set(key, this._buffer.length);
    this._buffer.push(row);
  }

  _startTimer() {
    this._timer = setInterval(() => {
      this.flush().catch((error) => {
        if (this.onError) this.onError(error);
      });
    }, this.flushInterval);

    if (typeof this._timer.unref === 'function') this._timer.unref();
  }

  async _onBatch() {
    throw new Error(`${this.constructor.name} does not implement _onBatch()`);
  }

  async _onClose() {
    return undefined;
  }
}

module.exports = Sink;
