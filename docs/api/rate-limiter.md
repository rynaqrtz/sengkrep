# RateLimiter

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new RateLimiter(options?: RateLimitOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `enabled` | `boolean` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `acquire` | `hostname: string` | `Promise<() => void>` |  |
| `reset` | `hostname?: string` | `void` |  |

## Related

- [RateLimitOptions](./rate-limit-options.md)

## Declaration

```ts
class RateLimiter { ... }
```
