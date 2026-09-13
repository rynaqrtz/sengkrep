# CaptureCodegen

interface

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `jsonPathsFromSchema` | `schema: CaptureJsonSchema, options?: CaptureSchemaOptions` | `Record<string, string>` |  |
| `buildScript` | `options: CaptureScriptOptions & { endpoint: CaptureEndpoint; schema: Record<string, string>; entry?: CaptureEntry \| null }` | `string` |  |
| `collectPaths` | `schema: CaptureJsonSchema, prefix: string, depth: number, maxDepth: number, out: Array<{ path: string; schema: CaptureJsonSchema }>` | `void` |  |
| `keyForPath` | `path: string` | `string` |  |
| `uniqueKey` | `base: string, path: string, used: Set<string>` | `string` |  |
| `queryParamsOf` | `rawUrl: string` | `Record<string, string>` |  |
| `stripQuery` | `rawUrl: string` | `string` |  |

## Related

- [CaptureEndpoint](./capture-endpoint.md)
- [CaptureEntry](./capture-entry.md)
- [CaptureJsonSchema](./capture-json-schema.md)
- [CaptureSchemaOptions](./capture-schema-options.md)
- [CaptureScriptOptions](./capture-script-options.md)

## Declaration

```ts
interface CaptureCodegen { ... }
```
