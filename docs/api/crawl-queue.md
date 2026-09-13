# CrawlQueue

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new CrawlQueue(options: CrawlOptions)
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `start` | `visitFn: (url: string) => Promise<{ data: unknown; links: string[] }>` | `Promise<Array<{ url: string; data: unknown }>>` |  |
| `resume` | `visitFn: (url: string) => Promise<{ data: unknown; links: string[] }>` | `Promise<Array<{ url: string; data: unknown }>>` |  |
| `pause` |  | `void` |  |
| `on` | `event: string, fn: (payload: any) => void` | `void` |  |
| `results` |  | `Array<{ url: string; data: unknown }>` |  |
| `stats` |  | `{ visited: number; queued: number; results: number }` |  |

## Related

- [CrawlOptions](./crawl-options.md)

## Declaration

```ts
class CrawlQueue { ... }
```
