import type { TerrainFoundation } from './geography/TerrainTypes';
import type { WorldV18State } from '../v18/types';
import type { WorldV19State } from '../v19/types';

export type AgentGoalKind =
  | 'recover'
  | 'secure_resources'
  | 'connect'
  | 'contribute'
  | 'explore'
  | 'reflect'
  | 'build_family'
  | 'seek_truth';

export type AgentActionKind =
  | 'rest'
  | 'relax'
  | 'walk'
  | 'gather'
  | 'hunt'
  | 'work'
  | 'socialize'
  | 'help'
  | 'explore'
  | 'reflect'
  | 'bond'
  | 'pray';

export type AgentOrigin = 'native' | 'external_resident';
export type AgentSex = 'male' | 'female';
export type AgentRace =
  | 'human'
  | 'elf'
  | 'dwarf'
  | 'goblin'
  | 'orc'
  | 'ogre';

export interface AgentProgressionState {
  level: number;
  experience: number;
  objectControlAuthority: number;
  systemControlAuthority: number;
  combatMastery: number;
  sacredArts: number;
}

export type AgentLifeStage =
  | 'child'
  | 'adolescent'
  | 'adult'
  | 'elder';

export type AgentDeathCause =
  | 'old_age'
  | 'illness'
  | 'childbirth'
  | 'deprivation'
  | 'catastrophe'
  | 'wildlife'
  | 'monster'
  | 'war';

export interface AgentPhysiologyState {
  strength: number;
  endurance: number;
  mobility: number;
  recovery: number;
}

export interface AgentLifeState {
  bornAt: number;
  ageYears: number;
  lifespanYears: number;
  stage: AgentLifeStage;
  alive: boolean;
  health: number;
  physiology: AgentPhysiologyState;
  generation: number;
  parentIds: string[];
  childIds: string[];
  lastChildAt?: number;
  lastChildWorldMinute?: number;
  diedAt?: number;
  deathCause?: AgentDeathCause;
}

export interface AgentEmotionState {
  joy: number;
  fear: number;
  grief: number;
  awe: number;
  hope: number;
}

export interface AgentValueState {
  care: number;
  freedom: number;
  knowledge: number;
  tradition: number;
  ambition: number;
}

export interface AgentBeliefState {
  worldTrust: number;
  divinePresence: number;
  fate: number;
  afterlife: number;
}

/**
 * Persistent personhood layer inspired by bottom-up artificial people.
 * Cardinal may observe aggregate consequences, but this state is never an
 * intervention target and may only change through the resident's lived life.
 */
export interface AgentMindState {
  identityId: string;
  continuity: number;
  autonomy: number;
  memoryCoherence: number;
  emotions: AgentEmotionState;
  values: AgentValueState;
  beliefs: AgentBeliefState;
}

export interface AgentPersonality {
  sociability: number;
  diligence: number;
  curiosity: number;
  generosity: number;
  resilience: number;
  riskTolerance: number;
}

export interface AgentNeeds {
  belonging: number;
  purpose: number;
}

export interface AgentSkills {
  gathering: number;
  hunting: number;
  craft: number;
  social: number;
  exploration: number;
}

export type DivineGiftKind = import('../v20/DivineGiftsV20').GiftKindV20;
export type DivineBurdenKind = import('../v20/DivineGiftsV20').DivineBurdenKindV22;

export type DivineContactKind =
  | 'message'
  | 'revelation'
  | 'command'
  | 'request'
  | 'warning'
  | 'vision'
  | 'sign';

export type DivineCallingRole = 'hero' | 'messenger' | 'priest';

/**
 * Deprecated v0.3.18 save shape, retained only for lossless migration into
 * v19 gifts and contacts. Runtime decisions never consult the legacy calling.
 */
export interface AgentDivineCallingState {
  audienceId: string;
  deityId: string;
  deityName: string;
  religionName?: string;
  message: string;
  gift: DivineGiftKind;
  calling: DivineCallingRole;
  acceptedCalling: boolean;
  grantedWorldMinute: number;
  sharedCount: number;
  lastSharedWorldMinute?: number;
}

export interface AgentGoalState {
  kind: AgentGoalKind;
  strength: number;
  since: number;
}

