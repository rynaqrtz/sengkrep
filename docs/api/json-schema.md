# JsonSchema

type · type parameters: `T = Record<string, unknown>` · alias of `{ [K in keyof T]: JsonSchemaField; }`

Category: Types · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Related

- [JsonSchemaField](./json-schema-field.md)

## Declaration

```ts
export type JsonSchema<T = Record<string, unknown>> = { [K in keyof T]: JsonSchemaField; };
```
