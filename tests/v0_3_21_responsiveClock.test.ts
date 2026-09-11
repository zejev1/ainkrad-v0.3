import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { ClockContinuity } from '../src/runtime/ClockContinuity';
import { ExternalClockCommands } from '../src/runtime/ExternalClockCommands';
import { MAX_LIVE_PENDING_MINUTES, nextCatchUpBatchSize } from '../src/runtime/LiveAccelerationBudget';
import { offlineWorldMinuteTarget, makeOfflineWorldClockAnchor, parseOfflineWorldClockAnchor } from '../src/runtime/OfflineWorldClock';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { createIndexedDbPersistence } from '../src/persistence/IndexedDbPersistence';
import { LogBackedCardinalJournal } from '../src/cardinal/LogBackedCardinalJournal';
import { WorldEngine } from '../src/world/WorldEngine';
import { WORLD_MINUTES_PER_YEAR as YEAR, type WorldSpeedId } from '../src/world/WorldClock';
import { CANONICAL_WORLD_QUANTUM_MINUTES as Q } from '../src/v15/WorldTimeContract';

const create = (store = new InMemoryWorldStore(), controlLog = new InMemoryAppendOnlyLog()) =>
  LiveWorldRuntime.create({ worldId: 'fix4-clock', seed: 'ainkrad-browser-world', mode: 'observer',
    store, controlLog, boundedLiveAcceleration: true, worldSpeedId: 'century_per_minute' });

