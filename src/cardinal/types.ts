import type { CardinalMetrics } from '../sensors/types';

export type CardinalMode = 'off' | 'observer' | 'intervene';

export type InterventionKind =
  | 'resource_relief'
  | 'open_shared_space'
  | 'safety_support';

export interface InterventionProposal {
  proposalId: string;
  worldId: string;
  kind: InterventionKind;
  magnitude: number;
  reason: string;
  expectedOutcome: string;
}

export interface CardinalEvaluation {
  evaluationId: string;
  worldId: string;
  evaluatedAt: number;
  observedWorldRevision: number;
  sensorVersion: string;
  policyVersion: string;
  mode: Exclude<CardinalMode, 'off'>;
  metrics: CardinalMetrics;
  evidenceEventIds: string[];
  uncertaintyNotes: string[];
  decision: 'no_action' | 'propose';
  rationale: string;
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
  accepted: boolean;
  concerns: string[];
}
