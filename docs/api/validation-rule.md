# ValidationRule

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `required` | `boolean` | no |  |
| `type` | `'string' \| 'number' \| 'boolean' \| 'url' \| 'email' \| 'date'` | no |  |
| `pattern` | `RegExp` | no |  |
| `minLength` | `number` | no |  |
| `maxLength` | `number` | no |  |
| `minItems` | `number` | no |  |
| `notEmpty` | `boolean` | no |  |
| `custom` | `(value: unknown, allData: Record<string, unknown>) => true \| string` | no |  |

## Declaration

```ts
interface ValidationRule { ... }
```
