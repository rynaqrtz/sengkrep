# BlockError

class · extends `Error`

Category: Errors · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `code` | `'BLOCKED'` | yes |  |
| `url` | `string \| null` | yes |  |
| `vendor` | `string \| null` | yes |  |
| `kind` | `string \| null` | yes |  |
| `confidence` | `string \| null` | yes |  |
| `status` | `number \| null` | yes |  |
| `signals` | `string[]` | yes |  |
| `retryable` | `boolean` | yes |  |
| `verdict` | `BlockVerdict \| null` | yes |  |

## Related

- [BlockVerdict](./block-verdict.md)

## Declaration

```ts
class BlockError extends Error { ... }
```
