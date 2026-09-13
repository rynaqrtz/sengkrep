const { EventEmitter } = require('events');
const JobStore = require('./JobStore');
const { scheduleKind, nextRunTime, scheduleLabel } = require('./cron');

class Scheduler extends EventEmitter {
  constructor(options = {}) {
    super();

    const config = options === true ? {} : options ?? {};

    this.logger = config.logger ?? null;
    this.now = typeof config.now === 'function' ? config.now : Date.now;
    this.concurrency = config.concurrency ?? 1;
    this.catchUp = config.catchUp === true;
    this.pollInterval = config.pollInterval ?? 1000;
    this.store = config.store instanceof JobStore ? config.store : new JobStore(config.store ?? config);

    this._handlers = new Map();
    this._running = new Map();
    this._timer = null;
    this._started = false;
    this._stats = { ticks: 0, runs: 0, errors: 0, skipped: 0 };

    if (Array.isArray(config.jobs)) {
      for (const job of config.jobs) {
        if (!job || !job.id || typeof job.handler !== 'function') continue;
        this.add(job, job.handler);
      }
    }
  }

  get started() {
    return this._started;
  }

  add(job, handler) {
    if (!job || !job.id) throw new Error('Scheduler.add() requires a job with an id');
    if (typeof handler !== 'function') throw new Error(`Scheduler.add("${job.id}") requires a handler function`);

    const existing = this.store.get(job.id);
    const schedule = job.schedule ?? existing?.schedule ?? null;
    if (!schedule) throw new Error(`Scheduler.add("${job.id}") requires a schedule`);
    scheduleKind(schedule);
    scheduleLabel(schedule);

    const changed = !existing || JSON.stringify(existing.schedule) !== JSON.stringify(schedule);
    const timestamp = new Date(this.now()).toISOString();

    const record = {
      id: job.id,
      name: job.name ?? existing?.name ?? job.id,
      schedule,
      enabled: job.enabled ?? existing?.enabled ?? true,
      data: job.data ?? existing?.data ?? null,
      nextRunAt: job.nextRunAt ?? (changed ? nextRunTime(schedule, { now: this.now() }) : existing.nextRunAt),
      lastRunAt: existing?.lastRunAt ?? null,
      lastStatus: existing?.lastStatus ?? null,
      lastError: existing?.lastError ?? null,
      lastDurationMs: existing?.lastDurationMs ?? null,
      runs: existing?.runs ?? 0,
      failures: existing?.failures ?? 0,
      missed: existing?.missed ?? 0,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    this._handlers.set(job.id, handler);
    this.store.save(record);
    if (this._started) this._arm();

    return record;
  }

  remove(id) {
    this._handlers.delete(id);
    return this.store.delete(id);
  }

  get(id) {
    return this.store.get(id);
  }

  list() {
    return this.store.all();
  }

  has(id) {
    return this._handlers.has(id);
  }

  pause(id) {
    const record = this._require(id);
    return this.store.save({ ...record, enabled: false, updatedAt: new Date(this.now()).toISOString() });
  }

  resume(id) {
    const record = this._require(id);
    const next = nextRunTime(record.schedule, { now: this.now() });
    const saved = this.store.save({ ...record, enabled: true, nextRunAt: next, updatedAt: new Date(this.now()).toISOString() });
    if (this._started) this._arm();
    return saved;
  }

  async start() {
    if (this._started) return this;
    this._started = true;

    for (const record of this.store.all()) {
      if (!this._handlers.has(record.id)) {
        this.logger?.warn?.(`[scheduler] no handler registered for job "${record.id}", it stays idle`);
        continue;
      }
      if (!record.enabled) continue;

      const now = this.now();
      const timestamp = new Date(now).toISOString();

      if (!Number.isFinite(record.nextRunAt)) {
        this.store.save({ ...record, nextRunAt: nextRunTime(record.schedule, { now }), updatedAt: timestamp });
        continue;
      }

      if (record.nextRunAt <= now && !this.catchUp) {
        const missed = (record.missed ?? 0) + 1;
        this.store.save({ ...record, nextRunAt: nextRunTime(record.schedule, { now }), missed, updatedAt: timestamp });
        this.logger?.warn?.(`[scheduler] job "${record.id}" missed a run while the process was down, it runs at the next slot`);
      }
    }

    this.emit('start');
    this._arm();
    return this;
  }

  async tick() {
    this._stats.ticks += 1;
    if (!this._started) return 0;

    const now = this.now();
    const due = this.store.all()
      .filter((record) => record.enabled && this._handlers.has(record.id) && Number.isFinite(record.nextRunAt) && record.nextRunAt <= now)
      .sort((a, b) => a.nextRunAt - b.nextRunAt);

    let started = 0;

    for (const record of due) {
      if (this._running.has(record.id)) {
        this._stats.skipped += 1;
        this.store.save({
          ...record,
          nextRunAt: nextRunTime(record.schedule, { now, lastRunAt: record.nextRunAt }),
          updatedAt: new Date(now).toISOString(),
        });
        continue;
      }

      if (this._running.size >= this.concurrency) break;

      started += 1;
      this._launch(record);
    }

    this.emit('tick', { at: now, started });
    this._arm();
    return started;
  }

  async runNow(id) {
    const record = this._require(id);
    if (!this._handlers.has(id)) throw new Error(`No handler registered for job "${id}"`);
    await this._launch(record);
    return this.store.get(id);
  }

  async stop(options = {}) {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._started = false;

    if (options.wait !== false && this._running.size > 0) {
      const pending = [...this._running.values()];
      await Promise.allSettled(pending);
    }

    this.emit('stop');
    return this;
  }

  stats() {
    const records = this.store.all();
    return {
      ...this._stats,
      jobs: records.length,
      enabled: records.filter((record) => record.enabled).length,
      running: this._running.size,
      started: this._started,
    };
  }

  _require(id) {
    const record = this.store.get(id);
    if (!record) throw new Error(`No scheduled job with id "${id}"`);
    return record;
  }

  _launch(record) {
    const handler = this._handlers.get(record.id);
    const startedAt = this.now();

    const run = (async () => {
      try {
        const result = await handler({ ...record, runCount: (record.runs ?? 0) + 1 }, this);
        return { status: 'ok', result };
      } catch (error) {
        return { status: 'error', error };
      }
    })();

    const tracked = run.then((outcome) => {
      this._running.delete(record.id);
      this._finish(record, startedAt, outcome);
    });

    this._running.set(record.id, tracked);
    return tracked;
  }

  _finish(record, startedAt, outcome) {
    const fresh = this.store.get(record.id) ?? record;
    const now = this.now();
    const once = scheduleKind(fresh.schedule) === 'once';
    const failed = outcome.status === 'error';

    const updated = {
      ...fresh,
      enabled: once ? false : fresh.enabled,
      nextRunAt: once ? null : nextRunTime(fresh.schedule, { now, lastRunAt: startedAt }),
      lastRunAt: new Date(startedAt).toISOString(),
      lastStatus: outcome.status,
      lastError: failed ? outcome.error.message : null,
      lastDurationMs: Math.max(0, now - startedAt),
      runs: (fresh.runs ?? 0) + 1,
      failures: (fresh.failures ?? 0) + (failed ? 1 : 0),
      updatedAt: new Date(now).toISOString(),
    };

    this.store.save(updated);
    this._stats.runs += 1;

    if (failed) {
      this._stats.errors += 1;
      this.logger?.warn?.(`[scheduler] job "${updated.id}" failed: ${outcome.error.message}`);
      this.emit('run:error', { job: updated, error: outcome.error });
    } else {
      this.emit('run', { job: updated, result: outcome.result });
    }

    this._arm();
  }

  _arm() {
    if (!this._started) return;
    if (this._timer) clearTimeout(this._timer);

    const now = this.now();
    const armed = this.store.all().filter((record) => record.enabled && this._handlers.has(record.id) && Number.isFinite(record.nextRunAt));
    const soonest = armed.length > 0 ? Math.min(...armed.map((record) => record.nextRunAt)) : now + this.pollInterval;
    const delta = Math.max(0, Math.min(soonest - now, this.pollInterval));

    this._timer = setTimeout(() => {
      this._timer = null;
      this.tick();
    }, delta);
  }
}

Scheduler.scheduleLabel = scheduleLabel;
Scheduler.nextRunTime = nextRunTime;

module.exports = Scheduler;
