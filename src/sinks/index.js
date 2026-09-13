const Sink = require('./Sink');
const MemorySink = require('./MemorySink');
const FileSink = require('./FileSink');
const SqlSink = require('./SqlSink');
const PostgresSink = require('./PostgresSink');
const MySQLSink = require('./MySQLSink');
const ClickHouseSink = require('./ClickHouseSink');
const S3Sink = require('./S3Sink');
const sql = require('./sql');
const drivers = require('./drivers');

const TYPES = {
  memory: MemorySink,
  file: FileSink,
  jsonl: FileSink,
  csv: FileSink,
  postgres: PostgresSink,
  postgresql: PostgresSink,
  pg: PostgresSink,
  mysql: MySQLSink,
  mariadb: MySQLSink,
  clickhouse: ClickHouseSink,
  s3: S3Sink,
};

function createSink(options = {}) {
  if (options && typeof options.write === 'function') return options;

  const type = String(options.type ?? options.kind ?? 'file').toLowerCase();
  const SinkClass = TYPES[type];

  if (!SinkClass) {
    throw new Error(`Unknown sink type "${type}". Use: ${Object.keys(TYPES).join(', ')}`);
  }

  if (SinkClass === FileSink) {
    return new FileSink(options.path ?? options.file, { ...options, format: options.format ?? (type === 'csv' ? 'csv' : type === 'jsonl' ? 'jsonl' : undefined) });
  }

  return new SinkClass(options);
}

module.exports = {
  Sink,
  MemorySink,
  FileSink,
  SqlSink,
  PostgresSink,
  MySQLSink,
  ClickHouseSink,
  S3Sink,
  sql,
  drivers,
  createSink,
};
