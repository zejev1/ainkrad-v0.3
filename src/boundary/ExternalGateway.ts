import type {
  JsonObject,
} from '../core/json';

export interface ExternalActionRequest {
  requestId: string;
  kind: string;
  payload: JsonObject;
}

export interface ExternalActionResult {
  authorized: boolean;
  executed: boolean;
  reason: string;
}

export interface ExternalGateway {
  request(
    action:
      Readonly<
        ExternalActionRequest
      >,
  ): Promise<ExternalActionResult>;
}

// Default boundary: closed.
//
// Cardinal may request an action,
// but receives no capability to alter
// authorization rules or execute directly.
export class ClosedExternalGateway
implements ExternalGateway {
  async request(
    _action:
      Readonly<
        ExternalActionRequest
      >,
  ): Promise<ExternalActionResult> {
    return {
      authorized: false,
      executed: false,
      reason:
        'External actions are disabled. Authorization belongs to an independent gateway.',
    };
  }
}
