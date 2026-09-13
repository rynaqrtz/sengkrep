const fs = require('fs');
const path = require('path');
const Sink = require('./Sink');
const { escapeCsvField } = require('../utils/exporter');
const { parseCSV } = require('../utils/contentHandlers');

class FileSink extends Sink {
  constructor(filePath, options = {}) {
    super(options);

    if (!filePath) throw new Error('FileSink requires a file path');

    this.filePath = filePath;
    this.format = options.format ?? (String(filePath).toLowerCase().endsWith('.csv') ? 'csv' : 'jsonl');
    if (this.format !== 'csv' && this.format !== 'jsonl') {
      throw new Error(`Unknown file sink format "${this.format}". Use: jsonl or csv`);
    }

    this.columns = Array.isArray(options.columns) ? [...options.columns] : null;
    this.rows = [];
    this._rowIndex = new Map();
    this._loaded = false;

    const dir = path.dirname(filePath);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  get appendOnly() {
    return !this.replace;
  }

  count() {
    return this.replace ? this.rows.length : this._stats.written;
  }

  async _onBatch(batch) {
    if (!this.replace) {
      this._append(batch);
      return;
    }

    this._load();

    for (const row of batch) {
      if (this.keys.length === 0) {
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

    this._rewrite();
  }

  _load() {
    if (this._loaded) return;

    let rows = [];

    if (fs.existsSync(this.filePath)) {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      if (raw.trim()) rows = this.format === 'csv' ? parseCSV(raw) : this._parseJsonl(raw);
    }

    this.rows = rows;

    if (!this.columns && this.format === 'csv' && rows.length > 0) {
      this.columns = Object.keys(rows[0]);
    }

    if (this.keys.length > 0) {
      rows.forEach((row, index) => this._rowIndex.set(this.keyOf(row), index));
    }

    this._loaded = true;
  }

  _parseJsonl(raw) {
    const rows = [];
    const lines = raw.split('\n');

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        rows.push(JSON.parse(line));
      } catch {
        throw new Error(`FileSink could not parse line ${i + 1} of ${this.filePath} as JSON`);
      }
    }

    return rows;
  }

  _ensureColumns(rows) {
    if (this.columns) return this.columns;
    const first = rows.find((row) => row && typeof row === 'object');
    this.columns = first ? Object.keys(first) : [];
    return this.columns;
  }

  _serialize(row) {
    if (this.format === 'csv') {
      return this._ensureColumns([row]).map((name) => escapeCsvField(row ? row[name] : '')).join(',');
    }
    return JSON.stringify(row);
  }

  _rewrite() {
    const lines = [];

    if (this.format === 'csv') {
      const columns = this._ensureColumns(this.rows);
      if (columns.length > 0) lines.push(columns.map(escapeCsvField).join(','));
    }

    for (const row of this.rows) lines.push(this._serialize(row));

    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, lines.length > 0 ? `${lines.join('\n')}\n` : '');
    fs.renameSync(tmp, this.filePath);
  }

  _append(batch) {
    const lines = [];

    if (this.format === 'csv') {
      this._ensureColumns(batch);
      const empty = !fs.existsSync(this.filePath) || fs.statSync(this.filePath).size === 0;
      if (empty && this.columns.length > 0) lines.push(this.columns.map(escapeCsvField).join(','));
    }

    for (const row of batch) lines.push(this._serialize(row));

    fs.appendFileSync(this.filePath, `${lines.join('\n')}\n`);
  }
}

module.exports = FileSink;
