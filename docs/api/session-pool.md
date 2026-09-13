# SessionPool

class · 1 constructor form

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new SessionPool(options?: SessionPoolOptions)
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `next` |  | `SessionPoolSession` |  |
| `get` | `id: number` | `SessionPoolSession \| null` |  |
| `stats` |  | `Array<{ id: number; useCount: number; createdAt: number }>` |  |
| `resetAll` |  | `void` |  |

## Related

- [SessionPoolOptions](./session-pool-options.md)
- [SessionPoolSession](./session-pool-session.md)

## Declaration

```ts
class SessionPool { ... }
```
