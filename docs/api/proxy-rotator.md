# ProxyRotator

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new ProxyRotator(options?: { proxies?: string[]; strategy?: string; maxFailures?: number })
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `enabled` | `boolean` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `next` | `hostname?: string` | `string \| null` |  |
| `reportSuccess` | `proxy: string` | `void` |  |
| `reportFailure` | `proxy: string` | `void` |  |
| `stats` |  | `Array<{ proxy: string; failures: number; healthy: boolean }>` |  |

## Declaration

```ts
class ProxyRotator { ... }
```
