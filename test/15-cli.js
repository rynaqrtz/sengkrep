const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { ready, closeAll } = require('./server');
const { test, assert, delay, finish } = require('./harness');

const BASE = 'http://127.0.0.1:9911';
const CLI  = path.join(__dirname, '..', 'bin', 'sengkrep.js');
const TMP  = fs.mkdtempSync(path.join(os.tmpdir(), 'sengkrep-cli-'));

function write(name, contents) {
  const file = path.join(TMP, name);
  fs.writeFileSync(file, contents);
  return file;
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: TMP,
    encoding: 'utf8',
    timeout: options.timeout ?? 60000,
  });
}

function runCliAsync(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd: TMP });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('exit', (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}

async function main() {
  const { httpsAvailable } = await ready;
  assert.strictEqual(httpsAvailable, true);

  await test('help documents the new commands', () => {
    const result = runCli(['help']);
    assert.strictEqual(result.status, 0);
    for (const needle of ['sengkrep jobs', 'sengkrep run', 'sengkrep doctor', '--sink <json>', '--catch-up', '--concurrency']) {
      assert.ok(result.stdout.includes(needle), `help is missing "${needle}"`);
    }
  });

  await test('--flag=value is parsed instead of becoming part of the key', async () => {
    const output = path.join(TMP, 'books.json');
    const result = await runCliAsync([
      'scrape', `${BASE}/html`,
      '--schema', '{"title":"#title"}',
      '--format', 'json',
      `--output=${output}`,
    ]);

    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(output), `expected ${output} to exist; stdout was ${result.stdout}`);
    assert.ok(fs.readFileSync(output, 'utf8').includes('Hello Sengkrep'));
  });

  await test('scrape writes through a sink descriptor', async () => {
    const rows = path.join(TMP, 'rows.jsonl');
    const result = await runCliAsync([
      'scrape', `${BASE}/html`,
      '--schema', '{"title":"#title"}',
      '--sink', JSON.stringify({ type: 'file', path: rows, key: 'title', format: 'jsonl' }),
    ]);

    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(rows), `expected ${rows} to exist; stdout was ${result.stdout}`);
    assert.ok(fs.readFileSync(rows, 'utf8').includes('Hello Sengkrep'));
  });

  await test('scrape rejects a malformed sink descriptor', () => {
    const result = runCli(['scrape', `${BASE}/html`, '--schema', '{"title":"#title"}', '--sink', '{not json}']);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('--sink must be a JSON object'), result.stderr);
  });

  await test('doctor reports a structured result and exits zero on a healthy host', () => {
    const result = runCli(['doctor', '--skip-network', '--json']);
    assert.strictEqual(result.status, 0, result.stderr);

    const report = JSON.parse(result.stdout);
    assert.strictEqual(report.ok, true);
    assert.strictEqual(report.failures, 0);
    assert.ok(Array.isArray(report.checks) && report.checks.length > 0);
    assert.ok(report.checks.some((check) => check.name === 'node' && check.status === 'pass'));
    assert.ok(report.checks.some((check) => check.name === 'temp-dir' && check.status === 'pass'));
  });

  await test('doctor checks the network by default', () => {
    const result = runCli(['doctor', '--host', '127.0.0.1', '--json']);
    assert.strictEqual(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.ok(report.checks.some((check) => check.name === 'dns'));
  });

  await test('doctor fails when the DevTools endpoint does not answer', () => {
    const result = runCli(['doctor', '--skip-network', '--cdp', 'http://127.0.0.1:9', '--json']);
    assert.strictEqual(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.ok(report.checks.some((check) => check.name === 'cdp' && check.status === 'fail'));
  });

  write('jobs.js', `
module.exports = {
  concurrency: 2,
  jobs: [
    { id: 'alpha', schedule: '*/5 * * * *', handler: async () => ({ tag: 'a' }) },
    { id: 'beta',  schedule: { every: '1h' }, handler: async () => ({ tag: 'b' }) },
  ],
};
`);

  await test('jobs lists schedules and next run times', () => {
    const result = runCli(['jobs', 'jobs.js', '--dir', 'jobs-store']);
    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('alpha'), result.stdout);
    assert.ok(result.stdout.includes('beta'), result.stdout);
    assert.ok(result.stdout.includes('*/5 * * * *'), result.stdout);
    assert.ok(result.stdout.includes('every 1h'), result.stdout);
    assert.ok(result.stdout.includes('NEXT'), result.stdout);
  });

  await test('jobs --json prints the stored records', () => {
    const result = runCli(['jobs', 'jobs.js', '--dir', 'jobs-store', '--json']);
    assert.strictEqual(result.status, 0, result.stderr);

    const records = JSON.parse(result.stdout);
    assert.deepStrictEqual(records.map((record) => record.id), ['alpha', 'beta']);
    assert.strictEqual(records[0].enabled, true);
  });

  await test('run --once runs every enabled job', () => {
    const result = runCli(['run', 'jobs.js', '--dir', 'once-store', '--once']);
    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('ok   alpha'), result.stdout);
    assert.ok(result.stdout.includes('ok   beta'), result.stdout);
  });

  await test('run --job runs a single job and persists its counters', () => {
    const result = runCli(['run', 'jobs.js', '--dir', 'job-store', '--job', 'alpha']);
    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('ok   alpha'), result.stdout);
    assert.ok(!result.stdout.includes('beta'), result.stdout);

    const listed = runCli(['jobs', 'jobs.js', '--dir', 'job-store', '--json']);
    const alpha = JSON.parse(listed.stdout).find((record) => record.id === 'alpha');
    assert.strictEqual(alpha.runs, 1);
    assert.strictEqual(alpha.lastStatus, 'ok');
  });

  await test('run --job fails when the job id is unknown', () => {
    const result = runCli(['run', 'jobs.js', '--dir', 'job-store', '--job', 'nope']);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('No scheduled job with id "nope"'), result.stderr);
  });

  write('due.js', `
module.exports = [
  { id: 'past', schedule: { at: new Date(Date.now() - 60000).toISOString() }, handler: async () => 'ran' },
  { id: 'future', schedule: { every: '1h' }, handler: async () => 'waited' },
];
`);

  await test('run --due runs only the job whose slot has arrived', () => {
    const result = runCli(['run', 'due.js', '--dir', 'due-store', '--due']);
    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('ok   past'), result.stdout);
    assert.ok(!result.stdout.includes('future'), result.stdout);
  });

  await test('run --due reports when nothing is due', () => {
    const result = runCli(['run', 'jobs.js', '--dir', 'nothing-store', '--due']);
    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('No jobs to run.'), result.stdout);
  });

  await test('run exits non zero when a handler throws', () => {
    write('broken.js', `
module.exports = [
  { id: 'boom', schedule: { every: '1h' }, handler: async () => { throw new Error('handler exploded'); } },
];
`);
    const result = runCli(['run', 'broken.js', '--dir', 'broken-store', '--once']);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stdout.includes('FAIL boom: handler exploded'), result.stdout);
  });

  await test('run without a mode explains its usage', () => {
    const result = runCli(['run', 'jobs.js', '--dir', 'useless-store']);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('Usage: sengkrep run'), result.stderr);
  });

  write('watch.js', `
module.exports = [
  { id: 'tick', schedule: { everyMs: 150 }, handler: async () => null },
];
`);

  await test('run --watch keeps the scheduler alive until SIGINT', async () => {
    const child = spawn(process.execPath, [CLI, 'run', 'watch.js', '--dir', 'watch-store', '--watch'], { cwd: TMP });
    let output = '';

    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });

    const deadline = Date.now() + 15000;
    while (!output.includes('ok   tick') && Date.now() < deadline) await delay(50);

    assert.ok(output.includes('Watching scheduled jobs'), output);
    assert.ok(output.includes('ok   tick'), `watch never ran the job: ${output}`);

    child.kill('SIGINT');
    const code = await new Promise((resolve) => child.once('exit', resolve));
    assert.strictEqual(code, 0);
    assert.ok(output.includes('Scheduler stopped.'), output);
  });

  await test('capture cookies still parses a Netscape cookie file', () => {
    const file = write('cookies.txt', [
      '# Netscape HTTP Cookie File',
      'example.com\tTRUE\t/\tFALSE\t1900000000\tsid\tabc123',
      '#HttpOnly_.example.com\tTRUE\t/\tTRUE\t1900000000\thttp\tonly',
      '',
    ].join('\n'));

    const result = runCli(['capture', 'cookies', file, '--domain', 'example.com']);
    assert.strictEqual(result.status, 0, result.stderr);

    const cookies = JSON.parse(result.stdout);
    assert.strictEqual(cookies.length, 2);
    assert.strictEqual(cookies[0].name, 'sid');
    assert.strictEqual(cookies[0].httpOnly, false);
    assert.strictEqual(cookies[1].httpOnly, true);
  });

  await test('an unknown command lists no side effects', () => {
    const result = runCli(['teleport']);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('Unknown command: teleport'), result.stderr);
  });

  finish('15-cli');
  closeAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
