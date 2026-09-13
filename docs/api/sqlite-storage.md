# SqliteStorage

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new SqliteStorage(options?: { file?: string; table?: string })
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `set` | `key: string, value: unknown` | `boolean` |  |
| `get` | `key: string` | `{ ts: number; data: unknown } \| null` |  |
| `delete` | `key: string` | `void` |  |
| `list` |  | `string[]` |  |
| `clear` |  | `boolean` |  |
| `close` |  | `void` |  |

## Declaration

```ts
class SqliteStorage { ... }
```
