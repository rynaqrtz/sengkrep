# SingleFlight

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new SingleFlight(options?: SingleFlightOptions | boolean)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `enabled` | `boolean` | yes |  |
| `maxKeys` | `number` | yes |  |
| `size` | `number` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `key` | `method: string, url: string, body?: string \| null` | `string` |  |
| `run` | `key: string, fn: () => Promise<T> \| T` | `Promise<T>` |  |
| `stats` |  | `SingleFlightStats` |  |
| `clear` |  | `void` |  |

## Related

- [SingleFlightOptions](./single-flight-options.md)
- [SingleFlightStats](./single-flight-stats.md)

## Declaration

```ts
class SingleFlight { ... }
```
