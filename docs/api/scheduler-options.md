# SchedulerOptions

interface · extends `JobStoreOptions`

Category: Scheduling · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `concurrency` | `number` | no |  |
| `catchUp` | `boolean` | no |  |
| `pollInterval` | `number` | no |  |
| `now` | `() => number` | no |  |
| `logger` | `unknown` | no |  |
| `jobs` | `ScheduledJob[]` | no |  |
| `store` | `JobStore` | no |  |

## Related

- [JobStore](./job-store.md)
- [JobStoreOptions](./job-store-options.md)
- [ScheduledJob](./scheduled-job.md)

## Declaration

```ts
interface SchedulerOptions extends JobStoreOptions { ... }
```
