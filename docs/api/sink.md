# Sink

class · type parameters: `T = Record<string, unknown>` · 1 constructor form

Category: Data sinks · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Sink(options?: SinkOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `key` | `SinkKey` | yes |  |
| `keys` | `string[]` | yes |  |
| `replace` | `boolean` | yes |  |
| `batchSize` | `number` | yes |  |
| `flushInterval` | `number \| null` | yes |  |
| `retries` | `number` | yes |  |
| `retryDelayMs` | `number` | yes |  |
| `size` | `number` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `keyOf` | `row: T` | `string` |  |
| `write` | `rows: T \| T[]` | `Promise<number>` |  |
| `upsert` | `rows: T \| T[]` | `Promise<number>` |  |
| `flush` |  | `Promise<number>` |  |
| `close` |  | `Promise<SinkStats>` |  |
| `stats` |  | `SinkStats` |  |

## Related

- [SinkKey](./sink-key.md)
- [SinkOptions](./sink-options.md)
- [SinkStats](./sink-stats.md)

## Declaration

```ts
class Sink<T = Record<string, unknown>> { ... }
```
