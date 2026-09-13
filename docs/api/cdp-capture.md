# CdpCapture

class · 1 constructor form

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new CdpCapture(options?: CdpCaptureOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `host` | `string` | yes |  |
| `timeout` | `number` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `version` | `host?: string, options?: { timeout?: number }` | `Promise<Record<string, unknown>>` | `static` |
| `targets` | `host?: string, options?: { timeout?: number }` | `Promise<CdpTargetDescription[]>` | `static` |
| `discover` | `host?: string, options?: { timeout?: number }` | `Promise<{ webSocketDebuggerUrl: string; Browser?: string; [key: string]: unknown }>` | `static` |
| `captureUrl` | `url: string, options?: CdpCaptureOptions` | `Promise<CdpCaptureResult>` | `static` |
| `exportCookies` | `options?: CdpCaptureOptions` | `Promise<CaptureCookie[]>` | `static` |
| `open` | `options?: CdpCaptureOptions` | `Promise<{ session: CdpSession; client: CdpClient; targetId: string; sessionId: string; browser: Record<string, unknown> }>` |  |
| `exportCookies` | `options?: CdpCaptureOptions` | `Promise<CaptureCookie[]>` |  |
| `capture` | `options: CdpCaptureOptions & { url: string }` | `Promise<CdpCaptureResult>` |  |
| `fetchBodies` | `session: CdpSession, sessionId: string, records: unknown[], options?: CdpCaptureOptions` | `Promise<unknown[]>` |  |

## Related

- [Browser](./browser.md)
- [CaptureCookie](./capture-cookie.md)
- [CdpCaptureOptions](./cdp-capture-options.md)
- [CdpCaptureResult](./cdp-capture-result.md)
- [CdpClient](./cdp-client.md)
- [CdpSession](./cdp-session.md)
- [CdpTargetDescription](./cdp-target-description.md)

## Declaration

```ts
class CdpCapture { ... }
```
