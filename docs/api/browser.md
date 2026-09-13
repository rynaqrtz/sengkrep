# Browser

class · 1 constructor form

Category: Classes · Source: [index.d.ts](../../index.d.ts) · [All exports](./README.md)

## Constructors

```ts
new Browser(options?: BrowserOptions)
```

## Properties

| Property | Type | Required | Flags |
| --- | --- | --- | --- |
| `opened` | `unknown \| null` | yes | `readonly` |

## Methods

| Method | Parameters | Returns | Flags |
| --- | --- | --- | --- |
| `open` |  | `Promise<unknown>` |  |
| `goto` | `url: string, options?: BrowserGotoOptions` | `Promise<Browser>` |  |
| `evaluate` | `expression: string, options?: { awaitPromise?: boolean }` | `Promise<T>` |  |
| `html` |  | `Promise<string>` |  |
| `text` |  | `Promise<string>` |  |
| `url` |  | `Promise<string>` |  |
| `title` |  | `Promise<string>` |  |
| `waitForSelector` | `selector: string, options?: BrowserWaitOptions` | `Promise<boolean>` |  |
| `click` | `selector: string, options?: BrowserWaitOptions & { waitForNavigation?: boolean }` | `Promise<boolean>` |  |
| `type` | `selector: string, text: string, options?: BrowserWaitOptions` | `Promise<boolean>` |  |
| `screenshot` | `options?: BrowserScreenshotOptions` | `Promise<Buffer>` |  |
| `pdf` | `options?: BrowserPdfOptions` | `Promise<Buffer>` |  |
| `scroll` | `options?: { to?: number; amount?: number; settleMs?: number }` | `Promise<boolean>` |  |
| `close` |  | `void` |  |
| `connect` | `options?: BrowserOptions` | `Promise<Browser>` | `static` |

## Related

- [BrowserGotoOptions](./browser-goto-options.md)
- [BrowserOptions](./browser-options.md)
- [BrowserPdfOptions](./browser-pdf-options.md)
- [BrowserScreenshotOptions](./browser-screenshot-options.md)
- [BrowserWaitOptions](./browser-wait-options.md)

## Declaration

```ts
class Browser { ... }
```
