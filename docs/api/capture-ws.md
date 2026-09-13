# CaptureWs

interface

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `GUID` | `string` | yes |  |
| `OPCODES` | `Record<string, number>` | yes |  |
| `WebSocketClient` | `new (socket: unknown, options?: { maxPayload?: number }) => CaptureWebSocketClient` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `acceptKey` | `key: string` | `string` |  |
| `connect` | `url: string, options?: { timeout?: number; maxPayload?: number; headers?: Record<string, string> }` | `Promise<CaptureWebSocketClient>` |  |
| `decodeFrames` | `buffer: Buffer, options?: { maxPayload?: number }` | `CaptureDecodeResult` |  |
| `encodeFrame` | `opcode: number, data: string \| Buffer, options?: { mask?: boolean; key?: Buffer; fin?: boolean }` | `Buffer` |  |

## Related

- [CaptureDecodeResult](./capture-decode-result.md)
- [CaptureWebSocketClient](./capture-web-socket-client.md)

## Declaration

```ts
interface CaptureWs { ... }
```
