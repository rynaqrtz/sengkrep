# JobStoreOptions

interface

Category: Scheduling · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `backend` | `StorageBackend` | no |  |
| `storageDir` | `string` | no |  |
| `file` | `string` | no |  |
| `table` | `string` | no |  |
| `storage` | `{ get(key: string): { data: unknown } \| null; set(key: string, value: unknown): unknown; delete(key: string): unknown; list(): string[] }` | no |  |

## Related

- [StorageBackend](./storage-backend.md)

## Declaration

```ts
interface JobStoreOptions { ... }
```
