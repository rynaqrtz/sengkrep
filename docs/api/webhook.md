# Webhook

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Webhook(config?: WebhookOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `results` | `WebhookDeliveryResult[]` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `sign` | `body: string` | `string \| null` |  |
| `fire` | `event: string, payload?: Record<string, unknown>` | `Promise<WebhookDeliveryResult>` |  |

## Related

- [WebhookDeliveryResult](./webhook-delivery-result.md)
- [WebhookOptions](./webhook-options.md)

## Declaration

```ts
class Webhook { ... }
```