export interface AgentDecisionState {
  action: AgentActionKind;
  dominantAction: AgentActionKind;
  consideredActionCount: number;
  openness: number;
  chosenAt: number;
  /** Actual short reflection time; the action itself may continue afterwards. */
  deliberationWorldMinutes?: number;
  /** Private first-person account derived from this resident's lived state. */
  innerThought?: string;
}

export interface AgentPlanState {
  kind: 'explore_frontier' | 'dungeon_expedition' | 'hunt';
  targetPlaceId: string;
  startedAt: number;
  expiresAt: number;
}

export interface WorldPoint2D {
  x: number;
  y: number;
}

/**
 * v0.3 currently simulates only the surface plane. The explicit layer keeps
 * today's 2D physics honest while leaving room for dungeons and sky later.
 */
export type WorldLayerId = 'surface';

export interface AgentPositionState extends WorldPoint2D {
  layerId: WorldLayerId;
}

export interface AgentMovementState {
  /** Occupancy of a real vessel; never permits walking through water. */
  boatId?: string;
  targetPlaceId: string;
  purpose: AgentActionKind;
  waypoints: WorldPoint2D[];
  nextWaypointIndex: number;
  startedAt: number;
  worldStageAtStart: number;
  routeIds?: string[];
}

export interface AgentState {
  cartography?: import('./ResidentCartography').ResidentMapNotes;
  /** Lived attempts, predictions and revisable methods; absent in legacy saves. */
  learning?: import('./learning/index').ResidentLearningState;
  knownPlaceIds?: string[];
  knownDungeonIds?: string[];
  id: string;
  name: string;
  origin: AgentOrigin;
  sex?: AgentSex;
  race?: AgentRace;
  progression?: AgentProgressionState;

  energy: number;
  stress: number;
  resources: number;
  socialDrive: number;

  personality: AgentPersonality;
  life: AgentLifeState;
  mind: AgentMindState;
  needs: AgentNeeds;
  skills: AgentSkills;
  goal: AgentGoalState;

  homeId: string;
  locationId: string;
  position: AgentPositionState;
  movement?: AgentMovementState;

  lastMeaningfulEventAt: number;
  lastAction?: AgentActionKind;
  /** What the latest completed work action physically was. */
  lastWorkKind?: 'ordinary' | 'construction';
  lastDecision?: AgentDecisionState;
  plan?: AgentPlanState;
  privateDivineCalling?: AgentDivineCallingState;
}

export interface RelationshipState {
  agentA: string;
  agentB: string;

  trust: number;
  affinity: number;
  respect: number;
  conflict: number;

  updatedAt: number;
}

export interface MemoryRecord {
  memoryId: string;
  worldId: string;
  agentId: string;
  createdAt: number;
  kind:
    | 'interaction'
    | 'reflection'
    | 'world_event'
    | 'birth'
    | 'death'
    | 'omen'
    | 'divine_audience';
  summary: string;
  importance: number;
  valence: number;
  relatedAgentIds: string[];
}

export type WorldPlaceKind =
  | 'home'
  | 'construction_site'
  | 'commons'
  | 'library'
  | 'resource_field'
  | 'workshop'
  | 'quiet_space'
  | 'outskirts'
  | 'meadow'
  | 'forest'
  | 'shore'
  | 'ocean'
  | 'mountains'
  | 'lake'
  | 'river'
  | 'swamp'
  | 'ruins'
  | 'cemetery'
  | 'village'
  | 'city';

export type WorldBiome =
  | 'settlement'
  | 'plains'
  | 'forest'
  | 'coast'
  | 'ocean'
  | 'mountains'
  | 'lake'
  | 'river'
  | 'swamp'
  | 'ancient_ruins';

export type WorldSurfaceKind = 'land' | 'shore' | 'water';

export type WorldTraversalKind = 'walk' | 'bridge' | 'boat';

