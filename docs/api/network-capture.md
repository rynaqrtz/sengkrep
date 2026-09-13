# NetworkCapture

class · 1 constructor form

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new NetworkCapture(options?: { source?: string; includeStatic?: boolean })
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `source` | `string` | yes |  |
| `entries` | `CaptureEntry[]` | yes |  |
| `meta` | `Record<string, unknown>` | yes |  |
| `size` | `number` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `fromHar` | `input: string \| HarLog, options?: Record<string, unknown>` | `NetworkCapture` | `static` |
| `fromCdp` | `options: CdpCaptureOptions & { url: string }` | `Promise<NetworkCapture>` | `static` |
| `fromProxy` | `options?: CaptureProxyOptions` | `Promise<{ capture: NetworkCapture; proxy: CaptureProxy }>` | `static` |
| `fromPlaywright` | `url: string, options?: PlaywrightCaptureOptions` | `Promise<NetworkCapture>` | `static` |
| `run` | `options?: Record<string, unknown>` | `Promise<NetworkCapture>` | `static` |
| `add` | `input: CaptureEntryInit \| CaptureEntryInit[]` | `this` |  |
| `pull` | `source: { entries: CaptureEntry[] } \| CaptureEntry[]` | `number` |  |
| `filter` | `criteria?: CaptureFilter \| ((entry: CaptureEntry) => boolean)` | `NetworkCapture` |  |
| `api` |  | `NetworkCapture` |  |
| `find` | `target: string \| ((entry: CaptureEntry) => boolean)` | `CaptureEntry \| null` |  |
| `summary` |  | `CaptureSummary` |  |
| `endpoints` | `options?: CaptureEndpointOptions` | `CaptureEndpoint[]` |  |
| `schemas` | `options?: CaptureEndpointOptions` | `Record<string, CaptureJsonSchema>` |  |
| `toHAR` | `options?: { redact?: boolean; creator?: string }` | `HarLog` |  |
| `saveHar` | `filePath: string, options?: { redact?: boolean }` | `string` |  |
| `toFetchCode` | `target: string \| CaptureEntry, options?: { redact?: boolean }` | `string` |  |
| `toCurl` | `target: string \| CaptureEntry, options?: { redact?: boolean }` | `string` |  |
| `toSchema` | `target: string \| CaptureEntry \| CaptureEndpoint, options?: CaptureSchemaOptions` | `Record<string, string>` |  |
| `toScript` | `target: string \| CaptureEntry \| CaptureEndpoint, options?: CaptureScriptOptions` | `string` |  |
| `frames` | `target: string \| CaptureEntry` | `CaptureWebSocketFrameRecord[]` |  |
| `json` | `options?: CaptureEndpointOptions` | `{ source: string; meta: Record<string, unknown>; summary: CaptureSummary; endpoints: CaptureEndpoint[] }` |  |
| `toJSON` | `options?: CaptureEndpointOptions` | `{ source: string; meta: Record<string, unknown>; summary: CaptureSummary; endpoints: CaptureEndpoint[] }` |  |
| `clear` |  | `this` |  |

## Related

- [CaptureEndpoint](./capture-endpoint.md)
- [CaptureEndpointOptions](./capture-endpoint-options.md)
- [CaptureEntry](./capture-entry.md)
- [CaptureEntryInit](./capture-entry-init.md)
- [CaptureFilter](./capture-filter.md)
- [CaptureJsonSchema](./capture-json-schema.md)
- [CaptureProxy](./capture-proxy.md)
- [CaptureProxyOptions](./capture-proxy-options.md)
- [CaptureSchemaOptions](./capture-schema-options.md)
- [CaptureScriptOptions](./capture-script-options.md)
- [CaptureSummary](./capture-summary.md)
- [CaptureWebSocketFrameRecord](./capture-web-socket-frame-record.md)
- [CdpCaptureOptions](./cdp-capture-options.md)
- [HarLog](./har-log.md)
- [PlaywrightCaptureOptions](./playwright-capture-options.md)

## Declaration

```ts
class NetworkCapture { ... }
```
