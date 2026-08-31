import { describe, expect, it } from 'vitest';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';

describe('Live world continuity', () => {
  it('does not show stale resume metadata after a new epoch starts', async () => {
    const runtime = await LiveWorldRuntime.create({
      mode: 'observer',
      seed: 'reset-continuity',
      worldId: 'reset-continuity',
      store: new InMemoryWorldStore(),
      controlLog: new InMemoryAppendOnlyLog(),
      durable: true,
      worldSpeedId: 'hour_per_minute',
    });
    await runtime.tick();
    await runtime.resetWorld();
    const resetFrame = await runtime.tick();

    expect(resetFrame.world.calendar.elapsedWorldMinutes).toBe(1);
    expect(resetFrame.continuity.resumed).toBe(false);
    expect(resetFrame.continuity.resumedFromWorldMinutes).toBe(0);
    expect(
      Object.values(resetFrame.world.agents).every(
        (agent) => !agent.lastAction && !agent.lastDecision && !agent.movement,
      ),
    ).toBe(true);
  });

  it('reopens the committed world and Cardinal evidence instead of starting over', async () => {
    const store = new InMemoryWorldStore();
    const controlLog = new InMemoryAppendOnlyLog();
    const options = {
      mode: 'observer' as const,
      seed: 'browser-continuity-seed',
      worldId: 'browser-continuity',
      store,
      controlLog,
      durable: true,
    };

    const firstRuntime = await LiveWorldRuntime.create(options);
    const first = await firstRuntime.tick();
    const second = await firstRuntime.tick();

    expect(first.continuity).toEqual({
      durable: true,
      resumed: false,
      resumedFromTick: 0,
      resumedFromWorldMinutes: 0,
    });
    expect(second.tick).toBe(2);
    expect(second.world.calendar.elapsedWorldMinutes).toBe(
      first.world.calendar.elapsedWorldMinutes + second.clock.worldMinutesPerTick,
    );

    const reopenedRuntime = await LiveWorldRuntime.create(options);
    const resumed = await reopenedRuntime.tick();

    expect(resumed.tick).toBe(3);
    expect(resumed.world.now).toBe(3);
    expect(resumed.world.calendar.elapsedWorldMinutes).toBeGreaterThan(
      second.world.calendar.elapsedWorldMinutes,
    );
    expect(resumed.continuity).toEqual({
      durable: true,
      resumed: true,
      resumedFromTick: 2,
      resumedFromWorldMinutes: second.world.calendar.elapsedWorldMinutes,
    });
    expect(resumed.evaluationCount).toBeGreaterThan(
      second.evaluationCount,
    );
    expect(resumed.recentEvents.length).toBeGreaterThan(0);
  });

  it('lets a fresh Cardinal detect persistent pressure and reach the gateway', async () => {
    const runtime = await LiveWorldRuntime.create({
      mode: 'intervene',
      seed: 'ainkrad-browser-world',
      worldId: 'fresh-cardinal-world',
      store: new InMemoryWorldStore(),
      controlLog: new InMemoryAppendOnlyLog(),
      disturbances: [
        { tick: 12, kind: 'resource_shock', magnitude: 0.86 },
      ],
    });

    let frame = await runtime.tick();
    for (let tick = 2; tick <= 24; tick += 1) {
      frame = await runtime.tick();
    }

    expect(frame.cardinalActivity.proposalCount).toBeGreaterThan(0);
    expect(frame.cardinalActivity.authorizationDecisionCount).toBeGreaterThan(0);
    expect(frame.executedInterventionCount).toBeGreaterThan(0);

    const consoleSnapshot = await runtime.cardinalConsole();
    expect(consoleSnapshot.laws.length).toBeGreaterThan(0);
    expect(consoleSnapshot.readableLawReports).toHaveLength(
      consoleSnapshot.laws.length,
    );
    expect(consoleSnapshot.readableInterventionReports).toHaveLength(
      consoleSnapshot.interventions.length,
    );
    expect(consoleSnapshot.worldHealth.title).toBe('Состояние мира Ainkrad');
    expect(consoleSnapshot.worldHealth.sections.some(
      (section) => section.id === 'cardinal',
    )).toBe(true);
    expect(Array.isArray(consoleSnapshot.deathDiagnostics)).toBe(true);
    expect(consoleSnapshot.evaluations.length).toBeLessThanOrEqual(160);
    expect(consoleSnapshot.interventions.length).toBeGreaterThan(0);
    expect(
      consoleSnapshot.audits.some(
        (audit) =>
          audit.evaluationId === consoleSnapshot.interventions[0].evaluationId,
      ),
    ).toBe(true);
  });

  it('keeps historic Cardinal learning but resets visible intervention counters per world epoch', async () => {
    const runtime = await LiveWorldRuntime.create({
      mode: 'intervene',
      seed: 'cardinal-epoch-counter-isolation',
      worldId: 'cardinal-epoch-counter-isolation',
      store: new InMemoryWorldStore(),
      controlLog: new InMemoryAppendOnlyLog(),
      disturbances: [
        { tick: 12, kind: 'resource_shock', magnitude: 0.86 },
      ],
    });

    let prior = await runtime.tick();
    for (let tick = 2; tick <= 24; tick += 1) prior = await runtime.tick();
    expect(prior.executedInterventionCount).toBeGreaterThan(0);

    await runtime.resetWorld('cardinal-epoch-counter-isolation-new');
    const freshEpoch = await runtime.tick(0);
    expect(freshEpoch.world.epoch).toBe(2);
    expect(freshEpoch.evaluationCount).toBe(0);
    expect(freshEpoch.executedInterventionCount).toBe(0);
    expect(freshEpoch.cardinalActivity.proposalCount).toBe(0);
    expect(freshEpoch.cardinalActivity.authorizationDecisionCount).toBe(0);
    expect(freshEpoch.cardinalActivity.deniedInterventionCount).toBe(0);
    const consoleSnapshot = await runtime.cardinalConsole();
    expect(consoleSnapshot.evaluations).toEqual([]);
    expect(consoleSnapshot.interventions).toEqual([]);
    expect(consoleSnapshot.outcomes).toEqual([]);
    expect(consoleSnapshot.audits).toEqual([]);
  }, 30_000);
});

