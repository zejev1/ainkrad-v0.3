import type { JsonObject } from '../../core/json';

export type InputSource =
  | 'agent'
  | 'world'
  | 'player'
  | 'system'
  | 'cardinal';

export type InputPayload = JsonObject;

export interface InputEnvelope {
  eventId: string;
  worldId: string;
  source: InputSource;
  type: string;
  createdAt: number;
  payload: InputPayload;
  deduplicationKey?: string;
  correlationId?: string;
}
