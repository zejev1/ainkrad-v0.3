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

    const reopenedRuntime = await LiveWorldRuntime.create(options);
    const resumed = await reopenedRuntime.tick();

    expect(resumed.tick).toBe(3);
    expect(resumed.world.now).toBe(3);
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
});
