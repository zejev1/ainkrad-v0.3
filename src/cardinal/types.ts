import type { CardinalMetrics } from '../sensors/types';

export type CardinalMode = 'off' | 'observer' | 'intervene';

export type CardinalProblemKind =
  | 'civilization_collapse'
  | 'resource_fragility'
  | 'social_fragmentation'
  | 'safety_instability'
  | 'conflict_overload'
  | 'ecosystem_fragility';

export type InterventionKind =
  | 'resource_relief'
  | 'open_shared_space'
  | 'safety_support'
  | 'habitat_support';

export type CardinalPredictionMetric =
  | 'civilizationCriticality'
  | 'resourcePressure'
  | 'socialIsolation'
  | 'safetyPressure'
  | 'averageStress'
  | 'wildlifePressure';

export type CardinalCapability =
  | 'world_observation'
  | 'autonomy_guard'
  | 'trend_reasoning'
  | 'ecosystem_observation'
  | 'outcome_learning'
  | 'habitat_support_planning'
  | 'world_rule_design'
  | 'demographic_stewardship'
  | 'catastrophe_modeling';

export interface CardinalExperienceState {
  level: number;
  totalExperience: number;
  observationCycles: number;
  ecologyObservationCycles: number;
  evaluatedOutcomes: number;
  successfulPredictions: number;
  capabilities: CardinalCapability[];
  newlyUnlockedCapabilities: CardinalCapability[];
}

export interface FalsifiablePrediction {
  metric: CardinalPredictionMetric;
  direction: 'decrease';
  minimumImprovement: number;
  horizon: number;
  statement: string;
}

export interface CardinalProblemAssessment {
  hypothesisId: string;
  kind: CardinalProblemKind;
  severity: number;
  persistence: number;
  trend: 'rising' | 'stable' | 'falling';
  confidence: number;
  criticalThresholdCrossed: boolean;
  supportingEvaluationIds: string[];
  priorOutcomeIds: string[];
  claim: string;
  falsifier: string;
}


export type CardinalDeferReason =
  | 'insufficient_persistence'
  | 'experiment_in_progress'
  | 'autonomy_budget'
  | 'failed_prediction_caution'
  | 'capability_not_ready';

export interface CardinalAutonomyAssessment {
  window: number;
  recentExecutedInterventionIds: string[];
  activeOrUnresolvedInterventionIds: string[];
  activeOrUnresolvedSameKindIds: string[];
  interventionDensity: number;
  dependencyRisk: number;
  budgetStatus: 'open' | 'caution' | 'exhausted';
}

export interface InterventionProposal {
  proposalId: string;
  worldId: string;
  hypothesisId: string;
  kind: InterventionKind;
  magnitude: number;
  reason: string;
  expectedOutcome: string;
  prediction: FalsifiablePrediction;
}

export interface CardinalEvaluation {
  evaluationId: string;
  worldId: string;
  evaluatedAt: number;
  observedWorldRevision: number;
  sensorVersion: string;
  policyVersion: string;
  researchVersion: string;
  researchContextFingerprint: string;
  mode: Exclude<CardinalMode, 'off'>;
  metrics: CardinalMetrics;
  evidenceEventIds: string[];
  uncertaintyNotes: string[];
  detectedProblem?: CardinalProblemAssessment;
  decision: 'no_action' | 'defer' | 'propose';
  deferReason?: CardinalDeferReason;
  autonomyAssessment?: CardinalAutonomyAssessment;
  rationale: string;
  reasoningFactors: string[];
  experience: CardinalExperienceState;
  proposal?: InterventionProposal;
  hypotheticalOnly: boolean;
}

export type InterventionExecutionStatus =
  | 'denied'
  | 'authorized_pending'
  | 'executed'
  | 'stale';

export interface InterventionRecord {
  interventionId: string;
  evaluationId: string;
  worldId: string;
  requestedAt: number;
  observedWorldRevision: number;
  gatewayPolicyVersion: string;
  authorizedEffectDuration: number;
  proposal: InterventionProposal;
  authorized: boolean;
  authorizationReason: string;
  executionStatus: InterventionExecutionStatus;
  executed: boolean;
  committedWorldRevision?: number;
}

export interface InterventionOutcomeRecord {
  outcomeId: string;
  worldId: string;
  interventionId: string;
  evaluationId: string;
  observedAt: number;
  sensorVersion: string;
  beforeWorldRevision: number;
  afterWorldRevision: number;
  evidenceEventIds: string[];
  beforeMetrics: CardinalMetrics;
  afterMetrics: CardinalMetrics;
  recoveryCapacityDelta: number;
  averageStressDelta: number;
  socialIsolationDelta: number;
  conflictPressureDelta: number;
  resourcePressureDelta: number;
  wildlifePressureDelta: number;
  predictionMetric: CardinalPredictionMetric;
  predictedMinimumImprovement: number;
  observedPredictionDelta: number;
  expectedDirectionObserved: boolean;
  causalClaim: 'observational_only';
}

export interface AuditRecord {
  auditId: string;
  worldId: string;
  auditedAt: number;
  stage: 'decision' | 'outcome';
  evaluationId: string;
  interventionId?: string;
  outcomeId?: string;
  independentObservationMatched?: boolean;
  auditContextVersion?: string;
  auditContextFingerprint?: string;
  accepted: boolean;
  concerns: string[];
}
