# Cache

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Cache(options?: CacheOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `ttl` | `number` | yes |  |
| `staleTtl` | `number` | yes |  |
| `staleWhileRevalidate` | `boolean` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `get` | `url: string, method?: string` | `unknown` |  |
| `lookup` | `url: string, method?: string` | `CacheLookup \| null` |  |
| `set` | `url: string, data: unknown, method?: string, options?: { ttl?: number }` | `void` |  |
| `beginRevalidate` | `url: string, method?: string` | `boolean` |  |
| `endRevalidate` | `url: string, method?: string` | `void` |  |
| `isRevalidating` | `url: string, method?: string` | `boolean` |  |
| `has` | `url: string, method?: string` | `boolean` |  |
| `delete` | `url: string, method?: string` | `void` |  |
| `clear` |  | `void` |  |
| `stats` |  | `CacheStats` |  |

## Related

- [CacheLookup](./cache-lookup.md)
- [CacheOptions](./cache-options.md)
- [CacheStats](./cache-stats.md)

## Declaration

```ts
class Cache { ... }
```
