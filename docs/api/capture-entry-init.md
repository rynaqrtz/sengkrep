# CaptureEntryInit

interface

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `id` | `string` | no |  |
| `source` | `string` | no |  |
| `method` | `string` | no |  |
| `url` | `string` | no |  |
| `status` | `number` | no |  |
| `statusText` | `string` | no |  |
| `httpVersion` | `string` | no |  |
| `resourceType` | `string` | no |  |
| `mimeType` | `string` | no |  |
| `requestHeaders` | `CaptureHeaders \| Array<{ name: string; value: string }>` | no |  |
| `responseHeaders` | `CaptureHeaders \| Array<{ name: string; value: string }>` | no |  |
| `requestBody` | `string \| Buffer \| null` | no |  |
| `responseBody` | `string \| Buffer \| null` | no |  |
| `requestSize` | `number` | no |  |
| `responseSize` | `number` | no |  |
| `startedDateTime` | `string` | no |  |
| `time` | `number` | no |  |
| `initiator` | `string \| null` | no |  |
| `fromCache` | `boolean` | no |  |
| `failed` | `boolean` | no |  |
| `errorText` | `string \| null` | no |  |
| `redirectURL` | `string \| null` | no |  |
| `bodyBase64` | `boolean` | no |  |

## Related

- [CaptureHeaders](./capture-headers.md)

## Declaration

```ts
interface CaptureEntryInit { ... }
```
