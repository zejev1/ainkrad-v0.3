import { describe, expect, it } from 'vitest';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import { LogBackedCardinalJournal } from '../src/cardinal/LogBackedCardinalJournal';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import type { SensorSnapshot } from '../src/sensors/types';

const observation: SensorSnapshot = {
  sensorVersion: 'ainkrad-world-sensors-0.3.3',
  worldId: 'world_journal_restart',
  worldEpoch: 1,
  worldRevision: 4,
  observedAt: 12,
  observedWorldMinutes: 105_120,
  metrics: {
    populationActivity: 0.2,
    averageStress: 0.3,
    socialIsolation: 0.9,
    conflictPressure: 0.1,
    resourcePressure: 0.2,
    relationshipDiversity: 0.2,
    recoveryCapacity: 0.6,
    activeSignalCount: 0,
  },
  evidenceEventIds: ['event_1'],
  limitations: [],
};

describe('Log-backed Cardinal journal', () => {
  it('survives journal recreation and keeps exact retries idempotent', async () => {
    const log = new InMemoryAppendOnlyLog();
    const first = new LogBackedCardinalJournal(log);
    const evaluation = new CardinalCore().evaluate('observer', observation);

    await first.appendEvaluation(evaluation);

    const restarted = new LogBackedCardinalJournal(log);
    expect(await restarted.evaluations(observation.worldId)).toEqual([evaluation]);

    await restarted.appendEvaluation(structuredClone(evaluation));
    expect(await restarted.evaluations(observation.worldId)).toHaveLength(1);
  });

  it('rejects same evidence ID with changed content after restart', async () => {
    const log = new InMemoryAppendOnlyLog();
    const first = new LogBackedCardinalJournal(log);
    const evaluation = new CardinalCore().evaluate('observer', observation);
    await first.appendEvaluation(evaluation);

    const restarted = new LogBackedCardinalJournal(log);
    const tampered = structuredClone(evaluation);
    tampered.rationale = 'tampered after restart';
    await expect(restarted.appendEvaluation(tampered)).rejects.toThrow();
  });

  it('serializes concurrent appenders without losing evidence', async () => {
    const log = new InMemoryAppendOnlyLog();
    const first = new LogBackedCardinalJournal(log);
    const second = new LogBackedCardinalJournal(log);

    const a = new CardinalCore().evaluate('observer', observation);
    const bObservation = {
      ...observation,
      worldRevision: 5,
      observedAt: 13,
      observedWorldMinutes: 113_880,
    };
    const b = new CardinalCore().evaluate('observer', bObservation);

    await Promise.all([
      first.appendEvaluation(a),
      second.appendEvaluation(b),
    ]);

    const restarted = new LogBackedCardinalJournal(log);
    const values = await restarted.evaluations(observation.worldId);
    expect(values).toHaveLength(2);
    expect(new Set(values.map((item) => item.evaluationId)).size).toBe(2);
  });

});
