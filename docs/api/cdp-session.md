# CdpSession

class · 1 constructor form

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new CdpSession(client: CdpClient, options?: { timeout?: number })
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `closed` | `boolean` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `on` | `method: string, handler: (params: Record<string, unknown>, sessionId: string) => void, sessionId?: string` | `this` |  |
| `once` | `method: string, handler: (params: Record<string, unknown>, sessionId: string) => void, sessionId?: string` | `this` |  |
| `send` | `method: string, params?: Record<string, unknown>, sessionId?: string` | `Promise<T>` |  |
| `close` |  | `void` |  |

## Related

- [CdpClient](./cdp-client.md)

## Declaration

```ts
class CdpSession { ... }
```
