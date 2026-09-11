import type { JsonObject } from './json';

/** Public world protocol. It exposes no Cardinal algorithm or authority token. */
export type WorldInterventionKind =
  | 'resource_relief'
  | 'open_shared_space'
  | 'safety_support'
  | 'habitat_support';

export type WorldInputSource = 'agent' | 'world' | 'player' | 'system' | 'cardinal';

/** A source label is provenance, never permission to apply a world effect. */
export interface WorldInputEnvelope {
  eventId: string;
  worldId: string;
  source: WorldInputSource;
  type: string;
  createdAt: number;
  payload: JsonObject;
  deduplicationKey?: string;
  correlationId?: string;
}
