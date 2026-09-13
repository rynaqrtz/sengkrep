# CircuitBreaker

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new CircuitBreaker(options?: CircuitBreakerOptions)
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `canRequest` | `key: string` | `boolean` |  |
| `assertCanRequest` | `key: string` | `void` |  |
| `recordSuccess` | `key: string` | `void` |  |
| `recordFailure` | `key: string` | `void` |  |
| `getState` | `key: string` | `{ key: string; state: string; failures: number; openedAt: number \| null }` |  |
| `getAllStates` |  | `unknown[]` |  |
| `reset` | `key?: string` | `void` |  |

## Related

- [CircuitBreakerOptions](./circuit-breaker-options.md)

## Declaration

```ts
class CircuitBreaker { ... }
```
