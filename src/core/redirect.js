const SENSITIVE_REDIRECT_HEADERS = new Set([
  'authorization', 'cookie', 'proxy-authorization', 'x-api-key', 'x-auth-token',
]);

const DEFAULT_REDIRECT_POLICY = {
  validateEachHop: true,
  forwardSensitiveHeaders: false,
  maxCrossHostHops: 3,
};

function buildRedirectPolicy(options = {}) {
  return {
    validateEachHop:         options.validateEachHop         ?? DEFAULT_REDIRECT_POLICY.validateEachHop,
    forwardSensitiveHeaders: options.forwardSensitiveHeaders ?? DEFAULT_REDIRECT_POLICY.forwardSensitiveHeaders,
    maxCrossHostHops:        options.maxCrossHostHops        ?? DEFAULT_REDIRECT_POLICY.maxCrossHostHops,
  };
}

function originsDiffer(from, to) {
  try {
    return new URL(from).origin !== new URL(to).origin;
  } catch {
    return true;
  }
}

function stripSensitiveHeaders(config) {
  const headers = {};
  for (const [name, value] of Object.entries(config.headers ?? {})) {
    if (SENSITIVE_REDIRECT_HEADERS.has(name.toLowerCase())) continue;
    headers[name] = value;
  }
  return { ...config, headers, lookup: undefined };
}

function lookupFromPin(pin) {
  return (host, options, callback) => callback(null, pin.address, pin.family);
}

async function prepareRedirectHop(config, policy, context) {
  const { url, next, statusCode, hops } = context;
  const crossOrigin = originsDiffer(url, next);

  let hopConfig = config;
  if (crossOrigin && !policy.forwardSensitiveHeaders) hopConfig = stripSensitiveHeaders(config);
  else if (crossOrigin && hopConfig.lookup) hopConfig = { ...hopConfig, lookup: undefined };

  if ([301, 302, 303].includes(statusCode) && !['GET', 'HEAD'].includes(String(hopConfig.method ?? 'GET').toUpperCase())) {
    hopConfig = { ...hopConfig, method: 'GET', body: null };
  }

  if (policy.validateEachHop && typeof config.onRedirect === 'function') {
    const pin = await config.onRedirect(next, { status: statusCode, hop: hops + 1, crossOrigin, from: url });
    if (pin && pin.address) hopConfig = { ...hopConfig, lookup: lookupFromPin(pin) };
    else if (pin === null) hopConfig = { ...hopConfig, lookup: undefined };
  }

  return { hopConfig, crossOrigin };
}

module.exports = {
  DEFAULT_REDIRECT_POLICY,
  SENSITIVE_REDIRECT_HEADERS,
  buildRedirectPolicy,
  lookupFromPin,
  originsDiffer,
  prepareRedirectHop,
  stripSensitiveHeaders,
};
