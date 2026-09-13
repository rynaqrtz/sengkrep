# JsonFieldDefinition

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `path` | `string \| string[]` | yes |  |
| `required` | `boolean` | no |  |
| `transform` | `(value: unknown) => unknown` | no |  |
| `pattern` | `RegExp` | no |  |
| `default` | `unknown` | no |  |

## Declaration

```ts
interface JsonFieldDefinition { ... }
```
