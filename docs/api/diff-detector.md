# DiffDetector

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new DiffDetector(options?: DiffOptions)
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `check` | `url: string, data: unknown` | `DiffReport` |  |
| `getAllChanges` | `url?: string` | `DiffReport[]` |  |
| `getChangedOnly` | `url?: string` | `DiffReport[]` |  |
| `clearHistory` |  | `void` |  |
| `clearSnapshot` | `url: string` | `void` |  |
| `clearAll` |  | `void` |  |

## Related

- [DiffOptions](./diff-options.md)
- [DiffReport](./diff-report.md)

## Declaration

```ts
class DiffDetector { ... }
```
