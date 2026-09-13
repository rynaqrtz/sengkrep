# WebhookDeliveryResult

interface

Category: Results · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `event` | `string` | yes |  |
| `url` | `string` | no |  |
| `delivered` | `boolean` | yes |  |
| `status` | `number` | no |  |
| `attempts` | `number` | no |  |
| `error` | `Error \| null` | no |  |
| `skipped` | `boolean` | no |  |

## Declaration

```ts
interface WebhookDeliveryResult { ... }
```
