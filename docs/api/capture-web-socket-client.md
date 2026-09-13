# CaptureWebSocketClient

interface

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `socket` | `unknown` | yes |  |
| `maxPayload` | `number` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `send` | `data: string \| Buffer, options?: { binary?: boolean }` | `void` |  |
| `close` | `code?: number, reason?: string` | `void` |  |
| `on` | `event: string, handler: (...args: never[]) => void` | `void` |  |
| `off` | `event: string, handler: (...args: never[]) => void` | `void` | `optional` |

## Declaration

```ts
interface CaptureWebSocketClient { ... }
```
