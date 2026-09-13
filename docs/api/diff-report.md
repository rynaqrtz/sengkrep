# DiffReport

interface

Category: Results · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `url` | `string` | yes |  |
| `firstRun` | `boolean` | yes |  |
| `changes` | `DiffChange[]` | yes |  |
| `hasCritical` | `boolean` | yes |  |
| `hasWarn` | `boolean` | no |  |
| `previousTs` | `number \| null` | yes |  |

## Related

- [DiffChange](./diff-change.md)

## Declaration

```ts
interface DiffReport { ... }
```
