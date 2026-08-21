import { describe, expect, it } from 'vitest';
import { CardinalAuditor } from '../src/cardinal/CardinalAuditor';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import { deriveCardinalExperience } from '../src/cardinal/CardinalExperience';
import type { SensorSnapshot } from '../src/sensors/types';

const observation: SensorSnapshot = {
  sensorVersion: 'ainkrad-world-sensors-0.3.3',
  worldId: 'world_1',
  worldRevision: 7,
  observedAt: 10,
  metrics: {
    populationActivity: 0.5,
    averageStress: 0.4,
    socialIsolation: 0.3,
    conflictPressure: 0.2,
    resourcePressure: 0.4,
    relationshipDiversity: 0.2,
    recoveryCapacity: 0.6,
    exploredWorldRatio: 0,
    wildlifePressure: 0,
    ecologicalDiversity: 0,
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

import type { CardinalAuditContext } from '../src/cardinal/CardinalAuditContext';
import {
  CARDINAL_RESEARCH_VERSION,
  type CardinalResearchContext,
} from '../src/cardinal/CardinalResearch';
import type { InterventionRecord } from '../src/cardinal/types';

function auditIntervention(): InterventionRecord {
  return {
    interventionId: 'intervention_previous',
    evaluationId: 'evaluation_previous',
    worldId: 'world_1',
    requestedAt: 8,
    observedWorldRevision: 8,
    gatewayPolicyVersion: 'gateway-test',
    authorizedEffectDuration: 8,
    proposal: {
      proposalId: 'proposal_previous',
      worldId: 'world_1',
      hypothesisId: 'hypothesis_previous',
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
    committedWorldRevision: 9,
  };
}

describe('Cardinal Auditor autonomy reconstruction', () => {
  it('independently verifies Cardinal experiment-in-progress deferral', () => {
    const core = new CardinalCore();
    const pressuredObservation: SensorSnapshot = {
      ...observation,
      observedAt: 10,
      worldRevision: 10,
      metrics: {
        ...observation.metrics,
        resourcePressure: 0.82,
        recoveryCapacity: 0.3,
      },
      evidenceEventIds: ['event_10'],
    };
    const prior = auditIntervention();
    const research: CardinalResearchContext = {
      researchVersion: CARDINAL_RESEARCH_VERSION,
      priorEvaluations: [],
      priorInterventions: [prior],
      priorOutcomes: [],
      experience: deriveCardinalExperience([], []),
      fingerprint: 'research_for_audit',
    };
    const auditContext: CardinalAuditContext = {
      version: 'audit-test-v1',
      priorEvaluations: [],
      priorInterventions: [prior],
      priorOutcomes: [],
      fingerprint: 'audit_context_for_audit',
    };
    const evaluation = core.evaluate('intervene', pressuredObservation, research);

    const accepted = new CardinalAuditor().auditDecision(
      evaluation,
      undefined,
      10,
      pressuredObservation,
      auditContext,
    );
    expect(accepted.accepted).toBe(true);
    expect(evaluation.deferReason).toBe('experiment_in_progress');

    evaluation.autonomyAssessment = {
      ...evaluation.autonomyAssessment!,
      activeOrUnresolvedSameKindIds: [],
    };
    const rejected = new CardinalAuditor().auditDecision(
      evaluation,
      undefined,
      10,
      pressuredObservation,
      auditContext,
    );
    expect(rejected.accepted).toBe(false);
    expect(rejected.concerns.some((item) => item.includes('autonomy assessment'))).toBe(
      true,
    );
  });
});
