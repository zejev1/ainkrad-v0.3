export type V18ConversationTopic =
  | 'daily_life'
  | 'family'
  | 'work'
  | 'resources'
  | 'travel'
  | 'danger'
  | 'learning'
  | 'belief'
  | 'settlement'
  | 'conflict';

export type V18ConversationTone = 'warm' | 'neutral' | 'tense';

/**
 * Russian is a learned cultural capability, not a UI label. The compact
 * proficiency model is deliberately bounded: durable facts and teaching
 * evidence can grow without storing an unbounded token history in WorldState.
 */
export interface V18LanguageKnowledgeState {
  languageId: 'ru';
  spokenComprehension: number;
  spokenExpression: number;
  vocabulary: number;
  cyrillicLiteracy: number;
  conversationCount: number;
  teachingCount: number;
  writtenRecordCount: number;
  teacherIds: string[];
  lastConversationWorldMinute?: number;
  lastLiteracyPracticeWorldMinute?: number;
}

export interface V18ConversationEvidence {
  speakerGoal: string;
  speakerAction: string;
  speakerResourceBand: 'scarce' | 'enough' | 'secure';
  speakerStressBand: 'calm' | 'strained' | 'overwhelmed';
  relationshipSentiment: number;
  settlementId?: string;
  referencedPlaceId?: string;
}

/**
 * A rendered utterance always accompanies structured evidence. Presentation
 * may quote it, but may never replace it with invented prose.
 */
export interface V18ConversationRecord {
  id: string;
  worldMinute: number;
  placeId: string;
  speakerId: string;
  listenerId: string;
  topic: V18ConversationTopic;
  tone: V18ConversationTone;
  utterance: string;
  reply: string;
  evidence: V18ConversationEvidence;
  audibility: number;
  observerAudible: boolean;
}

export type V18SettlementStatus =
  | 'inhabited'
  | 'declining'
  | 'abandoned'
  | 'ruins'
  | 'occupied';

export interface V18SettlementLifecycleState {
  settlementId: string;
  status: V18SettlementStatus;
  residentCount: number;
  resourcePressure: number;
  housingPressure: number;
  dangerPressure: number;
  departurePressure: number;
  lastAppraisedWorldMinute: number;
  abandonedWorldMinute?: number;
  ruinedWorldMinute?: number;
  controllerSettlementId?: string;
  lastStatusReason?: string;
}

export type V18ExpeditionStage =
  | 'considering'
  | 'preparing'
  | 'travelling'
  | 'camp'
  | 'founded'
  | 'returned'
  | 'failed';

export interface V18FrontierExpeditionState {
  id: string;
  originSettlementId: string;
  targetPlaceId: string;
  leaderId: string;
  memberIds: string[];
  stage: V18ExpeditionStage;
  reasons: string[];
  provisionShare: number;
  createdWorldMinute: number;
  lastChangedWorldMinute: number;
  resultingSettlementId?: string;
}

export type V18LivelihoodKind =
  | 'undecided'
  | 'farmer'
  | 'forager'
  | 'woodcutter'
  | 'miner'
  | 'fisher'
  | 'hunter'
  | 'artisan'
  | 'smith'
  | 'builder'
  | 'caregiver'
  | 'scout'
  | 'teacher'
  | 'scribe'
  | 'guard'
  | 'spiritual_keeper';

export type V18LivelihoodStage =
  | 'observing'
  | 'apprentice'
  | 'practitioner'
  | 'master';

/**
 * A livelihood is a truthful summary of repeated lived practice. It is never
 * assigned by Cardinal or by a settlement quota, and a resident may change it
 * when another path becomes more important to them.
 */
export interface V18LivelihoodState {
  agentId: string;
  primary: V18LivelihoodKind;
  stage: V18LivelihoodStage;
  practiceByKind: Record<Exclude<V18LivelihoodKind, 'undecided'>, number>;
  totalPractice: number;
  chosenWorldMinute?: number;
  lastPracticedWorldMinute?: number;
  lastWorkplaceId?: string;
  mentorIds: string[];
  changeCount: number;
}

/**
 * Recent life rhythm prevents one rewarding action from becoming a permanent
 * feedback loop. Hunger, work and travel remain circumstances residents feel;
 * the record does not contain a commanded schedule.
 */
export interface V18LifeRhythmState {
  agentId: string;
  satiety: number;
  mealsConsumed: number;
  missedMealQuanta: number;
  repeatedActionCount: number;
  productiveActionCount: number;
  outsideSettlementActionCount: number;
  lastAction?: string;
  lastMealWorldMinute?: number;
  lastProductiveWorldMinute?: number;
  lastOutsideSettlementWorldMinute?: number;
  pendingArrivalAction?: string;
  pendingArrivalPlaceId?: string;
  pendingArrivalWorldMinute?: number;
}

export interface WorldV18State {
  version: 'v18';
  migratedFromRulesVersion: string;
  languageByAgentId: Record<string, V18LanguageKnowledgeState>;
  recentConversations: V18ConversationRecord[];
  settlementLifecycleById: Record<string, V18SettlementLifecycleState>;
  expeditionsById: Record<string, V18FrontierExpeditionState>;
  livelihoodByAgentId: Record<string, V18LivelihoodState>;
  lifeRhythmByAgentId: Record<string, V18LifeRhythmState>;
  nextExpeditionSequence: number;
}
