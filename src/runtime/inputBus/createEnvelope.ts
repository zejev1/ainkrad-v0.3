import {
  assertValidInputEnvelope,
  type InputEnvelope,
  type InputPayload,
  type InputSource,
} from './types';

export interface CreateInputEnvelopeArgs {
  eventId: string;
  worldId: string;
  source: InputSource;
  type: string;
  payload?: InputPayload;
  createdAt?: number;
  deduplicationKey?: string;
  correlationId?: string;
}

export function createInputEnvelope(
  args: CreateInputEnvelopeArgs,
): InputEnvelope {
  const event: InputEnvelope = {
    eventId: args.eventId,
    worldId: args.worldId,
    source: args.source,
    type: args.type,
    createdAt: args.createdAt ?? Date.now(),
    payload: args.payload ?? {},
    deduplicationKey: args.deduplicationKey,
    correlationId: args.correlationId,
  };

  assertValidInputEnvelope(event);
  return event;
}
