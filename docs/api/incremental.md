# Incremental

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Incremental(options?: { storageDir?: string })
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `getConditionalHeaders` | `url: string` | `Record<string, string>` |  |
| `hasSnapshot` | `url: string` | `boolean` |  |
| `getSnapshot` | `url: string` | `unknown` |  |
| `record` | `url: string, headers: Record<string, unknown>, extracted: unknown` | `void` |  |
| `clear` | `url?: string` | `void` |  |

## Declaration

```ts
class Incremental { ... }
```
