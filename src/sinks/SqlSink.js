const Sink = require('./Sink');
const { columnsFor, placeholders, quoteIdentifier, rowsToValues } = require('./sql');

class SqlSink extends Sink {
  constructor(options = {}) {
    super(options);

    this.dialect = options.dialect ?? 'postgres';
    this.table = options.table ?? null;
    this.client = options.client ?? options.pool ?? null;
    this.columns = Array.isArray(options.columns) ? [...options.columns] : null;
    this.connection = options.connection ?? null;
    this.conflictTarget = options.conflictTarget ?? null;
    this._ownedClient = false;

    if (!this.table) throw new Error(`${this.constructor.name} requires a table`);
  }

  buildStatement(batch) {
    const columns = columnsFor(batch, this.columns);
    const quoted = columns.map((name) => quoteIdentifier(name, this.dialect)).join(', ');
    const values = rowsToValues(batch, columns);

    const text = `INSERT INTO ${quoteIdentifier(this.table, this.dialect)} (${quoted})`
      + ` VALUES ${placeholders(batch.length, columns.length, this.dialect)}`
      + this.upsertClause(columns);

    return { text, values, columns };
  }

  upsertClause(columns) {
    if (!this.replace || this.keys.length === 0) return '';

    const keyColumns = this.keys.map((name) => quoteIdentifier(name, this.dialect));
    const updatable = columns.filter((name) => !this.keys.includes(name));
    const assignments = (mapper) => updatable.map((name) => mapper(quoteIdentifier(name, this.dialect))).join(', ');

    if (this.dialect === 'mysql') {
      if (updatable.length === 0) return ` ON DUPLICATE KEY UPDATE ${keyColumns[0]} = ${keyColumns[0]}`;
      return ` ON DUPLICATE KEY UPDATE ${assignments((column) => `${column} = VALUES(${column})`)}`;
    }

    const target = this.conflictTarget ?? keyColumns.join(', ');
    if (updatable.length === 0) return ` ON CONFLICT (${target}) DO NOTHING`;
    return ` ON CONFLICT (${target}) DO UPDATE SET ${assignments((column) => `${column} = EXCLUDED.${column}`)}`;
  }

  async query(text, values) {
    const client = this.resolveClient();

    if (typeof client.query === 'function') return client.query(text, values);
    if (typeof client.execute === 'function') return client.execute(text, values);

    throw new Error(`${this.constructor.name} needs a client with a query() or execute() method`);
  }

  async _onBatch(batch) {
    const { text, values } = this.buildStatement(batch);
    await this.query(text, values);
  }

  resolveClient() {
    if (this.client) return this.client;
    this.client = this.createClient();
    return this.client;
  }

  createClient() {
    throw new Error(`${this.constructor.name} needs a client, or a subclass that can build one`);
  }

  async _onClose() {
    if (!this._ownedClient || !this.client) return;
    if (typeof this.client.end === 'function') await this.client.end();
  }
}

module.exports = SqlSink;
