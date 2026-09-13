const https = require('https');
const http  = require('http');
const zlib  = require('zlib');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');
const { createHttpsAgent, routeHttpThroughProxy } = require('./ProxyTunnel');
const { buildRedirectPolicy, originsDiffer, prepareRedirectHop } = require('./redirect');
const contentSafety = require('../utils/contentSafety');
const { version } = require('../../package.json');

class FetchError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name   = 'FetchError';
    this.status = status ?? null;
    this.code   = code   ?? 'FETCH_ERROR';
  }
}

class TimeoutError extends FetchError {
  constructor(message) {
    super(message, null, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

class CanceledError extends FetchError {
  constructor(message) {
    super(message, null, 'CANCELED');
    this.name = 'CanceledError';
  }
}

const KNOWN_ENCODINGS = new Set(['gzip', 'br', 'deflate', 'zstd', 'identity']);

function parseRetryAfter(headerValue) {
  if (!headerValue) return null;

  const seconds = Number(headerValue);
  if (!isNaN(seconds)) return Math.max(0, seconds * 1000);

  const dateMs = Date.parse(headerValue);
  if (!isNaN(dateMs)) return Math.max(0, dateMs - Date.now());

  return null;
}

function decompressStream(encoding) {
  if (!encoding || encoding === 'identity') return { transform: null, unsupported: false };
  if (encoding === 'gzip')    return { transform: zlib.createGunzip(), unsupported: false };
  if (encoding === 'br')      return { transform: zlib.createBrotliDecompress(), unsupported: false };
  if (encoding === 'deflate') return { transform: zlib.createInflate(), unsupported: false };
  if (encoding === 'zstd') {
    if (zlib.createZstdDecompress) return { transform: zlib.createZstdDecompress(), unsupported: false };
    return { transform: null, unsupported: true };
  }
  return { transform: null, unsupported: !KNOWN_ENCODINGS.has(encoding) ? true : false };
}

class Fetcher {
  constructor(options = {}) {
    this.timeout          = options.timeout          ?? 30000;
    this.maxRedirects      = options.maxRedirects      ?? 5;
    this.fingerprint       = options.fingerprint       ?? null;
    this.cookieJar         = options.cookieJar         ?? null;
    this.interceptors      = options.interceptors      ?? null;
    this.maxMemoryBuffer   = options.maxMemoryBuffer   ?? 10 * 1024 * 1024;
    this.streamDir         = options.streamDir         ?? os.tmpdir();
    this.keepAlive         = options.keepAlive         ?? true;
    this.onProgress        = options.onProgress        ?? null;
    this.dnsCache          = options.dnsCache          ?? null;

    this.httpAgent  = new http.Agent({ keepAlive: this.keepAlive, maxSockets: options.maxSockets ?? 50 });
    this.httpsAgent = new https.Agent({ keepAlive: this.keepAlive, maxSockets: options.maxSockets ?? 50 });
    this.connectTimeout = options.connectTimeout ?? null;
    this.totalTimeout   = options.totalTimeout   ?? null;
    this._tempFiles     = new Set();

    this.redirectPolicy = buildRedirectPolicy(options.redirectPolicy);
  }

  close() {
    for (const file of this._tempFiles) {
      try {
        fs.unlinkSync(file);
      } catch {}
    }
    this._tempFiles.clear();
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
  }

  sweepStreamFiles(ttlMs = 3600000) {
    let removed = 0;
    try {
      const now = Date.now();
      for (const name of fs.readdirSync(this.streamDir)) {
        if (!name.startsWith('sengkrep-stream-') || !name.endsWith('.tmp')) continue;
        const full = path.join(this.streamDir, name);
        try {
          const stat = fs.statSync(full);
          if (now - stat.mtimeMs > ttlMs) {
            fs.unlinkSync(full);
            this._tempFiles.delete(full);
            removed += 1;
          }
        } catch {
          continue;
        }
      }
    } catch {
      return 0;
    }
    return removed;
  }

  _consumeBody(res, config) {
    return new Promise((resolve, reject) => {
      const encoding = res.headers['content-encoding'];
      const decomp   = decompressStream(encoding);

      if (decomp.unsupported) {
        res.resume();
        return reject(new FetchError(
          `Response uses Content-Encoding "${encoding}" which this Node.js runtime cannot decompress (zstd needs Node 22.15+/23.8+). Upgrade Node or ask the server for gzip/br/deflate via an explicit Accept-Encoding header.`,
          null,
          'UNSUPPORTED_ENCODING',
        ));
      }

      const declaredLength = res.headers['content-length'] ? parseInt(res.headers['content-length'], 10) : null;
      const verifyLength   = config.verifyLength !== false;
      let rawBytesReceived = 0;
      res.on('data', (chunk) => { rawBytesReceived += chunk.length; });

      const source = decomp.transform ? res.pipe(decomp.transform) : res;

      let chunks       = [];
      let bufferedSize = 0;
      let fileStream   = null;
      let filePath     = null;
      let totalSize    = 0;
      let settled      = false;

      const finish = (err, result) => {
        if (settled) return;
        settled = true;
        if (fileStream) fileStream.end();
        if (err) return reject(err);
        resolve(result);
      };

      const truncationError = () => new FetchError(
        `Response ended before it was complete${declaredLength !== null ? ` (declared Content-Length: ${declaredLength}, received: ${rawBytesReceived})` : ''}. The connection likely dropped mid-transfer.`,
        null,
        'TRUNCATED_RESPONSE',
      );

      res.on('aborted', () => {
        if (verifyLength) return finish(truncationError());
        if (fileStream) {
          fileStream.end(() => finish(null, { streamed: true, filePath, size: totalSize }));
        } else {
          finish(null, { streamed: false, buffer: Buffer.concat(chunks), size: totalSize });
        }
      });

      source.on('data', (chunk) => {
        totalSize += chunk.length;

        if (this.onProgress) this.onProgress({ url: config.url, bytesReceived: totalSize });

        if (fileStream) {
          fileStream.write(chunk);
          return;
        }

        chunks.push(chunk);
        bufferedSize += chunk.length;

        if (bufferedSize > this.maxMemoryBuffer && config.bufferAll !== true) {
          filePath   = path.join(this.streamDir, `sengkrep-stream-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
          fileStream = fs.createWriteStream(filePath);
          this._tempFiles.add(filePath);
          for (const c of chunks) fileStream.write(c);
          chunks = [];
        }
      });

      source.on('end', () => {
        if (verifyLength && res.complete === false) {
          return finish(truncationError());
        }

        if (fileStream) {
          fileStream.end(() => finish(null, { streamed: true, filePath, size: totalSize }));
        } else {
          finish(null, { streamed: false, buffer: Buffer.concat(chunks), size: totalSize });
        }
      });

      source.on('error', (err) => finish(new FetchError(`Decompress/stream failed: ${err.message}`, null, 'DECOMPRESS_ERROR')));
      res.on('error', (err) => {
        if (verifyLength && res.complete === false) return finish(truncationError());
        finish(new FetchError(err.message, null, 'STREAM_ERROR'));
      });
    });
  }

  _rawFetch(url, config, hops = 0, redirectState = null) {
    return new Promise((resolve, reject) => {
      if (hops > this.maxRedirects) {
        return reject(new FetchError('Max redirects exceeded', null, 'TOO_MANY_REDIRECTS'));
      }

      const state = redirectState ?? { crossHostHops: 0 };

      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return reject(new FetchError(`Invalid URL: ${url}`, null, 'INVALID_URL'));
      }

      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? https : http;

      const headers = this.fingerprint
        ? this.fingerprint.buildHeaders(config.headers ?? {})
        : { 'User-Agent': `sengkrep/${version}`, ...(config.headers ?? {}) };

      if (this.cookieJar && !headers['Cookie']) {
        const cookieHeader = this.cookieJar.getCookieHeader(parsed.hostname);
        if (cookieHeader) headers['Cookie'] = cookieHeader;
      }

      let reqOptions = {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     `${parsed.pathname}${parsed.search}`,
        method:   config.method ?? 'GET',
        headers,
        timeout:  config.timeout ?? this.timeout,
        agent:    isHttps ? this.httpsAgent : this.httpAgent,
      };

      if (config.proxy) {
        if (isHttps) {
          reqOptions.agent = createHttpsAgent(config.proxy);
        } else {
          reqOptions = routeHttpThroughProxy(reqOptions, url, config.proxy);
        }
      }

      if (config.rejectUnauthorized === false) {
        reqOptions.rejectUnauthorized = false;
      }

      if (config.lookup) {
        reqOptions.lookup = config.lookup;
      } else if (this.dnsCache) {
        reqOptions.lookup = (hostname, opts, callback) => {
          this.dnsCache.lookup(hostname)
            .then((address) => callback(null, address, address.includes(':') ? 6 : 4))
            .catch((err) => callback(err));
        };
      }

      let settled = false;
      let connectTimer = null;
      let totalTimer   = null;
      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        if (connectTimer) clearTimeout(connectTimer);
        if (totalTimer) clearTimeout(totalTimer);
        fn(arg);
      };

      const requestSize = config.body ? Buffer.byteLength(config.body) : 0;
      let responseStarted = false;

      const connectTimeout = config.connectTimeout ?? this.connectTimeout ?? config.timeout ?? this.timeout;
      const totalTimeout   = config.totalTimeout   ?? this.totalTimeout;

      const req = lib.request(reqOptions, async (res) => {
        responseStarted = true;
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }
        const { statusCode, headers: resHeaders } = res;

        if (this.cookieJar && resHeaders['set-cookie']) {
          this.cookieJar.setFromHeaders(parsed.hostname, resHeaders['set-cookie']);
        }

        if ([301, 302, 303, 307, 308].includes(statusCode) && resHeaders.location) {
          res.resume();

          let next;
          try {
            next = new URL(resHeaders.location, url).href;
          } catch {
            return finish(reject, new FetchError(`Bad redirect location: ${resHeaders.location}`, statusCode, 'BAD_REDIRECT'));
          }

          const crossOrigin = originsDiffer(url, next);
          if (crossOrigin) {
            state.crossHostHops += 1;
            if (state.crossHostHops > this.redirectPolicy.maxCrossHostHops) {
              return finish(reject, new FetchError(
                `Too many cross-host redirects (> ${this.redirectPolicy.maxCrossHostHops}): ${next}`,
                statusCode,
                'TOO_MANY_REDIRECTS',
              ));
            }
          }

          return finish(resolve, prepareRedirectHop(config, this.redirectPolicy, { url, next, statusCode, hops })
            .then(({ hopConfig }) => this._rawFetch(next, hopConfig, hops + 1, state)));
        }

        if (statusCode === 304) {
          res.resume();
          return finish(resolve, { status: statusCode, headers: resHeaders, body: '', url, notModified: true, requestSize, responseSize: 0 });
        }

        if (statusCode >= 400) {
          res.resume();
          const err = new FetchError(`HTTP ${statusCode}`, statusCode, 'HTTP_ERROR');
          err.headers    = resHeaders;
          err.retryAfterMs = parseRetryAfter(resHeaders['retry-after']);
          return finish(reject, err);
        }

        try {
          const consumed = await this._consumeBody(res, { ...config, url });

          if (consumed.streamed) {
            return finish(resolve, {
              status: statusCode, headers: resHeaders, url,
              body: '', streamed: true, filePath: consumed.filePath,
              requestSize, responseSize: consumed.size,
            });
          }

          const safety = contentSafety.inspect(consumed.buffer, resHeaders['content-type']);

          if (safety.isBinary) {
            return finish(resolve, {
              status: statusCode, headers: resHeaders, url,
              body: '', binary: true, bodyBuffer: consumed.buffer,
              sniffedType: safety.sniffedType, requestSize, responseSize: consumed.size,
            });
          }

          const decoded = contentSafety.decodeBuffer(consumed.buffer, {
            headerCharset: contentSafety.detectCharsetFromContentType(resHeaders['content-type']),
          });

          finish(resolve, {
            status: statusCode, headers: resHeaders, url,
            body: decoded.text, charset: decoded.charset, charsetSource: decoded.source,
            requestSize, responseSize: consumed.size,
          });
        } catch (e) {
          finish(reject, e);
        }
      });

      connectTimer = setTimeout(() => {
        req.destroy();
        finish(reject, new TimeoutError('Connection timed out'));
      }, connectTimeout);

      if (totalTimeout) {
        totalTimer = setTimeout(() => {
          req.destroy();
          finish(reject, new TimeoutError('Request deadline exceeded'));
        }, totalTimeout);
      }

      req.on('timeout', () => {
        req.destroy();
        finish(reject, new TimeoutError('Request timed out'));
      });

      if (config.signal) {
        const onAbort = () => {
          req.destroy();
          finish(reject, new CanceledError('Request canceled'));
        };
        if (config.signal.aborted) {
          onAbort();
        } else {
          config.signal.addEventListener('abort', onAbort, { once: true });
        }
      }

      req.on('error', (err) => {
        if (err.code === 'PROXY_ERROR') return finish(reject, err);
        if (responseStarted && config.verifyLength !== false) {
          return finish(reject, new FetchError(
            `Connection dropped while receiving the response body: ${err.message}`,
            null,
            'TRUNCATED_RESPONSE',
          ));
        }
        finish(reject, new FetchError(err.message, null, 'NETWORK_ERROR'));
      });

      if (config.body) req.write(config.body);
      req.end();
    });
  }

  async fetch(url, options = {}) {
    let config = {
      method:             options.method             ?? 'GET',
      headers:            options.headers             ?? {},
      body:               options.body                ?? null,
      proxy:              options.proxy               ?? null,
      signal:             options.signal               ?? null,
      timeout:            options.timeout             ?? this.timeout,
      connectTimeout:     options.connectTimeout      ?? this.connectTimeout ?? undefined,
      totalTimeout:       options.totalTimeout        ?? this.totalTimeout   ?? undefined,
      lookup:             options.lookup              ?? null,
      onRedirect:         options.onRedirect          ?? null,
      rejectUnauthorized: options.rejectUnauthorized   ?? undefined,
      bufferAll:          options.bufferAll            ?? false,
      verifyLength:       options.verifyLength         ?? true,
    };

    if (this.interceptors) {
      config = await this.interceptors.request.run({ url, ...config });
      url    = config.url;
    }

    try {
      const raw = await this._rawFetch(url, config, 0);
      if (this.interceptors) return await this.interceptors.response.run(raw);
      return raw;
    } catch (err) {
      if (this.interceptors) return await this.interceptors.response.runError(err);
      throw err;
    }
  }
}

module.exports = { Fetcher, FetchError, TimeoutError, CanceledError };
