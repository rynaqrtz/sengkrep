# PlaywrightCapture

class · 1 constructor form

Category: Network capture · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new PlaywrightCapture(options?: PlaywrightCaptureOptions)
```

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `resolve` |  | `unknown` |  |
| `attach` | `page: { on: (event: string, handler: (...args: never[]) => void) => void; off?: (event: string, handler: (...args: never[]) => void) => void }, options?: PlaywrightCaptureOptions` | `PlaywrightAttachment` |  |
| `capture` | `url: string, options?: PlaywrightCaptureOptions` | `Promise<{ entries: CaptureEntry[]; title: string; html: string \| null; url: string }>` |  |

## Related

- [CaptureEntry](./capture-entry.md)
- [PlaywrightAttachment](./playwright-attachment.md)
- [PlaywrightCaptureOptions](./playwright-capture-options.md)

## Declaration

```ts
class PlaywrightCapture { ... }
```
