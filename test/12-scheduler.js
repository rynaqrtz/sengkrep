const fs = require('fs');
const os = require('os');
const path = require('path');
const sengkrep = require('../index');
const Scheduler = require('../src/modules/Scheduler');
const JobStore = require('../src/modules/JobStore');
const cron = require('../src/modules/cron');
const { test, assert, delay, finish } = require('./harness');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sengkrep-jobs-'));

function iso(ms) {
  return new Date(ms).toISOString();
}

function controlled() {
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  return { promise, release };
}

async function main() {
  await test('cron lands on the next matching minute', () => {
    const from = Date.parse('2026-09-13T10:02:30Z');
    assert.strictEqual(iso(cron.nextRunTime('*/5 * * * *', { now: from })), '2026-09-13T10:05:00.000Z');
    assert.strictEqual(iso(cron.nextRunTime('*/15 9-17 * * *', { now: Date.parse('2026-09-13T09:07:00Z') })), '2026-09-13T09:15:00.000Z');
  });

  await test('cron matches a fixed hour on the next day', () => {
    const from = Date.parse('2026-09-13T10:02:30Z');
    assert.strictEqual(iso(cron.nextRunTime('0 3 * * *', { now: from })), '2026-09-14T03:00:00.000Z');
    assert.strictEqual(iso(cron.nextRunTime('30 8 * * mon', { now: from })), '2026-09-14T08:30:00.000Z');
  });

  await test('cron combines day of month and day of week with or', () => {
    const fromSunday = cron.nextRunTime('0 12 13 * 5', { now: Date.parse('2026-09-06T00:00:00Z') });
    assert.strictEqual(iso(fromSunday), '2026-09-11T12:00:00.000Z');

    const fromSaturday = cron.nextRunTime('0 12 13 * 5', { now: Date.parse('2026-09-12T00:00:00Z') });
    assert.strictEqual(iso(fromSaturday), '2026-09-13T12:00:00.000Z');
  });

  await test('cron rejects malformed expressions', () => {
    assert.throws(() => cron.parseCron('0 3 * *'), /needs 5 fields/);
    assert.throws(() => cron.parseCron('*/0 * * * *'), /Invalid step/);
    assert.throws(() => cron.parseCron('0 25 * * *'), /out of range/);
    assert.throws(() => cron.parseCron('0 3 * * nope'), /Invalid range/);
    assert.throws(() => cron.nextRunTime({ nothing: true }), /must be a cron string/);
  });

  await test('durations parse to milliseconds', () => {
    assert.strictEqual(cron.parseDuration(1500), 1500);
    assert.strictEqual(cron.parseDuration('30s'), 30000);
    assert.strictEqual(cron.parseDuration('5m'), 300000);
    assert.strictEqual(cron.parseDuration('2h'), 7200000);
    assert.strictEqual(cron.parseDuration('1d'), 86400000);
    assert.strictEqual(cron.parseDuration('250ms'), 250);
    assert.throws(() => cron.parseDuration('soon'), /Invalid duration/);
    assert.strictEqual(cron.formatDuration(300000), '5m');
    assert.strictEqual(cron.formatDuration(1500), '1500ms');
  });

  await test('interval schedules keep alignment and skip missed slots', () => {
    assert.strictEqual(cron.nextRunTime({ everyMs: 1000 }, { now: 10000 }), 11000);
    assert.strictEqual(cron.nextRunTime({ every: '1m' }, { now: 0 }), 60000);
    assert.strictEqual(cron.nextRunTime({ everyMs: 1000 }, { now: 10000, lastRunAt: 9000 }), 11000);
    assert.strictEqual(cron.nextRunTime({ ms: 5000 }, { now: 60000, lastRunAt: 5000 }), 65000);
    assert.strictEqual(cron.nextRunTime({ at: 20000 }, { now: 10000 }), 20000);
    assert.throws(() => cron.nextRunTime({ everyMs: 0 }), /greater than zero/);
  });

  await test('schedule labels describe what was configured', () => {
    assert.strictEqual(cron.scheduleLabel('*/5 * * * *'), '*/5 * * * *');
    assert.strictEqual(cron.scheduleLabel({ every: '30s' }), 'every 30s');
    assert.strictEqual(cron.scheduleLabel({ everyMs: 90000 }), 'every 90s');
  });

  await test('job store keeps records behind an index', () => {
    const store = new JobStore({ backend: 'memory' });

    store.save({ id: 'b', nextRunAt: 200 });
    store.save({ id: 'a', nextRunAt: 100 });

    assert.strictEqual(store.has('a'), true);
    assert.strictEqual(store.get('a').id, 'a');
    assert.strictEqual(store.get('missing'), null);
    assert.deepStrictEqual(store.list(), ['a', 'b']);
    assert.deepStrictEqual(store.all().map((record) => record.id), ['a', 'b']);

    store.save({ id: 'a', nextRunAt: 50 });
    assert.deepStrictEqual(store.list(), ['a', 'b']);

    assert.strictEqual(store.delete('a'), true);
    assert.strictEqual(store.delete('a'), false);
    assert.deepStrictEqual(store.list(), ['b']);

    assert.strictEqual(store.clear(), true);
    assert.deepStrictEqual(store.list(), []);
  });

  await test('job store drops index entries whose record is gone', () => {
    const store = new JobStore({ backend: 'memory' });
    store.save({ id: 'gone', nextRunAt: 1 });
    store.storage.delete(store.key('gone'));

    assert.deepStrictEqual(store.list(), []);
    assert.strictEqual(store.save({ id: 'kept' }).id, 'kept');
    assert.deepStrictEqual(store.list(), ['kept']);
  });

  await test('job store survives a new instance on the same directory', () => {
    const dir = path.join(TMP, 'store');
    const first = new JobStore({ backend: 'file', storageDir: dir });
    first.save({ id: 'nightly', schedule: '0 3 * * *', enabled: true, nextRunAt: 123 });

    const second = new JobStore({ backend: 'file', storageDir: dir });
    const record = second.get('nightly');

    assert.strictEqual(record.nextRunAt, 123);
    assert.strictEqual(record.schedule, '0 3 * * *');
    assert.deepStrictEqual(second.list(), ['nightly']);
  });

  await test('scheduler runs a due interval job and advances it', async () => {
    let clock = 1000000;
    const seen = [];
    const scheduler = new Scheduler({ backend: 'memory', now: () => clock, pollInterval: 60000 });
    scheduler.add({ id: 'tick', schedule: { everyMs: 1000 } }, (job) => { seen.push(job.runCount); });

    await scheduler.start();
    assert.strictEqual(await scheduler.tick(), 0);
    assert.deepStrictEqual(seen, []);

    clock += 1000;
    assert.strictEqual(await scheduler.tick(), 1);
    await delay(10);

    const record = scheduler.get('tick');
    assert.deepStrictEqual(seen, [1]);
    assert.strictEqual(record.runs, 1);
    assert.strictEqual(record.lastStatus, 'ok');
    assert.strictEqual(record.lastError, null);
    assert.strictEqual(record.nextRunAt, 1002000);
    assert.strictEqual(record.lastRunAt, iso(1001000));

    await scheduler.stop();
    assert.strictEqual(scheduler.started, false);
  });

  await test('scheduler skips a run while the job is still running', async () => {
    let clock = 2000000;
    const gate = controlled();
    let runs = 0;
    const scheduler = new Scheduler({ backend: 'memory', now: () => clock, pollInterval: 60000 });
    scheduler.add({ id: 'slow', schedule: { everyMs: 1000 } }, async () => { runs += 1; await gate.promise; });

    await scheduler.start();
    clock += 1000;
    assert.strictEqual(await scheduler.tick(), 1);
    assert.strictEqual(scheduler.stats().running, 1);

    clock += 1000;
    assert.strictEqual(await scheduler.tick(), 0);
    assert.strictEqual(scheduler.stats().skipped, 1);
    assert.strictEqual(runs, 1);
    assert.strictEqual(scheduler.get('slow').nextRunAt, 2003000);

    gate.release();
    await scheduler.stop();
    assert.strictEqual(runs, 1);
    assert.strictEqual(scheduler.get('slow').runs, 1);
  });

  await test('scheduler records a failed run and emits it', async () => {
    const seen = [];
    const scheduler = new Scheduler({ backend: 'memory', now: () => 3000000, pollInterval: 60000 });
    scheduler.add({ id: 'bad', schedule: { everyMs: 1000 } }, () => { throw new Error('handler exploded'); });
    scheduler.on('run:error', (event) => seen.push(event));

    await scheduler.start();
    const record = await scheduler.runNow('bad');

    assert.strictEqual(record.lastStatus, 'error');
    assert.strictEqual(record.lastError, 'handler exploded');
    assert.strictEqual(record.failures, 1);
    assert.strictEqual(record.runs, 1);
    assert.strictEqual(seen.length, 1);
    assert.strictEqual(seen[0].error.message, 'handler exploded');
    assert.strictEqual(scheduler.stats().errors, 1);

    await scheduler.stop();
  });

  await test('runNow ignores the schedule and emits run', async () => {
    const seen = [];
    const scheduler = new Scheduler({ backend: 'memory', now: () => 4000000, pollInterval: 60000 });
    scheduler.add({ id: 'manual', schedule: { every: '6h' } }, () => 'done');
    scheduler.on('run', (event) => seen.push(event.result));

    await scheduler.start();
    const record = await scheduler.runNow('manual');

    assert.strictEqual(record.runs, 1);
    assert.deepStrictEqual(seen, ['done']);
    assert.strictEqual(record.nextRunAt, 4000000 + 6 * 3600000);

    await scheduler.stop();
  });

  await test('pause and resume move the next run', async () => {
    const scheduler = new Scheduler({ backend: 'memory', now: () => 5000000, pollInterval: 60000 });
    scheduler.add({ id: 'paused', schedule: { everyMs: 2000 } }, () => {});

    await scheduler.start();
    assert.strictEqual(scheduler.pause('paused').enabled, false);
    assert.strictEqual(await scheduler.tick(), 0);

    const resumed = scheduler.resume('paused');
    assert.strictEqual(resumed.enabled, true);
    assert.strictEqual(resumed.nextRunAt, 5002000);

    await scheduler.stop();
  });

  await test('catchUp decides what happens to a missed run', async () => {
    const store = new JobStore({ backend: 'memory' });
    let clock = 6000000;

    const first = new Scheduler({ store, now: () => clock, pollInterval: 60000 });
    first.add({ id: 'nightly', schedule: { everyMs: 1000 } }, () => {});
    await first.start();
    await first.stop();

    clock = 6999999;
    const quiet = new Scheduler({ store, now: () => clock, pollInterval: 60000 });
    quiet.add({ id: 'nightly', schedule: { everyMs: 1000 } }, () => {});
    await quiet.start();
    assert.strictEqual(quiet.get('nightly').missed, 1);
    assert.strictEqual(quiet.get('nightly').nextRunAt, 7000999);
    assert.strictEqual(await quiet.tick(), 0);
    await quiet.stop();

    store.save({ ...store.get('nightly'), nextRunAt: clock - 5000 });

    const catching = new Scheduler({ store, now: () => clock, catchUp: true, pollInterval: 60000 });
    catching.add({ id: 'nightly', schedule: { everyMs: 1000 } }, () => {});
    await catching.start();
    assert.strictEqual(await catching.tick(), 1);
    await catching.stop();
    assert.strictEqual(catching.get('nightly').runs, 1);
  });

  await test('a one-shot job runs once and disables itself', async () => {
    let clock = 7000000;
    const scheduler = new Scheduler({ backend: 'memory', now: () => clock, pollInterval: 60000 });
    scheduler.add({ id: 'once', schedule: { at: 7000000 } }, () => {});

    await scheduler.start();
    assert.strictEqual(await scheduler.tick(), 1);
    await delay(10);

    const record = scheduler.get('once');
    assert.strictEqual(record.runs, 1);
    assert.strictEqual(record.enabled, false);
    assert.strictEqual(record.nextRunAt, null);

    clock += 60000;
    assert.strictEqual(await scheduler.tick(), 0);

    await scheduler.stop();
  });

  await test('scheduler leaves jobs without a handler idle', async () => {
    const store = new JobStore({ backend: 'memory' });
    store.save({ id: 'orphan', name: 'orphan', schedule: { everyMs: 1 }, enabled: true, nextRunAt: 1 });

    const scheduler = new Scheduler({ store, now: () => 8000000, catchUp: true, pollInterval: 60000 });
    await scheduler.start();

    assert.strictEqual(await scheduler.tick(), 0);
    assert.strictEqual(scheduler.stats().jobs, 1);
    assert.strictEqual(scheduler.has('orphan'), false);

    await scheduler.stop();
  });

  await test('scheduler honors the concurrency limit', async () => {
    let clock = 9000000;
    const gate = controlled();
    const done = [];
    const scheduler = new Scheduler({ backend: 'memory', concurrency: 1, now: () => clock, pollInterval: 60000 });

    scheduler.add({ id: 'one', schedule: { everyMs: 1000 } }, async () => { await gate.promise; done.push('one'); });
    scheduler.add({ id: 'two', schedule: { everyMs: 1000 } }, () => { done.push('two'); });

    await scheduler.start();
    clock += 1000;

    assert.strictEqual(await scheduler.tick(), 1);
    assert.strictEqual(scheduler.stats().running, 1);
    assert.deepStrictEqual(done, []);

    gate.release();
    await delay(50);
    assert.deepStrictEqual(done, ['one', 'two']);
    assert.strictEqual(scheduler.stats().running, 0);

    await scheduler.stop();
  });

  await test('scheduler removes jobs and reports unknown ids', async () => {
    const scheduler = new Scheduler({ backend: 'memory', now: () => 9500000, pollInterval: 60000 });
    scheduler.add({ id: 'temp', schedule: { everyMs: 1000 } }, () => {});

    assert.throws(() => scheduler.pause('nope'), /No scheduled job/);
    assert.throws(() => scheduler.resume('nope'), /No scheduled job/);
    await scheduler.start();
    await assert.rejects(scheduler.runNow('nope'), /No scheduled job/);
    assert.strictEqual(scheduler.remove('temp'), true);
    assert.strictEqual(scheduler.remove('temp'), false);
    assert.deepStrictEqual(scheduler.list(), []);
    assert.throws(() => scheduler.add({ schedule: { everyMs: 1 } }, () => {}), /requires a job with an id/);
    assert.throws(() => scheduler.add({ id: 'x' }), /requires a handler/);

    await scheduler.stop();
  });

  await test('sengkrep wires the scheduler only when it is configured', async () => {
    const bare = sengkrep.create({ logLevel: 'error' });
    assert.strictEqual(bare.scheduler, null);
    bare.close();

    const runs = [];
    const scraper = sengkrep.create({
      logLevel: 'error',
      scheduler: {
        backend: 'memory',
        jobs: [{ id: 'sync', schedule: { every: '1h' }, handler: (job) => { runs.push(job.id); } }],
      },
    });

    assert.ok(scraper.scheduler instanceof Scheduler);
    assert.strictEqual(scraper.scheduler.list().length, 1);
    assert.strictEqual(scraper.scheduler.get('sync').nextRunAt > Date.now(), true);

    await scraper.scheduler.runNow('sync');
    assert.deepStrictEqual(runs, ['sync']);

    scraper.close();
    assert.strictEqual(scraper.scheduler.started, false);
  });

  await test('the scheduler surface is exported from the package root', () => {
    assert.strictEqual(typeof sengkrep.Scheduler, 'function');
    assert.strictEqual(typeof sengkrep.JobStore, 'function');
    assert.strictEqual(typeof sengkrep.cron.nextRunTime, 'function');
    assert.strictEqual(sengkrep.cron.scheduleKind('0 3 * * *'), 'cron');
    assert.strictEqual(sengkrep.cron.scheduleKind({ every: '1m' }), 'interval');
    assert.strictEqual(sengkrep.cron.scheduleKind({ at: 0 }), 'once');
  });

  finish('12-scheduler');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
