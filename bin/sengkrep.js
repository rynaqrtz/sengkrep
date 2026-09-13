#!/usr/bin/env node
const sengkrep = require('../index');
const fs       = require('fs');
const path     = require('path');

function parseArgs(argv) {
  const args  = { _: [] };
  let i = 0;
  while (i < argv.length) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      if (eq > 2) {
        args[token.slice(2, eq)] = token.slice(eq + 1);
        i += 1;
      } else {
        const key = token.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) {
          args[key] = true;
          i += 1;
        } else {
          args[key] = next;
          i += 2;
        }
      }
    } else {
      args._.push(token);
      i += 1;
    }
  }
  return args;
}

function printHelp() {
  console.log(`sengkrep CLI

Usage:
  sengkrep fetch <url>
  sengkrep scrape <url> --schema '<json>' [options]
  sengkrep discover <origin>
  sengkrep capture <har|browser|proxy|playwright> [target] [options]
  sengkrep capture cookies <cookies.txt> [--domain <host>]
  sengkrep cookies <cookies.txt> [--domain <host>]
  sengkrep probe <url> [--json]
  sengkrep jobs <jobs.js> [--dir .sengkrep-jobs] [--json]
  sengkrep run <jobs.js> [--job <id> | --once | --due | --watch]
  sengkrep doctor [--host example.com] [--cdp http://127.0.0.1:9222] [--json]

Capture options:
  --out <path>          Write a HAR file with every captured request
  --json                Print the full analysis as JSON
  --all                 Include static assets, not only API calls
  --code                Print a fetch() snippet for the first endpoint
  --schema              Print an extraction schema for the first JSON endpoint
  --script              Print a runnable scraper script for the first JSON endpoint
  --script-out <path>   Write that script to a file instead of stdout
  --cdp <host>          DevTools endpoint (default: http://127.0.0.1:9222)
  --port <n>            Local capture proxy port (default: 8899)
  --seconds <n>         How long to keep the proxy open (default: 30)
  --headless=false      Show the browser when using playwright

Cookie options:
  --domain <host>       Only keep cookies for this host (repeatable with commas)
  --out <path>          Write an exported cookie jar as JSON

Options for probe:
  --method <verb>       Request method (default: GET)
  --proxy <url>         Route the request through a proxy
  --no-identity         Send the request without a rotated browser identity
  --json                Print the full verdict as JSON

Probe exits 0 when the response looks normal, 2 when a bot wall is detected,
and 1 on a request error, so a shell can branch on the result.

Options for scrape:
  --schema <json>       Required. Extraction schema as JSON string
  --format <fmt>        csv | json | ndjson | markdown (default: json)
  --output <path>       Write result to file instead of stdout
  --pages <n>           Paginate up to n pages
  --next <selector>     CSS selector for next-page link, or "auto"
  --items <selector>    CSS selector for repeated item containers
  --proxy <url>         Proxy URL to route requests through
  --delay <ms>          Base delay between requests
  --sink <json>         Sink descriptor, e.g. '{"type":"file","path":"out.jsonl","key":"id"}'

Options for jobs and run:
  --dir <path>          Job store directory (default: .sengkrep-jobs)
  --job <id>            Run a single job now and exit
  --once                Run every enabled job once and exit
  --due                 Run only the jobs whose slot has arrived
  --watch               Keep the scheduler running until Ctrl+C
  --catch-up            Also run a job missed while the process was down
  --concurrency <n>     How many jobs may run at once (default: 1)
  --json                Print job records as JSON

A jobs file exports an array of jobs or { jobs: [...], concurrency, catchUp }.
Each job needs an id, a schedule and a handler:

  module.exports = {
    concurrency: 2,
    jobs: [
      { id: 'sync', schedule: '*/15 * * * *', handler: async () => {} },
    ],
  }

Capture examples:
  sengkrep capture har session.har --out api.har --json
  sengkrep capture har session.har --schema --script-out scraper.js
  sengkrep capture browser https://app.example.com --cdp http://127.0.0.1:9222
  sengkrep capture proxy --port 8899 --seconds 60 --out session.har
  sengkrep capture playwright https://app.example.com --out session.har
  sengkrep capture cookies cookies.txt --domain example.com

Examples:
  sengkrep fetch https://example.com
  sengkrep scrape https://books.toscrape.com --schema '{"title":"h1"}' --format csv --output books.csv
  sengkrep probe https://example.com
  sengkrep run jobs.js --due
  sengkrep doctor --json
`);
}

