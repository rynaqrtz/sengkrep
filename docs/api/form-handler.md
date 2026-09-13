# FormHandler

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new FormHandler(options?: { csrf?: CsrfOptions })
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `parse` | `$: CheerioAPI, selector: string, baseUrl: string` | `ParsedForm \| null` |  |
| `buildSubmission` | `parsedForm: ParsedForm, overrides?: Record<string, unknown>` | `{ url: string; method: string; body: string; headers: Record<string, string> }` |  |

## Related

- [CsrfOptions](./csrf-options.md)
- [ParsedForm](./parsed-form.md)

## Declaration

```ts
class FormHandler { ... }
```
