# CookieJar

class

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `getCookieHeader` | `hostname: string` | `string \| null` |  |
| `getAll` | `hostname: string` | `unknown[]` |  |
| `setManual` | `hostname: string, name: string, value: string, options?: Record<string, unknown>` | `void` |  |
| `export` |  | `Record<string, unknown[]>` |  |
| `import` | `snapshot: Record<string, unknown[]>` | `void` |  |
| `clear` | `hostname?: string` | `void` |  |

## Declaration

```ts
class CookieJar { ... }
```
