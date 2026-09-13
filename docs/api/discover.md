# Discover

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Discover(fetcher: unknown, options?: { robotsTtl?: number })
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `run` | `origin: string, options?: { maxDepth?: number; maxEntries?: number; pattern?: RegExp }` | `Promise<string[]>` |  |
| `isAllowed` | `url: string, userAgent?: string` | `Promise<boolean>` |  |
| `getCrawlDelay` | `origin: string, userAgent?: string` | `Promise<number \| null>` |  |
| `clearRobotsCache` | `origin?: string` | `void` |  |

## Declaration

```ts
class Discover { ... }
```
