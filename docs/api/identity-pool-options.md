# IdentityPoolOptions

interface · extends `IdentitySpec`

Category: Options · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `identities` | `Array<Identity \| IdentitySpec>` | no |  |
| `size` | `number` | no |  |
| `rotation` | `'sticky' \| 'round-robin' \| 'random'` | no |  |
| `rotateOnBlock` | `boolean` | no |  |

## Related

- [Identity](./identity.md)
- [IdentitySpec](./identity-spec.md)

## Declaration

```ts
interface IdentityPoolOptions extends IdentitySpec { ... }
```
