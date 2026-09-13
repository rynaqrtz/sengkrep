# FileSink

class · type parameters: `T = Record<string, unknown>` · extends `Sink<T>` · 1 constructor form

Category: Data sinks · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new FileSink(path: string, options?: FileSinkOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `filePath` | `string` | yes |  |
| `format` | `FileSinkFormat` | yes |  |
| `columns` | `string[] \| null` | yes |  |
| `rows` | `T[]` | yes |  |
| `appendOnly` | `boolean` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `count` |  | `number` |  |

## Related

- [FileSinkFormat](./file-sink-format.md)
- [FileSinkOptions](./file-sink-options.md)
- [Sink](./sink.md)

## Declaration

```ts
class FileSink<T = Record<string, unknown>> extends Sink<T> { ... }
```
