# CrawlOptions

interface

Category: Options · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `seed` | `string \| string[]` | yes |  |
| `sink` | `SinkInput` | no |  |
| `schema` | `Record<string, SchemaField>` | no |  |
| `follow` | `RegExp \| ((url: string) => boolean)` | no |  |
| `maxUrls` | `number` | no |  |
| `concurrency` | `number` | no |  |
| `stateFile` | `string \| null` | no |  |
| `saveEvery` | `number` | no |  |
| `linkOptions` | `Record<string, unknown>` | no |  |
| `respectRobotsTxt` | `boolean` | no |  |
| `userAgent` | `string` | no |  |

## Related

- [SchemaField](./schema-field.md)
- [SinkInput](./sink-input.md)

## Declaration

```ts
interface CrawlOptions { ... }
```
