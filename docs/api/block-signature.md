# BlockSignature

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `id` | `string` | yes |  |
| `name` | `string` | no |  |
| `kind` | `BlockKind` | no |  |
| `weight` | `number` | no |  |
| `retryable` | `boolean` | no |  |
| `headers` | `Array<{ name: string; pattern?: RegExp }>` | no |  |
| `body` | `Array<{ label: string; pattern: RegExp }>` | no |  |
| `cookies` | `RegExp[]` | no |  |

## Related

- [BlockKind](./block-kind.md)

## Declaration

```ts
interface BlockSignature { ... }
```
