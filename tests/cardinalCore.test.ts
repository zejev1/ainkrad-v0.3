import { describe, expect, it } from 'vitest';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import {
  CARDINAL_RESEARCH_VERSION,
  emptyCardinalResearchContext,
  type CardinalResearchContext,
} from '../src/cardinal/CardinalResearch';
import type { CardinalEvaluation } from '../src/cardinal/types';
import type { SensorSnapshot } from '../src/sensors/types';

function observation(
  overrides: Partial<SensorSnapshot['metrics']>,
  observedAt = 10,
): SensorSnapshot {
  return {
    sensorVersion: 'ainkrad-world-sensors-0.3.3',
    worldId: 'world_1',
    worldRevision: observedAt,
    observedAt,
    metrics: {
      populationActivity: 0.4,
      averageStress: 0.3,
      socialIsolation: 0.2,
      conflictPressure: 0.1,
      resourcePressure: 0.2,
      relationshipDiversity: 0.2,
      recoveryCapacity: 0.7,
      activeSignalCount: 0,
      ...overrides,
    },
    evidenceEventIds: [`event_${observedAt}`],
    limitations: [],
  };
}

function research(priorEvaluations: CardinalEvaluation[]): CardinalResearchContext {
  return {
    researchVersion: CARDINAL_RESEARCH_VERSION,
    priorEvaluations,
    priorInterventions: [],
    priorOutcomes: [],
    fingerprint: `context_${priorEvaluations.length}`,
  };
}

describe('Cardinal Core', () => {
  it('chooses the strongest qualifying condition instead of a fixed category priority', () => {
    const evaluation = new CardinalCore().evaluate(
      'intervene',
      observation({
        resourcePressure: 0.74,
        recoveryCapacity: 0.4,
        socialIsolation: 0.95,
        populationActivity: 0.2,
      }),
    );

    expect(evaluation.decision).toBe('propose');
    expect(evaluation.proposal?.kind).toBe('open_shared_space');
    expect(evaluation.proposal?.hypothesisId).toBe(
      evaluation.detectedProblem?.hypothesisId,
    );
  });

  it('preserves observation limitations as uncertainty notes', () => {
    const input = observation({});
    input.limitations = ['Relationship graph is sparse.'];
    const evaluation = new CardinalCore().evaluate('observer', input);

    expect(evaluation.uncertaintyNotes).toEqual(input.limitations);
  });

  it('defers a non-critical single observation instead of reflexively intervening', () => {
    const evaluation = new CardinalCore().evaluate(
      'intervene',
      observation({ resourcePressure: 0.82, recoveryCapacity: 0.3 }),
      emptyCardinalResearchContext(),
    );

    expect(evaluation.detectedProblem?.kind).toBe('resource_fragility');
    expect(evaluation.detectedProblem?.persistence).toBe(1);
    expect(evaluation.decision).toBe('defer');
    expect(evaluation.proposal).toBeUndefined();
  });

  it('turns persistent compatible evidence into a falsifiable minimal proposal', () => {
    const core = new CardinalCore();
    const metrics = { resourcePressure: 0.82, recoveryCapacity: 0.3 };

    const first = core.evaluate('intervene', observation(metrics, 8), research([]));
    const second = core.evaluate('intervene', observation(metrics, 9), research([first]));
    const third = core.evaluate(
      'intervene',
      observation(metrics, 10),
      research([first, second]),
    );

    expect(first.decision).toBe('defer');
    expect(second.decision).toBe('defer');
    expect(third.decision).toBe('propose');
    expect(third.detectedProblem?.persistence).toBe(3);
    expect(third.detectedProblem?.hypothesisId).toBe(
      first.detectedProblem?.hypothesisId,
    );
    expect(third.proposal?.prediction.metric).toBe('resourcePressure');
    expect(third.proposal?.prediction.minimumImprovement).toBeGreaterThan(0);
  });
});
