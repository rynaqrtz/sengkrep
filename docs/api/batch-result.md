# BatchResult

interface · type parameters: `T = Record<string, unknown>`

Category: Results · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `url` | `string` | yes |  |
| `data` | `ExtractResult<T> \| null` | yes |  |
| `error` | `Error \| null` | yes |  |

## Related

- [ExtractResult](./extract-result.md)

## Declaration

```ts
interface BatchResult<T = Record<string, unknown>> { ... }
```