export interface WorldPlace {
  id: string;
  name: string;
  kind: WorldPlaceKind;
  capacity: number;
  biome: WorldBiome;
  mapX: number;
  mapY: number;
  connectedPlaceIds: string[];
  fertility: number;
  danger: number;
  surface: WorldSurfaceKind;
  /**
   * A large geographical feature is an area, not a decorative point. Water
   * polygons block implicit walking routes and render as continuous terrain.
   */
  boundaryPolygon?: WorldPoint2D[];
  settlementId?: string;
  /** Stable metre-scale town plot; unrelated to world-map zoom or race spacing. */
  urbanLot?: number;
  urbanLayoutVersion?: 1 | 2 | 3;
  /** Shared physical footprint, never a camera-dependent size. */
  rotation?: number;
  geographyVersion?: 1;
  /** Water body beside a reachable bank; the bank place remains walkable. */
  waterPolygon?: WorldPoint2D[];
  terrainPath?: WorldPoint2D[];
  /** A wilderness claim can change through settlement decisions or war. */
  claimedBySettlementId?: string;
  discoveredAt?: number;
}

export interface WorldRouteState {
  terrainKey?: string;
  geometryVersion?: 1 | 2 | 3;
  widthMetres?: number;
  completedTraversals?: number;
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  traversal: WorldTraversalKind;
  waypoints: WorldPoint2D[];
  distance: number;
}

export interface WorldSettlementState {
  layoutVersion?: 2 | 3;
  boundaryPolygon?: WorldPoint2D[];
  layoutSignature?: string;
  id: string;
  name: string;
  kind: 'village' | 'city';
  centerPlaceId: string;
  centerX: number;
  centerY: number;
  radius: number;
  memberPlaceIds: string[];
  foundedAt: number;
}

export type WildlifeSpecies =
  | 'rabbit'
  | 'deer'
  | 'fish'
  | 'boar'
  | 'wolf'
  | 'bird'
  | 'dire_wolf'
  | 'ogre'
  | 'wraith'
  | 'century_humpback';

export interface WildlifePopulation {
  id: string;
  species: WildlifeSpecies;
  habitatId: string;
  count: number;
  carryingCapacity: number;
  reproductionRate: number;
  alertness: number;
  threat: number;
  isMonster: boolean;
  lastChangedAt: number;
  /** Last semantic world tick on which this population consumed real prey. */
  lastFedAt?: number;
}

export type CenturyHumpbackPhase =
  | 'dormant'
  | 'adult'
  | 'incubating'
  | 'larva_crawling';

export interface CenturyHumpbackState {
  version: 1;
  phase: CenturyHumpbackPhase;
  cycle: number;
  nextEmergenceWorldMinute: number;
  phaseStartedWorldMinute?: number;
  phaseEndsWorldMinute?: number;
  habitatId?: string;
  populationId?: string;
  hostAgentId?: string;
  nearbyRace?: Exclude<AgentRace, 'human' | 'elf'>;
  lastOutcome?:
    | 'adult_defeated'
    | 'host_killed'
    | 'larva_killed'
    | 'larva_reached_lair';
  /** Cultural information only; never a write into a resident's mind. */
  knowledgeByRace: Record<AgentRace, 'countermeasures' | 'warning'>;
}

export interface WorldCalendarState {
  elapsedWorldMinutes: number;
}

export interface WorldGrowthState {
  // Continuous frontier sequence. It is deliberately not capped at 3.
  stage: number;
  explorationProgress: number;
  lastExpansionAt: number;
  /** Canonical semantic time; technical timestamp above is ordering-only. */
  lastExpansionWorldMinutes?: number;
  discoveredRegionIds: string[];
  frontierSequence: number;
}

export interface WorldPopulationState {
  nextAgentSequence: number;
  births: number;
  deaths: number;
  lastBirthAt?: number;
  lastBirthWorldMinute?: number;
  lastDeathAt?: number;
}

export type WorldEntryRole = 'resident' | 'deity';

export interface WorldDeityPresence {
  id: string;
  name: string;
  origin: 'emergent_belief' | 'external_entry';
  enteredAt: number;
  lastOmenAt?: number;
}

export interface WorldCosmologyState {
  mysteryLevel: number;
  omenCount: number;
  traditions: string[];
  deities: Record<string, WorldDeityPresence>;
}

export type WorldLawDomain =
  | 'geography'
  | 'ecology'
  | 'climate'
  | 'resources'
  | 'demography'
  | 'cosmology';

