export interface AgentState {
  id: string;
  name: string;

  energy: number;
  stress: number;
  resources: number;
  socialDrive: number;

  lastMeaningfulEventAt: number;
  lastAction?: string;
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

export interface WorldEnvironment {
  resourcePool: number;
  resourceRegenerationRate: number;

  // Baseline opportunity. Temporary signals can modify it without rewriting
  // agent relationships or forcing social behavior.
  socialOpportunity: number;

  // Baseline environmental support. Temporary signals can modify it.
  safetySupport: number;
}

export interface WorldDeterminismState {
  rngState: number;
  eventSequence: number;
}

export interface WorldState {
  id: string;
  now: number;

  environment: WorldEnvironment;
  determinism: WorldDeterminismState;

  agents: Record<string, AgentState>;
  relationships: Record<string, RelationshipState>;
}

export type WorldDisturbanceKind =
  | 'resource_shock'
  | 'social_barrier'
  | 'safety_shock';
