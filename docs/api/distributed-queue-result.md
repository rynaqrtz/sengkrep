# DistributedQueueResult

interface · type parameters: `T = unknown`

Category: Results · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `item` | `unknown` | yes |  |
| `result` | `T \| null` | yes |  |
| `error` | `Error \| null` | yes |  |
| `droppedAfterRetries` | `number` | no |  |

## Declaration

```ts
interface DistributedQueueResult<T = unknown> { ... }
```
