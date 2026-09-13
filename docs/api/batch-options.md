# BatchOptions

interface · extends `ExtractOptions`

Category: Options · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `concurrency` | `number` | no |  |
| `delay` | `number` | no |  |
| `randomOrder` | `boolean` | no |  |
| `progressBar` | `boolean` | no |  |
| `onProgress` | `(done: number, total: number) => void` | no |  |
| `sink` | `SinkInput` | no |  |

## Related

- [ExtractOptions](./extract-options.md)
- [SinkInput](./sink-input.md)

## Declaration

```ts
interface BatchOptions extends ExtractOptions { ... }
```
