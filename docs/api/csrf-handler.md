# CsrfHandler

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new CsrfHandler(options?: CsrfOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `enabled` | `boolean` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `extractFromHtml` | `$: CheerioAPI` | `string \| null` |  |
| `extractFromCookies` | `cookieJar: CookieJar \| null, hostname: string` | `string \| null` |  |
| `buildFormBody` | `fields: Record<string, unknown>, token: string \| null` | `string` |  |
| `buildHeaders` | `token: string \| null, extra?: Record<string, string>` | `Record<string, string>` |  |

## Related

- [CookieJar](./cookie-jar.md)
- [CsrfOptions](./csrf-options.md)

## Declaration

```ts
class CsrfHandler { ... }
```
