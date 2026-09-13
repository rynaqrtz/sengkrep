# StreamWriter

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new StreamWriter(filePath: string, options?: { format?: 'csv' | 'jsonl'; keys?: string[] })
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `write` | `row: Record<string, unknown>` | `void` |  |
| `writeMany` | `rows: Record<string, unknown>[]` | `void` |  |
| `count` |  | `number` |  |
| `close` |  | `Promise<void>` |  |

## Declaration

```ts
class StreamWriter { ... }
```
