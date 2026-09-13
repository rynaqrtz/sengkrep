# MemoryStorage

class

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `set` | `key: string, value: unknown` | `boolean` |  |
| `get` | `key: string` | `{ ts: number; data: unknown } \| null` |  |
| `delete` | `key: string` | `void` |  |
| `list` |  | `string[]` |  |
| `clear` |  | `boolean` |  |

## Declaration

```ts
class MemoryStorage { ... }
```
