# ScheduledJob

interface

Category: Scheduling · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `id` | `string` | yes |  |
| `schedule` | `Schedule` | no |  |
| `name` | `string` | no |  |
| `enabled` | `boolean` | no |  |
| `data` | `unknown` | no |  |
| `nextRunAt` | `number` | no |  |
| `handler` | `(job: JobRecord & { runCount: number }, scheduler: Scheduler) => Promise<unknown> \| unknown` | no |  |

## Related

- [JobRecord](./job-record.md)
- [Schedule](./schedule.md)
- [Scheduler](./scheduler.md)

## Declaration

```ts
interface ScheduledJob { ... }
```
