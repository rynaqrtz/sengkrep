# SinkDescriptor

type · alias of `| ({ type: 'memory' } & SinkOptions) | ({ type: 'file' | 'jsonl' | 'csv'; path?: string; file?: string } & FileSinkOptions) | ({ type: 'postgres' | 'postgresql' | 'pg' } & PostgresSinkOptions) | ({ type: 'mysql' | 'mariadb' } & MySQLSinkOptions) | ({ type: 'clickhouse' } & ClickHouseSinkOptions) | ({ type: 's3' } & S3SinkOptions)`

Category: Data sinks · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Related

- [ClickHouseSinkOptions](./click-house-sink-options.md)
- [FileSinkOptions](./file-sink-options.md)
- [MySQLSinkOptions](./my-sqlsink-options.md)
- [PostgresSinkOptions](./postgres-sink-options.md)
- [S3SinkOptions](./s3-sink-options.md)
- [SinkOptions](./sink-options.md)

## Declaration

```ts
export type SinkDescriptor = | ({ type: 'memory' } & SinkOptions) | ({ type: 'file' | 'jsonl' | 'csv'; path?: string; file?: string } & FileSinkOptions) | ({ type: 'postgres' | 'postgresql' | 'pg' } & PostgresSinkOptions) | ({ type: 'mysql' | 'mariadb' } & MySQLSinkOptions) | ({ type: 'clickhouse' } & ClickHouseSinkOptions) | ({ type: 's3' } & S3SinkOptions);
```