export type WorldLawMechanism =
  | 'frontier_expansion'
  | 'wildlife_recovery'
  | 'fertility_support'
  | 'resource_regeneration'
  | 'mystic_resonance'
  | 'weather_volatility'
  | 'catastrophe_recovery'
  | 'settlement_cohesion'
  | 'habitat_integrity'
  | 'civilization_continuity';

export interface WorldLawState {
  id: string;
  domain: WorldLawDomain;
  mechanism: WorldLawMechanism;
  value: number;
  minimum: number;
  maximum: number;
  revision: number;
  createdAt: number;
  updatedAt: number;
  /** Canonical Ainkrad time; technical timestamps above are ordering only. */
  createdWorldMinutes?: number;
  updatedWorldMinutes?: number;
  createdBy: 'system' | 'cardinal';
  rationale: string;
}

export interface WorldGovernanceState {
  constitutionVersion: string;
  authorityRevision: number;
  protectedPersonhoodDomains: readonly [
    'identity',
    'memory',
    'agency',
    'values',
    'relationships',
  ];
  laws: Record<string, WorldLawState>;
  lastCardinalAuthorityAt?: number;
  /** Canonical semantic time for authority cooldowns. */
  lastCardinalAuthorityWorldMinutes?: number;
}

export interface WorldEnvironment {
  resourcePool: number;
  resourceRegenerationRate: number;

  // Baseline opportunity. Temporary signals can modify it without rewriting
  // agent relationships or forcing social behavior.
  socialOpportunity: number;

  // Baseline environmental support. Temporary signals can modify it.
  safetySupport: number;

  // Baseline support for habitats and wildlife recovery. Cardinal may only
  // request a temporary bounded modifier through the independent gateway.
  habitatSupport: number;
}


export type V15GenesisDomain =
  | 'agriculture'
  | 'construction'
  | 'household'
  | 'survival';

export interface V15KnowledgeState {
  agriculture: number;
  construction: number;
  household: number;
  survival: number;
  aptitude: Record<V15GenesisDomain, number>;
  verifiedLearningSessions: number;
  verifiedPracticeSessions: number;
  lastLearningWorldMinute?: number;
}

export interface V15FamilyAgencyState {
  physicalIntimacyInclination: number;
  childDesire: number;
  autonomy: number;
}

export interface V15GenesisTeacherState {
  id: string;
  epochId: string;
  domain: V15GenesisDomain;
  createdWorldMinutes: number;
  activeUntilWorldMinutes: number;
  ordinaryResident: false;
  countedInPopulation: false;
  teachingHistoryIds: string[];
}

export type V15WeaponKind =
  | 'stone_knife'
  | 'stone_spear'
  | 'crude_metal_knife'
  | 'crude_metal_spear'
  | 'forged_spear';

export interface V15WorldBookPageState {
  pageNumber: number;
  chapter: string;
  minimumAgeYears: number;
  text: string;
  concepts: string[];
}

export interface V15WorldBookState {
  id: string;
  title: string;
  author: string;
  language: string;
  edition: number;
  pages: V15WorldBookPageState[];
  totalWords: number;
}

export interface V15WorldItemState {
  id: string;
  kind: 'weapon' | 'artifact';
  weaponKind?: V15WeaponKind;
  name: string;
  createdByAgentId?: string;
  createdWorldMinute: number;
  ownerAgentId?: string;
  locationId?: string;
  quality: number;
  effectiveness: number;
  reliability: number;
  description: string;
  /** A physical copy refers to one complete text stored once in the world. */
  bookId?: string;
  /** Physical construction progress; not a skill or an instant reading reward. */
  boat?: {
    laborMinutes: number;
    requiredLaborMinutes: number;
    lastWorkedMinute: number;
    completed: boolean;
    condition?: number;
    /** Design evolves only after real construction and voyages. */
    design?: 'coastal_skiff' | 'sailing_boat' | 'coastal_ship';
    designExperience?: number;
    passengerCapacity?: number;
    cargoCapacityKg?: number;
    range?: number;
    seaworthiness?: number;
    position?: WorldPoint2D;
    journey?: import('../v21/BoatNavigation').BoatJourney;
  };
}

