const KEY_SEPARATOR = '\u0000';

function quoteIdentifier(name, dialect) {
  const parts = String(name).split('.');
  if (dialect === 'mysql') {
    return parts.map((part) => `\`${part.replace(/`/g, '``')}\``).join('.');
  }
  return parts.map((part) => `"${part.replace(/"/g, '""')}"`).join('.');
}

function columnsFor(batch, explicit) {
  if (Array.isArray(explicit) && explicit.length > 0) return [...explicit];

  const columns = [];
  const seen = new Set();
  for (const row of batch) {
    if (!row || typeof row !== 'object') continue;
    for (const name of Object.keys(row)) {
      if (seen.has(name)) continue;
      seen.add(name);
      columns.push(name);
    }
  }

  if (columns.length === 0) {
    throw new Error('A sink row must be an object with at least one field, or the sink needs an explicit column list');
  }
  return columns;
}

function rowsToValues(batch, columns) {
  const values = [];
  for (const row of batch) {
    for (const column of columns) {
      const value = row ? row[column] : null;
      values.push(value === undefined ? null : value);
    }
  }
  return values;
}

function placeholders(rowCount, columnCount, dialect) {
  const rows = [];
  let index = 1;
  for (let r = 0; r < rowCount; r += 1) {
    const row = [];
    for (let c = 0; c < columnCount; c += 1) {
      row.push(dialect === 'postgres' ? `$${index}` : '?');
      index += 1;
    }
    rows.push(`(${row.join(', ')})`);
  }
  return rows.join(', ');
}

function keyOf(row, keys) {
  return keys.map((name) => {
    const value = row ? row[name] : undefined;
    if (value === undefined || value === null) {
      throw new Error(`A sink row is missing the key field "${name}"`);
    }
    return String(value);
  }).join(KEY_SEPARATOR);
}

module.exports = {
  KEY_SEPARATOR,
  columnsFor,
  keyOf,
  placeholders,
  quoteIdentifier,
  rowsToValues,
};
