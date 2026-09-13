const fs = require('fs');
const os = require('os');
const path = require('path');
const dns = require('dns');
const zlib = require('zlib');

const MIN_NODE = '20.18.1';
const SQLITE_NODE = '22.5.0';

const OPTIONAL_DRIVERS = [
  { name: 'playwright', install: 'npm install playwright', purpose: 'browser capture and rendering through Playwright' },
  { name: 'pg', install: 'npm install pg', purpose: 'PostgresSink' },
  { name: 'mysql2/promise', install: 'npm install mysql2', purpose: 'MySQLSink' },
  { name: '@clickhouse/client', install: 'npm install @clickhouse/client', purpose: 'ClickHouseSink' },
  { name: '@aws-sdk/client-s3', install: 'npm install @aws-sdk/client-s3', purpose: 'S3Sink' },
];

function compareVersions(left, right) {
  const a = String(left).split('.').map(Number);
  const b = String(right).split('.').map(Number);

  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }

  return 0;
}

function zstdSupported() {
  return typeof zlib.createZstdDecompress === 'function' || typeof zlib.zstdDecompress === 'function';
}

function sqliteSupported() {
  try {
    require('node:sqlite');
    return true;
  } catch {
    return false;
  }
}

function installed(name) {
  try {
    require(name);
    return true;
  } catch {
    return false;
  }
}

function writable(directory, label) {
  const file = path.join(directory, `.sengkrep-doctor-${process.pid}.tmp`);
  try {
    fs.writeFileSync(file, 'ok');
    fs.unlinkSync(file);
    return { status: 'pass', detail: `${directory} is writable, so ${label}` };
  } catch (error) {
    return { status: 'fail', detail: `cannot write to ${directory}: ${error.message}` };
  }
}

async function runDoctor(options = {}) {
  const config = options ?? {};
  const checks = [];
  const nodeVersion = process.versions.node;

  checks.push(compareVersions(nodeVersion, MIN_NODE) >= 0
    ? { name: 'node', status: 'pass', detail: `${nodeVersion}, which meets the ${MIN_NODE} floor` }
    : { name: 'node', status: 'fail', detail: `${nodeVersion} is older than the required ${MIN_NODE}` });

  checks.push(sqliteSupported()
    ? { name: 'sqlite', status: 'pass', detail: 'node:sqlite is present, the sqlite backend works' }
    : { name: 'sqlite', status: 'warn', detail: `node:sqlite needs Node ${SQLITE_NODE} or newer, the sqlite backend stays unavailable` });

  checks.push(zstdSupported()
    ? { name: 'zstd', status: 'pass', detail: 'zstd decompression works, so Accept-Encoding can advertise it' }
    : { name: 'zstd', status: 'warn', detail: 'this Node build cannot decompress zstd, so it is left out of Accept-Encoding' });

  checks.push({ name: 'temp-dir', ...writable(os.tmpdir(), 'streamed responses can spill to disk') });
  checks.push({ name: 'working-dir', ...writable(process.cwd(), 'cache and crawl state can be written') });

  for (const driver of OPTIONAL_DRIVERS) {
    checks.push(installed(driver.name)
      ? { name: `driver:${driver.name}`, status: 'pass', detail: `installed, so ${driver.purpose} is available` }
      : { name: `driver:${driver.name}`, status: 'warn', detail: `not installed, so ${driver.purpose} is unavailable (${driver.install})` });
  }

  if (!config.skipNetwork) {
    const host = config.host ?? 'example.com';
    try {
      await dns.promises.lookup(host);
      checks.push({ name: 'dns', status: 'pass', detail: `resolved ${host}` });
    } catch (error) {
      checks.push({ name: 'dns', status: 'fail', detail: `could not resolve ${host}: ${error.message}` });
    }
  }

  if (config.cdp) {
    const { httpGetJson } = require('../capture');
    const host = String(config.cdp);

    try {
      const version = await httpGetJson(`${host.replace(/\/$/, '')}/json/version`, { timeout: config.timeout ?? 3000 });
      checks.push({ name: 'cdp', status: 'pass', detail: `${host} answered as ${version.Browser ?? 'a DevTools endpoint'}` });
    } catch (error) {
      checks.push({ name: 'cdp', status: 'fail', detail: `${host} did not answer as a DevTools endpoint: ${error.message}` });
    }
  }

  const failures = checks.filter((item) => item.status === 'fail').length;

  return {
    ok: failures === 0,
    node: nodeVersion,
    platform: `${process.platform} ${process.arch}`,
    checks,
    failures,
    warnings: checks.filter((item) => item.status === 'warn').length,
  };
}

runDoctor.MIN_NODE = MIN_NODE;
runDoctor.SQLITE_NODE = SQLITE_NODE;
runDoctor.OPTIONAL_DRIVERS = OPTIONAL_DRIVERS;
runDoctor.compareVersions = compareVersions;

module.exports = runDoctor;
