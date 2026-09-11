import { describe, expect, it } from 'vitest';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { LiveWallClock, liveLoopDelay } from '../src/runtime/LiveWallClock';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';

const create = () => LiveWorldRuntime.create({ worldId: 'fix2-clock', seed: 'ainkrad-browser-world',
  mode: 'observer', store: new InMemoryWorldStore(), controlLog: new InMemoryAppendOnlyLog(),
  worldSpeedId: 'year_per_minute', worldSpeedMultiplier: 1 });

describe('FIX2 elapsed time and bounded live work', () => {
  it('counts work, persistence and a long throttled interval exactly once; excludes a deliberate pause', () => {
    const clock = new LiveWallClock(0);
    let counted = 0;
    // Each iteration spends 250ms working and 50ms yielding. The old worker
    // only charged those last 50ms, giving six times less acceleration.
    for (let now = 300; now <= 60_000; now += 300) counted += clock.sample(now);
    expect(counted).toBe(60_000);
    expect(clock.sample(72_500)).toBe(12_500);
    clock.reset(100_000);
    expect(clock.sample(100_200)).toBe(200);
    expect(liveLoopDelay(250, 0)).toBe(750);
    expect(liveLoopDelay(250, 100)).toBe(150);
  });

  it('simulates the same year and Cardinal observations with or without presentation frames', async () => {
    const runtime = await create(), control = await create();
    for (let i = 0; i < 60; i++) await runtime.advanceResponsive(1000, false);
    while (runtime.liveTiming().pendingWorldMinutes > 1e-7) await runtime.advanceResponsive(0, false);
    const actual = await runtime.tick(0), expected = await control.tick(WORLD_MINUTES_PER_YEAR);
    expect(actual.world).toEqual(expected.world);
    expect((await runtime.cardinalConsole()).evaluations).toEqual((await control.cardinalConsole()).evaluations);
    expect(actual.world.calendar.elapsedWorldMinutes).toBe(WORLD_MINUTES_PER_YEAR);
    // Public snapshots must remain isolated after eliminating internal clones.
    actual.world.agents.agent_1.name = 'caller mutation';
    expect((await runtime.tick(0)).world.agents.agent_1.name).not.toBe('caller mutation');
  }, 60_000);

  it('retains work across speed changes, counts ten years for one minute, and exposes real backlog', async () => {
    const runtime = await create();
    runtime.setWorldSpeed('decade_per_minute', 1);
    const started = performance.now();
    let frame = await runtime.responsiveTick(60_000);
    expect(frame.liveTiming!.pendingWorldMinutes).toBeGreaterThan(0);
    runtime.setWorldSpeed('real_time', 1);
    while (runtime.liveTiming().pendingWorldMinutes > 1e-7) await runtime.advanceResponsive(0, false);
    frame = await runtime.tick(0);
    expect(frame.world.calendar.elapsedWorldMinutes).toBeCloseTo(WORLD_MINUTES_PER_YEAR * 10, 6);
    console.log(JSON.stringify({ benchmark: '10 requested world years', realSeconds: (performance.now() - started) / 1000,
      simulatedYears: frame.world.calendar.elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR,
      living: Object.values(frame.world.agents).filter(a => a.life.alive).length }));
  }, 60_000);

  it('transfers overlapping time to an offline target and clears old-epoch debt only on explicit reset', async () => {
    const runtime = await create();
    runtime.enqueueLiveElapsed(1000);
    const queued = runtime.liveTiming().pendingWorldMinutes;
    runtime.coverLiveTimeThrough(queued / 2);
    expect(runtime.liveTiming().pendingWorldMinutes).toBe(queued / 2);
    runtime.coverLiveTimeThrough(queued * 3 / 4);
    expect(runtime.liveTiming().pendingWorldMinutes).toBe(queued / 4);
    runtime.coverLiveTimeThrough(queued * 3 / 4);
    expect(runtime.liveTiming().pendingWorldMinutes).toBe(queued / 4);
    runtime.coverLiveTimeThrough(queued * 100, 999);
    expect(runtime.liveTiming().pendingWorldMinutes).toBe(queued / 4);
    await runtime.resetWorld();
    expect(runtime.liveTiming().pendingWorldMinutes).toBe(0);
  });

  it('does not debit an in-flight commit twice when switching from live work to catch-up', async () => {
    const runtime = await create();
    runtime.enqueueLiveElapsed(4000);
    const owed = runtime.liveTiming().pendingWorldMinutes;
    const pendingCommit = runtime.advanceResponsive(0, false);
    runtime.coverLiveTimeThrough(owed / 2);
    await pendingCommit;
    expect(runtime.liveTiming().pendingWorldMinutes).toBeCloseTo(owed / 2);
    while (!(await runtime.catchUpBatchTo(owed / 2)).completed) { /* bounded batches */ }
    while (runtime.liveTiming().pendingWorldMinutes > 1e-7) await runtime.advanceResponsive(0, false);
    expect(runtime.worldContinuityPosition().elapsedWorldMinutes).toBe(owed);
  });
});
