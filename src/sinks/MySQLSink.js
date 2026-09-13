const SqlSink = require('./SqlSink');
const { loadDriver } = require('./drivers');

class MySQLSink extends SqlSink {
  constructor(options = {}) {
    super({ ...options, dialect: 'mysql' });
    this.driver = options.driver ?? 'mysql2/promise';
  }

  createClient() {
    const mysql = loadDriver(this.driver, 'MySQL needs the mysql2 package');
    const createPool = mysql.createPool ?? mysql.default?.createPool;

    if (typeof createPool !== 'function') {
      throw new Error(`The "${this.driver}" package did not expose createPool()`);
    }

    this._ownedClient = true;
    return createPool(this.connection ?? {});
  }
}

module.exports = MySQLSink;