function renderCapture(capture, endpoints, summary, includeStatic) {
  const byType = Object.entries(summary.byResourceType).map(([type, count]) => `${type}=${count}`).join(', ');
  const lines = [`Captured ${summary.total} request(s): ${byType || 'none'}`];

  if (endpoints.length === 0) {
    lines.push(includeStatic ? 'No endpoints in this capture.' : 'No API calls detected; re-run with --all for static assets.');
    return lines.join('\n');
  }

  lines.push('', `${includeStatic ? 'Endpoints' : 'API endpoints'}:`);
  for (const endpoint of endpoints.slice(0, 50)) {
    const statuses = Object.keys(endpoint.statuses).join('/');
    lines.push(`  ${endpoint.method} ${endpoint.template}  [${endpoint.count}x, ${statuses}]`);
  }
  if (endpoints.length > 50) lines.push(`  ... ${endpoints.length - 50} more`);
  return lines.join('\n');
}

const DOCTOR_STATUS = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' };

function renderDoctor(report) {
  const lines = [
    `sengkrep doctor: Node ${report.node}, ${report.platform}`,
    report.ok ? 'All required checks passed.' : `${report.failures} required check(s) failed.`,
    '',
  ];

  const width = Math.max(...report.checks.map((check) => check.name.length));

  for (const check of report.checks) {
    lines.push(`  ${DOCTOR_STATUS[check.status]}  ${check.name.padEnd(width)}  ${check.detail}`);
  }

  if (report.warnings > 0) {
    lines.push('', `${report.warnings} optional check(s) warned; the matching feature stays unavailable.`);
  }

  return lines.join('\n');
}

function loadJobs(file) {
  if (!file) throw new Error('Usage: sengkrep jobs <jobs.js>');

  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) throw new Error(`Jobs file not found: ${resolved}`);

  const loaded = require(resolved);
  const value = typeof loaded === 'function' ? loaded(sengkrep) : loaded;
  const config = Array.isArray(value) ? { jobs: value } : value;

  if (!config || !Array.isArray(config.jobs)) {
    throw new Error('A jobs file must export an array of jobs or an object with a jobs array');
  }

  return config;
}

function storeOptions(args, config) {
  return {
    backend: 'file',
    storageDir: typeof args.dir === 'string' ? args.dir : config.storageDir ?? '.sengkrep-jobs',
    concurrency: args.concurrency ? parseInt(args.concurrency, 10) : config.concurrency,
    catchUp: Boolean(args['catch-up'] ?? config.catchUp),
  };
}

function humanizeDuration(ms) {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours}h${minutes % 60}m` : `${hours}h`;

  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days}d${hours % 24}h` : `${days}d`;
}

function jobRows(records) {
  const now = Date.now();
  return records.map((record) => ({
    id: record.id,
    schedule: sengkrep.cron.scheduleLabel(record.schedule),
    next: Number.isFinite(record.nextRunAt)
      ? `${record.nextRunAt <= now ? 'due' : humanizeDuration(record.nextRunAt - now)} (${new Date(record.nextRunAt).toISOString()})`
      : 'never',
    last: record.lastStatus ?? 'never',
    runs: record.runs ?? 0,
    failures: record.failures ?? 0,
    missed: record.missed ?? 0,
    enabled: record.enabled,
  }));
}

function renderJobs(rows) {
  if (rows.length === 0) return 'No jobs registered.';

  const headers = { id: 'JOB', schedule: 'SCHEDULE', next: 'NEXT', last: 'LAST', runs: 'RUNS', failures: 'FAILED', missed: 'MISSED' };
  const keys = Object.keys(headers);
  const width = {};

  for (const key of keys) {
    width[key] = Math.max(headers[key].length, ...rows.map((row) => String(row[key]).length));
  }

  const line = (values) => keys.map((key, index) => values[index].padEnd(width[key])).join('  ').trimEnd();

  return [
    line(keys.map((key) => headers[key])),
    line(keys.map((key) => '-'.repeat(width[key]))),
    ...rows.map((row) => line(keys.map((key) => String(row[key])))),
  ].join('\n');
}

function formatRecord(record) {
  return `${record.id}: ${record.lastStatus ?? 'never'} after ${record.lastDurationMs ?? 0}ms (runs=${record.runs ?? 0}, failures=${record.failures ?? 0})`;
}

