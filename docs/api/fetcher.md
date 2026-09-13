# Fetcher

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Fetcher(options?: Record<string, unknown>)
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `fetch` | `url: string, options?: RequestConfig & Record<string, unknown>` | `Promise<T>` |  |
| `sweepStreamFiles` | `ttlMs?: number` | `number` |  |
| `close` |  | `void` |  |

## Related

- [RequestConfig](./request-config.md)

## Declaration

```ts
class Fetcher { ... }
```
