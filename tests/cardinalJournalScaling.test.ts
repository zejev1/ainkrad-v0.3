import { describe, expect, it } from 'vitest';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import { LogBackedCardinalJournal } from '../src/cardinal/LogBackedCardinalJournal';
import { buildCardinalResearchContext } from '../src/cardinal/CardinalResearch';
import {
  InMemoryAppendOnlyLog,
  type AppendOnlyLog,
} from '../src/persistence/AppendOnlyLog';
import type { SensorSnapshot } from '../src/sensors/types';

class CountingAppendOnlyLog implements AppendOnlyLog {
  readonly inner = new InMemoryAppendOnlyLog();
  reads = 0;
  rangeReads = 0;
  tailReads = 0;
  lengthReads = 0;

  async read(streamId: string): Promise<string[]> {
    this.reads += 1;
    return await this.inner.read(streamId);
  }

  async length(streamId: string): Promise<number> {
    this.lengthReads += 1;
    return await this.inner.length(streamId);
  }

  async readRange(streamId: string, start: number, limit: number): Promise<string[]> {
    this.rangeReads += 1;
    return await this.inner.readRange(streamId, start, limit);
  }

  async readTail(streamId: string, limit: number): Promise<string[]> {
    this.tailReads += 1;
    return await this.inner.readTail(streamId, limit);
  }

  async append(streamId: string, expectedLength: number, record: string): Promise<number> {
    return await this.inner.append(streamId, expectedLength, record);
  }
}

function observation(observedAt: number): SensorSnapshot {
  return {
    sensorVersion: 'ainkrad-world-sensors-0.3.11',
    worldId: 'mature-journal',
    worldRevision: observedAt,
    observedAt,
    metrics: {
      populationActivity: 0.5,
      averageStress: 0.25,
      socialIsolation: 0.3,
      conflictPressure: 0.1,
      safetyPressure: 0.2,
      resourcePressure: 0.25,
      relationshipDiversity: 0.6,
      recoveryCapacity: 0.75,
      exploredWorldRatio: 0.5,
      wildlifePressure: 0.2,
      ecologicalDiversity: 0.6,
      activeSignalCount: 0,
    },
    evidenceEventIds: [],
    limitations: [],
  };
}

describe('Mature Cardinal journal scaling', () => {
  it('loads persisted evidence once and keeps every later research cycle bounded', async () => {
    const log = new CountingAppendOnlyLog();
    const writer = new LogBackedCardinalJournal(log);
    const core = new CardinalCore();
    for (let tick = 1; tick <= 1_200; tick += 1) {
      await writer.appendEvaluation(core.evaluate('observer', observation(tick)));
    }

    const restarted = new LogBackedCardinalJournal(log);
    const summary = await restarted.summary('mature-journal');
    expect(summary.evaluationCount).toBe(1_200);
    const readsAfterWarmup = log.rangeReads;
    expect(readsAfterWarmup).toBeGreaterThan(0);
    expect(log.reads).toBe(0);

    for (let tick = 1_201; tick <= 1_220; tick += 1) {
      const context = await buildCardinalResearchContext(
        restarted,
        'mature-journal',
        tick,
        core.policyVersion,
        observation(tick).sensorVersion,
      );
      expect(context.priorEvaluations.length).toBeLessThanOrEqual(12);
    }

    expect(log.rangeReads).toBe(readsAfterWarmup);
    expect(log.reads).toBe(0);
  });
});
