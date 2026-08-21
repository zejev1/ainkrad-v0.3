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

export type AgentLifeStage =
  | 'child'
  | 'adolescent'
  | 'adult'
  | 'elder';

export type AgentDeathCause =
  | 'old_age'
  | 'illness'
  | 'deprivation'
  | 'catastrophe';

export interface AgentLifeState {
  bornAt: number;
  ageYears: number;
  lifespanYears: number;
  stage: AgentLifeStage;
  alive: boolean;
  health: number;
  generation: number;
  parentIds: string[];
  childIds: string[];
  lastChildAt?: number;
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
}

export interface AgentPlanState {
  kind: 'explore_frontier' | 'hunt';
  targetPlaceId: string;
  startedAt: number;
  expiresAt: number;
}

export interface AgentState {
  id: string;
  name: string;
  origin: AgentOrigin;

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

  lastMeaningfulEventAt: number;
  lastAction?: AgentActionKind;
  lastDecision?: AgentDecisionState;
  plan?: AgentPlanState;
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
    | 'omen';
  summary: string;
  importance: number;
  valence: number;
  relatedAgentIds: string[];
}

export type WorldPlaceKind =
  | 'home'
  | 'commons'
  | 'resource_field'
  | 'workshop'
  | 'quiet_space'
  | 'outskirts'
  | 'meadow'
  | 'forest'
  | 'shore'
  | 'mountains'
  | 'lake'
  | 'river'
  | 'swamp'
  | 'ruins'
  | 'village';

export type WorldBiome =
  | 'settlement'
  | 'plains'
  | 'forest'
  | 'coast'
  | 'mountains'
  | 'lake'
  | 'river'
  | 'swamp'
  | 'ancient_ruins';

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
  discoveredAt?: number;
}

export type WildlifeSpecies =
  | 'rabbit'
  | 'deer'
  | 'fish'
  | 'boar'
  | 'wolf'
  | 'bird';

export interface WildlifePopulation {
  id: string;
  species: WildlifeSpecies;
  habitatId: string;
  count: number;
  carryingCapacity: number;
  reproductionRate: number;
  alertness: number;
  lastChangedAt: number;
}

export interface WorldGrowthState {
  // Continuous frontier sequence. It is deliberately not capped at 3.
  stage: number;
  explorationProgress: number;
  lastExpansionAt: number;
  discoveredRegionIds: string[];
  frontierSequence: number;
}

export interface WorldPopulationState {
  nextAgentSequence: number;
  births: number;
  deaths: number;
  lastBirthAt?: number;
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
  | 'catastrophe_recovery';

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

export interface WorldDeterminismState {
  rngState: number;
  eventSequence: number;
}

export interface WorldState {
  id: string;
  now: number;
  revision: number;
  rulesVersion: string;

  environment: WorldEnvironment;
  determinism: WorldDeterminismState;
  growth: WorldGrowthState;
  population: WorldPopulationState;
  cosmology: WorldCosmologyState;
  governance: WorldGovernanceState;

  places: Record<string, WorldPlace>;
  wildlife: Record<string, WildlifePopulation>;
  agents: Record<string, AgentState>;
  relationships: Record<string, RelationshipState>;
}

export type WorldDisturbanceKind =
  | 'resource_shock'
  | 'social_barrier'
  | 'safety_shock';
