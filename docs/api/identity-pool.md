# IdentityPool

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new IdentityPool(options?: IdentityPoolOptions | boolean)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `identities` | `Identity[]` | yes |  |
| `rotateOnBlock` | `boolean` | yes |  |
| `enabled` | `boolean` | yes | `readonly` |
| `size` | `number` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `list` |  | `Identity[]` |  |
| `get` | `seed?: string` | `Identity` |  |
| `next` | `seed?: string` | `Identity` |  |
| `rotate` | `seed?: string` | `Identity` |  |
| `release` | `seed: string` | `boolean` |  |
| `reset` |  | `void` |  |
| `stats` |  | `IdentityPoolStats` |  |
| `generate` | `size?: number, options?: { profiles?: BrowserProfile[]; locales?: string[] }` | `Identity[]` | `static` |

## Related

- [BrowserProfile](./browser-profile.md)
- [Identity](./identity.md)
- [IdentityPoolOptions](./identity-pool-options.md)
- [IdentityPoolStats](./identity-pool-stats.md)

## Declaration

```ts
class IdentityPool { ... }
```
