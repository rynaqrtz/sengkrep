# AutoResult

interface

Category: Results · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `url` | `string` | no |  |
| `status` | `number` | no |  |
| `fromCache` | `boolean` | no |  |
| `rendered` | `boolean` | no |  |
| `title` | `string \| null` | yes |  |
| `description` | `string \| null` | yes |  |
| `item` | `Record<string, unknown> \| null` | yes |  |
| `items` | `Array<Record<string, unknown>>` | yes |  |
| `tables` | `Array<Record<string, unknown>>` | no |  |
| `sources` | `string[]` | yes |  |
| `text` | `string` | no |  |

## Related

- [auto](./auto.md)

## Declaration

```ts
interface AutoResult { ... }
```
