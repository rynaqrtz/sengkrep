# FieldDefinition

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `selector` | `FieldSelector` | yes |  |
| `required` | `boolean` | no |  |
| `multiple` | `boolean` | no |  |
| `attr` | `string` | no |  |
| `type` | `'text' \| 'html'` | no |  |
| `transform` | `(value: string) => unknown` | no |  |
| `pattern` | `RegExp` | no |  |
| `default` | `unknown` | no |  |

## Related

- [FieldSelector](./field-selector.md)

## Declaration

```ts
interface FieldDefinition { ... }
```
