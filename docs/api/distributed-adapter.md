# DistributedAdapter

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `enqueue` | `items: unknown[]` | `Promise<void>` |  |
| `dequeue` |  | `Promise<unknown \| null>` |  |
| `complete` | `item: unknown` | `Promise<void>` |  |
| `release` | `item: unknown` | `Promise<void>` |  |
| `size` |  | `Promise<Record<string, number>>` |  |

## Declaration

```ts
interface DistributedAdapter { ... }
```