export interface V15SmithingKnowledgeState {
  stoneToolmaking: number;
  primitiveSmithing: number;
  weaponcraft: number;
  heatWorking: number;
  materialKnowledge: number;
}

export interface V15SmithingProfileState {
  knowledge: V15SmithingKnowledgeState;
  verifiedWorkshopSessions: number;
  failedCraftAttempts: number;
  successfulCraftAttempts: number;
  observedWeaponProblems: number;
  lastWorkshopWorldMinute?: number;
}

export interface V15EquipmentState {
  weaponItemId?: string;
}

export interface V15RenewableResourceState {
  storedResources: number;
  renewableBase: number;
  fertility: number;
  lastRecoveredWorldMinute: number;
}

export interface V15SimulationClockState {
  /** Fixed semantic decision quantum; technical worker speed must not change it. */
  quantumWorldMinutes: number;
  pendingWorldMinutes: number;
  simulatedWorldMinutes: number;
  quantumIndex: number;
}

export interface V15DeathTelemetryState {
  deathId: string;
  agentId: string;
  cause: AgentDeathCause;
  worldMinutes: number;
  technicalTick: number;
  ageYears: number;
  lifespanYears: number;
  generation: number;
  level: number;
  healthBeforeDeath: number;
  energyBeforeDeath: number;
  resourcesBeforeDeath: number;
  stressBeforeDeath: number;
  locationId: string;
  placeDanger: number;
  lastAction?: AgentActionKind;
  species?: string;
  monster?: boolean;
  damage?: number;
  lethalChance?: number;
  encounterReason?: 'self_defense' | 'territorial_defense' | 'dungeon';
  primaryMechanism?: string;
  diagnosticFactors?: string[];
  summary: string;
}

export interface V15SmithingInnovationState {
  ideaId: string;
  inventorAgentId: string;
  createdWorldMinute: number;
  parentWeaponKind: V15WeaponKind;
  effectivenessDelta: number;
  reliabilityDelta: number;
  description: string;
}

export interface WorldV15State {
  version: 'v15';
  genesisTeachers: V15GenesisTeacherState[];
  knowledgeByAgentId: Record<string, V15KnowledgeState>;
  familyAgencyByAgentId: Record<string, V15FamilyAgencyState>;
  smithingByAgentId: Record<string, V15SmithingProfileState>;
  smithingInnovations: Record<string, V15SmithingInnovationState>;
  equipmentByAgentId: Record<string, V15EquipmentState>;
  items: Record<string, V15WorldItemState>;
  /** Complete readable texts, shared by physical copies without duplicating pages. */
  books?: Record<string, V15WorldBookState>;
  founderSmithAgentId?: string;
  renewableResources: V15RenewableResourceState;
  simulationClock: V15SimulationClockState;
  deathTelemetry: V15DeathTelemetryState[];
  learningSequence: number;
  itemSequence: number;
  futureDungeons: {
    enabled: false;
    earliestWorldYear: 200;
    nominalWorldYear: 250;
    latestWorldYear: 300;
    usesExistingResidentLevelScale: true;
  };
}

/**
 * v0.3.16 stores bounded evidence summaries rather than invented biographies.
 * Technical timestamps may deduplicate one decision, while every duration and
 * historical coordinate exposed to society logic is canonical world time.
 */
export interface V16ResidentEvidenceState {
  agentId: string;
  firstObservedWorldMinute: number;
  lastObservedWorldMinute: number;
  lastRecordedDecisionAt?: number;
  recordedDecisionCount: number;
  actionCounts: Partial<Record<AgentActionKind, number>>;
  placeVisitCounts: Record<string, number>;
  contactCounts: Record<string, number>;
  constructiveContactCounts: Record<string, number>;
  tenseContactCounts: Record<string, number>;
  helpGivenCounts: Record<string, number>;
  helpReceivedCounts: Record<string, number>;
  burialCareCount: number;
  conflictParticipationCount: number;
}

export interface V16RaceFamilyOpportunityState {
  race: AgentRace;
  lastOpportunityWorldMinute?: number;
  lastBirthWorldMinute?: number;
  opportunityChecks: number;
  eligiblePairChecks: number;
  voluntaryIntimacyChoices: number;
  voluntaryChildChoices: number;
  birthsSinceTracking: number;
  /** New receipts distinguish the candidate pool from actual opportunities.
   * eligiblePairChecks is the legacy cumulative pre-window candidate count. */
  scheduledPairChecks?: number;
  evaluatedPairChecks?: number;
}

