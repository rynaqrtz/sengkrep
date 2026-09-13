# MemorySink

class · type parameters: `T = Record<string, unknown>` · extends `Sink<T>`

Category: Data sinks · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `rows` | `T[]` | yes |  |
| `length` | `number` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `clear` |  | `this` |  |

## Related

- [Sink](./sink.md)

## Declaration

```ts
class MemorySink<T = Record<string, unknown>> extends Sink<T> { ... }
```
