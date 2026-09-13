# PluginHooks

interface

Category: Interfaces · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `beforeRequest` | `(payload: { url: string; options: ExtractOptions }) => unknown` | no |  |
| `afterExtract` | `(payload: { data: Record<string, unknown>; meta: SengkrepMeta }) => unknown` | no |  |
| `onError` | `(payload: { url: string; error: Error }) => unknown` | no |  |

## Related

- [ExtractOptions](./extract-options.md)
- [SengkrepMeta](./sengkrep-meta.md)

## Declaration

```ts
interface PluginHooks { ... }
```
