# PostgresSink

class · type parameters: `T = Record<string, unknown>` · extends `SqlSink<T>` · 1 constructor form

Category: Data sinks · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new PostgresSink(options: PostgresSinkOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `driver` | `string` | yes |  |

## Related

- [PostgresSinkOptions](./postgres-sink-options.md)
- [SqlSink](./sql-sink.md)

## Declaration

```ts
class PostgresSink<T = Record<string, unknown>> extends SqlSink<T> { ... }
```
