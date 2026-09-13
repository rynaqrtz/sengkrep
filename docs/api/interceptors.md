# Interceptors

class

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `request` | `{ use: (onFulfilled?: Function, onRejected?: Function) => number; eject: (id: number) => void }` | yes |  |
| `response` | `{ use: (onFulfilled?: Function, onRejected?: Function) => number; eject: (id: number) => void }` | yes |  |

## Declaration

```ts
class Interceptors { ... }
```
