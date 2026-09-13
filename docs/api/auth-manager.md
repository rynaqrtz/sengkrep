# AuthManager

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new AuthManager(options?: AuthOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `enabled` | `boolean` | yes | `readonly` |
| `token` | `string \| null` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `buildHeaders` | `extra?: Record<string, string>` | `Record<string, string>` |  |
| `shouldRefresh` | `status: number` | `boolean` |  |
| `refresh` |  | `Promise<string \| null>` |  |

## Related

- [AuthOptions](./auth-options.md)

## Declaration

```ts
class AuthManager { ... }
```
