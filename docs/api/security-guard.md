# SecurityGuard

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new SecurityGuard(options?: SecurityOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `enabled` | `boolean` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `resolve` | `hostname: string` | `Promise<{ address: string; family: number }>` |  |
| `checkAddress` | `hostname: string` | `Promise<{ address: string; family: number } \| null>` |  |
| `resolveForRequest` | `url: string` | `Promise<{ address: string; family: number } \| null>` |  |
| `check` | `url: string` | `Promise<boolean>` |  |

## Related

- [SecurityOptions](./security-options.md)

## Declaration

```ts
class SecurityGuard { ... }
```
