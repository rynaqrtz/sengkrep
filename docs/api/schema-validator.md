# SchemaValidator

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new SchemaValidator(rules: Record<string, ValidationRule>)
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `validate` | `data: Record<string, unknown>` | `ValidationReport` |  |
| `validateMany` | `items: Record<string, unknown>[]` | `(ValidationReport & { index: number })[]` |  |

## Related

- [ValidationReport](./validation-report.md)
- [ValidationRule](./validation-rule.md)

## Declaration

```ts
class SchemaValidator { ... }
```
