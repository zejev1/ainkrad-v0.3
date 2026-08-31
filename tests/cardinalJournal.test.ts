import { describe, expect, it } from 'vitest';
import { CardinalAuditor } from '../src/cardinal/CardinalAuditor';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import { InMemoryCardinalJournal } from '../src/cardinal/InMemoryCardinalJournal';
import type { SensorSnapshot } from '../src/sensors/types';

const observation: SensorSnapshot = {
  sensorVersion: 'ainkrad-world-sensors-0.3.3',
  worldId: 'world_1',
  worldEpoch: 1,
  worldRevision: 9,
  observedAt: 20,
  observedWorldMinutes: 175_200,
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

describe('Cardinal retry evidence', () => {
  it('derives stable evaluation and proposal identities from the same observation', () => {
    const core = new CardinalCore();
    const first = core.evaluate('intervene', observation);
    const retry = core.evaluate('intervene', structuredClone(observation));

    expect(retry.evaluationId).toBe(first.evaluationId);
    expect(retry.proposal?.proposalId).toBe(first.proposal?.proposalId);
  });

  it('journals exact retries once and rejects same-ID content changes', async () => {
    const journal = new InMemoryCardinalJournal();
    const evaluation = new CardinalCore().evaluate('observer', observation);

    await journal.appendEvaluation(evaluation);
    await journal.appendEvaluation(structuredClone(evaluation));
    expect(await journal.evaluations('world_1')).toHaveLength(1);

    const changed = structuredClone(evaluation);
    changed.rationale = 'tampered';
    await expect(journal.appendEvaluation(changed)).rejects.toThrow();
  });

  it('uses stable Auditor identities for exact retry evidence', () => {
    const evaluation = new CardinalCore().evaluate('observer', observation);
    const auditor = new CardinalAuditor();
    const first = auditor.auditDecision(evaluation, undefined, 20, observation);
    const retry = auditor.auditDecision(evaluation, undefined, 20, observation);

    expect(retry.auditId).toBe(first.auditId);
  });
});

describe('Research version identity', () => {
  it('does not collapse evaluations from different Cardinal policy versions', () => {
    const first = new CardinalCore('policy-A').evaluate('observer', observation);
    const second = new CardinalCore('policy-B').evaluate('observer', observation);
    expect(second.evaluationId).not.toBe(first.evaluationId);
    expect(second.policyVersion).toBe('policy-B');
  });
});
