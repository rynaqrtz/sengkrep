# RawResponse

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `status` | `number` | yes |  |
| `headers` | `Record<string, string \| string[] \| undefined>` | yes |  |
| `url` | `string` | yes |  |
| `body` | `string` | yes |  |
| `binary` | `boolean` | yes |  |
| `bodyBuffer` | `Buffer \| null` | no |  |
| `streamed` | `boolean` | yes |  |
| `filePath` | `string \| null` | yes |  |
| `fromCache` | `boolean` | yes |  |
| `stale` | `boolean` | no |  |
| `notModified` | `boolean` | yes |  |
| `charset` | `string` | no |  |
| `sniffedType` | `string \| null` | no |  |
| `size` | `number \| null` | no |  |
| `rateLimit` | `RateLimitInfo \| null` | no |  |

## Related

- [RateLimitInfo](./rate-limit-info.md)

## Declaration

```ts
interface RawResponse { ... }
```
