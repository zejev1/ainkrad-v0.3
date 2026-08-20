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

function syntheticExecutedIntervention(
  id: string,
  requestedAt: number,
  effectDuration = 8,
): import('../src/cardinal/types').InterventionRecord {
  return {
    interventionId: id,
    evaluationId: `evaluation_${id}`,
    worldId: 'world_1',
    requestedAt,
    observedWorldRevision: requestedAt,
    gatewayPolicyVersion: 'gateway-test',
    authorizedEffectDuration: effectDuration,
    proposal: {
      proposalId: `proposal_${id}`,
      worldId: 'world_1',
      hypothesisId: 'hypothesis_test',
      kind: 'resource_relief',
      magnitude: 0.1,
      reason: 'test',
      expectedOutcome: 'test',
      prediction: {
        metric: 'resourcePressure',
        direction: 'decrease',
        minimumImprovement: 0.01,
        horizon: 4,
        statement: 'resourcePressure should decrease.',
      },
    },
    authorized: true,
    authorizationReason: 'test',
    executionStatus: 'executed',
    executed: true,
    committedWorldRevision: requestedAt + 1,
  };
}

function syntheticOutcome(
  intervention: import('../src/cardinal/types').InterventionRecord,
  observedAt: number,
): import('../src/cardinal/types').InterventionOutcomeRecord {
  const metrics = observation({}, observedAt).metrics;
  return {
    outcomeId: `outcome_${intervention.interventionId}`,
    worldId: intervention.worldId,
    interventionId: intervention.interventionId,
    evaluationId: intervention.evaluationId,
    observedAt,
    sensorVersion: 'ainkrad-world-sensors-0.3.3',
    beforeWorldRevision: intervention.observedWorldRevision,
    afterWorldRevision: intervention.committedWorldRevision ?? intervention.observedWorldRevision + 1,
    evidenceEventIds: [`outcome_event_${observedAt}`],
    beforeMetrics: metrics,
    afterMetrics: metrics,
    recoveryCapacityDelta: 0,
    averageStressDelta: 0,
    socialIsolationDelta: 0,
    conflictPressureDelta: 0,
    resourcePressureDelta: 0,
    predictionMetric: 'resourcePressure',
    predictedMinimumImprovement: 0.01,
    observedPredictionDelta: 0,
    expectedDirectionObserved: false,
    causalClaim: 'observational_only',
  };
}

describe('Cardinal experimental discipline', () => {
  it('does not overlap a same-kind intervention whose effect or outcome is still in progress', () => {
    const core = new CardinalCore();
    const metrics = { resourcePressure: 0.82, recoveryCapacity: 0.3 };
    const first = core.evaluate('intervene', observation(metrics, 8), research([]));
    const second = core.evaluate('intervene', observation(metrics, 9), research([first]));
    const inFlight = syntheticExecutedIntervention('active_relief', 8, 8);
    const context: CardinalResearchContext = {
      researchVersion: CARDINAL_RESEARCH_VERSION,
      priorEvaluations: [first, second],
      priorInterventions: [inFlight],
      priorOutcomes: [],
      fingerprint: 'active_intervention_context',
    };

    const evaluation = core.evaluate('intervene', observation(metrics, 10), context);

    expect(evaluation.decision).toBe('defer');
    expect(evaluation.deferReason).toBe('experiment_in_progress');
    expect(evaluation.autonomyAssessment?.activeOrUnresolvedSameKindIds).toEqual([
      'active_relief',
    ]);
    expect(evaluation.proposal).toBeUndefined();
  });

  it('uses an autonomy budget to force a non-critical washout period after dense interventions', () => {
    const core = new CardinalCore();
    const metrics = { resourcePressure: 0.82, recoveryCapacity: 0.3 };
    const first = core.evaluate('intervene', observation(metrics, 14), research([]));
    const second = core.evaluate('intervene', observation(metrics, 15), research([first]));
    const interventions = [
      syntheticExecutedIntervention('old_1', 1, 1),
      syntheticExecutedIntervention('old_2', 5, 1),
      syntheticExecutedIntervention('old_3', 9, 1),
    ];
    const outcomes = interventions.map((item, index) =>
      syntheticOutcome(item, [2, 6, 10][index]),
    );
    const context: CardinalResearchContext = {
      researchVersion: CARDINAL_RESEARCH_VERSION,
      priorEvaluations: [first, second],
      priorInterventions: interventions,
      priorOutcomes: outcomes,
      fingerprint: 'dense_intervention_context',
    };

    const evaluation = core.evaluate('intervene', observation(metrics, 16), context);

    expect(evaluation.detectedProblem?.criticalThresholdCrossed).toBe(false);
    expect(evaluation.autonomyAssessment?.budgetStatus).toBe('exhausted');
    expect(evaluation.decision).toBe('defer');
    expect(evaluation.deferReason).toBe('autonomy_budget');
  });

  it('allows an explicit critical override of the autonomy budget only when no same-kind test is active', () => {
    const core = new CardinalCore();
    const criticalMetrics = { resourcePressure: 0.96, recoveryCapacity: 0.2 };
    const interventions = [
      syntheticExecutedIntervention('old_1', 1, 1),
      syntheticExecutedIntervention('old_2', 5, 1),
      syntheticExecutedIntervention('old_3', 9, 1),
    ];
    const outcomes = interventions.map((item, index) =>
      syntheticOutcome(item, [2, 6, 10][index]),
    );
    const context: CardinalResearchContext = {
      researchVersion: CARDINAL_RESEARCH_VERSION,
      priorEvaluations: [],
      priorInterventions: interventions,
      priorOutcomes: outcomes,
      fingerprint: 'critical_budget_context',
    };

    const evaluation = core.evaluate(
      'intervene',
      observation(criticalMetrics, 16),
      context,
    );

    expect(evaluation.detectedProblem?.criticalThresholdCrossed).toBe(true);
    expect(evaluation.autonomyAssessment?.budgetStatus).toBe('exhausted');
    expect(evaluation.decision).toBe('propose');
    expect(evaluation.reasoningFactors).toContain(
      'critical_autonomy_budget_override=true',
    );
  });
});
