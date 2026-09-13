const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, assert, finish } = require('./harness');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'api-docs.js');
const OUT = path.join(ROOT, 'docs', 'api');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sengkrep-docs-'));

const docs = require('../scripts/api-docs');
const result = docs.build();

function model(name) {
  return result.models.find((item) => item.name === name);
}

async function main() {
  await test('the generator reads every export in index.d.ts', () => {
    const declared = new Set(fs.readFileSync(path.join(ROOT, 'index.d.ts'), 'utf8')
      .split('\n')
      .map((line) => line.match(/^export (?:interface|class|type|function) ([A-Za-z_][A-Za-z0-9_]*)/))
      .filter(Boolean)
      .map((match) => match[1]));

    assert.ok(result.models.length > 150, `expected more than 150 exports, got ${result.models.length}`);
    assert.deepStrictEqual([...declared].sort(), result.models.map((item) => item.name).sort());
  });

  await test('interface properties carry a name, a type and optionality', () => {
    const options = model('SinkOptions');

    assert.strictEqual(options.kind, 'interface');
    assert.deepStrictEqual(options.properties.map((property) => property.name), [
      'key', 'replace', 'batchSize', 'flushInterval', 'retries', 'retryDelayMs', 'transform', 'onError',
    ]);
    assert.strictEqual(options.properties.find((property) => property.name === 'key').type, 'SinkKey');
    assert.strictEqual(options.properties.find((property) => property.name === 'batchSize').type, 'number');
    assert.strictEqual(options.properties.every((property) => property.optional), true);
  });

  await test('required and readonly members are flagged', () => {
    const store = model('JobStore');

    assert.strictEqual(store.properties.find((property) => property.name === 'storage').optional, false);
    assert.strictEqual(store.methods.find((method) => method.name === 'save').parameters, 'job: JobRecord');

    const scheduler = model('Scheduler');
    assert.strictEqual(scheduler.properties.find((property) => property.name === 'started').readonly, true);
    assert.strictEqual(scheduler.properties.find((property) => property.name === 'started').type, 'boolean');
    assert.strictEqual(scheduler.constructors[0].parameters, 'options?: SchedulerOptions | boolean');
    assert.deepStrictEqual(
      scheduler.methods.filter((method) => method.name === 'on').length,
      5,
    );
  });

  await test('interfaces record their heritage and type parameters', () => {
    const postgres = model('PostgresSinkOptions');
    assert.deepStrictEqual(postgres.extends, ["Omit<SqlSinkOptions, 'dialect'>"]);
    assert.strictEqual(postgres.category, 'Data sinks');

    const single = model('BatchOptions');
    assert.deepStrictEqual(single.extends, ['ExtractOptions']);
    assert.strictEqual(single.category, 'Options');
  });

  await test('type aliases keep the alias text and expand object literals', () => {
    const schedule = model('Schedule');
    assert.strictEqual(schedule.kind, 'type');
    assert.strictEqual(schedule.aliased, 'string | ScheduleInterval | ScheduleOnce');
    assert.strictEqual(schedule.literal, false);

    const sinkInput = model('SinkInput');
    assert.strictEqual(sinkInput.aliased, 'Sink | SinkDescriptor');
  });

  await test('functions group their overloads', () => {
    const createSink = model('createSink');
    assert.strictEqual(createSink.kind, 'function');
    assert.strictEqual(createSink.overloads.length, 2);
    assert.deepStrictEqual(createSink.declarations, [
      'export function createSink(descriptor: SinkDescriptor): Sink',
      'export function createSink(sink: Sink): Sink',
    ]);

    const page = result.files.get('create-sink.md');
    assert.strictEqual(page.split('export function createSink(descriptor').length - 1, 1);
    assert.strictEqual(page.split('export function createSink(sink').length - 1, 1);
  });

  await test('every page has a title, a category and a declaration', () => {
    for (const item of result.models) {
      const page = result.files.get(`${item.slug}.md`);
      assert.ok(page, `missing page for ${item.name}`);
      assert.strictEqual(page.split('\n')[0], `# ${item.name}`);
      assert.ok(page.includes('Category: '), `${item.name} has no category line`);
      assert.ok(page.includes('## Declaration'), `${item.name} has no declaration block`);
    }
  });

  await test('the index lists every page under its category', () => {
    const index = result.files.get('README.md');

    assert.ok(index.startsWith('# API reference'));
    assert.ok(index.includes(`${result.models.length} exports:`));
    assert.ok(index.includes('npm run docs:check'));

    for (const item of result.models) {
      assert.ok(index.includes(`[${item.name}](./${item.slug}.md)`), `${item.name} is missing from the index`);
    }

    const categories = docs.CATEGORY_ORDER.filter((category) => index.includes(`## ${category} (`));
    assert.ok(categories.length >= 8, `expected at least 8 categories, got ${categories.length}`);
  });

  await test('slugs are unique and every related link resolves', () => {
    const slugs = new Set();

    for (const item of result.models) {
      assert.strictEqual(slugs.has(item.slug), false, `duplicate slug ${item.slug}`);
      slugs.add(item.slug);
    }

    for (const [file, content] of result.files) {
      for (const match of content.matchAll(/\]\(\.\/([^)]+)\)/g)) {
        const target = match[1];
        assert.ok(result.files.has(target), `${file} links to a missing page ${target}`);
      }
    }
  });

  await test('the generated markdown stays plain', () => {
    for (const [file, content] of result.files) {
      if (!file.endsWith('.md')) continue;
      assert.strictEqual(content.includes('\u2014'), false, `${file} contains an em dash`);
      assert.strictEqual(content.includes('\t'), false, `${file} contains a tab`);
      assert.strictEqual(content.endsWith('\n'), true, `${file} does not end with a newline`);
    }
  });

  await test('the catalog matches the pages', () => {
    const catalog = JSON.parse(result.files.get('api.json'));

    assert.strictEqual(catalog.declarations.length, result.models.length);
    assert.strictEqual(catalog.generatedFrom, 'index.d.ts');
    assert.match(catalog.hash, /^[0-9a-f]{40}$/);
    assert.strictEqual(
      Object.values(catalog.counts).reduce((total, count) => total + count, 0),
      result.models.length,
    );

    const sink = catalog.declarations.find((item) => item.name === 'SqlSink');
    assert.strictEqual(sink.methods.includes('buildStatement'), true);
    assert.strictEqual(sink.category, 'Data sinks');

    const postgres = catalog.declarations.find((item) => item.name === 'PostgresSink');
    assert.deepStrictEqual(postgres.properties, ['driver']);
  });

  await test('building twice produces the same bytes', () => {
    const again = docs.build();

    assert.deepStrictEqual([...again.files.keys()], [...result.files.keys()]);
    for (const [file, content] of result.files) {
      assert.strictEqual(again.files.get(file), content, `${file} is not deterministic`);
    }
    assert.strictEqual(again.manifest.hash, result.manifest.hash);
  });

  await test('the committed reference is up to date', () => {
    const problems = docs.compare(result, OUT);

    assert.deepStrictEqual(problems, [], `docs/api is out of date: ${JSON.stringify(problems)}`);
    assert.ok(fs.existsSync(path.join(OUT, docs.MANIFEST)));
  });

  await test('the drift check notices stale, missing and hand written files', () => {
    const dir = path.join(TMP, 'drift');
    docs.write(result, dir);
    assert.deepStrictEqual(docs.compare(result, dir), []);

    fs.appendFileSync(path.join(dir, 'sink.md'), '\nstale\n');
    assert.deepStrictEqual(docs.compare(result, dir), [{ type: 'stale', file: 'sink.md' }]);

    docs.write(result, dir);
    fs.unlinkSync(path.join(dir, 'sink-key.md'));
    assert.deepStrictEqual(docs.compare(result, dir), [{ type: 'missing', file: 'sink-key.md' }]);

    docs.write(result, dir);
    fs.writeFileSync(path.join(dir, 'notes.md'), '# notes\n');
    assert.deepStrictEqual(docs.compare(result, dir), [{ type: 'unexpected', file: 'notes.md' }]);
  });

  await test('writing removes pages that no longer exist and the command exits cleanly', () => {
    const dir = path.join(TMP, 'prune');
    const first = {
      files: new Map([['a.md', 'a\n'], ['b.md', 'b\n']]),
      manifest: { input: 'index.d.ts', hash: 'x', counts: {}, files: ['a.md', 'b.md'] },
      models: [],
    };
    const second = {
      files: new Map([['a.md', 'a\n']]),
      manifest: { input: 'index.d.ts', hash: 'x', counts: {}, files: ['a.md'] },
      models: [],
    };

    docs.write(first, dir);
    assert.deepStrictEqual(fs.readdirSync(dir).sort(), [docs.MANIFEST, 'a.md', 'b.md']);

    const report = docs.write(second, dir);
    assert.deepStrictEqual(report.removed, ['b.md']);
    assert.deepStrictEqual(fs.readdirSync(dir).sort(), [docs.MANIFEST, 'a.md']);

    const check = spawnSync(process.execPath, [SCRIPT, '--check', `--out=${OUT}`], { cwd: ROOT, encoding: 'utf8' });
    assert.strictEqual(check.status, 0, check.stdout);
    assert.match(check.stdout, /up to date/);
  });

  finish('14-api-docs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
