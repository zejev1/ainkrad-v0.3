import { describe, expect, it } from 'vitest';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';

describe('Live world continuity', () => {
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
    expect(consoleSnapshot.evaluations.length).toBeLessThanOrEqual(160);
    expect(consoleSnapshot.interventions.length).toBeGreaterThan(0);
    expect(
      consoleSnapshot.audits.some(
        (audit) =>
          audit.evaluationId === consoleSnapshot.interventions[0].evaluationId,
      ),
    ).toBe(true);
  });
});
