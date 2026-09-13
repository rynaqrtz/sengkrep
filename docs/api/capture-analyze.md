# CaptureAnalyze

interface

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `groupEndpoints` | `entries: CaptureEntry[], options?: CaptureAnalyzeOptions` | `CaptureEndpoint[]` |  |
| `inferJsonSchema` | `value: unknown` | `CaptureJsonSchema` |  |
| `mergeSchemas` | `schemas: Array<CaptureJsonSchema \| null \| undefined>` | `CaptureJsonSchema` |  |
| `queryParams` | `rawUrl: string` | `string[]` |  |
| `safeHeaders` | `headers: CaptureHeaders \| unknown, redact?: boolean` | `CaptureHeaders` |  |
| `schemaFromSamples` | `samples: unknown[]` | `CaptureJsonSchema \| null` |  |
| `summarize` | `entries: CaptureEntry[]` | `CaptureSummary` |  |
| `toCurl` | `entry: CaptureEntry, options?: { redact?: boolean }` | `string` |  |
| `toFetchCode` | `entry: CaptureEntry, options?: { redact?: boolean }` | `string` |  |
| `truncate` | `text: unknown, max: number` | `string` |  |
| `urlTemplate` | `rawUrl: string, options?: { placeholder?: string }` | `string` |  |

## Related

- [CaptureAnalyzeOptions](./capture-analyze-options.md)
- [CaptureEndpoint](./capture-endpoint.md)
- [CaptureEntry](./capture-entry.md)
- [CaptureHeaders](./capture-headers.md)
- [CaptureJsonSchema](./capture-json-schema.md)
- [CaptureSummary](./capture-summary.md)

## Declaration

```ts
interface CaptureAnalyze { ... }
```
