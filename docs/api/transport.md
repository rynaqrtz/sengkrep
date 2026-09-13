# Transport

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Transport(options: { fetcher: unknown; http2?: unknown; logger?: unknown; fallback?: boolean })
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `supportsHttp2` | `boolean` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `request` | `url: string, config?: RequestConfig` | `Promise<T>` |  |
| `sweepStreamFiles` | `ttlMs?: number` | `number` |  |
| `close` |  | `void` |  |

## Related

- [RequestConfig](./request-config.md)

## Declaration

```ts
class Transport { ... }
```
