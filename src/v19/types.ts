import type {
  DivineContactKind,
  DivineGiftKind,
} from '../world/types';

export type V19DivineDelivery = 'silent' | 'direct' | 'ambiguous_sign';

export type V19DivineInterpretation =
  | 'direct_contact'
  | 'miracle'
  | 'luck'
  | 'natural_cause'
  | 'another_deity'
  | 'uncertain'
  | 'frightening';

export interface V19DivineGiftGrant {
  id: string;
  gift: DivineGiftKind;
  deityId: string;
  deityName: string;
  grantedWorldMinute: number;
  inheritableGift?: DivineGiftKind;
  delivery: V19DivineDelivery;
  interpretation: V19DivineInterpretation;
  residentResponse?: string;
  relatedPrayerId?: string;
}

export interface V19DivineContactRecord {
  id: string;
  kind: DivineContactKind;
  deityId: string;
  deityName: string;
  religionName?: string;
  message: string;
  receivedWorldMinute: number;
  interpretation: V19DivineInterpretation;
  residentResponse?: string;
  relatedPrayerId?: string;
  sharedCount: number;
  lastSharedWorldMinute?: number;
}

export interface V19DeityRelationshipState {
  deityId: string;
  deityName: string;
  knowsName: boolean;
  beliefStrength: number;
  trust: number;
  fear: number;
  doubt: number;
  gratitude: number;
  prayerCount: number;
  answeredPrayerCount: number;
  lastPrayerWorldMinute?: number;
  lastContactWorldMinute?: number;
}

export type V19PrayerTopic =
  | 'health'
  | 'family'
  | 'grief'
  | 'hunger'
  | 'harvest'
  | 'war'
  | 'danger'
  | 'travel'
  | 'poverty'
  | 'gratitude'
  | 'purpose';

export type V19PrayerEmotion =
  | 'request'
  | 'gratitude'
  | 'fear'
  | 'anger'
  | 'despair'
  | 'doubt'
  | 'accusation'
  | 'bargain'
  | 'promise'
  | 'hope'
  | 'remorse';

export interface V19PrayerEvidence {
  settlementId?: string;
  settlementName?: string;
  profession: string;
  locationId: string;
  health: number;
  satiety: number;
  personalResources: number;
  localFoodShare?: number;
  localFertility?: number;
  localDanger: number;
  activeWar: boolean;
  targetRelationship?: string;
  targetAlive?: boolean;
  facts: string[];
}

export interface V19PrayerResponseState {
  interventionId: string;
  respondedWorldMinute: number;
  gift?: DivineGiftKind;
  contactKind?: DivineContactKind;
  interpretation: V19DivineInterpretation;
  residentResponse: string;
}

export interface V19PrayerRecord {
  id: string;
  sequence: number;
  npcId: string;
  npcName: string;
  npcAgeYears: number;
  worldMinute: number;
  worldYear: number;
  deityId: string;
  deityName: string;
  deityKnown: boolean;
  triggerEvent: string;
  topic: V19PrayerTopic;
  subject: string;
  targetPersonId?: string;
  targetPersonName?: string;
  desiredOutcome: string;
  emotionalState: V19PrayerEmotion;
  beliefStrength: number;
  desperation: number;
  importance: number;
  generatedPrayerText: string;
  evidence: V19PrayerEvidence;
  response?: V19PrayerResponseState;
}

export interface V19SignificantPrayerHistoryEntry {
  prayerId: string;
  worldMinute: number;
  worldYear: number;
  topic: V19PrayerTopic;
  triggerEvent: string;
  subject: string;
  targetPersonId?: string;
  targetPersonName?: string;
  emotionalState: V19PrayerEmotion;
  generatedPrayerText: string;
  response?: V19PrayerResponseState;
}

export interface V19AgentDivineAgencyState {
  agentId: string;
  gifts: V19DivineGiftGrant[];
  contacts: V19DivineContactRecord[];
  deityRelationships: V19DeityRelationshipState[];
  significantPrayers: V19SignificantPrayerHistoryEntry[];
  totalPrayerCount: number;
  lastPrayerWorldMinute?: number;
}

export interface V19ReligionRecognitionState {
  religionName: string;
  voluntarySpeakerIds: string[];
  testimonyCount: number;
}

export interface V19DivineAgencyState {
  version: 'divine-agency-v19';
  byAgentId: Record<string, V19AgentDivineAgencyState>;
  recentPrayers: V19PrayerRecord[];
  totalPrayerCount: number;
  prayerCountByTopic: Record<V19PrayerTopic, number>;
  nextPrayerSequence: number;
  religionRecognitionByName: Record<string, V19ReligionRecognitionState>;
}

export type V19AdventureRank =
  | 'unranked'
  | 'F'
  | 'E'
  | 'D'
  | 'C'
  | 'B'
  | 'A'
  | 'S';

