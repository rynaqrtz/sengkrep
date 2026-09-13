# AdaptiveThrottle

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new AdaptiveThrottle(options?: AdaptiveThrottleOptions)
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `acquire` | `hostname: string` | `Promise<() => void>` |  |
| `onSuccess` | `hostname: string` | `void` |  |
| `onFailure` | `hostname: string, info?: { retryAfterMs?: number \| null; status?: number \| null }` | `void` |  |
| `concurrencyFor` | `hostname: string` | `number` |  |
| `delayFor` | `hostname: string` | `number` |  |
| `stats` |  | `Array<{ hostname: string; concurrency: number; active: number; delay: number; backoffs: number }>` |  |
| `reset` | `hostname?: string` | `void` |  |

## Related

- [AdaptiveThrottleOptions](./adaptive-throttle-options.md)

## Declaration

```ts
class AdaptiveThrottle { ... }
```
