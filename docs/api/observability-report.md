# ObservabilityReport

interface

Category: Results · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `total` | `number` | yes |  |
| `success` | `number` | yes |  |
| `failed` | `number` | yes |  |
| `successRate` | `number` | yes |  |
| `rps` | `number` | yes |  |
| `elapsedSec` | `number` | yes |  |
| `domains` | `Record<string, { requests: number; success: number; failed: number }>` | yes |  |
| `categories` | `Record<string, number>` | yes |  |
| `bytes` | `{ sent: number; received: number }` | yes |  |
| `topErrors` | `Array<{ code: string; count: number }>` | yes |  |

## Declaration

```ts
interface ObservabilityReport { ... }
```
