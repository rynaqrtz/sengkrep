const { CdpCapture } = require('./CdpCapture');

const DEFAULT_EXPRESSION = 'document.documentElement.outerHTML';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpRenderer {
  constructor(options = {}) {
    this.capture = options.capture ?? new CdpCapture(options);
    this.timeout = options.timeout ?? options.capture?.timeout ?? 30000;
    this.idleMs = options.idleMs ?? 400;
    this.waitForSelector = options.waitForSelector ?? null;
    this.waitForSelectorTimeout = options.waitForSelectorTimeout ?? options.timeout ?? 10000;
    this.waitForSelectorInterval = options.waitForSelectorInterval ?? 100;
    this.expression = options.expression ?? DEFAULT_EXPRESSION;
    this.includeMeta = options.includeMeta ?? false;
    this.consoleMsgs = options.consoleMsgs ?? false;
  }

  async _waitForSelector(session, sessionId, selector) {
    const deadline = Date.now() + this.waitForSelectorTimeout;
    const expression = `Boolean(document.querySelector(${JSON.stringify(selector)}))`;

    while (Date.now() < deadline) {
      const result = await session
        .send('Runtime.evaluate', { expression, returnByValue: true }, sessionId)
        .catch(() => null);
      if (result?.result?.value === true) return true;
      await delay(this.waitForSelectorInterval);
    }

    return false;
  }

  async render(url, options = {}) {
    if (!url) throw new Error('CdpRenderer.render() requires a url');

    const timeout = options.timeout ?? this.timeout;
    const opened = await this.capture.open(options);
    const { session, sessionId } = opened;
    const consoleMsgs = [];

    if (this.consoleMsgs || options.consoleMsgs) {
      session.on('Runtime.consoleAPICalled', (params) => {
        const text = (params.args ?? [])
          .map((arg) => (arg.value !== undefined ? String(arg.value) : (arg.description ?? arg.type ?? '')))
          .join(' ');
        consoleMsgs.push({ type: params.type ?? 'log', text });
      }, sessionId);
    }

    let resolveLoaded;
    const loaded = new Promise((resolve) => {
      resolveLoaded = resolve;
    });
    let loadTimer = null;
    const markLoaded = () => {
      if (loadTimer) clearTimeout(loadTimer);
      loadTimer = null;
      resolveLoaded();
    };

    session.on('Page.loadEventFired', () => markLoaded(), sessionId);

    try {
      await session.send('Page.enable', {}, sessionId);
      if (this.consoleMsgs || options.consoleMsgs) await session.send('Runtime.enable', {}, sessionId);
      await session.send('Page.navigate', { url }, sessionId);

      loadTimer = setTimeout(markLoaded, timeout);
      if (typeof loadTimer.unref === 'function') loadTimer.unref();
      await loaded;

      const selector = options.waitForSelector ?? this.waitForSelector;
      const found = selector ? await this._waitForSelector(session, sessionId, selector) : null;
      if (selector && found === false) {
        throw new Error(`waited ${this.waitForSelectorTimeout}ms for ${selector} on ${url}`);
      }

      const idleMs = options.idleMs ?? this.idleMs;
      if (idleMs > 0) await delay(idleMs);

      const expression = options.expression ?? this.expression;
      const evaluated = await session.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
      const html = evaluated?.result?.value;

      if (typeof html !== 'string') {
        throw new Error(`CdpRenderer expression did not return a string for ${url}`);
      }

      if (!this.includeMeta && !options.includeMeta) return html;

      const meta = await session
        .send('Runtime.evaluate', {
          expression: '({ title: document.title, url: location.href, status: document.readyState })',
          returnByValue: true,
        }, sessionId)
        .then((result) => result?.result?.value ?? null)
        .catch(() => null);

      return {
        html,
        url: meta?.url ?? url,
        title: meta?.title ?? null,
        readyState: meta?.status ?? null,
        consoleMsgs,
      };
    } finally {
      try {
        await session.send('Target.closeTarget', { targetId: opened.targetId });
      } catch {}
      session.close();
    }
  }
}

function createCdpRenderer(options = {}) {
  return new CdpRenderer(options);
}

module.exports = { CdpRenderer, createCdpRenderer, DEFAULT_EXPRESSION };