export interface V16LocalFamilyOpportunityState {
  id: string;
  settlementId: string;
  race: AgentRace;
  createdWorldMinute: number;
  lastOpportunityWorldMinute?: number;
  lastBirthWorldMinute?: number;
  opportunityChecks: number;
  eligiblePairChecks: number;
  voluntaryIntimacyChoices: number;
  voluntaryChildChoices: number;
  birthsSinceTracking: number;
  /** New receipts distinguish the candidate pool from actual opportunities.
   * eligiblePairChecks is the legacy cumulative pre-window candidate count. */
  scheduledPairChecks?: number;
  evaluatedPairChecks?: number;
  /** Stable round-robin cursor; no per-couple lifetime history is required. */
  lastConsideredPairId?: string;
}

export type V16FamilyLifecycleStage = 'meeting' | 'intending' | 'pregnant';

/**
 * Persistent causal family state. A meeting is only a remembered rendezvous,
 * not consent to intimacy or a child. A mutual child intention is evidence of a
 * decision, never an instant pregnancy. Conception requires later physical
 * co-presence and a separate voluntary intimacy decision; birth requires a
 * completed gestation in canonical world time.
 */
export interface V16FamilyLifecycleState {
  id: string;
  pairId: string;
  agentAId: string;
  agentBId: string;
  race: AgentRace;
  settlementId: string;
  meetingPlaceId: string;
  stage: V16FamilyLifecycleStage;
  createdWorldMinute: number;
  lastAffirmedWorldMinute: number;
  lastPhysicalMeetingWorldMinute?: number;
  lastIntimacyWorldMinute?: number;
  pregnantAgentId?: string;
  conceptionWorldMinute?: number;
  dueWorldMinute?: number;
  /** Chosen once at conception; absent in older saves means singleton. */
  expectedChildCount?: 1 | 2 | 3 | 4;
}

export type V16SettlementPracticeKind =
  | 'gathering'
  | 'hunting'
  | 'craft'
  | 'care'
  | 'teaching'
  | 'exploration'
  | 'social'
  | 'ritual';

export interface V16SettlementEvidenceState {
  settlementId: string;
  evidenceCount: number;
  lastEvidenceWorldMinute: number;
  practiceCounts: Record<V16SettlementPracticeKind, number>;
}

/**
 * Normalized availability and renewable capacity physically belonging to one
 * settlement. Values are local indices, not copies of a world-wide warehouse.
 */
export interface V16SettlementResourceState {
  settlementId: string;
  storedResources: number;
  renewableBase: number;
  fertility: number;
  lastRecoveredWorldMinute: number;
}

export type V16MaterialKind = 'food' | 'wood' | 'stone' | 'metal' | 'fuel';

export type V16HumanHouseRecipe =
  | 'timber_wattle_thatch'
  | 'timber_stone_foundation';

export type V16HumanConstructionStage =
  | 'site_selection'
  | 'materials'
  | 'foundation'
  | 'frame'
  | 'walls'
  | 'roof'
  | 'finishing';

/**
 * A real, unfinished dwelling chosen and built by residents. Labour is stored
 * in person-days so closing the browser cannot finish, lose or duplicate it.
 */
export interface V16HumanHomeProjectState {
  id: string;
  settlementId: string;
  homeId: string;
  recipe: V16HumanHouseRecipe;
  initiatedByAgentId: string;
  intendedResidentIds: string[];
  builderIds: string[];
  plotX: number;
  plotY: number;
  plotRotation: number;
  urbanLot: number;
  startedWorldMinute: number;
  lastProgressWorldMinute?: number;
  stage: V16HumanConstructionStage;
  laborRequiredPersonDays: number;
  laborCompletedPersonDays: number;
  reservedMaterials: Pick<Record<V16MaterialKind, number>, 'wood' | 'stone'>;
}

