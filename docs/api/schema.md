# Schema

type · type parameters: `T = Record<string, unknown>` · alias of `{ [K in keyof T]: SchemaField; }`

Category: Types · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Related

- [SchemaField](./schema-field.md)

## Declaration

```ts
export type Schema<T = Record<string, unknown>> = { [K in keyof T]: SchemaField; };
```
