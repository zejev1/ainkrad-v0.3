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
  kind:
    | 'interaction'
    | 'reflection'
    | 'world_event';
  summary: string;
  importance: number;
  relatedAgentIds: string[];
}

export interface WorldEnvironment {
  resourcePool: number;

  // Environment-level opportunity.
  // This does not force agents to socialize.
  socialOpportunity: number;

  // Environment-level support.
  // It does not directly rewrite agent relationships.
  safetySupport: number;
}

export interface WorldState {
  id: string;
  now: number;

  environment:
    WorldEnvironment;

  agents:
    Record<
      string,
      AgentState
    >;

  relationships:
    Record<
      string,
      RelationshipState
    >;

  memories:
    MemoryRecord[];
}
