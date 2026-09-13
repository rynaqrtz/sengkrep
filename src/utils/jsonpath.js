function isObject(value) {
  return value !== null && typeof value === 'object';
}

function matchBracket(path, start) {
  let depth = 0;
  let quote = null;

  for (let i = start; i < path.length; i += 1) {
    const ch = path[i];

    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  throw new Error(`Unclosed bracket in JSONPath: ${path}`);
}

function unquote(text) {
  const trimmed = text.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return trimmed;
}

function parseFilter(inner) {
  const body = inner.replace(/^\?\(/, '').replace(/\)$/, '').trim();
  const match = body.match(/^@((?:\.[A-Za-z0-9_$-]+|\[['"][^'"]+['"]\])*)\s*(==|!=|>=|<=|>|<|=~)\s*(.+)$/);

  if (!match) throw new Error(`Unsupported JSONPath filter: ${inner}`);

  const keyPath = [];
  for (const segment of match[1].matchAll(/\.([A-Za-z0-9_$-]+)|\[['"]([^'"]+)['"]\]/g)) {
    keyPath.push(segment[1] ?? segment[2]);
  }

  let value = match[3].trim();
  if (/^-?\d+\.?\d*$/.test(value)) value = Number(value);
  else if (value === 'true' || value === 'false') value = value === 'true';
  else if (value === 'null') value = null;
  else value = unquote(value);

  return { type: 'filter', keyPath, op: match[2], value };
}

function parseBracket(inner) {
  const text = inner.trim();
  if (text === '*') return { type: 'wildcard' };
  if (text.startsWith('?(')) return parseFilter(text);

  if (/^-?\d+\s*:\s*-?\d*$/.test(text) || /^:\s*-?\d*$/.test(text)) {
    const [start, end] = text.split(':');
    return { type: 'slice', start: start ? Number(start) : null, end: end ? Number(end) : null };
  }

  if (/^-?\d+(\s*,\s*-?\d+)+$/.test(text)) {
    return { type: 'union', indexes: text.split(',').map((value) => Number(value.trim())) };
  }

  if (/^-?\d+$/.test(text)) return { type: 'index', index: Number(text) };

  return { type: 'child', key: unquote(text) };
}

function parse(expression) {
  let path = String(expression ?? '').trim();
  if (path.startsWith('$')) path = path.slice(1);

  const steps = [];
  let i = 0;

  while (i < path.length) {
    const ch = path[i];

    if (ch === '.') {
      if (path[i + 1] === '.') {
        i += 2;
        if (path[i] === '*') { steps.push({ type: 'descendAll' }); i += 1; continue; }
        const name = /^[^.[\]]+/.exec(path.slice(i));
        if (name) { steps.push({ type: 'descend', key: name[0] }); i += name[0].length; continue; }
        steps.push({ type: 'descendAll' });
        continue;
      }

      i += 1;
      if (path[i] === '*') { steps.push({ type: 'wildcard' }); i += 1; continue; }
      const name = /^[^.[\]]+/.exec(path.slice(i));
      if (name) { steps.push({ type: 'child', key: name[0] }); i += name[0].length; }
      continue;
    }

    if (ch === '[') {
      const end = matchBracket(path, i);
      steps.push(parseBracket(path.slice(i + 1, end)));
      i = end + 1;
      continue;
    }

    const name = /^[^.[\]]+/.exec(path.slice(i));
    if (name) { steps.push({ type: 'child', key: name[0] }); i += name[0].length; continue; }
    i += 1;
  }

  return steps;
}

function collectDescendants(node, out, depth = 0) {
  if (depth > 64 || !isObject(node)) return;

  if (Array.isArray(node)) {
    for (const item of node) collectDescendants(item, out, depth + 1);
    return;
  }

  for (const value of Object.values(node)) {
    out.push(value);
    collectDescendants(value, out, depth + 1);
  }
}

function compare(actual, op, expected) {
  switch (op) {
    case '==': return actual === expected || String(actual) === String(expected);
    case '!=': return actual !== expected && String(actual) !== String(expected);
    case '>':  return Number(actual) > Number(expected);
    case '<':  return Number(actual) < Number(expected);
    case '>=': return Number(actual) >= Number(expected);
    case '<=': return Number(actual) <= Number(expected);
    case '=~': return new RegExp(String(expected)).test(String(actual));
    default:   return false;
  }
}

function readPath(node, keyPath) {
  let current = node;
  for (const key of keyPath) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function entriesOf(node) {
  if (Array.isArray(node)) return node.map((value) => value);
  if (isObject(node)) return Object.values(node);
  return [];
}

function stepValues(nodes, step) {
  const out = [];

  for (const node of nodes) {
    if (!isObject(node)) continue;

    switch (step.type) {
      case 'child':
        if (step.key in node) out.push(node[step.key]);
        break;
      case 'index': {
        if (!Array.isArray(node)) break;
        const index = step.index < 0 ? node.length + step.index : step.index;
        if (index >= 0 && index < node.length) out.push(node[index]);
        break;
      }
      case 'slice': {
        if (!Array.isArray(node)) break;
        const start = step.start === null ? 0 : (step.start < 0 ? node.length + step.start : step.start);
        const end = step.end === null ? node.length : (step.end < 0 ? node.length + step.end : step.end);
        out.push(...node.slice(Math.max(0, start), Math.max(0, end)));
        break;
      }
      case 'union':
        if (!Array.isArray(node)) break;
        for (const raw of step.indexes) {
          const index = raw < 0 ? node.length + raw : raw;
          if (index >= 0 && index < node.length) out.push(node[index]);
        }
        break;
      case 'wildcard':
        out.push(...entriesOf(node));
        break;
      default:
        break;
    }
  }

  return out;
}

function query(root, expression) {
  const steps = Array.isArray(expression) ? expression : parse(expression);
  let current = [root];

  for (const step of steps) {
    if (step.type === 'descend') {
      const collected = [];
      const walk = (node) => {
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (!isObject(node)) return;
        if (step.key in node) collected.push(node[step.key]);
        for (const value of Object.values(node)) walk(value);
      };
      current.forEach(walk);
      current = collected;
      continue;
    }

    if (step.type === 'descendAll') {
      const collected = [];
      current.forEach((node) => collectDescendants(node, collected));
      current = collected;
      continue;
    }

    if (step.type === 'filter') {
      const kept = [];
      for (const node of current) {
        for (const value of entriesOf(node)) {
          if (compare(readPath(value, step.keyPath), step.op, step.value)) kept.push(value);
        }
      }
      current = kept;
      continue;
    }

    current = stepValues(current, step);
  }

  return current;
}

function isJsonPath(expression) {
  return typeof expression === 'string' && expression.trim().startsWith('$');
}

function hasWildcard(expression) {
  const text = String(expression);
  return /\[\s*\*|\.\*|\.\.|\[\s*\?|\[\s*-?\d+\s*,/.test(text);
}

module.exports = { query, parse, isJsonPath, hasWildcard };
