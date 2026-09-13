const { CdpCapture } = require('./CdpCapture');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function selectorToExpression(selector) {
  return `(() => {
    const found = document.querySelector(${JSON.stringify(String(selector))});
    return found ? { found: true, visible: !!(found.offsetWidth || found.offsetHeight || found.getClientRects().length) } : { found: false };
  })()`;
}

function readResult(evaluateResult) {
  const object = evaluateResult?.result ?? {};
  if (evaluateResult?.exceptionDetails) {
    const detail = evaluateResult.exceptionDetails;
    const text = detail.exception?.description ?? detail.text ?? 'Evaluation failed';
    const err = new Error(text);
    err.code = 'EVALUATION_FAILED';
    throw err;
  }
  if (object.type === 'undefined') return undefined;
  if (object.type === 'number' || object.type === 'boolean') return object.value;
  if (object.type === 'string') return object.value;
  if (object.subtype === 'null' || object.value === null) return null;
  return object.value ?? object.description ?? null;
}

class Browser {
  constructor(options = {}) {
    this.capture = options.capture instanceof CdpCapture ? options.capture : new CdpCapture(options);
    this.timeout = options.timeout ?? 30000;
    this.viewport = options.viewport ?? null;
    this.userAgent = options.userAgent ?? null;
    this._opened = null;
    this._lastSession = null;
    this._closed = false;
  }

  get opened() {
    return this._opened;
  }

  async open() {
    if (this._opened) return this._opened;
    if (this._closed) throw new Error('This browser is closed');

    const opened = await this.capture.open({ timeout: this.timeout, viewport: this.viewport, userAgent: this.userAgent });
    const { session, sessionId } = opened;

    if (this.viewport) {
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: this.viewport.width ?? 1280,
        height: this.viewport.height ?? 720,
        deviceScaleFactor: this.viewport.deviceScaleFactor ?? 1,
        mobile: this.viewport.mobile ?? false,
      }, sessionId);
    }

    if (this.userAgent) {
      await session.send('Network.setUserAgentOverride', { userAgent: this.userAgent }, sessionId);
    }

    this._opened = opened;
    this._lastSession = session;
    return opened;
  }

  async _evaluate(expression, options = {}) {
    const { session, sessionId } = await this.open();
    const result = await session.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: options.awaitPromise ?? false,
    }, sessionId);
    return readResult(result);
  }

  async goto(url, options = {}) {
    await this.open();
    const { session, sessionId } = this._opened;

    const load = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        session.close();
        reject(new Error(`Timed out after ${this.timeout}ms waiting for ${url} to load`));
      }, options.timeout ?? this.timeout);

      const onLoad = () => {
        clearTimeout(timer);
        session.off('Page.loadEventFired', onLoad, sessionId);
        resolve();
      };

      session.on('Page.loadEventFired', onLoad, sessionId);
    });

    await session.send('Page.navigate', { url }, sessionId);
    await load;

    if (options.waitForSelector) await this.waitForSelector(options.waitForSelector, { timeout: options.timeout });
    return this;
  }

  async evaluate(expression, options = {}) {
    return this._evaluate(expression, { awaitPromise: true, ...options });
  }

  async html() {
    return this._evaluate('document.documentElement.outerHTML');
  }

  async text() {
    return this._evaluate('document.body ? document.body.innerText : ""');
  }

  async url() {
    return this._evaluate('location.href');
  }

  async title() {
    return this._evaluate('document.title');
  }

  async waitForSelector(selector, options = {}) {
    const timeout = options.timeout ?? this.timeout;
    const deadline = Date.now() + timeout;

    for (;;) {
      const state = await this._evaluate(selectorToExpression(selector));
      if (state?.found) return true;

      if (Date.now() > deadline) {
        const err = new Error(`Timed out after ${timeout}ms waiting for "${selector}"`);
        err.code = 'SELECTOR_TIMEOUT';
        throw err;
      }

      await sleep(options.pollMs ?? 120);
    }
  }

  async click(selector, options = {}) {
    await this.waitForSelector(selector, options);

    const result = await this._evaluate(`(() => {
      const target = document.querySelector(${JSON.stringify(String(selector))});
      if (!target) return { clicked: false };
      target.scrollIntoView({ block: 'center' });
      const rect = target.getBoundingClientRect();
      return { clicked: true, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
    })()`);

    if (!result?.clicked) {
      const err = new Error(`No element matches "${selector}" to click`);
      err.code = 'SELECTOR_NOT_FOUND';
      throw err;
    }

    const { session, sessionId } = this._opened;
    await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: result.x, y: result.y, button: 'none' }, sessionId);
    await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: result.x, y: result.y, button: 'left', clickCount: 1 }, sessionId);
    await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: result.x, y: result.y, button: 'left', clickCount: 1 }, sessionId);

    if (options.waitForNavigation !== false) {
      await sleep(0);
    }
    return true;
  }

  async type(selector, text, options = {}) {
    await this.waitForSelector(selector, options);
    const { session, sessionId } = this._opened;

    await this._evaluate(`(() => {
      const field = document.querySelector(${JSON.stringify(String(selector))});
      if (!field) return false;
      field.focus();
      field.value = '';
      return true;
    })()`);

    for (const char of String(text)) {
      await session.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char }, sessionId);
      await session.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char }, sessionId);
    }

    await this._evaluate(`(() => {
      const field = document.querySelector(${JSON.stringify(String(selector))});
      if (!field) return false;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return field.value;
    })()`, { awaitPromise: false });

    return true;
  }

  async screenshot(options = {}) {
    const { session, sessionId } = this._opened ?? await this.open();
    const result = await session.send('Page.captureScreenshot', {
      format: options.format ?? 'png',
      quality: options.quality,
      captureBeyondViewport: options.fullPage ?? false,
    }, sessionId);

    return Buffer.from(result.data, 'base64');
  }

  async pdf(options = {}) {
    const { session, sessionId } = this._opened ?? await this.open();
    const result = await session.send('Page.printToPDF', {
      printBackground: options.printBackground ?? true,
      landscape: options.landscape ?? false,
    }, sessionId);

    return Buffer.from(result.data, 'base64');
  }

  async scroll(options = {}) {
    const amount = options.to ?? options.amount ?? 1000;
    await this._evaluate(`window.scrollTo(0, ${JSON.stringify(amount)})`);

    if (options.settleMs) await sleep(options.settleMs);
    return true;
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    this._opened = null;
    if (this._lastSession) this._lastSession.close();
  }

  static async connect(options = {}) {
    const browser = new Browser(options);
    await browser.open();
    return browser;
  }
}

module.exports = { Browser, readResult };
