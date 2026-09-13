# AuthOptions

interface

Category: Options · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `type` | `'bearer'` | no |  |
| `token` | `string \| null` | no |  |
| `refresh` | `((oldToken: string \| null) => Promise<string>) \| null` | no |  |
| `refreshOn` | `number[]` | no |  |
| `headerName` | `string` | no |  |
| `onRefresh` | `(newToken: string) => void` | no |  |

## Declaration

```ts
interface AuthOptions { ... }
```
