# ClickHouseSink

class · type parameters: `T = Record<string, unknown>` · extends `Sink<T>` · 1 constructor form

Category: Data sinks · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new ClickHouseSink(options: ClickHouseSinkOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `table` | `string` | yes |  |
| `driver` | `string` | yes |  |

## Related

- [ClickHouseSinkOptions](./click-house-sink-options.md)
- [Sink](./sink.md)

## Declaration

```ts
class ClickHouseSink<T = Record<string, unknown>> extends Sink<T> { ... }
```