describe('FIX4 responsive external acceleration', () => {
  it.each(['fifty_years_per_minute', 'century_per_minute'] as WorldSpeedId[])(
    '%s has a bounded live queue and executes every accepted semantic quantum', async speedId => {
      const runtime = await create();
      runtime.setWorldSpeed(speedId, 1);
      runtime.enqueueLiveElapsed(60_000);
      expect(runtime.liveTiming().pendingWorldMinutes).toBe(MAX_LIVE_PENDING_MINUTES);
      expect(runtime.liveTiming().capacityLimited).toBe(true);
      while (runtime.liveTiming().pendingWorldMinutes > 1e-7) await runtime.advanceResponsive(0);
      expect(runtime.worldSnapshot().calendar.elapsedWorldMinutes).toBe(MAX_LIVE_PENDING_MINUTES);
      expect(runtime.worldSnapshot().v15!.simulationClock.quantumIndex).toBe(MAX_LIVE_PENDING_MINUTES / Q);
      expect(runtime.worldSnapshot().determinism.rngState).not.toEqual((await create()).worldSnapshot().determinism.rngState);
    });

  it('does not accumulate decades during repeated overloaded browser frames', async () => {
    const runtime = await create();
    for (let i = 0; i < 12; i++) {
      await runtime.advanceResponsive(10_000);
      expect(runtime.liveTiming().pendingWorldMinutes).toBeLessThanOrEqual(MAX_LIVE_PENDING_MINUTES);
    }
    expect(runtime.worldSnapshot().calendar.elapsedWorldMinutes).toBeGreaterThan(0);
    runtime.discardPendingLiveTime();
    const actual = runtime.worldSnapshot();
    const reference = await LiveWorldRuntime.create({ worldId: 'fix4-clock', seed: 'ainkrad-browser-world',
      mode: 'observer', store: new InMemoryWorldStore(), controlLog: new InMemoryAppendOnlyLog() });
    await reference.tick(actual.calendar.elapsedWorldMinutes);
    expect(actual).toEqual(reference.worldSnapshot());
  });

  it('applies lower speed between commits and retains the exact world and Cardinal journal', async () => {
    const runtime = await create();
    await runtime.tick(Q * 6);
    const before = runtime.worldSnapshot(), journal = await runtime.cardinalConsole();
    runtime.enqueueLiveElapsed(60_000);
    const mailbox = new ExternalClockCommands();
    mailbox.enqueue({ type: 'set_speed', speedId: 'century_per_minute', multiplier: 1, clockRevision: 10 });
    mailbox.take();
    mailbox.enqueue({ type: 'set_speed', speedId: 'real_time', multiplier: 1, clockRevision: 11 });
    const command = mailbox.take()!;
    expect(command.discardPending).toBe(true);
    runtime.setWorldSpeed(command.speedId, command.multiplier);
    runtime.discardPendingLiveTime();
    expect(runtime.liveTiming().pendingWorldMinutes).toBe(0);
    expect(runtime.worldSnapshot()).toEqual(before);
    expect(await runtime.cardinalConsole()).toEqual(journal);
    await runtime.advanceResponsive(1000);
    expect(runtime.worldSnapshot().calendar.elapsedWorldMinutes).toBeCloseTo(before.calendar.elapsedWorldMinutes + 1 / 60, 7);
  });

  it('keeps a committed in-flight step and never debits the new queue twice', async () => {
    const store = new InMemoryWorldStore(), runtime = await create(store);
    const original = store.commit.bind(store);
    let entered!: () => void, release!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const spy = vi.spyOn(store, 'commit').mockImplementationOnce(async batch => {
      entered(); await gate; return original(batch);
    });
    runtime.enqueueLiveElapsed(60_000);
    const work = runtime.advanceResponsive(0);
    await waiting;
    runtime.discardPendingLiveTime();
    runtime.setWorldSpeed('real_time', 1);
    runtime.enqueueLiveElapsed(60_000);
    release(); await work; spy.mockRestore();
    expect(runtime.worldSnapshot().calendar.elapsedWorldMinutes).toBe(Q);
    expect(runtime.liveTiming().pendingWorldMinutes).toBe(1);
    expect(await store.loadWorld('fix4-clock')).toEqual(runtime.worldSnapshot());
  });

  it('avoids the snapshot-I/O feedback trap while keeping normal batches bounded', () => {
    expect(nextCatchUpBatchSize(1, 400)).toBe(4);
    expect(nextCatchUpBatchSize(4, 100)).toBe(8);
    expect(nextCatchUpBatchSize(8, 2000)).toBe(4);
  });

  it('checks outcome metadata without making a public full-world snapshot', async () => {
    const runtime = await create();
    await runtime.tick(Q * 20);
    const spy = vi.spyOn(WorldEngine.prototype, 'snapshot');
    await runtime.catchUpBatchTo(Q * 24, 4);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('aligns fractional restoration with the next exact Cardinal five-year boundary', async () => {
    const runtime = await create();
    const beforeBoundary = YEAR * 5 - Q + 123;
    while (!(await runtime.catchUpBatchTo(beforeBoundary, 24)).completed) { /* ordered quanta */ }
    const result = await runtime.catchUpBatchTo(YEAR * 5 + Q * 4, 8);
    expect(result.currentWorldMinutes).toBe(YEAR * 5);
    expect(result.cardinalEvaluated).toBe(true);
    const frame = await runtime.tick(0);
    expect(frame.evaluation?.evaluatedWorldMinutes).toBe(YEAR * 5);
  });
});

describe('FIX4 offline continuity and cancellation', () => {
  const position = { worldEpoch: 2, currentWorldMinutes: YEAR * 27 };
  const old = () => ({ version: 'ainkrad-offline-world-clock-1' as const, worldEpoch: 2,
    worldMinutes: YEAR * 86, wallClockMs: 1000, speedId: 'real_time' as const, multiplier: 1 as const });

  it('preserves an old 59-year target until an explicit cancellation and survives an immediate reload', () => {
    const anchor = parseOfflineWorldClockAnchor(JSON.stringify(old()))!;
    const clock = new ClockContinuity(anchor);
    clock.observe(position);
    expect(clock.restore(anchor, 1000)).toBe(YEAR * 86);
    const command = clock.command('real_time', 1, 2000);
    expect(command.discardPending).toBe(true);
    const intent = clock.anchor(2000, 'real_time', 1)!;
    expect(intent.cancelPending).toBe(true);
    expect(intent.targetWorldMinutes).toBeUndefined();
    const reopened = new ClockContinuity(parseOfflineWorldClockAnchor(JSON.stringify(intent)));
    reopened.observe(position);
    expect(reopened.restore(intent, 100_000)).toBeUndefined();
    expect(reopened.command('real_time', 1, 100_000, true).discardPending).toBe(true);
    reopened.acknowledge(command.clockRevision, position, true);
    const saved = reopened.anchor(100_000, 'real_time', 1)!;
    expect(offlineWorldMinuteTarget({ anchor: saved, currentWorldEpoch: 2,
      currentWorldMinutes: position.currentWorldMinutes, nowWallClockMs: 160_000 })).toBe(position.currentWorldMinutes + 1);
  });

  it('can persist stop intent before the first world frame exists', () => {
    const clock = new ClockContinuity(old());
    clock.command('real_time', 1, 2000);
    const intent = clock.anchor(2000, 'real_time', 1)!;
    expect(intent.cancelPending).toBe(true);
    expect(offlineWorldMinuteTarget({ anchor: intent, currentWorldEpoch: 2,
      currentWorldMinutes: position.currentWorldMinutes, nowWallClockMs: 99_000 })).toBe(position.currentWorldMinutes);
  });

  it('persists catch-up progress without adding time spent on the same unfinished calculation', () => {
    const clock = new ClockContinuity(old());
    clock.observe(position);
    clock.restore(old(), 1000);
    clock.observe({ ...position, currentWorldMinutes: YEAR * 28 });
    const anchor = clock.anchor(20_000, 'century_per_minute', 1)!;
    expect(anchor.worldMinutes).toBe(YEAR * 28);
    expect(anchor.targetWorldMinutes).toBe(YEAR * 86);
    expect(offlineWorldMinuteTarget({ anchor, currentWorldEpoch: 2,
      currentWorldMinutes: YEAR * 28, nowWallClockMs: 90_000 })).toBe(YEAR * 86);
    clock.observe(position); // stale UI frame cannot undo committed progress
    expect(clock.anchor(90_000, 'real_time', 1)!.worldMinutes).toBe(YEAR * 28);
  });

  it('defaults closed-tab time to real time and offers explicit accelerated background time', () => {
    const clock = new ClockContinuity();
    clock.observe(position);
    const normal = clock.anchor(1000, 'century_per_minute', 1)!;
    const target = (anchor: typeof normal) => offlineWorldMinuteTarget({ anchor, currentWorldEpoch: 2,
      currentWorldMinutes: YEAR * 27, nowWallClockMs: 61_000 });
    expect(target(normal)).toBe(YEAR * 27 + 1);
    clock.backgroundMode = 'selected';
    expect(target(clock.anchor(1000, 'century_per_minute', 1)!)).toBe(YEAR * 127);
  });

  it('rejects stale cross-tab requests and preserves stop when commands arrive rapidly', () => {
    const mailbox = new ExternalClockCommands();
    mailbox.enqueue({ type: 'set_speed', speedId: 'century_per_minute', multiplier: 1, clockRevision: 10 }); mailbox.take();
    mailbox.enqueue({ type: 'set_speed', speedId: 'real_time', multiplier: 1, clockRevision: 11 });
    expect(mailbox.acceptsTarget(10)).toBe(false);
    expect(mailbox.acceptsTarget(11)).toBe(false);
    mailbox.enqueue({ type: 'set_speed', speedId: 'year_per_minute', multiplier: 1, clockRevision: 12 });
    expect(mailbox.take()!.discardPending).toBe(true);
    expect(mailbox.enqueue({ type: 'set_speed', speedId: 'century_per_minute', multiplier: 1, clockRevision: 10 })).toBe(false);
    expect(mailbox.acceptsTarget(10)).toBe(false);
    expect(() => mailbox.enqueue({ type: 'set_speed', speedId: 'real_time', multiplier: 1, clockRevision: NaN })).toThrow();
  });

  it('rejects invalid anchors, old epochs and old revision progress', () => {
    const clock = new ClockContinuity(old());
    clock.observe(position); clock.restore(old(), 1000);
    const command = clock.command('real_time', 1, 2000);
    expect(clock.accepts(command.clockRevision - 1)).toBe(false);
    expect(clock.acknowledge(command.clockRevision - 1, position, false)).toBe(false);
    clock.acknowledge(command.clockRevision, position, true);
    clock.observe({ worldEpoch: 3, currentWorldMinutes: 0 });
    expect(clock.restore(old(), 99_000)).toBeUndefined();
    expect(parseOfflineWorldClockAnchor(JSON.stringify({ ...old(), clockRevision: -1 }))).toBeUndefined();
    expect(() => makeOfflineWorldClockAnchor({ ...old(), targetWorldMinutes: Infinity })).toThrow();
  });

  it('keeps the IndexedDB world, genealogy, RNG and Cardinal evidence through cancel and reload', async () => {
    const bundle = createIndexedDbPersistence('fix4-cancel-reload');
    const options = { worldId: 'fix4-durable', seed: 'ainkrad-browser-world', mode: 'observer' as const,
      store: bundle.worldStore, controlLog: bundle.controlLog, durable: true, boundedLiveAcceleration: true };
    const runtime = await LiveWorldRuntime.create(options);
    await runtime.tick(Q * 6);
    const before = runtime.worldSnapshot();
    const journal = new LogBackedCardinalJournal(bundle.controlLog);
    const evaluations = await journal.evaluations(before.id);
    expect(evaluations.length).toBeGreaterThan(0);
    runtime.enqueueLiveElapsed(60_000);
    runtime.discardPendingLiveTime();
    const reopened = await LiveWorldRuntime.create(options);
    expect(reopened.worldSnapshot()).toEqual(before);
    expect(await journal.evaluations(before.id)).toEqual(evaluations);
    expect(await bundle.worldStore.loadWorld(before.id)).toEqual(before);
  });
});
