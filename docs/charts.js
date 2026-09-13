const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const CARD = { bg: '#ffffff', border: '#d8dee4', title: '#1f2328', label: '#57606a', value: '#1f2328' };
const ACCENT = { yes: '#1a7f37', no: '#8c959f', bar: '#0969da', total: '#8250df' };

const CAPTURE_COLUMNS = [
  { key: 'httpsBody', label: 'HTTPS body' },
  { key: 'frames', label: 'WebSocket frames' },
  { key: 'headers', label: 'Response headers' },
  { key: 'noInstall', label: 'No extra install' },
  { key: 'needsBrowser', label: 'Needs a browser' },
  { key: 'offline', label: 'Works offline' },
];

const CAPTURE_SOURCES = [
  { name: 'CdpCapture', note: 'your Chrome, no dependency', httpsBody: 'yes', frames: 'yes', headers: 'yes', noInstall: 'yes', needsBrowser: 'yes', offline: 'no' },
  { name: 'PlaywrightCapture', note: 'when Playwright is already there', httpsBody: 'yes', frames: 'no', headers: 'yes', noInstall: 'no', needsBrowser: 'yes', offline: 'no' },
  { name: 'CaptureProxy', note: 'any client through a local proxy', httpsBody: 'no', frames: 'no', headers: 'yes', noInstall: 'yes', needsBrowser: 'no', offline: 'no' },
  { name: 'HarImporter', note: 'a file recorded earlier', httpsBody: 'yes', frames: 'no', headers: 'yes', noInstall: 'yes', needsBrowser: 'no', offline: 'yes' },
];

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function dot(x, y, state) {
  if (state === 'yes') return `<circle cx="${x}" cy="${y}" r="5.5" fill="${ACCENT.yes}"/>`;
  if (state === 'partial') return `<circle cx="${x}" cy="${y}" r="5.5" fill="none" stroke="${ACCENT.yes}" stroke-width="2"/><path d="M ${x} ${y - 5.5} A 5.5 5.5 0 0 1 ${x} ${y + 5.5} Z" fill="${ACCENT.yes}"/>`;
  return `<circle cx="${x}" cy="${y}" r="4.5" fill="none" stroke="${ACCENT.no}" stroke-width="2"/>`;
}

function captureMatrixSvg() {
  const width = 940;
  const rowHeight = 46;
  const headerHeight = 78;
  const footerHeight = 46;
  const height = headerHeight + CAPTURE_SOURCES.length * rowHeight + footerHeight;
  const labelWidth = 300;
  const columnWidth = (width - labelWidth - 28) / CAPTURE_COLUMNS.length;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="What each capture source records">`,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${CARD.bg}" stroke="${CARD.border}"/>`,
    `<text x="24" y="36" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="17" font-weight="600" fill="${CARD.title}">What each capture source records</text>`,
    `<text x="24" y="59" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="12.5" fill="${CARD.label}">Measured against the fixtures in test/08-network-capture.js and test/10-renderer-and-codegen.js</text>`,
  ];

  CAPTURE_COLUMNS.forEach((column, index) => {
    const x = labelWidth + columnWidth * index + columnWidth / 2;
    parts.push(`<text x="${x}" y="${headerHeight - 8}" text-anchor="middle" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="${CARD.label}">${esc(column.label)}</text>`);
  });

  CAPTURE_SOURCES.forEach((source, row) => {
    const top = headerHeight + row * rowHeight;
    const centerY = top + rowHeight / 2;

    if (row > 0) {
      parts.push(`<line x1="24" y1="${top}" x2="${width - 24}" y2="${top}" stroke="${CARD.border}" stroke-width="1"/>`);
    }

    parts.push(`<text x="24" y="${centerY - 1}" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="13.5" font-weight="600" fill="${CARD.title}">${esc(source.name)}</text>`);
    parts.push(`<text x="24" y="${centerY + 16}" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="11.5" fill="${CARD.label}">${esc(source.note)}</text>`);

    CAPTURE_COLUMNS.forEach((column, index) => {
      const x = labelWidth + columnWidth * index + columnWidth / 2;
      parts.push(dot(x, centerY, source[column.key]));
    });
  });

  const legendY = height - 18;
  parts.push(dot(width - 330, legendY - 4, 'yes'));
  parts.push(`<text x="${width - 316}" y="${legendY}" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="11.5" fill="${CARD.label}">full</text>`);
  parts.push(dot(width - 262, legendY - 4, 'partial'));
  parts.push(`<text x="${width - 248}" y="${legendY}" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="11.5" fill="${CARD.label}">partial</text>`);
  parts.push(dot(width - 176, legendY - 4, 'no'));
  parts.push(`<text x="${width - 162}" y="${legendY}" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="11.5" fill="${CARD.label}">not recorded</text>`);

  parts.push('</svg>');
  return parts.join('\n');
}

