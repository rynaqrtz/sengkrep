# CaptureEndpoint

interface

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `method` | `string` | yes |  |
| `template` | `string` | yes |  |
| `path` | `string` | yes |  |
| `host` | `string` | yes |  |
| `api` | `boolean` | yes |  |
| `count` | `number` | yes |  |
| `statuses` | `Record<string, number>` | yes |  |
| `params` | `string[]` | yes |  |
| `mimeTypes` | `string[]` | yes |  |
| `sources` | `string[]` | yes |  |
| `resourceTypes` | `string[]` | yes |  |
| `averageTime` | `number` | yes |  |
| `sampleIds` | `string[]` | yes |  |
| `schema` | `CaptureJsonSchema \| null` | yes |  |
| `sample` | `string` | no |  |

## Related

- [CaptureJsonSchema](./capture-json-schema.md)

## Declaration

```ts
interface CaptureEndpoint { ... }
```
