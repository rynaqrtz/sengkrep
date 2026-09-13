const { ready, closeAll } = require('../test/server');
const sengkrep = require('../index');
const contentSafety = require('../src/utils/contentSafety');
const ContentDedup = require('../src/modules/ContentDedup');

const BASE = 'http://127.0.0.1:9911';

function bench(label, iterations, fn) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i += 1) fn();
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  const perSecond = Math.round((iterations / elapsedMs) * 1000);
  process.stdout.write(`${label.padEnd(28)} ${String(iterations).padStart(7)} ops in ${elapsedMs.toFixed(1)}ms  (${perSecond} ops/s)\n`);
  return perSecond;
}

async function main() {
  await ready;

  const html = '<html><body><div class="product"><h2 class="title">Sengkrep</h2><span class="price">Rp99.000</span></div></body></html>';
  const extractor = sengkrep.Extractor ? new sengkrep.Extractor() : null;

  if (extractor) {
    bench('extractor html', 20000, () => extractor.extract(html, { title: 'h2.title', price: 'span.price' }));
  }

  const payload = Buffer.from('text/html; charset=utf-8 '.repeat(200));
  bench('contentSafety.scan', 20000, () => contentSafety.inspect(payload, 'text/html'));

  const dedup = new ContentDedup();
  bench('simhash fingerprint', 5000, () => dedup.fingerprint(html));

  const scraper = sengkrep.create({ logLevel: 'error', retry: { max: 0 } });
  const iterations = 300;
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i += 1) {
    await scraper.extract(`${BASE}/html`, { title: 'h1' });
  }
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  process.stdout.write(`${'extract over http'.padEnd(28)} ${String(iterations).padStart(7)} ops in ${elapsedMs.toFixed(1)}ms  (${Math.round((iterations / elapsedMs) * 1000)} ops/s)\n`);

  closeAll();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
