import type {
  InputEnvelope,
  InputPayload,
  InputSource,
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
  if (!args.eventId.trim()) {
    throw new Error(
      'Input eventId must not be empty.',
    );
  }

  if (!args.worldId.trim()) {
    throw new Error(
      'Input worldId must not be empty.',
    );
  }

  if (!args.type.trim()) {
    throw new Error(
      'Input type must not be empty.',
    );
  }

  return {
    eventId: args.eventId,
    worldId: args.worldId,
    source: args.source,
    type: args.type,
    createdAt:
      args.createdAt ??
      Date.now(),
    payload:
      args.payload ??
      {},
    deduplicationKey:
      args.deduplicationKey,
    correlationId:
      args.correlationId,
  };
}
