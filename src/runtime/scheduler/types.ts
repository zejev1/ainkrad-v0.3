import type {
  JsonObject,
} from '../../core/json';

export interface ScheduledOperation {
  operationId: string;
  worldId: string;
  actorId?: string;
  kind: string;
  payload?: JsonObject;
}

export const
  MAX_SCHEDULED_OPERATION_BYTES =
    8 * 1024;

export function
assertSmallScheduledOperation(
  operation:
    ScheduledOperation,
): void {
  const bytes =
    new TextEncoder()
      .encode(
        JSON.stringify(
          operation,
        ),
      )
      .byteLength;

  if (
    bytes >
    MAX_SCHEDULED_OPERATION_BYTES
  ) {
    throw new Error(
      `Scheduled operation is ${bytes} bytes; ` +
      `Ainkrad limit is ${MAX_SCHEDULED_OPERATION_BYTES} bytes.`,
    );
  }
}
