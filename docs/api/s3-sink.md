# S3Sink

class · type parameters: `T = Record<string, unknown>` · extends `Sink<T>` · 1 constructor form

Category: Data sinks · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new S3Sink(options: S3SinkOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `bucket` | `string \| null` | yes |  |
| `format` | `S3SinkFormat` | yes |  |
| `prefix` | `string` | yes |  |
| `client` | `unknown` | yes |  |
| `extension` | `string` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `objectKeyFor` | `row: T` | `string` |  |
| `batchKey` |  | `string` |  |
| `serializeBatch` | `batch: T[]` | `string` |  |
| `putObject` | `key: string, body: string` | `Promise<string>` |  |

## Related

- [S3SinkFormat](./s3-sink-format.md)
- [S3SinkOptions](./s3-sink-options.md)
- [Sink](./sink.md)

## Declaration

```ts
class S3Sink<T = Record<string, unknown>> extends Sink<T> { ... }
```
