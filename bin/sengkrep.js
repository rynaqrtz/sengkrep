#!/usr/bin/env node
const sengkrep = require('../index');
const fs       = require('fs');

function parseArgs(argv) {
  const args  = { _: [] };
  let i = 0;
  while (i < argv.length) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
        i += 1;
      } else {
        args[key] = next;
        i += 2;
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

Capture examples:
  sengkrep capture har session.har --out api.har --json
  sengkrep capture har session.har --schema --script-out scraper.js
  sengkrep capture browser https://app.example.com --cdp http://127.0.0.1:9222
  sengkrep capture proxy --port 8899 --seconds 60 --out session.har
  sengkrep capture playwright https://app.example.com --out session.har
  sengkrep capture cookies cookies.txt --domain example.com

Options for scrape:
  --schema <json>       Required. Extraction schema as JSON string
  --format <fmt>        csv | json | ndjson | markdown (default: json)
  --output <path>       Write result to file instead of stdout
  --pages <n>           Paginate up to n pages
  --next <selector>     CSS selector for next-page link, or "auto"
  --items <selector>    CSS selector for repeated item containers
  --proxy <url>         Proxy URL to route requests through
  --delay <ms>          Base delay between requests

Examples:
  sengkrep fetch https://example.com
  sengkrep scrape https://books.toscrape.com --schema '{"title":"h1"}' --format csv --output books.csv
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

    if (args.pages) {
      exportOptions.pagination = {
        nextSelector:  args.next ?? 'auto',
        itemsSelector: args.items ?? null,
        maxPages:      parseInt(args.pages, 10),
      };
    }

    const output = await scraper.export(url, schema, exportOptions);

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
