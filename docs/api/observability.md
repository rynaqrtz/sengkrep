# Observability

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Observability(options?: ObservabilityOptions)
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `recordSuccess` | `url: string` | `void` |  |
| `recordFailure` | `url: string, err: Error` | `void` |  |
| `trackBytes` | `sent: number, received: number` | `void` |  |
| `report` |  | `ObservabilityReport` |  |
| `prometheus` |  | `string` |  |
| `close` |  | `void` |  |

## Related

- [ObservabilityOptions](./observability-options.md)
- [ObservabilityReport](./observability-report.md)

## Declaration

```ts
class Observability { ... }
```
