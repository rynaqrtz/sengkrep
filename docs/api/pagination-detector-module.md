# PaginationDetectorModule

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `detectNextLink` | `$: CheerioAPI, currentUrl: string` | `PaginationNext \| null` |  |
| `detectFromUrlPattern` | `currentUrl: string` | `PaginationNext \| null` |  |
| `detectTotalPages` | `$: CheerioAPI` | `number` |  |

## Related

- [PaginationNext](./pagination-next.md)

## Declaration

```ts
interface PaginationDetectorModule { ... }
```
