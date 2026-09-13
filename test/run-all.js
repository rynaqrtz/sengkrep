const { spawnSync } = require('child_process');
const path = require('path');

const FILES = [
  '01-fetcher-and-extraction.js',
  '02-orchestration.js',
  '03-reliability-modules.js',
  '04-content-safety-and-utils.js',
  '05-bugfixes-and-schema-inference.js',
  '06-robots-retry-pagination.js',
  '07-transport-fingerprint-storage.js',
  '08-network-capture.js',
];

let failed = 0;

for (const file of FILES) {
  process.stdout.write(`\n=== ${file} ===\n`);
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}

if (failed > 0) {
  process.stdout.write(`\n${failed} test file(s) failed\n`);
  process.exit(1);
}

process.stdout.write('\nAll test files passed\n');
process.exit(0);
