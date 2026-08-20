import type {
  InputEnvelope,
} from './types';

export interface PublishResult {
  accepted: boolean;
  duplicate: boolean;
}

export interface InputBus {
  publish(
    event: InputEnvelope,
  ): Promise<PublishResult>;

  take(
    worldId: string,
    limit: number,
  ): Promise<InputEnvelope[]>;

  acknowledge(
    eventId: string,
  ): Promise<void>;
}
