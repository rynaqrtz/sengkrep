# CrawlJob

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `queue` | `unknown` | yes |  |
| `start` | `() => Promise<Array<{ url: string; data: unknown }>>` | yes |  |
| `resume` | `() => Promise<Array<{ url: string; data: unknown }>>` | yes |  |
| `pause` | `() => void` | yes |  |
| `on` | `(event: 'url:done' \| 'url:error' \| 'progress' \| 'start' \| 'done', fn: (payload: any) => void) => void` | yes |  |
| `results` | `() => Array<{ url: string; data: unknown }>` | yes |  |
| `stats` | `() => { visited: number; queued: number; results: number }` | yes |  |

## Declaration

```ts
interface CrawlJob { ... }
```
