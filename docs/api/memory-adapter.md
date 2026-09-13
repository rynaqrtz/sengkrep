# MemoryAdapter

class · extends `DistributedAdapter`

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `enqueue` | `items: unknown[]` | `Promise<void>` |  |
| `dequeue` |  | `Promise<unknown \| null>` |  |
| `complete` | `item: unknown` | `Promise<void>` |  |
| `release` | `item: unknown` | `Promise<void>` |  |
| `size` |  | `Promise<{ queued: number; locked: number; done: number }>` |  |

## Related

- [DistributedAdapter](./distributed-adapter.md)

## Declaration

```ts
class MemoryAdapter extends DistributedAdapter { ... }
```
