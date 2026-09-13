# ProgressBar

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new ProgressBar(options?: { total?: number; width?: number; label?: string; enabled?: boolean })
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `update` | `current: number, extra?: string` | `void` |  |
| `increment` | `step?: number, extra?: string` | `void` |  |
| `finish` | `message?: string` | `void` |  |

## Declaration

```ts
class ProgressBar { ... }
```
