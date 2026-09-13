# CronModule

interface

Category: Scheduling · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `parseCron` | `expression: string` | `Record<string, unknown>` |  |
| `nextCronTime` | `parsed: Record<string, unknown>, from: number` | `number \| null` |  |
| `parseDuration` | `value: string \| number` | `number` |  |
| `formatDuration` | `ms: number` | `string` |  |
| `nextRunTime` | `schedule: Schedule, options?: { now?: number; lastRunAt?: number }` | `number \| null` |  |
| `scheduleKind` | `schedule: Schedule` | `'cron' \| 'interval' \| 'once'` |  |
| `scheduleLabel` | `schedule: Schedule` | `string` |  |

## Related

- [Schedule](./schedule.md)

## Declaration

```ts
interface CronModule { ... }
```
