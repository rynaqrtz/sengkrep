const fs   = require('fs');
const path = require('path');

function encodeKey(key) {
  return Buffer.from(key).toString('base64').replace(/[/+=]/g, '_');
}

class Storage {
  constructor(dir = '.sengkrep') {
    this.dir = dir;
    this._boot();
  }

  _boot() {
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
  }

  _toPath(key) {
    const name = encodeKey(key);
    return path.join(this.dir, name.slice(0, 2), `${name}.json`);
  }

  set(key, value) {
    const file = this._toPath(key);
    const dir  = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const payload = JSON.stringify({ ts: Date.now(), data: value }, null, 2);
    const tmp     = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, payload, 'utf8');
    fs.renameSync(tmp, file);
    return true;
  }

  get(key) {
    const file = this._toPath(key);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }

  delete(key) {
    const file = this._toPath(key);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    const dir = path.dirname(file);
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch {
      return undefined;
    }
    return undefined;
  }

  _walk(dir) {
    if (!fs.existsSync(dir)) return [];
    const found = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        found.push(...this._walk(full));
      } else if (entry.name.endsWith('.json')) {
        found.push(full);
      }
    }
    return found;
  }

  list() {
    return this._walk(this.dir).map((file) => path.basename(file, '.json'));
  }

  clear() {
    for (const file of this._walk(this.dir)) fs.unlinkSync(file);
    return true;
  }
}

class MemoryStorage {
  constructor() {
    this._store = new Map();
  }

  set(key, value) {
    this._store.set(key, { ts: Date.now(), data: value });
    return true;
  }

  get(key) {
    return this._store.get(key) ?? null;
  }

  delete(key) {
    this._store.delete(key);
  }

  list() {
    return [...this._store.keys()];
  }

  clear() {
    this._store.clear();
    return true;
  }
}

function createStorage(options = {}) {
  if (options.storage === 'memory') return new MemoryStorage();
  if (options.storage === 'sqlite') {
    const SqliteStorage = require('../modules/SqliteStorage');
    return new SqliteStorage({ file: options.file, table: options.table });
  }
  return new Storage(options.storageDir ?? '.sengkrep');
}

module.exports = Storage;
module.exports.MemoryStorage = MemoryStorage;
module.exports.createStorage = createStorage;
module.exports.encodeKey = encodeKey;
