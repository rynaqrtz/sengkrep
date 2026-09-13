# IdentitySpec

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `id` | `string` | no |  |
| `label` | `string` | no |  |
| `browser` | `string` | no |  |
| `platform` | `string \| null` | no |  |
| `userAgent` | `string` | no |  |
| `locale` | `string` | no |  |
| `timezone` | `string` | no |  |
| `viewport` | `{ width: number; height: number }` | no |  |
| `deviceMemory` | `number` | no |  |
| `hardwareConcurrency` | `number` | no |  |
| `isMobile` | `boolean` | no |  |
| `profile` | `Partial<BrowserProfile>` | no |  |

## Related

- [BrowserProfile](./browser-profile.md)

## Declaration

```ts
interface IdentitySpec { ... }
```
