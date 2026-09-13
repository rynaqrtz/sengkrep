# CaptureScriptOptions

interface · extends `CaptureSchemaOptions`

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `schemaObject` | `Record<string, string>` | no |  |
| `require` | `string` | no |  |
| `logLevel` | `'error' \| 'warn' \| 'info' \| 'debug'` | no |  |
| `url` | `string` | no |  |
| `params` | `Record<string, string>` | no |  |
| `headers` | `Record<string, string>` | no |  |
| `body` | `string \| null` | no |  |
| `redact` | `boolean` | no |  |

## Related

- [CaptureSchemaOptions](./capture-schema-options.md)

## Declaration

```ts
interface CaptureScriptOptions extends CaptureSchemaOptions { ... }
```
