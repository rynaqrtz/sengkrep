# SchemaInferenceResult

interface

Category: Results · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `type` | `'list' \| 'single'` | yes |  |
| `container` | `string` | no |  |
| `itemCount` | `number` | no |  |
| `schema` | `Record<string, SchemaInferenceField>` | yes |  |
| `sample` | `Record<string, string>` | no |  |

## Related

- [SchemaInferenceField](./schema-inference-field.md)

## Declaration

```ts
interface SchemaInferenceResult { ... }
```
