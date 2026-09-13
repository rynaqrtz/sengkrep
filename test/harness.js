const assert = require('assert');

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write(`  ok   ${name}\n`);
  } catch (err) {
    failed += 1;
    failures.push({ name, err });
    process.stdout.write(`  FAIL ${name}\n       ${err && err.message ? err.message : err}\n`);
  }
}

async function rejects(promise, matcher) {
  let caught = null;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'expected promise to reject, but it resolved');
  if (typeof matcher === 'string') {
    assert.strictEqual(caught.code, matcher, `expected code ${matcher}, got ${caught.code}`);
  } else if (matcher instanceof RegExp) {
    assert.ok(matcher.test(caught.message), `expected message to match ${matcher}, got ${caught.message}`);
  } else if (typeof matcher === 'function') {
    assert.ok(matcher(caught), 'custom rejection matcher failed');
  }
  return caught;
}

function within(actual, expected, tolerance) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summary(label) {
  process.stdout.write(`\n${label}: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    for (const { name, err } of failures) {
      process.stdout.write(`  - ${name}: ${err && err.message ? err.message : err}\n`);
    }
  }
  return failed === 0;
}

function finish(label) {
  const ok = summary(label);
  setTimeout(() => process.exit(ok ? 0 : 1), 120);
}

module.exports = { assert, test, rejects, within, delay, summary, finish };
