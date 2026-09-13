const Sink = require('./Sink');

class MemorySink extends Sink {
  constructor(options = {}) {
    super(options);
    this.rows = [];
    this._rowIndex = new Map();
  }

  get length() {
    return this.rows.length;
  }

  async _onBatch(batch) {
    for (const row of batch) {
      if (this.keys.length === 0 || !this.replace) {
        this.rows.push(row);
        continue;
      }

      const key = this.keyOf(row);
      const at = this._rowIndex.get(key);

      if (at !== undefined) {
        this.rows[at] = row;
        this._stats.duplicates += 1;
        continue;
      }

      this._rowIndex.set(key, this.rows.length);
      this.rows.push(row);
    }
  }

  clear() {
    this.rows = [];
    this._rowIndex.clear();
    return this;
  }
}

module.exports = MemorySink;
