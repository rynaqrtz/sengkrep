# CookieImportOptions

interface · extends `CdpCaptureOptions`

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `from` | `'file' \| 'text' \| 'json' \| 'cdp' \| 'browser' \| 'cookies'` | no |  |
| `path` | `string` | no |  |
| `text` | `string` | no |  |
| `value` | `unknown` | no |  |
| `cookies` | `CaptureCookie[]` | no |  |
| `url` | `string` | no |  |
| `domain` | `string` | no |  |
| `domains` | `string[]` | no |  |

## Related

- [CaptureCookie](./capture-cookie.md)
- [CdpCaptureOptions](./cdp-capture-options.md)

## Declaration

```ts
interface CookieImportOptions extends CdpCaptureOptions { ... }
```
