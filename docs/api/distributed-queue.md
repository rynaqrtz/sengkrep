# DistributedQueue

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new DistributedQueue(options?: { adapter?: DistributedAdapter; workerId?: string; pollInterval?: number; emptyRetries?: number; maxItemRetries?: number; leaseTimeoutMs?: number })
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `deadLetter` | `Array<{ item: unknown; error: Error; attempts: number }>` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `enqueue` | `items: unknown \| unknown[], options?: { priority?: number }` | `Promise<void>` |  |
| `run` | `visitFn: (item: unknown, workerId: string) => Promise<T>, options?: { concurrency?: number }` | `Promise<DistributedQueueResult<T>[]>` |  |
| `deadLettered` |  | `Array<{ item: unknown; error: Error; attempts: number }>` |  |
| `size` |  | `Promise<Record<string, number>>` |  |

## Related

- [DistributedAdapter](./distributed-adapter.md)
- [DistributedQueueResult](./distributed-queue-result.md)

## Declaration

```ts
class DistributedQueue { ... }
```
