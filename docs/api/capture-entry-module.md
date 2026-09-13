# CaptureEntryModule

interface

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `API_RESOURCE_TYPES` | `Set<string>` | yes |  |
| `DEFAULT_REDACT_HEADERS` | `string[]` | yes |  |
| `HOP_BY_HOP` | `Set<string>` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `bodyToText` | `body: unknown` | `string \| null` |  |
| `byteLength` | `body: unknown` | `number` |  |
| `classifyResourceType` | `input: CaptureEntryClassifyInput` | `string` |  |
| `createEntry` | `input?: CaptureEntryInit` | `CaptureEntry` |  |
| `entryKind` | `entry: { status: number; failed?: boolean }` | `'failed' \| 'success' \| 'redirect' \| 'client-error' \| 'server-error' \| 'unknown'` |  |
| `headerMap` | `headers: unknown` | `CaptureHeaders` |  |
| `headersToHar` | `headers: unknown` | `Array<{ name: string; value: string }>` |  |
| `isApiEntry` | `entry: CaptureEntry \| null \| undefined` | `boolean` |  |
| `isJsonMime` | `mimeType: string \| null \| undefined` | `boolean` |  |
| `isTextMime` | `mimeType: string \| null \| undefined` | `boolean` |  |
| `nextId` | `prefix?: string` | `string` |  |
| `parseJsonBody` | `entry: CaptureEntry` | `unknown` |  |
| `parseUrl` | `rawUrl: string` | `URL \| null` |  |
| `redactHeaders` | `headers: unknown, names?: string[]` | `CaptureHeaders` |  |

## Related

- [CaptureEntry](./capture-entry.md)
- [CaptureEntryClassifyInput](./capture-entry-classify-input.md)
- [CaptureEntryInit](./capture-entry-init.md)
- [CaptureHeaders](./capture-headers.md)

## Declaration

```ts
interface CaptureEntryModule { ... }
```
