# Retry

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Retry(options?: RetryOptions)
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `run` | `fn: (attempt: number) => Promise<T>` | `Promise<T>` |  |

## Related

- [RetryOptions](./retry-options.md)

## Declaration

```ts
class Retry { ... }
```
