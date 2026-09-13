# CaptureProxy

class · 1 constructor form

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new CaptureProxy(options?: CaptureProxyOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `entries` | `CaptureEntry[]` | yes |  |
| `address` | `CaptureProxyAddress \| null` | yes |  |
| `server` | `unknown` | yes |  |
| `requestCount` | `number` | yes |  |
| `tunnelCount` | `number` | yes |  |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `start` |  | `Promise<CaptureProxyAddress>` |  |
| `stop` |  | `Promise<number>` |  |
| `captured` |  | `CaptureEntry[]` |  |

## Related

- [CaptureEntry](./capture-entry.md)
- [CaptureProxyAddress](./capture-proxy-address.md)
- [CaptureProxyOptions](./capture-proxy-options.md)

## Declaration

```ts
class CaptureProxy { ... }
```
