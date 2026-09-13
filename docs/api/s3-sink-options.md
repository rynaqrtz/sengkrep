# S3SinkOptions

interface · extends `SinkOptions`

Category: Data sinks · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `bucket` | `string` | no |  |
| `format` | `S3SinkFormat` | no |  |
| `prefix` | `string` | no |  |
| `client` | `unknown` | no |  |
| `connection` | `Record<string, unknown>` | no |  |
| `driver` | `string` | no |  |
| `put` | `(request: S3PutRequest) => Promise<unknown> \| unknown` | no |  |

## Related

- [S3PutRequest](./s3-put-request.md)
- [S3SinkFormat](./s3-sink-format.md)
- [SinkOptions](./sink-options.md)

## Declaration

```ts
interface S3SinkOptions extends SinkOptions { ... }
```
