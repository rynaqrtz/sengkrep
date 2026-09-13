#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'index.d.ts');
const DEFAULT_OUT = path.join(ROOT, 'docs', 'api');
const MANIFEST = '.manifest.json';
const CATALOG = 'api.json';
const INDEX_PAGE = 'README.md';

const CATEGORY_ORDER = [
  'Errors',
  'Scheduling',
  'Data sinks',
  'Network capture',
  'Options',
  'Results',
  'Classes',
  'Interfaces',
  'Types',
  'Functions',
  'Reference',
];

const CATEGORY_RULES = [
  { category: 'Errors', match: (name) => /Error$/.test(name) },
  { category: 'Scheduling', match: (name) => /^(Scheduler|JobStore|Schedule|Job|Cron)/.test(name) },
  { category: 'Data sinks', match: (name) => /Sink/.test(name) },
  { category: 'Network capture', match: (name) => /(Capture|Har|Cdp|Cookie|Renderer|Playwright|WebSocket|Session|Tunnel)/.test(name) },
  { category: 'Options', match: (name) => /(Options|Config)$/.test(name) },
  { category: 'Results', match: (name) => /(Result|Report|Stats|Summary|Record|Entry|Info|Snapshot|Dataset)$/.test(name) },
  { category: 'Classes', match: (name, kind) => kind === 'class' },
  { category: 'Interfaces', match: (name, kind) => kind === 'interface' },
  { category: 'Types', match: (name, kind) => kind === 'type' },
  { category: 'Functions', match: (name, kind) => kind === 'function' },
];

const START_HERE = ['Sengkrep', 'SengkrepOptions', 'Sink', 'Scheduler', 'createSink', 'NetworkCapture'];

