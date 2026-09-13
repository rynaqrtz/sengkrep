# CdpCaptureOptions

interface

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `url` | `string` | no |  |
| `host` | `string` | no |  |
| `debuggerUrl` | `string \| null` | no |  |
| `timeout` | `number` | no |  |
| `idleMs` | `number` | no |  |
| `maxEntries` | `number` | no |  |
| `maxBodyBytes` | `number` | no |  |
| `bodies` | `boolean` | no |  |
| `readAllBodies` | `boolean` | no |  |
| `frames` | `boolean` | no |  |
| `maxFramesPerSocket` | `number` | no |  |
| `connect` | `(url: string, options?: { timeout?: number }) => Promise<CdpClient>` | no |  |
| `discover` | `(options?: CdpCaptureOptions) => Promise<{ webSocketDebuggerUrl: string }>` | no |  |

## Related

- [CdpClient](./cdp-client.md)

## Declaration

```ts
interface CdpCaptureOptions { ... }
```