export interface V16SettlementEconomyState {
  settlementId: string;
  stocks: Record<V16MaterialKind, number>;
  storageCapacity: Record<V16MaterialKind, number>;
  farmingTools: number;
  constructionTools: number;
  harvestEvents: number;
  harvestEventsByMaterial: Record<V16MaterialKind, number>;
  constructionEvents: number;
  toolsCreated: number;
  lastHarvestWorldMinute?: number;
  lastConstructionWorldMinute?: number;
  lastMaterialProjectDecisionWorldMinute?: number;
  /** Human-only in FIX9; other peoples keep their existing model for now. */
  activeHumanHomeProject?: V16HumanHomeProjectState;
}

export interface V16SettlementRelationEvidenceState {
  id: string;
  settlementA: string;
  settlementB: string;
  contactEvents: number;
  familiarity: number;
  trust: number;
  fear: number;
  grievance: number;
  obligation: number;
  cooperation: number;
  hostility: number;
  activeWar: boolean;
  conflictRounds: number;
  resourceRaids: number;
  landDisputes: number;
  casualties: number;
  warStartedWorldMinute?: number;
  lastConflictWorldMinute?: number;
  contestedPlaceId?: string;
  lastEvidenceWorldMinute: number;
}

export type V16RemainsStatus =
  | 'unburied'
  | 'buried'
  | 'historical_unknown';

export interface V16RemainsState {
  id: string;
  agentId: string;
  race: AgentRace;
  deathWorldMinute: number;
  deathPlaceId: string;
  currentPlaceId: string;
  homeSettlementId?: string;
  status: V16RemainsStatus;
  contaminationRisk: number;
  burialPlaceId?: string;
  buriedWorldMinute?: number;
  buriedByAgentIds: string[];
}

export interface V16BurialSiteState {
  settlementId: string;
  placeId: string;
  establishedWorldMinute: number;
  burialCount: number;
  interredAgentIds: string[];
}

export interface WorldV16State {
  version: 'v16';
  migratedFromRulesVersion: string;
  createdWorldMinute: number;
  residentEvidenceByAgentId: Record<string, V16ResidentEvidenceState>;
  raceFamilyOpportunityByRace: Record<AgentRace, V16RaceFamilyOpportunityState>;
  localFamilyOpportunityByKey: Record<string, V16LocalFamilyOpportunityState>;
  /** Additive persistent intent/pregnancy state; empty in migrated old worlds. */
  familyLifecycleByPairId: Record<string, V16FamilyLifecycleState>;
  settlementEvidenceById: Record<string, V16SettlementEvidenceState>;
  settlementResourcesById: Record<string, V16SettlementResourceState>;
  settlementEconomyById: Record<string, V16SettlementEconomyState>;
  remainsById: Record<string, V16RemainsState>;
  burialSitesBySettlementId: Record<string, V16BurialSiteState>;
  settlementRelations: Record<string, V16SettlementRelationEvidenceState>;
}

export interface WorldDeterminismState {
  rngState: number;
  eventSequence: number;
}

export type V21BodySystemKind =
  | 'skin'
  | 'musculoskeletal'
  | 'circulatory'
  | 'respiratory'
  | 'digestive'
  | 'nervous'
  | 'immune';

export type V21WoundKind =
  | 'cut'
  | 'puncture'
  | 'blunt_trauma'
  | 'burn'
  | 'fracture';

export type V21BodyRegion =
  | 'head'
  | 'torso'
  | 'arm'
  | 'leg';

export interface V21WoundState {
  id: string;
  kind: V21WoundKind;
  region: V21BodyRegion;
  severity: number;
  bleeding: number;
  contamination: number;
  pain: number;
  mobilityPenalty: number;
  causedWorldMinute: number;
  lastTreatedWorldMinute?: number;
  source: 'wildlife' | 'monster' | 'dungeon' | 'conflict' | 'accident';
}

export interface V21DiseaseState {
  id: string;
  kind: 'wound_infection' | 'respiratory' | 'digestive' | 'fever' | 'malnutrition';
  severity: number;
  contagiousness: number;
  startedWorldMinute: number;
  lastObservedWorldMinute: number;
}

