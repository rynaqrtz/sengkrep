# CacheOptions

interface

Category: Options · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `ttl` | `number` | no |  |
| `storage` | `'memory' \| 'disk'` | no |  |
| `storageDir` | `string` | no |  |
| `maxItems` | `number` | no |  |
| `backend` | `StorageBackend` | no |  |
| `file` | `string` | no |  |
| `table` | `string` | no |  |
| `staleWhileRevalidate` | `boolean` | no |  |
| `staleTtl` | `number` | no |  |

## Related

- [StorageBackend](./storage-backend.md)

## Declaration

```ts
interface CacheOptions { ... }
```
