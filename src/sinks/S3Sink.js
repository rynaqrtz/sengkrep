const Sink = require('./Sink');
const { toCSV } = require('../utils/exporter');
const { loadDriver } = require('./drivers');

const CONTENT_TYPES = {
  json: 'application/json',
  jsonl: 'application/x-ndjson',
  csv: 'text/csv',
};

class S3Sink extends Sink {
  constructor(options = {}) {
    super(options);

    this.bucket = options.bucket ?? null;
    this.format = options.format ?? 'json';
    this.prefix = options.prefix ?? '';
    this.client = options.client ?? null;
    this.connection = options.connection ?? null;
    this.driver = options.driver ?? '@aws-sdk/client-s3';
    this.put = typeof options.put === 'function' ? options.put : null;
    this._ownedClient = false;
    this._flushes = 0;

    if (!CONTENT_TYPES[this.format]) {
      throw new Error(`Unknown S3 object format "${this.format}". Use: json, jsonl or csv`);
    }
    if (!this.put && !this.bucket) {
      throw new Error('S3Sink requires a bucket, or a put() function of your own');
    }

    if (this.prefix && !this.prefix.endsWith('/')) this.prefix = `${this.prefix}/`;
  }

  get extension() {
    return this.format === 'csv' ? 'csv' : 'json';
  }

  objectKeyFor(row) {
    const parts = this.keys.map((name) => `${name}=${encodeURIComponent(String(row[name]))}`);
    return `${this.prefix}${parts.join('/')}.${this.extension}`;
  }

  batchKey() {
    this._flushes += 1;
    return `${this.prefix}batch-${Date.now()}-${this._flushes}.${this.format === 'csv' ? 'csv' : 'jsonl'}`;
  }

  serializeBatch(batch) {
    if (this.format === 'csv') return toCSV(batch);
    if (this.format === 'jsonl') return batch.map((row) => JSON.stringify(row)).join('\n');
    return JSON.stringify(batch, null, 2);
  }

  async putObject(key, body) {
    const contentType = CONTENT_TYPES[this.format];

    if (this.put) {
      await this.put({ key, body, contentType, bucket: this.bucket, format: this.format });
      return key;
    }

    const sdk = loadDriver(this.driver, 'S3 needs the @aws-sdk/client-s3 package');

    if (!this.client) {
      if (typeof sdk.S3Client !== 'function') {
        throw new Error(`The "${this.driver}" package did not expose S3Client`);
      }
      this._ownedClient = true;
      this.client = new sdk.S3Client(this.connection ?? {});
    }

    if (typeof sdk.PutObjectCommand !== 'function') {
      throw new Error(`The "${this.driver}" package did not expose PutObjectCommand`);
    }

    await this.client.send(new sdk.PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));

    return key;
  }

  async _onBatch(batch) {
    if (this.keys.length > 0 && this.replace) {
      for (const row of batch) {
        const body = this.format === 'csv' ? toCSV([row]) : JSON.stringify(row, null, 2);
        await this.putObject(this.objectKeyFor(row), body);
      }
      return;
    }

    await this.putObject(this.batchKey(), this.serializeBatch(batch));
  }

  async _onClose() {
    if (!this._ownedClient || !this.client || typeof this.client.destroy !== 'function') return;
    this.client.destroy();
  }
}

module.exports = S3Sink;
