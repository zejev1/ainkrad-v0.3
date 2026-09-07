import { describe, expect, it } from 'vitest';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import {
  LiveWorldRuntime,
  OFFLINE_CATCH_UP_MAX_BATCH_QUANTA,
} from '../src/runtime/LiveWorldRuntime';
import { CANONICAL_WORLD_QUANTUM_MINUTES } from '../src/v15/WorldTimeContract';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';

describe('v0.3.18 closed-browser catch-up', () => {
  it('executes every semantic quantum while bounding durable commits', async () => {
    const runtime = await LiveWorldRuntime.create({
      mode: 'observer',
      seed: 'v18-offline-canonical-quanta',
      worldId: 'v18-offline-canonical-quanta',
      store: new InMemoryWorldStore(),
      controlLog: new InMemoryAppendOnlyLog(),
      durable: true,
    });
    const targetWorldMinutes = 20 * WORLD_MINUTES_PER_YEAR;
    let batches = 0;
    let quanta = 0;
    let largestBatch = 0;
    let result = await runtime.catchUpBatchTo(targetWorldMinutes);
    batches += 1;
    quanta += result.semanticQuantaProcessed;
    largestBatch = Math.max(largestBatch, result.semanticQuantaProcessed);
    while (!result.completed) {
      result = await runtime.catchUpBatchTo(targetWorldMinutes);
      batches += 1;
      quanta += result.semanticQuantaProcessed;
      largestBatch = Math.max(largestBatch, result.semanticQuantaProcessed);
    }

    const world = runtime.worldSnapshot();
    expect(result.currentWorldMinutes).toBe(targetWorldMinutes);
    expect(world.calendar.elapsedWorldMinutes).toBe(targetWorldMinutes);
    expect(quanta).toBe(
      targetWorldMinutes / CANONICAL_WORLD_QUANTUM_MINUTES,
    );
    expect(world.v15?.simulationClock.quantumIndex).toBe(quanta);
    expect(largestBatch).toBeLessThanOrEqual(
      OFFLINE_CATCH_UP_MAX_BATCH_QUANTA,
    );
    expect(batches).toBeGreaterThan(40);
    expect(batches).toBeLessThanOrEqual(55);
    expect(world.revision).toBeLessThanOrEqual(batches + 3);
    expect(world.population.births + world.population.deaths).toBeGreaterThan(0);
    expect(world.v18?.recentConversations.length ?? 0).toBeLessThanOrEqual(96);
  });

  it('splits the reported day-300 mobile restoration into safe commits', async () => {
    const store = new InMemoryWorldStore();
    const controlLog = new InMemoryAppendOnlyLog();
    const options = {
      mode: 'intervene' as const,
      seed: 'ainkrad-browser-world',
      worldId: 'ainkrad-live-mobile-catch-up',
      store,
      controlLog,
      durable: true,
    };
    const initial = await LiveWorldRuntime.create(options);
    const day300 = 299 * 1_440 + 5 * 60 + 58;
    let result = await initial.catchUpBatchTo(day300);
    while (!result.completed) result = await initial.catchUpBatchTo(day300);

    const resumed = await LiveWorldRuntime.create(options);
    const target =
      resumed.worldSnapshot().calendar.elapsedWorldMinutes +
      2.1 * WORLD_MINUTES_PER_YEAR;
    let batches = 0;
    let largestBatch = 0;
    do {
      result = await resumed.catchUpBatchTo(target);
      batches += 1;
      largestBatch = Math.max(largestBatch, result.semanticQuantaProcessed);
    } while (!result.completed);

    expect(batches).toBeGreaterThan(1);
    expect(largestBatch).toBeLessThanOrEqual(
      OFFLINE_CATCH_UP_MAX_BATCH_QUANTA,
    );
    expect(result.currentWorldMinutes).toBe(target);
    expect(resumed.worldDiagnosticSummary().living).toBeGreaterThan(0);
  });

  it('returns an idempotent completed result at an already reached target', async () => {
    const runtime = await LiveWorldRuntime.create({
      mode: 'off',
      seed: 'v18-offline-idempotent',
      worldId: 'v18-offline-idempotent',
      store: new InMemoryWorldStore(),
      controlLog: new InMemoryAppendOnlyLog(),
    });
    const target = WORLD_MINUTES_PER_YEAR;
    let result = await runtime.catchUpBatchTo(target);
    while (!result.completed) result = await runtime.catchUpBatchTo(target);
    const before = runtime.worldDiagnosticSummary();
    const duplicate = await runtime.catchUpBatchTo(target);
    const after = runtime.worldDiagnosticSummary();

    expect(duplicate.completed).toBe(true);
    expect(duplicate.processedWorldMinutes).toBe(0);
    expect(duplicate.semanticQuantaProcessed).toBe(0);
    expect(after).toEqual(before);
  });
});