/**
 * These are kinds of lived practice, not jobs assigned by Cardinal.  A
 * community may combine any two of them into a profession title that was not
 * present in a static catalogue (for example, a smith-scout).
 */
export type V19PracticeDomain =
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
  | 'cartographer'
  | 'adventurer'
  | 'teacher'
  | 'scribe'
  | 'guard'
  | 'warrior'
  | 'spiritual_keeper'
  | 'trader';

/** Descriptions inferred from capability. They never grant capability. */
export type V19ArchetypeKind =
  | 'fighter'
  | 'heavy_fighter'
  | 'scout'
  | 'hunter'
  | 'healer'
  | 'craft_specialist'
  | 'merchant'
  | 'leader';

export type V19CommodityKind =
  | 'food'
  | 'wood'
  | 'stone'
  | 'metal'
  | 'fuel'
  | 'meat'
  | 'hide'
  | 'herbs'
  | 'monster_part'
  | 'rare_mineral';

export type V19ContractKind =
  | 'delivery'
  | 'survey'
  | 'mining'
  | 'hunt'
  | 'guard'
  | 'escort'
  | 'dungeon_clear'
  | 'find_person'
  | 'construction';

export type V19ContractStatus =
  | 'open'
  | 'accepted'
  | 'completed'
  | 'failed'
  | 'expired';

export interface V19PracticeDisciplineState {
  domain: V19PracticeDomain;
  lifetimePractice: number;
  currentMastery: number;
  practiceEvents: number;
  mentorIds: string[];
  observedPractice: number;
  lastPracticedWorldMinute?: number;
}

export interface V19RecognizedProfessionState {
  id: string;
  agentId: string;
  settlementId: string;
  title: string;
  primaryDomain: V19PracticeDomain;
  secondaryDomain?: V19PracticeDomain;
  recognizedWorldMinute: number;
  evidenceCount: number;
  witnessCount: number;
}

export interface V19LocalReputationState {
  settlementId: string;
  trust: number;
  reliability: number;
  provenCompetence: number;
  completedContracts: number;
  failedContracts: number;
  rescuedPeople: number;
  groupLosses: number;
  crimes: number;
  unpaidDebts: number;
  recommendations: number;
  lastEvidenceWorldMinute: number;
}

export interface V19ResidentSocietyState {
  agentId: string;
  disciplinesByDomain: Partial<
    Record<V19PracticeDomain, V19PracticeDisciplineState>
  >;
  archetypes: V19ArchetypeKind[];
  recognizedProfessionId?: string;
  localReputationBySettlementId: Record<string, V19LocalReputationState>;
  completedContractIds: string[];
  failedContractIds: string[];
  lastUpdatedWorldMinute: number;
}

export interface V19MarketPriceSignalState {
  settlementId: string;
  commodity: V19CommodityKind;
  unitPrice: number;
  supply: number;
  demand: number;
  scarcity: number;
  deliveryDistanceKm: number;
  deliveryRisk: number;
  quality: number;
  necessity: number;
  updatedWorldMinute: number;
}

export interface V19ContractState {
  id: string;
  kind: V19ContractKind;
  status: V19ContractStatus;
  issuerKind: 'resident' | 'settlement' | 'guild';
  issuerAgentId?: string;
  issuerSettlementId: string;
  guildId?: string;
  targetPlaceId?: string;
  commodity?: V19CommodityKind;
  requestedQuantity: number;
  deliveredQuantity: number;
  danger: number;
  rewardCoin: number;
  rewardFood: number;
  minimumRank: V19AdventureRank;
  evidence: string[];
  offeredWorldMinute: number;
  expiresWorldMinute: number;
  acceptedByAgentId?: string;
  acceptedWorldMinute?: number;
  resolvedWorldMinute?: number;
}

export interface V19GuildState {
  id: string;
  name: string;
  settlementId: string;
  focus: 'adventure' | 'trade' | 'craft' | 'mixed';
  founderAgentIds: string[];
  memberAgentIds: string[];
  foundedWorldMinute: number;
  contractIds: string[];
  reputation: number;
}

export interface V19EmergentSocietyState {
  version: 'emergent-society-v21';
  residentsByAgentId: Record<string, V19ResidentSocietyState>;
  professionsById: Record<string, V19RecognizedProfessionState>;
  marketPricesByKey: Record<string, V19MarketPriceSignalState>;
  contractsById: Record<string, V19ContractState>;
  guildsById: Record<string, V19GuildState>;
  lastAdvancedWorldMinute: number;
  nextContractSequence: number;
  nextGuildSequence: number;
}

export type V19AdventureAbility =
  | 'guardian_stance'
  | 'pathfinder'
  | 'keen_edge'
  | 'rapid_recovery'
  | 'mana_sense'
  | 'treasure_appraisal';

