# GraphQLClient

class

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `introspect` | `endpoint: string, options?: { headers?: Record<string, string> }` | `Promise<{ queryType: string \| null; types: Record<string, unknown> }>` |  |
| `query` | `endpoint: string, queryString: string, variables?: Record<string, unknown>, options?: { headers?: Record<string, string> }` | `Promise<T>` |  |
| `flattenConnection` | `connectionObj: { edges: Array<{ node: T }> }` | `T[]` |  |
| `queryAllPages` | `endpoint: string, queryString: string, options: { variables?: Record<string, unknown>; connectionPath: string; maxPages?: number; pageSize?: number; headers?: Record<string, string> }` | `Promise<T[]>` |  |

## Declaration

```ts
class GraphQLClient { ... }
```
