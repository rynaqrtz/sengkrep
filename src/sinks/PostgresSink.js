const SqlSink = require('./SqlSink');
const { loadDriver } = require('./drivers');

class PostgresSink extends SqlSink {
  constructor(options = {}) {
    super({ ...options, dialect: 'postgres' });
    this.driver = options.driver ?? 'pg';
  }

  createClient() {
    const pg = loadDriver(this.driver, 'Postgres needs the pg package');
    const Pool = pg.Pool ?? pg.default?.Pool;

    if (typeof Pool !== 'function') {
      throw new Error(`The "${this.driver}" package did not expose a Pool constructor`);
    }

    this._ownedClient = true;
    return new Pool(this.connection ?? {});
  }
}

module.exports = PostgresSink;
