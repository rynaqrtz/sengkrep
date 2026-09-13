# BlockDetector

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new BlockDetector(options?: BlockOptions | boolean)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `VENDORS` | `BlockSignature[]` | yes | `static` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `detect` | `response: BlockResponseInput` | `BlockVerdict` |  |
| `isBlocked` | `response: BlockResponseInput` | `boolean` |  |
| `addSignature` | `signature: BlockSignature` | `this` |  |
| `stats` |  | `{ checked: number; blocked: number; byVendor: Record<string, number> }` |  |

## Related

- [BlockOptions](./block-options.md)
- [BlockResponseInput](./block-response-input.md)
- [BlockSignature](./block-signature.md)
- [BlockVerdict](./block-verdict.md)

## Declaration

```ts
class BlockDetector { ... }
```