export interface V21BodyState {
  agentId: string;
  systems: Record<V21BodySystemKind, number>;
  wounds: V21WoundState[];
  diseases: V21DiseaseState[];
  pain: number;
  mobilityScale: number;
  recoveryScale: number;
  lastAdvancedWorldMinute: number;
  nextWoundSequence: number;
  nextDiseaseSequence: number;
}

export interface V21AppliedKnowledgeState {
  agentId: string;
  homeTheory: number;
  familyTheory: number;
  weatherTheory: number;
  foundingPrimerLessons: number;
  foundingPrimerPageIndex: number;
  foundingPrimerWordOffset: number;
  foundingPrimerWordsRead: number;
  foundingPrimerCompletedReadings: number;
  lastPrimerWorldMinute?: number;
  anatomyTheory: number;
  woundTheory: number;
  diseaseTheory: number;
  materialTheory: number;
  diagnosisPractice: number;
  treatmentPractice: number;
  materialPractice: number;
  verifiedObservations: number;
  lastLearnedWorldMinute?: number;
}

export type V21PhysicalMaterialKind =
  | 'wood'
  | 'stone'
  | 'iron'
  | 'fiber'
  | 'leather'
  | 'bone'
  | 'ceramic';

export interface V21MaterialDefinition {
  kind: V21PhysicalMaterialKind;
  density: number;
  hardness: number;
  toughness: number;
  flexibility: number;
  waterResistance: number;
  heatResistance: number;
  corrosionRisk: number;
}

export interface V21ItemPhysicalState {
  itemId: string;
  materials: Partial<Record<V21PhysicalMaterialKind, number>>;
  massKg: number;
  integrity: number;
  edge: number;
  contamination: number;
  lastUsedWorldMinute?: number;
}

export interface V21ChildSupervisionState {
  childId: string;
  guardianIds: string[];
  lastKnownPlaceId: string;
  lastObservedWorldMinute: number;
  deferredRemoteTrips: number;
}

export interface WorldV21State {
  version: 'v21-embodied-world';
  bodiesByAgentId: Record<string, V21BodyState>;
  appliedKnowledgeByAgentId: Record<string, V21AppliedKnowledgeState>;
  itemPhysicsByItemId: Record<string, V21ItemPhysicalState>;
  materialCatalog: Record<V21PhysicalMaterialKind, V21MaterialDefinition>;
  childSupervisionByChildId: Record<string, V21ChildSupervisionState>;
  lastAdvancedWorldMinute: number;
}

export interface WorldState {
  cartography?: import('./ResidentCartography').WorldCartography;
  terrain?: TerrainFoundation;
  oceanExploration?: import('./geography/OceanExploration').OceanExplorationState;
  id: string;
  geography?: { version: 1; revision: number; signature: string };
  /** Logical world epoch. Optional only for legacy fixtures before migration. */
  epoch?: number;
  /** Absolute logical tick at which the current epoch began. */
  epochStartedAt?: number;
  now: number;
  revision: number;
  rulesVersion: string;

  environment: WorldEnvironment;
  determinism: WorldDeterminismState;
  calendar: WorldCalendarState;
  growth: WorldGrowthState;
  population: WorldPopulationState;
  cosmology: WorldCosmologyState;
  governance: WorldGovernanceState;

  places: Record<string, WorldPlace>;
  routes: Record<string, WorldRouteState>;
  settlements: Record<string, WorldSettlementState>;
  wildlife: Record<string, WildlifePopulation>;
  /** One physical century parasite cycle, lazily added to older saves. */
  centuryHumpback?: CenturyHumpbackState;
  agents: Record<string, AgentState>;
  relationships: Record<string, RelationshipState>;

  /** v15 persistent extension. Optional only while loading legacy v0.3.14 state. */
  v15?: WorldV15State;

  /** v0.3.16 additive society evidence. Optional only during legacy loading. */
  v16?: WorldV16State;

  /** v0.3.18 language, conversation and settlement-mobility evidence. */
  v18?: WorldV18State;

  /** v0.3.19 independent gifts, divine contact and contextual prayers. */
  v19?: WorldV19State;

  /** v0.3.21 causal bodies, materials and family-supervision evidence. */
  v21?: WorldV21State;
}

export type WorldDisturbanceKind =
  | 'resource_shock'
  | 'social_barrier'
  | 'safety_shock';