function slugify(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function flatten(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function typeText(node, source) {
  if (!node) return 'unknown';
  return flatten(node.getText(source));
}

function hasModifier(node, checker) {
  return Boolean(node.modifiers?.some((modifier) => checker(modifier)));
}

function isReadonly(node) {
  return hasModifier(node, (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword);
}

function isStatic(node) {
  return hasModifier(node, (modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword);
}

function isAsync(node) {
  return hasModifier(node, (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword);
}

function parameterText(parameter, source) {
  const rest = parameter.dotDotDotToken ? '...' : '';
  const optional = parameter.questionToken ? '?' : '';
  return `${rest}${parameter.name.getText(source)}${optional}: ${typeText(parameter.type, source)}`;
}

function parameterList(node, source) {
  return (node.parameters ?? []).map((parameter) => parameterText(parameter, source)).join(', ');
}

function declarationCategory(name, kind) {
  for (const rule of CATEGORY_RULES) {
    if (rule.match(name, kind)) return rule.category;
  }
  return 'Reference';
}

function memberName(member, source) {
  if (member.name) return flatten(member.name.getText(source));
  if (member.parameters?.length === 1) return flatten(member.parameters[0].name.getText(source));
  return null;
}

function readInterface(node, source) {
  const model = {
    kind: 'interface',
    name: node.name.text,
    typeParameters: (node.typeParameters ?? []).map((parameter) => flatten(parameter.getText(source))),
    extends: (node.heritageClauses ?? []).flatMap((clause) => clause.types.map((type) => flatten(type.getText(source)))),
    properties: [],
    methods: [],
    calls: [],
    constructs: [],
  };

  for (const member of node.members) {
    if (ts.isPropertySignature(member)) {
      model.properties.push({
        name: memberName(member, source),
        type: typeText(member.type, source),
        optional: Boolean(member.questionToken),
        readonly: isReadonly(member),
      });
    } else if (ts.isMethodSignature(member)) {
      model.methods.push({
        name: memberName(member, source),
        parameters: parameterList(member, source),
        returns: typeText(member.type, source),
        optional: Boolean(member.questionToken),
      });
    } else if (ts.isIndexSignatureDeclaration(member)) {
      model.properties.push({
        name: memberName(member, source),
        type: typeText(member.type, source),
        optional: false,
        readonly: isReadonly(member),
        index: true,
      });
    } else if (ts.isCallSignatureDeclaration(member)) {
      model.calls.push({ parameters: parameterList(member, source), returns: typeText(member.type, source) });
    } else if (ts.isConstructSignatureDeclaration(member)) {
      model.constructs.push({ parameters: parameterList(member, source), returns: typeText(member.type, source) });
    }
  }

  return model;
}

function readClass(node, source) {
  const model = {
    kind: 'class',
    name: node.name.text,
    typeParameters: (node.typeParameters ?? []).map((parameter) => flatten(parameter.getText(source))),
    extends: (node.heritageClauses ?? []).flatMap((clause) => clause.types.map((type) => flatten(type.getText(source)))),
    properties: [],
    methods: [],
    constructors: [],
  };

  for (const member of node.members) {
    if (ts.isPropertyDeclaration(member)) {
      model.properties.push({
        name: memberName(member, source),
        type: typeText(member.type, source),
        optional: Boolean(member.questionToken),
        readonly: isReadonly(member),
        static: isStatic(member),
      });
    } else if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
      model.properties.push({
        name: memberName(member, source),
        type: ts.isGetAccessorDeclaration(member) ? typeText(member.type, source) : 'setter',
        optional: false,
        readonly: ts.isGetAccessorDeclaration(member),
        accessor: ts.isGetAccessorDeclaration(member) ? 'get' : 'set',
      });
    } else if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
      model.methods.push({
        name: memberName(member, source),
        parameters: parameterList(member, source),
        returns: typeText(member.type, source),
        static: isStatic(member),
        async: isAsync(member),
      });
    } else if (ts.isConstructorDeclaration(member)) {
      model.constructors.push({ parameters: parameterList(member, source) });
    } else if (ts.isIndexSignatureDeclaration(member)) {
      model.properties.push({
        name: memberName(member, source),
        type: typeText(member.type, source),
        optional: false,
        readonly: isReadonly(member),
        index: true,
      });
    }
  }

  return model;
}

function readTypeLiteralMembers(node, source) {
  const properties = [];
  const methods = [];

  for (const member of node.members ?? []) {
    if (ts.isPropertySignature(member)) {
      properties.push({
        name: memberName(member, source),
        type: typeText(member.type, source),
        optional: Boolean(member.questionToken),
        readonly: isReadonly(member),
      });
    } else if (ts.isMethodSignature(member)) {
      methods.push({
        name: memberName(member, source),
        parameters: parameterList(member, source),
        returns: typeText(member.type, source),
      });
    } else if (ts.isIndexSignatureDeclaration(member)) {
      properties.push({
        name: memberName(member, source),
        type: typeText(member.type, source),
        optional: false,
        readonly: isReadonly(member),
        index: true,
      });
    }
  }

  return { properties, methods };
}

function readTypeAlias(node, source) {
  const model = {
    kind: 'type',
    name: node.name.text,
    typeParameters: (node.typeParameters ?? []).map((parameter) => flatten(parameter.getText(source))),
    aliased: typeText(node.type, source),
    properties: [],
    methods: [],
    declaration: flatten(node.getText(source)),
    literal: false,
  };

  if (ts.isTypeLiteralNode(node.type)) {
    const members = readTypeLiteralMembers(node.type, source);
    model.properties = members.properties;
    model.methods = members.methods;
    model.literal = true;
  } else if (ts.isUnionTypeNode(node.type) && node.type.types.length > 0 && node.type.types.every((part) => ts.isTypeLiteralNode(part))) {
    for (const part of node.type.types) {
      const members = readTypeLiteralMembers(part, source);
      model.properties.push(...members.properties);
      model.methods.push(...members.methods);
    }
    model.literal = true;
  }

  return model;
}

function readFunction(node, source) {
  return {
    kind: 'function',
    name: node.name.text,
    properties: [],
    methods: [],
    typeParameters: (node.typeParameters ?? []).map((parameter) => flatten(parameter.getText(source))),
    parameters: parameterList(node, source),
    returns: typeText(node.type, source),
    declaration: flatten(node.getText(source).replace(/;\s*$/, '')),
  };
}

function parseIndex(text) {
  const source = ts.createSourceFile('index.d.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const models = [];
  const functions = new Map();

  for (const statement of source.statements) {
    if (ts.isInterfaceDeclaration(statement)) {
      models.push(readInterface(statement, source));
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      models.push(readClass(statement, source));
    } else if (ts.isTypeAliasDeclaration(statement)) {
      models.push(readTypeAlias(statement, source));
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      if (!functions.has(name)) {
        const model = readFunction(statement, source);
        model.overloads = [];
        model.declarations = [];
        functions.set(name, model);
        models.push(model);
      }
      const model = functions.get(name);
      model.overloads.push({ parameters: parameterList(statement, source), returns: typeText(statement.type, source) });
      model.declarations.push(flatten(statement.getText(source).replace(/;\s*$/, '')));
    }
  }

  for (const model of models) {
    model.slug = slugify(model.name);
    model.category = declarationCategory(model.name, model.kind);
  }

  const used = new Map();
  for (const model of models) {
    const count = used.get(model.slug) ?? 0;
    used.set(model.slug, count + 1);
    if (count > 0) model.slug = `${model.slug}-${model.kind}`;
  }

  return models;
}

function table(headers, rows) {
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ];

  for (const row of rows) lines.push(`| ${row.join(' | ')} |`);
  return lines.join('\n');
}

function cell(value) {
  if (value === null || value === undefined || value === '') return '';
  return `\`${String(value).replace(/\|/g, '\\|')}\``;
}

function flagsCell(flags) {
  const text = flags.filter(Boolean).join(', ');
  return text ? `\`${text}\`` : '';
}

function propertyTable(model) {
  if (!model.properties || model.properties.length === 0) return '';

  const rows = model.properties.map((property) => [
    cell(property.name),
    cell(property.type),
    property.optional ? 'no' : 'yes',
    flagsCell([
      property.readonly ? 'readonly' : '',
      property.static ? 'static' : '',
      property.accessor ?? '',
      property.index ? 'index' : '',
    ]),
  ]);

  return `## Properties\n\n${table(['Property', 'Type', 'Required', 'Flags'], rows)}`;
}

function methodTable(model) {
  if (!model.methods || model.methods.length === 0) return '';

  const rows = model.methods.map((method) => [
    cell(method.name),
    cell(method.parameters),
    cell(method.returns),
    flagsCell([method.optional ? 'optional' : '', method.static ? 'static' : '', method.async ? 'async' : '']),
  ]);

  return `## Methods\n\n${table(['Method', 'Parameters', 'Returns', 'Flags'], rows)}`;
}

function declarationBlock(model) {
  const lines = [];

  if (model.declarations?.length > 0) {
    lines.push(...model.declarations);
  } else if (model.declaration) {
    lines.push(model.declaration);
  } else if (model.kind === 'interface') {
    const typeParameters = model.typeParameters.length > 0 ? `<${model.typeParameters.join(', ')}>` : '';
    const heritage = model.extends.length > 0 ? ` extends ${model.extends.join(', ')}` : '';
    lines.push(`interface ${model.name}${typeParameters}${heritage} { ... }`);
  } else if (model.kind === 'class') {
    const typeParameters = model.typeParameters.length > 0 ? `<${model.typeParameters.join(', ')}>` : '';
    const heritage = model.extends.length > 0 ? ` extends ${model.extends.join(', ')}` : '';
    lines.push(`class ${model.name}${typeParameters}${heritage} { ... }`);
  }

  return `## Declaration\n\n\`\`\`ts\n${lines.join('\n')}\n\`\`\``;
}

function summaryLine(model) {
  const parts = [model.kind];

  if (model.typeParameters?.length > 0) parts.push(`type parameters: ${model.typeParameters.map((item) => `\`${item}\``).join(', ')}`);
  if (model.extends?.length > 0) parts.push(`extends ${model.extends.map((item) => `\`${item}\``).join(', ')}`);
  if (model.aliased) parts.push(`alias of \`${model.aliased}\``);
  if (model.constructors?.length > 0) parts.push(`${model.constructors.length} constructor form${model.constructors.length === 1 ? '' : 's'}`);
  if (model.overloads?.length > 1) parts.push(`${model.overloads.length} overloads`);

  return parts.join(' · ');
}

function renderPage(model, names, slugByName) {
  const resolved = new Map(names.map((name) => [name, slugByName.get(name)]));
  const related = [...resolved.keys()]
    .filter((name) => name !== model.name && new RegExp(`\\b${name}\\b`).test(JSON.stringify(model)))
    .sort();

  const sections = [
    `# ${model.name}`,
    '',
    summaryLine(model),
    '',
    `Category: ${model.category} · Source: [index.d.ts](../../index.d.ts) · [All exports](./${INDEX_PAGE})`,
  ];

  if (model.constructs?.length > 0) {
    sections.push('', '## Constructor signatures', '', '```ts', ...model.constructs.map((item) => `new ${model.name}(${item.parameters}) => ${item.returns}`), '```');
  }

  if (model.constructors?.length > 0) {
    sections.push('', '## Constructors', '', '```ts', ...model.constructors.map((item) => `new ${model.name}(${item.parameters})`), '```');
  }

  if (model.calls?.length > 0) {
    sections.push('', '## Call signatures', '', '```ts', ...model.calls.map((item) => `(${item.parameters}) => ${item.returns}`), '```');
  }

  const properties = propertyTable(model);
  if (properties) sections.push('', properties);

  const methods = methodTable(model);
  if (methods) sections.push('', methods);

  if (related.length > 0) {
    sections.push('', `## Related\n\n${related.map((name) => `- [${name}](./${resolved.get(name)}.md)`).join('\n')}`);
  }

  sections.push('', declarationBlock(model));
  sections.push('');

  return sections.join('\n');
}

function plural(kind, count) {
  if (count === 1) return kind;
  if (kind === 'class') return 'classes';
  if (kind === 'interface') return 'interfaces';
  return `${kind}s`;
}

function renderIndex(models, categories) {
  const counts = models.reduce((total, model) => {
    total[model.kind] = (total[model.kind] ?? 0) + 1;
    return total;
  }, {});

  const byName = new Map(models.map((model) => [model.name, model]));
  const here = START_HERE.filter((name) => byName.has(name));
  const lines = [
    '# API reference',
    '',
    `${models.length} exports: ${Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).map(([kind, count]) => `${count} ${plural(kind, count)}`).join(', ')}.`,
    '',
    'Generated from `index.d.ts` by `npm run docs`. Do not edit this directory by hand; `npm run docs:check` fails when it drifts.',
    '',
  ];

  if (here.length > 0) {
    lines.push(`Start here: ${here.map((name) => `[${name}](./${byName.get(name).slug}.md)`).join(' · ')}`, '');
  }

  for (const category of CATEGORY_ORDER) {
    const group = categories.get(category);
    if (!group || group.length === 0) continue;

    lines.push(`## ${category} (${group.length})`, '');
    lines.push(table(['Name', 'Kind'], group.map((model) => [`[${model.name}](./${model.slug}.md)`, cell(model.kind)])));
    lines.push('');
  }

  return lines.join('\n');
}

function build(options = {}) {
  const input = options.input ?? INPUT;
  const text = fs.readFileSync(input, 'utf8');
  const models = parseIndex(text);
  const names = models.map((model) => model.name);
  const slugByName = new Map(models.map((model) => [model.name, model.slug]));

  const categories = new Map();
  for (const model of models) {
    if (!categories.has(model.category)) categories.set(model.category, []);
    categories.get(model.category).push(model);
  }
  for (const group of categories.values()) group.sort((a, b) => a.name.localeCompare(b.name));

  const files = new Map();
  files.set(INDEX_PAGE, renderIndex(models, categories));

  for (const model of models) {
    files.set(`${model.slug}.md`, renderPage(model, names, slugByName));
  }

  const catalog = {
    generatedFrom: path.relative(ROOT, input).split(path.sep).join('/'),
    hash: crypto.createHash('sha1').update(text).digest('hex'),
    counts: models.reduce((total, model) => {
      total[model.kind] = (total[model.kind] ?? 0) + 1;
      return total;
    }, {}),
    categories: Object.fromEntries([...categories.entries()].map(([category, group]) => [category, group.map((model) => model.name)])),
    declarations: models.map((model) => ({
      name: model.name,
      kind: model.kind,
      slug: model.slug,
      category: model.category,
      properties: model.properties.map((property) => property.name),
      methods: (model.methods ?? []).map((method) => method.name),
    })),
  };

  files.set(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`);

  const manifest = {
    input: path.relative(ROOT, input).split(path.sep).join('/'),
    hash: catalog.hash,
    counts: catalog.counts,
    files: [...files.keys()].sort(),
  };

  return { models, files, manifest, catalog };
}

function compare(result, out) {
  const problems = [];

  for (const [name, content] of result.files) {
    const target = path.join(out, name);
    if (!fs.existsSync(target)) {
      problems.push({ type: 'missing', file: name });
      continue;
    }
    if (fs.readFileSync(target, 'utf8') !== content) problems.push({ type: 'stale', file: name });
  }

  for (const entry of fs.existsSync(out) ? fs.readdirSync(out) : []) {
    const generated = result.files.has(entry) || entry === MANIFEST;
    if (!generated && (entry.endsWith('.md') || entry.endsWith('.json'))) {
      problems.push({ type: 'unexpected', file: entry });
    }
  }

  return problems;
}

function write(result, out) {
  fs.mkdirSync(out, { recursive: true });

  const previous = fs.existsSync(path.join(out, MANIFEST))
    ? JSON.parse(fs.readFileSync(path.join(out, MANIFEST), 'utf8')).files ?? []
    : [];
  const removed = [];

  for (const name of previous) {
    if (result.files.has(name)) continue;
    const target = path.join(out, name);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      removed.push(name);
    }
  }

  for (const [name, content] of result.files) {
    fs.writeFileSync(path.join(out, name), content, 'utf8');
  }

  fs.writeFileSync(path.join(out, MANIFEST), `${JSON.stringify(result.manifest, null, 2)}\n`, 'utf8');

  return { written: result.files.size, removed };
}

function main(argv = process.argv.slice(2)) {
  const check = argv.includes('--check');
  const outArg = argv.find((argument) => argument.startsWith('--out='));
  const out = outArg ? path.resolve(outArg.slice('--out='.length)) : DEFAULT_OUT;
  const result = build();

  if (check) {
    const problems = compare(result, out);
    if (problems.length > 0) {
      process.stdout.write(`The API reference in ${path.relative(ROOT, out)} is out of date:\n`);
      for (const problem of problems.slice(0, 20)) process.stdout.write(`  ${problem.type}: ${problem.file}\n`);
      if (problems.length > 20) process.stdout.write(`  and ${problems.length - 20} more\n`);
      process.stdout.write('Run: npm run docs\n');
      return 1;
    }
    process.stdout.write(`API reference is up to date (${result.files.size} files, ${result.models.length} exports)\n`);
    return 0;
  }

  const report = write(result, out);
  process.stdout.write(`API reference written to ${path.relative(ROOT, out)}: ${report.written} files, ${result.models.length} exports\n`);
  if (report.removed.length > 0) process.stdout.write(`removed ${report.removed.length} stale file(s): ${report.removed.join(', ')}\n`);

  return 0;
}

if (require.main === module) process.exit(main());

module.exports = {
  INDEX_PAGE,
  MANIFEST,
  CATALOG,
  CATEGORY_ORDER,
  DEFAULT_OUT,
  INPUT,
  build,
  compare,
  main,
  parseIndex,
  renderIndex,
  renderPage,
  slugify,
  write,
};
