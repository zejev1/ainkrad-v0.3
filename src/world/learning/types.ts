import type { AgentActionKind } from '../types';

export type LifeProblem = 'provisions' | 'fatigue' | 'distress' | 'company' | 'purpose';
export const MAX_LEARNED_METHODS = 12;
export const MAX_RECENT_ATTEMPTS = 4;

/** All external input available to this personal reasoning module. No whole-world access. */
export interface ResidentLearningContext {
  worldMinute: number;
  placeKind: string;
  ownKnowledge: readonly {knowledgeId:string; category:string; understanding:number}[];
}

export interface LifeObservation {
  provisions: number;
  energy: number;
  stress: number;
  belonging: number;
  purpose: number;
  health: number;
}

export interface LearnedMethod {
  id: string;
  problem: LifeProblem;
  action: AgentActionKind;
  placeId: string;
  placeKind: string;
  trials: number;
  successes: number;
  failures: number;
  /** Estimate of the observed effect, not an ability/skill bonus. */
  expectedGain: number;
  /** Incidental effects can suggest a new use for a method, without an authored recipe. */
  observedEffects: Record<LifeProblem, number>;
  confidence: number;
  lastWorldMinute: number;
  knowledgeIds: string[];
  lastReason: AttemptResult['reason'];
}

export interface LearningAttempt {
  id: number;
  problem: LifeProblem;
  action: AgentActionKind;
  sourcePlaceId: string;
  targetPlaceId: string;
  startedWorldMinute: number;
  before: LifeObservation;
  expectedGain: number;
  knowledgeIds: string[];
  recalledMethodIds: string[];
  phase: 'acting' | 'travelling';
  material?: string;
  materialAmount?: number;
  beneficiaryId?: string;
  beneficiaryBefore?: number;
  beneficiaryAfter?: number;
}

export interface AttemptResult {
  id: number;
  problem: LifeProblem;
  action: AgentActionKind;
  placeId: string;
  startedWorldMinute: number;
  finishedWorldMinute: number;
  expectedGain: number;
  observedGain: number;
  outcome: 'helped' | 'ineffective' | 'harmful' | 'abandoned';
  reason: 'measured_change' | 'no_change' | 'different_action' | 'changed_intention' | 'no_resources' | 'recipient_declined' | 'recipient_helped' | 'body_unavailable';
  before: LifeObservation;
  after: LifeObservation;
  knowledgeIds: string[];
  beneficiaryId?: string;
  beneficiaryGain?: number;
  recalledMethodIds: string[];
}

export interface ResidentLearningState {
  version: 1;
  sequence: number;
  totalEvaluated: number;
  methods: LearnedMethod[];
  recent: AttemptResult[];
  pending?: LearningAttempt;
}
