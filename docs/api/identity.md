# Identity

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Identity(spec?: IdentitySpec)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `id` | `string` | yes |  |
| `label` | `string` | yes |  |
| `browser` | `string` | yes |  |
| `platform` | `string \| null` | yes |  |
| `userAgent` | `string` | yes |  |
| `locale` | `string` | yes |  |
| `timezone` | `string` | yes |  |
| `viewport` | `{ width: number; height: number }` | yes |  |
| `deviceMemory` | `number` | yes |  |
| `hardwareConcurrency` | `number` | yes |  |
| `isMobile` | `boolean` | yes |  |
| `mobile` | `boolean` | yes | `readonly` |
| `headers` | `Record<string, string>` | yes | `readonly` |
| `LOCALE_TIMEZONES` | `Record<string, string[]>` | yes | `static` |
| `VIEWPORTS` | `Array<{ width: number; height: number }>` | yes | `static` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `toJSON` |  | `IdentitySpec` |  |

## Related

- [IdentitySpec](./identity-spec.md)

## Declaration

```ts
class Identity { ... }
```
