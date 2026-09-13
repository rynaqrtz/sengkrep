# PluginSystem

class

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `use` | `plugin: PluginHooks \| ((system: PluginSystem) => void)` | `this` |  |
| `hook` | `name: string, fn: Function` | `this` |  |
| `run` | `hookName: string, payload: unknown` | `Promise<unknown>` |  |

## Related

- [PluginHooks](./plugin-hooks.md)

## Declaration

```ts
class PluginSystem { ... }
```
