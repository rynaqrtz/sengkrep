# MySQLSink

class · type parameters: `T = Record<string, unknown>` · extends `SqlSink<T>` · 1 constructor form

Category: Data sinks · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new MySQLSink(options: MySQLSinkOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `driver` | `string` | yes |  |

## Related

- [MySQLSinkOptions](./my-sqlsink-options.md)
- [SqlSink](./sql-sink.md)

## Declaration

```ts
class MySQLSink<T = Record<string, unknown>> extends SqlSink<T> { ... }
```
