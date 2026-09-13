const { createEntry } = require('./entry');

const BODY_TYPES = /json|text|xml|javascript|graphql|urlencoded|csv/i;

class PlaywrightCapture {
  constructor(options = {}) {
    this.module = options.module ?? null;
    this.moduleName = options.moduleName ?? null;
  }

  resolve() {
    if (this.module) return this.module;

    const names = this.moduleName ? [this.moduleName] : ['playwright', 'playwright-core'];
    for (const name of names) {
      try {
        const loaded = require(name);
        this.module = loaded;
        return loaded;
      } catch {
        continue;
      }
    }

    const error = new Error('Playwright is not installed. Install it with: npm i -D playwright');
    error.code = 'PLAYWRIGHT_MISSING';
    throw error;
  }

  attach(page, options = {}) {
    const entries = [];
    const pending = new Map();

    const metaFor = (request) => pending.get(request) ?? {
      startedAt: Date.now(),
      startedDateTime: new Date().toISOString(),
    };

    const onRequest = (request) => {
      pending.set(request, {
        startedAt: Date.now(),
        startedDateTime: new Date().toISOString(),
      });
    };

    const onResponse = async (response) => {
      const request = response.request();
      const meta = metaFor(request);
      pending.delete(request);

      let requestHeaders = {};
      let responseHeaders = {};
      try {
        requestHeaders = await request.allHeaders();
      } catch {
        requestHeaders = request.headers();
      }
      try {
        responseHeaders = await response.allHeaders();
      } catch {
        responseHeaders = response.headers();
      }

      let responseBody = null;
      if (options.bodies !== false && BODY_TYPES.test(String(responseHeaders['content-type'] ?? ''))) {
        try {
          responseBody = await response.text();
        } catch {
          responseBody = null;
        }
      }

      entries.push(
        createEntry({
          source: 'playwright',
          method: request.method(),
          url: request.url(),
          status: response.status(),
          statusText: response.statusText(),
          resourceType: request.resourceType(),
          requestHeaders,
          responseHeaders,
          requestBody: request.postData() ?? null,
          responseBody,
          startedDateTime: meta.startedDateTime,
          time: Date.now() - meta.startedAt,
        }),
      );
    };

    const onFailed = (request) => {
      const meta = metaFor(request);
      pending.delete(request);
      let requestHeaders = {};
      try {
        requestHeaders = request.headers();
      } catch {
        requestHeaders = {};
      }

      entries.push(
        createEntry({
          source: 'playwright',
          method: request.method(),
          url: request.url(),
          resourceType: request.resourceType(),
          status: 0,
          requestHeaders,
          requestBody: request.postData() ?? null,
          startedDateTime: meta.startedDateTime,
          time: Date.now() - meta.startedAt,
          failed: true,
          errorText: request.failure()?.errorText ?? 'request failed',
        }),
      );
    };

    page.on('request', onRequest);
    page.on('response', (response) => {
      onResponse(response).catch(() => {});
    });
    page.on('requestfailed', onFailed);

    return {
      entries,
      pending,
      stop() {
        if (typeof page.off === 'function') {
          page.off('request', onRequest);
          page.off('requestfailed', onFailed);
        }
      },
    };
  }

  async capture(url, options = {}) {
    const playwright = this.resolve();
    const browserType = options.browserType ?? playwright.chromium;
    const browser = await browserType.launch({
      headless: options.headless ?? true,
      args: options.args ?? [],
    });

    try {
      const page = await browser.newPage(options.context ?? {});
      const controller = this.attach(page, options);

      await page.goto(url, {
        waitUntil: options.waitUntil ?? 'networkidle',
        timeout: options.timeout ?? 30000,
      });

      const title = await page.title();
      const html = options.html ? await page.content() : null;

      controller.stop();

      return {
        entries: controller.entries,
        title,
        html,
        url: page.url(),
      };
    } finally {
      await browser.close();
    }
  }
}

module.exports = PlaywrightCapture;
