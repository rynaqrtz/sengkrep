# JobRecord

interface

Category: Scheduling · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `id` | `string` | yes |  |
| `name` | `string` | yes |  |
| `schedule` | `Schedule` | yes |  |
| `enabled` | `boolean` | yes |  |
| `data` | `unknown` | yes |  |
| `nextRunAt` | `number \| null` | yes |  |
| `lastRunAt` | `string \| null` | yes |  |
| `lastStatus` | `'ok' \| 'error' \| null` | yes |  |
| `lastError` | `string \| null` | yes |  |
| `lastDurationMs` | `number \| null` | yes |  |
| `runs` | `number` | yes |  |
| `failures` | `number` | yes |  |
| `missed` | `number` | yes |  |
| `createdAt` | `string` | yes |  |
| `updatedAt` | `string` | yes |  |

## Related

- [Schedule](./schedule.md)

## Declaration

```ts
interface JobRecord { ... }
```
