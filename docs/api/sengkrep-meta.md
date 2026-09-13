# SengkrepMeta

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `responseType` | `'html' \| 'json' \| 'feed' \| 'csv' \| 'binary' \| 'streamed'` | yes |  |
| `cache` | `{ hit: boolean }` | no |  |
| `rendered` | `boolean` | no |  |
| `health` | `HealthReport` | no |  |
| `diff` | `DiffReport` | no |  |
| `validation` | `ValidationReport` | no |  |
| `sniffedType` | `string \| null` | no |  |
| `filePath` | `string \| null` | no |  |
| `size` | `number \| null` | no |  |
| `rateLimit` | `RateLimitInfo` | no |  |

## Related

- [DiffReport](./diff-report.md)
- [HealthReport](./health-report.md)
- [RateLimitInfo](./rate-limit-info.md)
- [ValidationReport](./validation-report.md)

## Declaration

```ts
interface SengkrepMeta { ... }
```
