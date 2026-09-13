const Sink = require('./Sink');
const { columnsFor, quoteIdentifier } = require('./sql');
const { loadDriver } = require('./drivers');

class ClickHouseSink extends Sink {
  constructor(options = {}) {
    super(options);

    this.table = options.table ?? null;
    this.client = options.client ?? null;
    this.driver = options.driver ?? '@clickhouse/client';
    this.columns = Array.isArray(options.columns) ? [...options.columns] : null;
    this.connection = options.connection ?? null;
    this._ownedClient = false;

    if (!this.table) throw new Error('ClickHouseSink requires a table');
  }

  async _onBatch(batch) {
    const client = this.resolveClient();
    const columns = columnsFor(batch, this.columns);
    const values = batch.map((row) => {
      const out = {};
      for (const column of columns) {
        const value = row ? row[column] : null;
        out[column] = value === undefined ? null : value;
      }
      return out;
    });

    const quoted = columns.map((name) => quoteIdentifier(name, 'clickhouse')).join(', ');
    const query = `INSERT INTO ${quoteIdentifier(this.table, 'clickhouse')} (${quoted}) FORMAT JSONEachRow`;

    if (typeof client.insert === 'function') {
      await client.insert({ table: this.table, values, format: 'JSONEachRow' });
      return;
    }

    if (typeof client.query === 'function') {
      await client.query({ query, format: 'JSONEachRow', values });
      return;
    }

    throw new Error('ClickHouseSink needs a client with an insert() or query() method');
  }

  resolveClient() {
    if (this.client) return this.client;

    const clickhouse = loadDriver(this.driver, 'ClickHouse needs the @clickhouse/client package');
    const createClient = clickhouse.createClient ?? clickhouse.default?.createClient;

    if (typeof createClient !== 'function') {
      throw new Error(`The "${this.driver}" package did not expose createClient()`);
    }

    this._ownedClient = true;
    this.client = createClient(this.connection ?? {});
    return this.client;
  }

  async _onClose() {
    if (!this._ownedClient || !this.client || typeof this.client.close !== 'function') return;
    await this.client.close();
  }
}

module.exports = ClickHouseSink;
