# ProbeResult

interface

Category: Results · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `url` | `string` | yes |  |
| `finalUrl` | `string` | yes |  |
| `status` | `number` | yes |  |
| `blocked` | `boolean` | yes |  |
| `verdict` | `BlockVerdict` | yes |  |
| `headers` | `Record<string, string \| string[] \| undefined>` | yes |  |
| `fromCache` | `boolean` | yes |  |

## Related

- [BlockVerdict](./block-verdict.md)

## Declaration

```ts
interface ProbeResult { ... }
```
