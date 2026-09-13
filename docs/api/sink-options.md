# SinkOptions

interface

Category: Data sinks · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `key` | `SinkKey` | no |  |
| `replace` | `boolean` | no |  |
| `batchSize` | `number` | no |  |
| `flushInterval` | `number \| null` | no |  |
| `retries` | `number` | no |  |
| `retryDelayMs` | `number` | no |  |
| `transform` | `(row: Record<string, unknown>) => Record<string, unknown>` | no |  |
| `onError` | `(error: Error) => void` | no |  |

## Related

- [SinkKey](./sink-key.md)

## Declaration

```ts
interface SinkOptions { ... }
```
