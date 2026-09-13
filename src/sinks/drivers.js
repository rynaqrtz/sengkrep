function loadDriver(name, hint) {
  try {
    return require(name);
  } catch (cause) {
    const suffix = hint ? ` ${hint}` : '';
    const error = new Error(`The sink needs the "${name}" package. Install it with: npm install ${name}.${suffix}`);
    error.code = 'MISSING_DRIVER';
    error.driver = name;
    error.cause = cause;
    throw error;
  }
}

function hasFunction(target, name) {
  return Boolean(target) && typeof target[name] === 'function';
}

module.exports = { loadDriver, hasFunction };
