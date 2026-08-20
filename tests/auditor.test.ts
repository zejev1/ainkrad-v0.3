import { describe, expect, it } from 'vitest';
import { CardinalAuditor } from '../src/cardinal/CardinalAuditor';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import type { SensorSnapshot } from '../src/sensors/types';

const observation: SensorSnapshot = {
  worldId: 'world_1',
  observedAt: 10,
  metrics: {
    populationActivity: 0.5,
    averageStress: 0.4,
    socialIsolation: 0.3,
    conflictPressure: 0.2,
    resourcePressure: 0.4,
    relationshipDiversity: 0.2,
    recoveryCapacity: 0.6,
    activeSignalCount: 0,
  },
  evidenceEventIds: ['event_1'],
  limitations: [],
};

describe('Cardinal Auditor independence', () => {
  it('accepts a decision only when it matches an independent observation', () => {
    const evaluation = new CardinalCore().evaluate('observer', observation);
    const audit = new CardinalAuditor().auditDecision(
      evaluation,
      undefined,
      10,
      observation,
    );

    expect(audit.independentObservationMatched).toBe(true);
    expect(audit.accepted).toBe(true);
  });

  it('rejects a tampered evaluation', () => {
    const evaluation = new CardinalCore().evaluate('observer', observation);
    evaluation.metrics.averageStress = 0.99;

    const audit = new CardinalAuditor().auditDecision(
      evaluation,
      undefined,
      10,
      observation,
    );

    expect(audit.independentObservationMatched).toBe(false);
    expect(audit.accepted).toBe(false);
  });
});
