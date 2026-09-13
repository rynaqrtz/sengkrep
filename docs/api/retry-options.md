# RetryOptions

interface

Category: Options · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `max` | `number` | no |  |
| `jitter` | `boolean` | no |  |
| `retryOn` | `number[]` | no |  |
| `retryOnNetwork` | `boolean` | no |  |
| `retryOnTimeout` | `boolean` | no |  |
| `respectRetryAfter` | `boolean` | no |  |
| `maxRetryAfter` | `number` | no |  |
| `budgetMs` | `number \| null` | no |  |
| `onRetry` | `(info: { attempt: number; status: number \| null; code: string \| null; waitMs: number; respectedRetryAfter: boolean; elapsedMs?: number }) => void` | no |  |

## Declaration

```ts
interface RetryOptions { ... }
```
