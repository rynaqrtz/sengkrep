class SqliteStorage {
  constructor(options = {}) {
    this.file  = options.file  ?? '.sengkrep.db';
    this.table = options.table ?? 'sengkrep_kv';
    this._db   = null;
  }

  _open() {
    if (this._db) return this._db;

    let sqlite;
    try {
      sqlite = require('node:sqlite');
    } catch {
      throw new Error('SqliteStorage requires the built-in "node:sqlite" module (Node 22.5+). Use the default file Storage or MemoryStorage on older runtimes.');
    }

    const db = new sqlite.DatabaseSync(this.file);
    db.exec(`CREATE TABLE IF NOT EXISTS ${this.table} (key TEXT PRIMARY KEY, ts INTEGER NOT NULL, data TEXT NOT NULL)`);
    this._db = db;
    return db;
  }

  set(key, value) {
    const db = this._open();
    db.prepare(`INSERT INTO ${this.table} (key, ts, data) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET ts = excluded.ts, data = excluded.data`)
      .run(key, Date.now(), JSON.stringify(value));
    return true;
  }

  get(key) {
    const db  = this._open();
    const row = db.prepare(`SELECT ts, data FROM ${this.table} WHERE key = ?`).get(key);
    if (!row) return null;
    try {
      return { ts: row.ts, data: JSON.parse(row.data) };
    } catch {
      return null;
    }
  }

  delete(key) {
    this._open().prepare(`DELETE FROM ${this.table} WHERE key = ?`).run(key);
  }

  list() {
    return this._open().prepare(`SELECT key FROM ${this.table}`).all().map((row) => row.key);
  }

  clear() {
    this._open().exec(`DELETE FROM ${this.table}`);
    return true;
  }

  close() {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }
}

module.exports = SqliteStorage;
