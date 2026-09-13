# ContentDedup

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new ContentDedup(options?: ContentDedupOptions)
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `fingerprint` | `text: string` | `bigint` |  |
| `add` | `text: string` | `bigint` |  |
| `find` | `text: string` | `{ fingerprint: bigint; distance: number \| null }` |  |
| `isDuplicate` | `text: string` | `{ duplicate: boolean; distance: number \| null; fingerprint: bigint }` |  |
| `check` | `text: string, options?: { add?: boolean }` | `{ duplicate: boolean; distance: number \| null; fingerprint: bigint }` |  |
| `size` |  | `number` |  |
| `clear` |  | `void` |  |
| `simhash` | `text: string, bits?: number, shingleSize?: number` | `bigint` | `static` |
| `hammingDistance` | `a: bigint, b: bigint` | `number` | `static` |
| `tokenize` | `text: string` | `string[]` | `static` |

## Related

- [ContentDedupOptions](./content-dedup-options.md)

## Declaration

```ts
class ContentDedup { ... }
```
