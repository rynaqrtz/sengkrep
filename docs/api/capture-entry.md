# CaptureEntry

interface

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `id` | `string` | yes |  |
| `source` | `string` | yes |  |
| `method` | `string` | yes |  |
| `url` | `string` | yes |  |
| `status` | `number` | yes |  |
| `statusText` | `string` | yes |  |
| `httpVersion` | `string` | yes |  |
| `resourceType` | `string` | yes |  |
| `mimeType` | `string` | yes |  |
| `requestHeaders` | `CaptureHeaders` | yes |  |
| `responseHeaders` | `CaptureHeaders` | yes |  |
| `requestBody` | `string \| null` | yes |  |
| `responseBody` | `string \| null` | yes |  |
| `requestSize` | `number` | yes |  |
| `responseSize` | `number` | yes |  |
| `startedDateTime` | `string` | yes |  |
| `time` | `number` | yes |  |
| `initiator` | `string \| null` | yes |  |
| `fromCache` | `boolean` | yes |  |
| `failed` | `boolean` | yes |  |
| `errorText` | `string \| null` | yes |  |
| `redirectURL` | `string \| null` | yes |  |
| `bodyBase64` | `boolean` | yes |  |
| `done` | `boolean` | no |  |
| `truncated` | `boolean` | no |  |
| `frames` | `CaptureWebSocketFrameRecord[]` | no |  |
| `framesTruncated` | `boolean` | no |  |

## Related

- [CaptureHeaders](./capture-headers.md)
- [CaptureWebSocketFrameRecord](./capture-web-socket-frame-record.md)

## Declaration

```ts
interface CaptureEntry { ... }
```