describe('Cardinal semantic speed equivalence', () => {
  it('gives Cardinal identical opportunities at ×1, ×10 and ×100 for equal Ainkrad time', async () => {
    async function runAtSpeed(
      worldSpeedMultiplier: 1 | 10 | 100,
      workerTicks: number,
    ) {
      const runtime = await LiveWorldRuntime.create({
        mode: 'observer',
        seed: 'cardinal-world-time-speed-equivalence',
        worldId: 'cardinal-world-time-speed-equivalence',
        store: new InMemoryWorldStore(),
        controlLog: new InMemoryAppendOnlyLog(),
        worldSpeedId: 'year_per_minute',
        worldSpeedMultiplier,
      });
      let frame = await runtime.tick();
      for (let workerTick = 1; workerTick < workerTicks; workerTick += 1) {
        frame = await runtime.tick();
      }
      return {
        world: frame.world,
        console: await runtime.cardinalConsole(),
      };
    }

    const atOne = await runAtSpeed(1, 100);
    const atTen = await runAtSpeed(10, 10);
    const atHundred = await runAtSpeed(100, 1);

    expect(atOne.world.calendar.elapsedWorldMinutes).toBe(876_000);
    expect(atTen.world).toEqual(atOne.world);
    expect(atHundred.world).toEqual(atOne.world);
    expect(atTen.console.evaluations).toEqual(atOne.console.evaluations);
    expect(atHundred.console.evaluations).toEqual(atOne.console.evaluations);
    expect(atTen.console.audits).toEqual(atOne.console.audits);
    expect(atHundred.console.audits).toEqual(atOne.console.audits);
    expect(
      atOne.console.evaluations
        .map((item) => item.evaluatedWorldMinutes)
        .slice(0, 3),
    ).toEqual(
      [8_760, 17_520, 26_280],
    );
    expect(
      atOne.console.evaluations.every(
        (item) => item.evaluatedWorldMinutes % 8_760 === 0,
      ),
    ).toBe(true);
  }, 60_000);
});
