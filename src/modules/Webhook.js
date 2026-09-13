const https  = require('https');
const http   = require('http');
const crypto = require('crypto');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function post(url, body, headers, timeout) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return resolve({ ok: false, status: 0 });
    }

    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     `${parsed.pathname}${parsed.search}`,
      method:   'POST',
      headers,
      timeout,
    }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode < 400, status: res.statusCode });
    });

    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0 }); });
    req.on('error', () => resolve({ ok: false, status: 0 }));

    req.write(body);
    req.end();
  });
}

class Webhook {
  constructor(config = {}) {
    this.config      = config;
    this.retries     = config.retries     ?? 2;
    this.backoffMs   = config.backoffMs   ?? 500;
    this.timeout     = config.timeout     ?? 8000;
    this.secret      = config.secret      ?? null;
    this.onDelivered = config.onDelivered ?? null;
    this.results     = [];
  }

  sign(body) {
    if (!this.secret) return null;
    return `sha256=${crypto.createHmac('sha256', this.secret).update(body).digest('hex')}`;
  }

  async fire(event, payload = {}) {
    const url = this.config[event];
    if (!url) return { delivered: false, skipped: true };

    const data = { event, timestamp: new Date().toISOString(), ...payload };
    const body = JSON.stringify(data);

    const headers = {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-Sengkrep-Event':   event,
    };

    const signature = this.sign(body);
    if (signature) headers['X-Sengkrep-Signature'] = signature;

    let lastError = null;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const { ok, status } = await post(url, body, headers, this.timeout);

      if (ok) {
        const result = { event, url, delivered: true, status, attempts: attempt + 1 };
        this.results.push(result);
        if (this.onDelivered) this.onDelivered(result);
        return result;
      }

      lastError = new Error(`Webhook ${event} delivery failed with status ${status}`);
      if (attempt < this.retries) await sleep(this.backoffMs * Math.pow(2, attempt));
    }

    const failure = { event, url, delivered: false, error: lastError, attempts: this.retries + 1 };
    this.results.push(failure);
    return failure;
  }
}

module.exports = Webhook;
