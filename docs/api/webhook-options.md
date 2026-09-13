# WebhookOptions

interface

Category: Options · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `onStart` | `string \| null` | no |  |
| `onComplete` | `string \| null` | no |  |
| `onError` | `string \| null` | no |  |
| `onProgress` | `string \| null` | no |  |
| `retries` | `number` | no |  |
| `backoffMs` | `number` | no |  |
| `timeout` | `number` | no |  |
| `secret` | `string \| null` | no |  |
| `onDelivered` | `(result: WebhookDeliveryResult) => void` | no |  |

## Related

- [WebhookDeliveryResult](./webhook-delivery-result.md)

## Declaration

```ts
interface WebhookOptions { ... }
```
