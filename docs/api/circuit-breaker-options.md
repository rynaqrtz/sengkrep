# CircuitBreakerOptions

interface

Category: Options · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `threshold` | `number` | no |  |
| `cooldown` | `number` | no |  |
| `halfOpenMaxAttempts` | `number` | no |  |
| `onOpen` | `(info: { key: string; failures: number }) => void` | no |  |
| `onClose` | `(info: { key: string }) => void` | no |  |

## Declaration

```ts
interface CircuitBreakerOptions { ... }
```