function collectTestResults() {
  const output = execFileSync(process.execPath, [path.join(ROOT, 'test', 'run-all.js')], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  const rows = [];
  for (const line of output.split('\n')) {
    const match = line.match(/^([\w-]+):\s+(\d+) passed, (\d+) failed/);
    if (match) rows.push({ name: match[1], passed: Number(match[2]), failed: Number(match[3]) });
  }

  return rows;
}

function testResultsSvg(rows) {
  const width = 940;
  const rowHeight = 30;
  const headerHeight = 92;
  const footerHeight = 34;
  const height = headerHeight + rows.length * rowHeight + footerHeight;
  const labelWidth = 268;
  const chartWidth = width - labelWidth - 96;

  const totalPassed = rows.reduce((sum, row) => sum + row.passed, 0);
  const totalFailed = rows.reduce((sum, row) => sum + row.failed, 0);
  const max = Math.max(...rows.map((row) => row.passed));

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Test suite results per file">`,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${CARD.bg}" stroke="${CARD.border}"/>`,
    `<text x="24" y="36" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="17" font-weight="600" fill="${CARD.title}">Test suite results</text>`,
    `<text x="24" y="59" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="12.5" fill="${CARD.label}">${totalPassed} passed, ${totalFailed} failed across ${rows.length} files, all against local fixture servers</text>`,
  ];

  rows.forEach((row, index) => {
    const top = headerHeight + index * rowHeight;
    const barWidth = Math.max(3, Math.round((row.passed / max) * chartWidth));

    parts.push(`<text x="24" y="${top + 16}" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="12" fill="${CARD.label}">${esc(row.name)}</text>`);
    parts.push(`<rect x="${labelWidth}" y="${top + 5}" width="${barWidth}" height="14" rx="4" fill="${ACCENT.bar}"/>`);
    parts.push(`<text x="${labelWidth + barWidth + 10}" y="${top + 16}" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="${CARD.value}">${row.passed}</text>`);
  });

  const top = headerHeight + rows.length * rowHeight;
  parts.push(`<line x1="24" y1="${top}" x2="${width - 24}" y2="${top}" stroke="${CARD.border}" stroke-width="1"/>`);
  parts.push(`<text x="24" y="${top + 24}" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="${ACCENT.total}">total</text>`);
  parts.push(`<text x="${width - 24}" y="${top + 24}" text-anchor="end" font-family="ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="${ACCENT.total}">${totalPassed} passed</text>`);
  parts.push('</svg>');
  return parts.join('\n');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectCaptureStats() {
  const { ready, closeAll } = require(path.join(ROOT, 'test', 'server.js'));
  const sengkrep = require(path.join(ROOT, 'index.js'));

  await ready;

  const proxy = new sengkrep.CaptureProxy({});
  await proxy.start();

  const scraper = sengkrep.create({
    logLevel: 'error',
    retry: { max: 0 },
    delayMin: 0,
    delayMax: 0,
    proxies: [proxy.address.url],
  });

  const origin = 'http://127.0.0.1:9911';
  const targets = [
    '/html',
    '/json',
    '/items',
    '/items/17',
    '/items/8321',
    '/items/9001',
    '/data.csv',
    '/feed.xml',
    '/wp-json/wp/v2/posts',
    '/rate-limited-api',
    '/structured',
    '/inference-list',
    '/missing-page',
  ];

  try {
    for (const target of targets) {
      try {
        await scraper.fetch(`${origin}${target}`);
      } catch {
        continue;
      }
    }

    await sleep(250);

    const capture = new sengkrep.NetworkCapture({ source: 'proxy' });
    capture.pull(proxy);
    await proxy.stop();

    const entries = capture.entries;
    const endpoints = capture.endpoints({ all: true });
    const summary = capture.summary();

    const bytes = entries.reduce((sum, entry) => sum + (entry.responseSize ?? 0), 0);
    const collapsed = endpoints.reduce((sum, endpoint) => sum + Math.max(0, endpoint.count - 1), 0);
    const withBody = entries.filter((entry) => entry.responseBody).length;
    const api = capture.api().entries.length;

    const tiles = [
      { label: 'Requests captured', value: String(entries.length), note: `${targets.length} URLs requested` },
      { label: 'Endpoints found', value: String(endpoints.length), note: `${api} of them carried JSON` },
      { label: 'Folded into templates', value: String(collapsed), note: '/items/17, /items/8321 and /items/9001 share /items/:id' },
      { label: 'Response bytes recorded', value: String(bytes), note: `${withBody} bodies kept, ${entries.length} header sets` },
    ];

    const bars = endpoints
      .slice(0, 6)
      .map((endpoint) => {
        const path_ = endpoint.path.length > 44 ? `${endpoint.path.slice(0, 41)}...` : endpoint.path;
        return { label: `${endpoint.method} ${path_}`, value: endpoint.count };
      });

    const statuses = Object.entries(summary.byStatus)
      .map(([status, count]) => `${status} x${count}`)
      .join(', ');

    return {
      tiles,
      bars,
      footer: `Statuses: ${statuses}. Every entry carries ${Object.keys(entries[0] ?? {}).length} normalized fields`,
    };
  } finally {
    scraper.close();
    closeAll();
  }
}

function captureStatsSvg(stats) {
  const width = 940;
  const tileTop = 84;
  const tileHeight = 92;
  const gap = 14;
  const tileWidth = (width - 48 - gap * (stats.tiles.length - 1)) / stats.tiles.length;
  const barsTitle = tileTop + tileHeight + 44;
  const rowHeight = 26;
  const barsTop = barsTitle + 18;
  const height = barsTop + stats.bars.length * rowHeight + 58;

  const font = 'ui-sans-serif, -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
  const max = Math.max(...stats.bars.map((bar) => bar.value), 1);
  const labelWidth = 190;
  const barWidth = width - labelWidth - 96;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Network capture measured end to end">`,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${CARD.bg}" stroke="${CARD.border}"/>`,
    `<text x="24" y="36" font-family="${font}" font-size="17" font-weight="600" fill="${CARD.title}">Network capture, measured end to end</text>`,
    `<text x="24" y="58" font-family="${font}" font-size="12.5" fill="${CARD.label}">A CaptureProxy in front of the fixture server, then analyzed by NetworkCapture. Regenerate with node docs/charts.js</text>`,
  ];

  stats.tiles.forEach((tile, index) => {
    const x = 24 + index * (tileWidth + gap);
    parts.push(`<rect x="${x}" y="${tileTop}" width="${tileWidth}" height="${tileHeight}" rx="8" fill="#f6f8fa" stroke="${CARD.border}"/>`);
    parts.push(`<text x="${x + 14}" y="${tileTop + 38}" font-family="${font}" font-size="26" font-weight="700" fill="${CARD.value}">${esc(tile.value)}</text>`);
    parts.push(`<text x="${x + 14}" y="${tileTop + 60}" font-family="${font}" font-size="12.5" font-weight="600" fill="${CARD.title}">${esc(tile.label)}</text>`);
    parts.push(`<text x="${x + 14}" y="${tileTop + 77}" font-family="${font}" font-size="11" fill="${CARD.label}">${esc(tile.note)}</text>`);
  });

  parts.push(`<text x="24" y="${barsTitle}" font-family="${font}" font-size="13" font-weight="600" fill="${CARD.title}">Requests per endpoint</text>`);

  stats.bars.forEach((bar, index) => {
    const top = barsTop + index * rowHeight;
    const width_ = Math.max(4, Math.round((bar.value / max) * barWidth));
    parts.push(`<text x="24" y="${top + 14}" font-family="${font}" font-size="12" fill="${CARD.label}">${esc(bar.label)}</text>`);
    parts.push(`<rect x="${labelWidth}" y="${top + 4}" width="${width_}" height="13" rx="4" fill="${ACCENT.bar}"/>`);
    parts.push(`<text x="${labelWidth + width_ + 9}" y="${top + 14}" font-family="${font}" font-size="12" font-weight="600" fill="${CARD.value}">${bar.value}</text>`);
  });

  const footerY = height - 16;
  parts.push(`<text x="24" y="${footerY}" font-family="${font}" font-size="11.5" fill="${CARD.label}">${esc(stats.footer)}</text>`);
  parts.push('</svg>');
  return parts.join('\n');
}

async function main() {
  const matrix = captureMatrixSvg();
  fs.writeFileSync(path.join(__dirname, 'capture-sources.svg'), `${matrix}\n`);

  const rows = collectTestResults();
  if (rows.length === 0) {
    throw new Error('No test results were parsed from test/run-all.js');
  }
  fs.writeFileSync(path.join(__dirname, 'test-results.svg'), `${testResultsSvg(rows)}\n`);

  const stats = await collectCaptureStats();
  fs.writeFileSync(path.join(__dirname, 'capture-stats.svg'), `${captureStatsSvg(stats)}\n`);

  process.stdout.write('capture-sources.svg written\n');
  process.stdout.write(`test-results.svg written (${rows.reduce((sum, row) => sum + row.passed, 0)} tests, ${rows.length} files)\n`);
  process.stdout.write(`capture-stats.svg written (${stats.tiles[0].value} requests, ${stats.tiles[1].value} endpoints)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
