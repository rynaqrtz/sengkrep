# BlockVerdict

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `blocked` | `boolean` | yes |  |
| `confidence` | `'none' \| 'low' \| 'medium' \| 'high'` | yes |  |
| `vendor` | `string \| null` | yes |  |
| `vendorName` | `string \| null` | yes |  |
| `kind` | `BlockKind \| null` | yes |  |
| `retryable` | `boolean` | yes |  |
| `status` | `number \| null` | yes |  |
| `signals` | `string[]` | yes |  |
| `at` | `string` | yes |  |

## Related

- [BlockKind](./block-kind.md)

## Declaration

```ts
interface BlockVerdict { ... }
```
