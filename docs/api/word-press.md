# WordPress

class

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `detect` | `origin: string` | `Promise<{ isWordPress: boolean; name?: string \| null; namespaces?: string[] }>` |  |
| `restApi` | `origin: string, endpoint: string, params?: Record<string, unknown>` | `Promise<{ data: unknown; total: number \| null; totalPages: number \| null }>` |  |
| `restApiAll` | `origin: string, endpoint: string, params?: Record<string, unknown>, options?: { maxPages?: number }` | `Promise<unknown[]>` |  |
| `extractNonce` | `html: string` | `string \| null` |  |
| `ajaxAction` | `origin: string, action: string, data?: Record<string, unknown>, options?: { nonce?: string; nonceFromPage?: string }` | `Promise<unknown>` |  |

## Declaration

```ts
class WordPress { ... }
```
