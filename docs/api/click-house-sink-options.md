# ClickHouseSinkOptions

interface · extends `SinkOptions`

Category: Data sinks · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `table` | `string` | yes |  |
| `client` | `unknown` | no |  |
| `columns` | `string[]` | no |  |
| `connection` | `Record<string, unknown>` | no |  |
| `driver` | `string` | no |  |

## Related

- [SinkOptions](./sink-options.md)

## Declaration

```ts
interface ClickHouseSinkOptions extends SinkOptions { ... }
```
