# HealthMonitor

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new HealthMonitor(options?: HealthOptions)
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `record` | `url: string, healthMap: Record<string, unknown>` | `HealthReport` |  |
| `getReport` | `url: string` | `unknown` |  |
| `getAllReports` |  | `unknown[]` |  |
| `reset` | `url?: string` | `void` |  |

## Related

- [HealthOptions](./health-options.md)
- [HealthReport](./health-report.md)

## Declaration

```ts
class HealthMonitor { ... }
```
