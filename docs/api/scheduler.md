# Scheduler

class · 1 constructor form

Category: Scheduling · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Scheduler(options?: SchedulerOptions | boolean)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `logger` | `unknown` | yes |  |
| `now` | `() => number` | yes |  |
| `concurrency` | `number` | yes |  |
| `catchUp` | `boolean` | yes |  |
| `pollInterval` | `number` | yes |  |
| `store` | `JobStore` | yes |  |
| `started` | `boolean` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `add` | `job: ScheduledJob, handler: (job: JobRecord & { runCount: number }, scheduler: Scheduler) => Promise<unknown> \| unknown` | `JobRecord` |  |
| `remove` | `id: string` | `boolean` |  |
| `get` | `id: string` | `JobRecord \| null` |  |
| `list` |  | `JobRecord[]` |  |
| `has` | `id: string` | `boolean` |  |
| `pause` | `id: string` | `JobRecord` |  |
| `resume` | `id: string` | `JobRecord` |  |
| `start` |  | `Promise<Scheduler>` |  |
| `tick` |  | `Promise<number>` |  |
| `runNow` | `id: string` | `Promise<JobRecord \| null>` |  |
| `stop` | `options?: { wait?: boolean }` | `Promise<Scheduler>` |  |
| `stats` |  | `SchedulerStats` |  |
| `on` | `event: 'run', listener: (event: SchedulerRunEvent) => void` | `this` |  |
| `on` | `event: 'run:error', listener: (event: SchedulerErrorEvent) => void` | `this` |  |
| `on` | `event: 'tick', listener: (event: SchedulerTickEvent) => void` | `this` |  |
| `on` | `event: 'start' \| 'stop', listener: () => void` | `this` |  |
| `on` | `event: string, listener: (...args: never[]) => void` | `this` |  |
| `once` | `event: 'run', listener: (event: SchedulerRunEvent) => void` | `this` |  |
| `once` | `event: 'run:error', listener: (event: SchedulerErrorEvent) => void` | `this` |  |
| `once` | `event: 'tick', listener: (event: SchedulerTickEvent) => void` | `this` |  |
| `once` | `event: 'start' \| 'stop', listener: () => void` | `this` |  |
| `once` | `event: string, listener: (...args: never[]) => void` | `this` |  |
| `off` | `event: string, listener: (...args: never[]) => void` | `this` |  |
| `emit` | `event: string, payload?: unknown` | `boolean` |  |

## Related

- [JobRecord](./job-record.md)
- [JobStore](./job-store.md)
- [ScheduledJob](./scheduled-job.md)
- [SchedulerErrorEvent](./scheduler-error-event.md)
- [SchedulerOptions](./scheduler-options.md)
- [SchedulerRunEvent](./scheduler-run-event.md)
- [SchedulerStats](./scheduler-stats.md)
- [SchedulerTickEvent](./scheduler-tick-event.md)

## Declaration

```ts
class Scheduler { ... }
```