async function listJobs(args) {
  const file = args._[0];
  const config = loadJobs(file);
  const scheduler = new sengkrep.Scheduler(storeOptions(args, config));

  for (const job of config.jobs) {
    if (!job || !job.id) continue;
    scheduler.add(job, typeof job.handler === 'function' ? job.handler : () => {});
  }

  const records = scheduler.list();
  if (args.json) {
    process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${renderJobs(jobRows(records))}\n`);
}

async function runJobs(args) {
  const file = args._[0];
  const config = loadJobs(file);
  const scheduler = new sengkrep.Scheduler({
    ...storeOptions(args, config),
    logger: { warn: (message) => process.stderr.write(`${message}\n`) },
  });

  let failures = 0;

  for (const job of config.jobs) {
    if (typeof job.handler !== 'function') throw new Error(`Job "${job.id}" needs a handler function`);
    scheduler.add(job, job.handler);
  }

  scheduler.on('run', ({ job }) => process.stdout.write(`ok   ${formatRecord(job)}\n`));
  scheduler.on('run:error', ({ job, error }) => {
    failures += 1;
    process.stdout.write(`FAIL ${job.id}: ${error.message}\n`);
  });

  if (args.job) {
    const record = await scheduler.runNow(String(args.job));
    if (record.lastStatus === 'error') failures += 1;
    if (args.json) process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
    process.exitCode = failures > 0 ? 1 : 0;
    return;
  }

  if (args.once || args.due) {
    const now = Date.now();
    const targets = scheduler.list().filter((record) => record.enabled
      && (!args.due || (Number.isFinite(record.nextRunAt) && record.nextRunAt <= now)));

    if (targets.length === 0) {
      process.stdout.write('No jobs to run.\n');
      return;
    }

    for (const record of targets) await scheduler.runNow(record.id);
    process.exitCode = failures > 0 ? 1 : 0;
    return;
  }

  if (args.watch) {
    await scheduler.start();
    process.stdout.write('Watching scheduled jobs. Press Ctrl+C to stop.\n');

    await new Promise((resolve) => {
      const stop = () => resolve();
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });

    await scheduler.stop({ wait: true });
    process.stdout.write('Scheduler stopped.\n');
    process.exitCode = failures > 0 ? 1 : 0;
    return;
  }

  throw new Error('Usage: sengkrep run <jobs.js> [--job <id> | --once | --due | --watch]');
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (args.help || args.h) {
    printHelp();
    return;
  }

  if (command === 'fetch') {
    const url = args._[0];
    if (!url) throw new Error('Usage: sengkrep fetch <url>');
    const res = await sengkrep.fetch(url);
    process.stdout.write(res.body + '\n');
    return;
  }

  if (command === 'discover') {
    const origin = args._[0];
    if (!origin) throw new Error('Usage: sengkrep discover <origin>');
    const urls = await sengkrep.discover(origin);
    console.log(urls.join('\n'));
    return;
  }

  if (command === 'doctor') {
    const report = await sengkrep.doctor({
      host: typeof args.host === 'string' ? args.host : undefined,
      cdp: typeof args.cdp === 'string' ? args.cdp : undefined,
      skipNetwork: Boolean(args['skip-network']),
    });

    if (args.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`${renderDoctor(report)}\n`);
    }

    if (!report.ok) process.exitCode = 1;
    return;
  }

  if (command === 'jobs') {
    await listJobs(args);
    return;
  }

  if (command === 'run') {
    await runJobs(args);
    return;
  }

  if (command === 'probe') {
    const url = args._[0];
    if (!url) throw new Error('Usage: sengkrep probe <url> [--json]');

    const scraper = sengkrep.create({
      logLevel: 'error',
      proxies: args.proxy ? [args.proxy] : [],
      identity: args['no-identity'] ? undefined : true,
      blocks: true,
    });

    let result;
    try {
      result = await scraper.probe(url, {
        request: typeof args.method === 'string' ? { method: args.method } : {},
      });
    } finally {
      scraper.close();
    }

    if (args.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      const verdict = result.verdict;
      const lines = [
        `url         ${result.finalUrl}`,
        `status      ${result.status}`,
        `blocked     ${result.blocked ? 'yes' : 'no'}`,
        `vendor      ${verdict.vendorName ?? verdict.vendor ?? 'none'}`,
        `kind        ${verdict.kind ?? 'none'}`,
        `confidence  ${verdict.confidence}`,
        `signals     ${verdict.signals.length > 0 ? verdict.signals.join(', ') : 'none'}`,
      ];
      process.stdout.write(`${lines.join('\n')}\n`);
    }

    if (result.blocked) process.exitCode = 2;
    return;
  }

  if (command === 'scrape') {
    const url = args._[0];
    if (!url) throw new Error('Usage: sengkrep scrape <url> --schema \'<json>\'');
    if (!args.schema) throw new Error('--schema is required, e.g. --schema \'{"title":"h1"}\'');

    const schema = JSON.parse(args.schema);
    const scraper = sengkrep.create({
      logLevel: 'warn',
      proxies: args.proxy ? [args.proxy] : [],
      delay:   args.delay ? parseInt(args.delay, 10) : undefined,
    });

    const exportOptions = { format: args.format ?? 'json' };
    if (args.output) exportOptions.path = args.output;

    if (args.sink) {
      try {
        exportOptions.sink = JSON.parse(args.sink);
      } catch {
        throw new Error('--sink must be a JSON object, e.g. --sink \'{"type":"file","path":"out.jsonl","key":"id"}\'');
      }
    }

    if (args.pages) {
      exportOptions.pagination = {
        nextSelector:  args.next ?? 'auto',
        itemsSelector: args.items ?? null,
        maxPages:      parseInt(args.pages, 10),
      };
    }

    let output;
    try {
      output = await scraper.export(url, schema, exportOptions);
    } finally {
      scraper.close();
    }

    if (args.output) {
      console.log(`Written to ${args.output}`);
    } else {
      process.stdout.write(output + '\n');
    }
    return;
  }

  if (command === 'capture' || command === 'cookies') {
    const [source, target] = args._;
    if (!source) throw new Error('Usage: sengkrep capture <har|browser|proxy|playwright> [target]');

    if (command === 'cookies' || source === 'cookies') {
      const file = command === 'cookies' ? source : target;
      if (!file) throw new Error('Usage: sengkrep capture cookies <cookies.txt> [--domain example.com]');

      const domains = typeof args.domain === 'string'
        ? args.domain.split(',').map((domain) => domain.trim()).filter(Boolean)
        : null;
      const parsed = sengkrep.capture.cookies.parseCookieFile(fs.readFileSync(file, 'utf8'));
      const kept = domains ? parsed.filter((cookie) => domains.includes(cookie.domain)) : parsed;

      if (args.out) {
        fs.writeFileSync(args.out, `${JSON.stringify(kept, null, 2)}\n`);
        console.log(`Wrote ${kept.length} cookie(s) to ${args.out}`);
      } else {
        process.stdout.write(`${JSON.stringify(kept, null, 2)}\n`);
      }
      return;
    }

    const includeStatic = Boolean(args.all);
    let capture;

    if (source === 'har') {
      if (!target) throw new Error('Usage: sengkrep capture har <file.har>');
      capture = sengkrep.capture.NetworkCapture.fromHar(target);
    } else if (source === 'browser' || source === 'cdp') {
      if (!target) throw new Error('Usage: sengkrep capture browser <url> [--cdp http://127.0.0.1:9222]');
      capture = await sengkrep.capture.NetworkCapture.fromCdp({
        url: target,
        host: typeof args.cdp === 'string' ? args.cdp : undefined,
      });
    } else if (source === 'playwright') {
      if (!target) throw new Error('Usage: sengkrep capture playwright <url>');
      capture = await sengkrep.capture.NetworkCapture.fromPlaywright(target, {
        headless: args.headless !== 'false',
      });
    } else if (source === 'proxy') {
      const started = await sengkrep.capture.NetworkCapture.fromProxy({
        port: args.port ? parseInt(args.port, 10) : 8899,
      });
      capture = started.capture;
      console.log(`Capture proxy listening on ${started.proxy.address.url}`);
      console.log('Route your client through it, e.g.:');
      console.log(`  curl -x ${started.proxy.address.url} http://example.com`);
      const seconds = args.seconds ? parseInt(args.seconds, 10) : 30;
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      capture.add(started.proxy.entries);
      await started.proxy.stop();
    } else {
      throw new Error(`Unknown capture source: ${source}`);
    }

    const endpoints = capture.endpoints({ all: includeStatic });
    const summary = capture.summary();

    const jsonEndpoint = endpoints.find((endpoint) => endpoint.schema) ?? null;
    const prefix = (endpoints[0]?.template ?? '').split(':id')[0];
    const apiEntries = capture.api().entries;
    const firstApiEntry = apiEntries.find((entry) => prefix && entry.url.startsWith(prefix)) ?? apiEntries[0] ?? null;

    if (args.out) {
      capture.saveHar(args.out);
      console.log(`HAR written to ${args.out}`);
    }

    if (args.code && firstApiEntry) {
      console.log(`${capture.toFetchCode(firstApiEntry)}\n`);
    }

    const wantsCode = Boolean(args.schema || args.script || args['script-out']);

    if (args.schema || args.script || args['script-out']) {
      if (!jsonEndpoint) throw new Error('No JSON endpoint in this capture; re-run with --all or check the source');

      if (args.schema) process.stdout.write(`${JSON.stringify(capture.toSchema(jsonEndpoint), null, 2)}\n`);

      if (args.script || args['script-out']) {
        const script = capture.toScript(jsonEndpoint);
        if (args['script-out']) {
          fs.writeFileSync(args['script-out'], script);
          console.log(`Script written to ${args['script-out']}`);
        } else {
          process.stdout.write(script);
        }
      }
    }

    if (wantsCode && !args.json) return;

    if (args.json) {
      process.stdout.write(`${JSON.stringify(capture.toJSON({ all: includeStatic }), null, 2)}\n`);
    } else {
      process.stdout.write(`${renderCapture(capture, endpoints, summary, includeStatic)}\n`);
    }
    return;
  }

  throw new Error(`Unknown command: ${command}. Run "sengkrep help" for usage.`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
