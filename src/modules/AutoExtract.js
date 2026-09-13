const { extractJsonLd, extractMicrodata, extractDataAttributes } = require('../utils/microdata');

function textOf($) {
  return $('body').text().replace(/\s+/g, ' ').trim();
}

function scoreItem(item) {
  let score = 0;
  for (const value of Object.values(item ?? {})) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) score += value.length > 0 ? 2 : 0;
    else if (typeof value === 'object') score += Object.keys(value).length > 0 ? 2 : 0;
    else if (String(value).trim() !== '') score += 1;
  }
  return score;
}

function fromJsonLd($) {
  const blocks = extractJsonLd($).filter((block) => block && typeof block === 'object');
  if (blocks.length === 0) return null;

  const flattened = blocks.flatMap((block) => (Array.isArray(block['@graph']) ? block['@graph'] : [block]));
  const scored = flattened
    .map((block) => ({ block, score: scoreItem(block) + (block['@type'] ? 3 : 0) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0].block;
  const item = { ...best };
  delete item['@context'];
  return { source: 'json-ld', item };
}

function fromMicrodata($) {
  const items = extractMicrodata($);
  if (items.length === 0) return null;

  const scored = items
    .map((item) => ({ item, score: scoreItem(item) }))
    .sort((a, b) => b.score - a.score);

  return { source: 'microdata', item: scored[0].item };
}

function fromDataAttributes($, selector = '[data-id], [data-title], [data-name], [data-price], [data-href]') {
  const rows = extractDataAttributes($, selector);
  if (rows.length === 0) return null;
  return { source: 'data-attributes', items: rows };
}

function tableToObjects($, table) {
  const $table = $(table);
  const headers = $table.find('thead th, thead td').map((_, cell) => $(cell).text().trim()).get();

  const bodyHeaders = headers.length > 0
    ? headers
    : $table.find('tr').first().find('th, td').map((_, cell) => $(cell).text().trim()).get();

  if (bodyHeaders.length === 0) return [];

  const rowSelector = headers.length > 0 ? 'tbody tr' : 'tr:gt(0)';
  return $table.find(rowSelector).map((_, row) => {
    const item = {};
    $(row).find('td, th').each((index, cell) => {
      const key = bodyHeaders[index] ?? `column_${index}`;
      if (key) item[key] = $(cell).text().trim();
    });
    return item;
  }).get().filter((item) => Object.keys(item).length > 0);
}

function repeatScore($, container) {
  const $container = $(container);
  let score = 0;

  if ($container.find('a[href]').length > 0) score += 2;
  if ($container.find('img[src], img[data-src]').length > 0) score += 1;
  if ($container.text().trim().length > 20) score += 1;
  if ($container.attr('class')) score += 1;

  return score;
}

function fromRepeatingContainers($) {
  const candidates = new Map();

  for (const element of $('div, li, article, section, tr').toArray()) {
    const $element = $(element);
    const classes = ($element.attr('class') ?? '')
      .split(/\s+/)
      .filter((name) => name.length > 2 && !/^(js|is|has|no)-/.test(name));

    for (const className of classes) {
      candidates.set(className, (candidates.get(className) ?? 0) + 1);
    }
  }

  const ranked = [...candidates.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [className, count] of ranked) {
    const selector = `.${className.replace(/[^\w-]/g, '\\$&')}`;
    const containers = $(selector);
    if (containers.length < 3) continue;

    const items = containers.toArray().slice(0, 50).map((container) => {
      const $container = $(container);
      const item = {};

      const heading = $container.find('h1, h2, h3, h4, [class*="title" i], [class*="name" i]').first();
      if (heading.length > 0) item.title = heading.text().trim();

      const link = $container.find('a[href]').first();
      if (link.length > 0) {
        item.url = link.attr('href');
        if (!item.title) item.title = link.text().trim();
      }

      const image = $container.find('img[src], img[data-src]').first();
      if (image.length > 0) item.image = image.attr('src') ?? image.attr('data-src');

      const price = $container.find('[class*="price" i]').first();
      if (price.length > 0) item.price = price.text().trim();

      if (Object.keys(item).length === 0) item.text = $container.text().trim().slice(0, 200);

      return item;
    }).filter((item) => Object.values(item).some((value) => value !== '' && value !== undefined));

    const filled = items.filter((item) => item.title || item.text);
    if (filled.length >= Math.min(3, Math.ceil(items.length * 0.5))) {
      return { source: 'repeating', selector, count, items };
    }
  }

  return null;
}

function auto($, options = {}) {
  const result = { title: null, description: null, item: null, items: [], sources: [] };

  result.title = $('title').first().text().trim() || $('meta[property="og:title"]').attr('content')?.trim() || null;
  result.description = $('meta[name="description"]').attr('content')?.trim()
    ?? $('meta[property="og:description"]').attr('content')?.trim()
    ?? null;

  const jsonLd = fromJsonLd($);
  if (jsonLd) {
    result.item = jsonLd.item;
    result.sources.push(jsonLd.source);
  }

  if (!result.item) {
    const microdata = fromMicrodata($);
    if (microdata) {
      result.item = microdata.item;
      result.sources.push(microdata.source);
    }
  }

  const tables = $('table').toArray();
  for (const table of tables) {
    const rows = tableToObjects($, table);
    if (rows.length > 0) {
      result.tables = (result.tables ?? []).concat(rows);
      if (!result.sources.includes('tables')) result.sources.push('tables');
    }
  }

  if (!options.skipRepeating) {
    const repeating = fromRepeatingContainers($);
    if (repeating) {
      result.items = repeating.items;
      result.sources.push(`repeating:${repeating.selector}`);
    }
  }

  if (result.items.length === 0 && options.dataAttributes !== false) {
    const data = fromDataAttributes($, options.dataSelector);
    if (data) {
      result.items = data.items;
      result.sources.push(data.source);
    }
  }

  if (options.text !== false) result.text = textOf($).slice(0, options.maxText ?? 2000);

  return result;
}

module.exports = { auto, tableToObjects, fromJsonLd, fromMicrodata, fromRepeatingContainers, fromDataAttributes };
