# DnsCache

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new DnsCache(options?: { ttl?: number; enabled?: boolean })
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `lookup` | `hostname: string` | `Promise<string>` |  |
| `invalidate` | `hostname?: string` | `void` |  |
| `stats` |  | `Array<{ hostname: string; addresses: string[]; ageMs: number }>` |  |

## Declaration

```ts
class DnsCache { ... }
```
