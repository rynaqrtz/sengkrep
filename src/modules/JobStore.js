const { createStorage } = require('../utils/storage');

const DEFAULT_DIR = '.sengkrep-jobs';
const INDEX_KEY = 'jobs:index';

class JobStore {
  constructor(options = {}) {
    const config = options ?? {};
    const injected = config.storage && typeof config.storage.get === 'function' ? config.storage : null;

    this.storage = injected ?? createStorage({
      storage: config.backend,
      storageDir: config.storageDir ?? DEFAULT_DIR,
      file: config.file,
      table: config.table,
    });
  }

  key(id) {
    return `job:${id}`;
  }

  _index() {
    const record = this.storage.get(INDEX_KEY);
    const ids = Array.isArray(record?.data) ? record.data : [];
    return ids.filter((id) => this.storage.get(this.key(id)) !== null);
  }

  _writeIndex(ids) {
    this.storage.set(INDEX_KEY, [...new Set(ids)]);
  }

  save(job) {
    if (!job || !job.id) throw new Error('JobStore.save() requires a job with an id');

    this.storage.set(this.key(job.id), job);

    const ids = this._index();
    if (!ids.includes(job.id)) this._writeIndex([...ids, job.id]);

    return job;
  }

  get(id) {
    const record = this.storage.get(this.key(id));
    return record?.data ?? null;
  }

  has(id) {
    return this.get(id) !== null;
  }

  list() {
    return this._index().sort();
  }

  all() {
    return this.list()
      .map((id) => this.get(id))
      .filter(Boolean)
      .sort((a, b) => (a.nextRunAt ?? Infinity) - (b.nextRunAt ?? Infinity));
  }

  delete(id) {
    const existed = this.has(id);
    this.storage.delete(this.key(id));
    this._writeIndex(this._index().filter((existing) => existing !== id));
    return existed;
  }

  clear() {
    for (const id of this.list()) this.storage.delete(this.key(id));
    this.storage.delete(INDEX_KEY);
    return true;
  }
}

JobStore.DEFAULT_DIR = DEFAULT_DIR;

module.exports = JobStore;
