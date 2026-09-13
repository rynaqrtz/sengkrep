# JobStore

class · 1 constructor form

Category: Scheduling · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new JobStore(options?: JobStoreOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `storage` | `{ get(key: string): { data: unknown } \| null; set(key: string, value: unknown): unknown; delete(key: string): unknown; list(): string[] }` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `key` | `id: string` | `string` |  |
| `save` | `job: JobRecord` | `JobRecord` |  |
| `get` | `id: string` | `JobRecord \| null` |  |
| `has` | `id: string` | `boolean` |  |
| `list` |  | `string[]` |  |
| `all` |  | `JobRecord[]` |  |
| `delete` | `id: string` | `boolean` |  |
| `clear` |  | `boolean` |  |

## Related

- [JobRecord](./job-record.md)
- [JobStoreOptions](./job-store-options.md)

## Declaration

```ts
class JobStore { ... }
```