export type V19ArtifactKind =
  | 'weapon'
  | 'armor'
  | 'tool'
  | 'relic'
  | 'skill_book';

/**
 * A dungeon interior is simulated as a dangerous, bounded expedition below
 * a physical surface entrance. It is not a teleport destination on the map.
 */
export interface V19DungeonState {
  id: string;
  name: string;
  entrancePlaceId: string;
  rank: Exclude<V19AdventureRank, 'unranked'>;
  depth: number;
  threat: number;
  discoveredWorldMinute: number;
  clearedDepth: number;
  runCount: number;
  successfulRunCount: number;
  treasureReserve: number;
  treasureCapacity: number;
  lastRenewedWorldMinute: number;
  lastRunWorldMinute?: number;
  formationStartedWorldMinute: number;
  lastDevelopedWorldMinute: number;
  formationProgress: number;
  formationStage: 'trace' | 'den' | 'passages' | 'labyrinth' | 'deep_domain';
  bossFloors: number[];
  active: boolean;
}

export interface V19ArtifactState {
  id: string;
  name: string;
  kind: V19ArtifactKind;
  rank: Exclude<V19AdventureRank, 'unranked'>;
  potency: number;
  originDungeonId: string;
  originSettlementId?: string;
  createdWorldMinute: number;
  ownerAgentId?: string;
  holderSettlementId?: string;
  ability?: V19AdventureAbility;
}

export interface V19AdventurerState {
  agentId: string;
  rank: V19AdventureRank;
  rankPoints: number;
  dungeonRuns: number;
  successfulRuns: number;
  retreats: number;
  deepestClear: number;
  coinBalance: number;
  totalCoinEarned: number;
  totalCoinSpent: number;
  artifactIds: string[];
  abilities: V19AdventureAbility[];
  carriedGoods: Partial<Record<V19CommodityKind, number>>;
  lastRunWorldMinute?: number;
  lastTradeWorldMinute?: number;
}

export interface V19SettlementMarketState {
  settlementId: string;
  treasuryCoin: number;
  tradeVolume: number;
  foodSold: number;
  artifactsBought: number;
  artifactsSold: number;
  inventoryArtifactIds: string[];
  commodityStocks: Partial<Record<V19CommodityKind, number>>;
  lastTradeWorldMinute?: number;
}

export interface V19TradeRelationState {
  id: string;
  settlementA: string;
  settlementB: string;
  carriedTradeCount: number;
  tradeVolume: number;
  lastCarrierAgentId: string;
  lastTradeWorldMinute: number;
}

export type V19AdventureTransactionKind =
  | 'dungeon_reward'
  | 'food_purchase'
  | 'artifact_sale'
  | 'artifact_purchase'
  | 'commodity_sale'
  | 'contract_reward';

export interface V19AdventureTransactionRecord {
  id: string;
  kind: V19AdventureTransactionKind;
  worldMinute: number;
  agentId: string;
  physicalPlaceId: string;
  settlementId?: string;
  originSettlementId?: string;
  coin: number;
  food: number;
  artifactId?: string;
  commodity?: V19CommodityKind;
  quantity?: number;
  unitPrice?: number;
  contractId?: string;
}

export interface V19DungeonRunRecord {
  id: string;
  worldMinute: number;
  agentId: string;
  dungeonId: string;
  entrancePlaceId: string;
  voluntary: true;
  outcome: 'success' | 'retreat' | 'defeat';
  rankBefore: V19AdventureRank;
  rankAfter: V19AdventureRank;
  clearedDepth: number;
  experienceGained: number;
  coinRecovered: number;
  artifactId?: string;
  loot?: Partial<Record<V19CommodityKind, number>>;
  healthDamage: number;
  partyAgentIds?: string[];
  casualtyAgentIds?: string[];
}

export interface V19AdventureEconomyState {
  version: 'adventure-economy-v19';
  dungeonsById: Record<string, V19DungeonState>;
  adventurersByAgentId: Record<string, V19AdventurerState>;
  artifactsById: Record<string, V19ArtifactState>;
  settlementMarketsById: Record<string, V19SettlementMarketState>;
  tradeRelationsById: Record<string, V19TradeRelationState>;
  recentRuns: V19DungeonRunRecord[];
  recentTransactions: V19AdventureTransactionRecord[];
  totalRuns: number;
  totalSuccessfulRuns: number;
  totalCoinRecovered: number;
  totalTradeVolume: number;
  nextRunSequence: number;
  nextArtifactSequence: number;
  nextTransactionSequence: number;
  emergentSociety: V19EmergentSocietyState;
}

export interface WorldV19State {
  version: 'v19';
  migratedFromRulesVersion: string;
  divineAgency: V19DivineAgencyState;
  adventureEconomy: V19AdventureEconomyState;
}
