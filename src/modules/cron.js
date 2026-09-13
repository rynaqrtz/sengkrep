const FIELD_SPECS = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, names: { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 } },
  { name: 'day of week', min: 0, max: 6, names: { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } },
];

const UNIT_MS = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };

function resolveValue(text, spec) {
  const raw = String(text).trim().toLowerCase();
  if (raw === '') return null;
  const named = spec.names ? spec.names[raw.slice(0, 3)] : undefined;
  if (named !== undefined) return named;
  const value = Number(raw);
  if (!Number.isInteger(value)) return null;
  if (spec.name === 'day of week' && value === 7) return 0;
  return value;
}

function parseField(text, spec) {
  const values = new Set();
  const wildcard = text === '*';

  for (const part of String(text).split(',')) {
    const [rangeText, stepText] = part.split('/');
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`Invalid step "${part}" in the ${spec.name} field`);
    }

    let start;
    let end;

    if (rangeText === '*') {
      start = spec.min;
      end = spec.max;
    } else if (rangeText.includes('-')) {
      const [left, right] = rangeText.split('-');
      start = resolveValue(left, spec);
      end = resolveValue(right, spec);
    } else {
      start = resolveValue(rangeText, spec);
      end = stepText === undefined ? start : spec.max;
    }

    if (start === null || end === null || start > end) {
      throw new Error(`Invalid range "${part}" in the ${spec.name} field`);
    }
    if (start < spec.min || end > spec.max) {
      throw new Error(`Value out of range in "${part}": the ${spec.name} field allows ${spec.min}-${spec.max}`);
    }

    for (let value = start; value <= end; value += step) values.add(value);
  }

  if (values.size === 0) throw new Error(`The ${spec.name} field matches nothing`);
  return { values, wildcard };
}

function parseCron(expression) {
  const parts = String(expression).trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`A cron expression needs 5 fields (minute hour day-of-month month day-of-week), got ${parts.length}`);
  }

  const fields = {};
  parts.forEach((text, index) => {
    const spec = FIELD_SPECS[index];
    fields[spec.name] = parseField(text, spec);
  });

  return {
    expression: parts.join(' '),
    minute: fields.minute.values,
    hour: fields.hour.values,
    dayOfMonth: fields['day of month'].values,
    month: fields.month.values,
    dayOfWeek: fields['day of week'].values,
    dayOfMonthWildcard: fields['day of month'].wildcard,
    dayOfWeekWildcard: fields['day of week'].wildcard,
  };
}

function dayMatches(parsed, date) {
  const dom = parsed.dayOfMonth.has(date.getUTCDate());
  const dow = parsed.dayOfWeek.has(date.getUTCDay());
  if (!parsed.dayOfMonthWildcard && !parsed.dayOfWeekWildcard) return dom || dow;
  if (!parsed.dayOfMonthWildcard) return dom;
  if (!parsed.dayOfWeekWildcard) return dow;
  return true;
}

function nextCronTime(parsed, from) {
  const date = new Date(from);
  date.setUTCSeconds(0, 0);
  date.setUTCMinutes(date.getUTCMinutes() + 1);

  const limit = date.getTime() + 1000 * 60 * 60 * 24 * 366 * 8;

  while (date.getTime() <= limit) {
    if (!parsed.month.has(date.getUTCMonth() + 1)) {
      date.setUTCMonth(date.getUTCMonth() + 1, 1);
      date.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(parsed, date)) {
      date.setUTCDate(date.getUTCDate() + 1);
      date.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (!parsed.hour.has(date.getUTCHours())) {
      date.setUTCHours(date.getUTCHours() + 1, 0, 0, 0);
      continue;
    }
    if (!parsed.minute.has(date.getUTCMinutes())) {
      date.setUTCMinutes(date.getUTCMinutes() + 1, 0, 0);
      continue;
    }
    return date.getTime();
  }

  return null;
}

function parseDuration(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i);
  if (!match) {
    throw new Error(`Invalid duration "${value}". Use milliseconds as a number, or a value like "30s", "5m", "2h" or "1d"`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? 'ms').toLowerCase();
  return Math.round(amount * UNIT_MS[unit]);
}

function formatDuration(ms) {
  if (ms % UNIT_MS.d === 0) return `${ms / UNIT_MS.d}d`;
  if (ms % UNIT_MS.h === 0) return `${ms / UNIT_MS.h}h`;
  if (ms % UNIT_MS.m === 0) return `${ms / UNIT_MS.m}m`;
  if (ms % UNIT_MS.s === 0) return `${ms / UNIT_MS.s}s`;
  return `${ms}ms`;
}

function scheduleKind(schedule) {
  if (typeof schedule === 'string') return 'cron';
  if (schedule && typeof schedule === 'object') {
    if ('at' in schedule) return 'once';
    if ('everyMs' in schedule || 'every' in schedule || 'ms' in schedule) return 'interval';
  }
  throw new Error('A schedule must be a cron string, { every } / { everyMs } or { at }');
}

function intervalMs(schedule) {
  if ('everyMs' in schedule) return parseDuration(schedule.everyMs);
  if ('every' in schedule) return parseDuration(schedule.every);
  return parseDuration(schedule.ms);
}

function nextRunTime(schedule, options = {}) {
  const now = options.now ?? Date.now();
  const kind = scheduleKind(schedule);

  if (kind === 'cron') return nextCronTime(parseCron(schedule), now);

  if (kind === 'once') {
    const raw = schedule.at;
    const at = raw instanceof Date ? raw.getTime() : typeof raw === 'number' ? raw : Date.parse(String(raw));
    if (!Number.isFinite(at)) throw new Error(`Invalid "at" value: ${raw}`);
    return at;
  }

  const everyMs = intervalMs(schedule);
  if (!Number.isFinite(everyMs) || everyMs <= 0) {
    throw new Error('A schedule interval must be greater than zero');
  }

  const base = Number.isFinite(options.lastRunAt) ? options.lastRunAt : now;
  let next = base + everyMs;
  if (next <= now) {
    const steps = Math.floor((now - next) / everyMs) + 1;
    next += steps * everyMs;
  }
  return next;
}

function scheduleLabel(schedule) {
  const kind = scheduleKind(schedule);
  if (kind === 'cron') return String(schedule).trim();
  if (kind === 'once') return `at ${new Date(nextRunTime(schedule)).toISOString()}`;
  return `every ${formatDuration(intervalMs(schedule))}`;
}

module.exports = {
  parseCron,
  nextCronTime,
  parseDuration,
  formatDuration,
  nextRunTime,
  scheduleKind,
  scheduleLabel,
};
