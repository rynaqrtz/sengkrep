# SqlSink

class · type parameters: `T = Record<string, unknown>` · extends `Sink<T>` · 1 constructor form

Category: Data sinks · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new SqlSink(options: SqlSinkOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `dialect` | `'postgres' \| 'mysql'` | yes |  |
| `table` | `string` | yes |  |
| `client` | `unknown` | yes |  |
| `columns` | `string[] \| null` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `buildStatement` | `batch: T[]` | `SqlStatement` |  |
| `upsertClause` | `columns: string[]` | `string` |  |
| `query` | `text: string, values: unknown[]` | `Promise<unknown>` |  |

## Related

- [Sink](./sink.md)
- [SqlSinkOptions](./sql-sink-options.md)
- [SqlStatement](./sql-statement.md)

## Declaration

```ts
class SqlSink<T = Record<string, unknown>> extends Sink<T> { ... }
```
