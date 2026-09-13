# CaptureCookies

interface

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `HTTP_ONLY_PREFIX` | `string` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `parseCookieFile` | `text: string` | `CaptureCookie[]` |  |
| `parseCookieJson` | `value: unknown` | `CaptureCookie[]` |  |
| `parseSetCookieLine` | `line: string` | `CaptureCookie \| null` |  |
| `toExpiry` | `value: unknown` | `number \| null` |  |
| `domainOf` | `value: string \| null \| undefined` | `string \| null` |  |
| `readCookies` | `options?: CookieImportOptions` | `Promise<CaptureCookie[]>` |  |
| `importCookies` | `jar: CookieJar, options?: CookieImportOptions` | `Promise<number>` |  |

## Related

- [CaptureCookie](./capture-cookie.md)
- [CookieImportOptions](./cookie-import-options.md)
- [CookieJar](./cookie-jar.md)

## Declaration

```ts
interface CaptureCookies { ... }
```
