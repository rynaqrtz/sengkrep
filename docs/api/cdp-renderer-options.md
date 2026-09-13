# CdpRendererOptions

interface · extends `CdpCaptureOptions`

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `capture` | `CdpCapture` | no |  |
| `idleMs` | `number` | no |  |
| `waitForSelector` | `string \| null` | no |  |
| `waitForSelectorTimeout` | `number` | no |  |
| `waitForSelectorInterval` | `number` | no |  |
| `expression` | `string` | no |  |
| `includeMeta` | `boolean` | no |  |
| `consoleMsgs` | `boolean` | no |  |

## Related

- [CdpCapture](./cdp-capture.md)
- [CdpCaptureOptions](./cdp-capture-options.md)

## Declaration

```ts
interface CdpRendererOptions extends CdpCaptureOptions { ... }
```
