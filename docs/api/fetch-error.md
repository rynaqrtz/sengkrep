# FetchError

class · extends `Error`

Category: Errors · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `status` | `number \| null` | yes |  |
| `code` | `string` | yes |  |
| `retryAfterMs` | `number \| null` | no |  |
| `headers` | `Record<string, string \| string[] \| undefined>` | no |  |

## Declaration

```ts
class FetchError extends Error { ... }
```
