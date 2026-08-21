export type AgentGoalKind =
  | 'recover'
  | 'secure_resources'
  | 'connect'
  | 'contribute'
  | 'explore'
  | 'reflect';

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
  | 'reflect';

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

export interface AgentState {
  id: string;
  name: string;

  energy: number;
  stress: number;
  resources: number;
  socialDrive: number;

  personality: AgentPersonality;
  needs: AgentNeeds;
  skills: AgentSkills;
  goal: AgentGoalState;

  homeId: string;
  locationId: string;

  lastMeaningfulEventAt: number;
  lastAction?: AgentActionKind;
  lastDecision?: AgentDecisionState;
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
  kind: 'interaction' | 'reflection' | 'world_event';
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
  | 'shore';

export interface WorldPlace {
  id: string;
  name: string;
  kind: WorldPlaceKind;
  capacity: number;
  discoveredAt?: number;
}

export type WildlifeSpecies = 'rabbit' | 'deer' | 'fish';

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
  // 0 = settlement, 1 = meadow, 2 = forest, 3 = shore/sea.
  stage: number;
  explorationProgress: number;
  lastExpansionAt: number;
  discoveredRegionIds: string[];
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

  places: Record<string, WorldPlace>;
  wildlife: Record<string, WildlifePopulation>;
  agents: Record<string, AgentState>;
  relationships: Record<string, RelationshipState>;
}

export type WorldDisturbanceKind =
  | 'resource_shock'
  | 'social_barrier'
  | 'safety_shock';
