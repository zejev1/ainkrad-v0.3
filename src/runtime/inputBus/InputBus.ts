import type { InputEnvelope } from './types';

export interface PublishResult {
  accepted: boolean;
  duplicate: boolean;
}

export interface ClaimedInput {
  event: InputEnvelope;
  claimToken: string;
  consumerId: string;
  leaseUntil: number;
}

export interface InputBus {
  publish(event: InputEnvelope): Promise<PublishResult>;

  // Claiming prevents multiple workers from processing the same event at once.
  // Expired claims may be reclaimed after a worker dies.
  claim(
    worldId: string,
    consumerId: string,
    limit: number,
    now: number,
    leaseMs: number,
  ): Promise<ClaimedInput[]>;

  acknowledge(
    worldId: string,
    eventId: string,
    consumerId: string,
    claimToken: string,
    acknowledgedAt: number,
  ): Promise<void>;

  release(
    worldId: string,
    eventId: string,
    consumerId: string,
    claimToken: string,
  ): Promise<void>;
}
