# Fingerprint

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Fingerprint(options?: FingerprintOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `profile` | `BrowserProfile` | yes | `readonly` |
| `PROFILES` | `BrowserProfile[]` | yes | `static` |
| `ACCEPT_ENCODING` | `string` | yes | `static` |
| `ZSTD_SUPPORTED` | `boolean` | yes | `static` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `setProfile` | `id: string` | `BrowserProfile` |  |
| `buildHeaders` | `extra?: Record<string, string>, context?: FingerprintContext \| null` | `Record<string, string>` |  |
| `getUA` |  | `string` |  |
| `delay` | `base?: number` | `Promise<void>` |  |
| `humanDelay` | `min?: number, max?: number` | `Promise<void>` |  |

## Related

- [BrowserProfile](./browser-profile.md)
- [FingerprintContext](./fingerprint-context.md)
- [FingerprintOptions](./fingerprint-options.md)

## Declaration

```ts
class Fingerprint { ... }
```
