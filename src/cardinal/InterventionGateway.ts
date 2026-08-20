import type {
  InterventionProposal,
} from './types';

import type {
  WorldState,
} from '../world/types';

export interface AuthorizationDecision {
  authorized: boolean;
  reason: string;
}

export interface InterventionGateway {
  authorize(
    proposal:
      Readonly<
        InterventionProposal
      >,
    world:
      Readonly<
        WorldState
      >,
  ): Promise<AuthorizationDecision>;
}

export class
IndependentInterventionGateway
implements InterventionGateway {
  async authorize(
    proposal:
      Readonly<
        InterventionProposal
      >,
    _world:
      Readonly<
        WorldState
      >,
  ): Promise<AuthorizationDecision> {
    if (
      proposal.magnitude <=
        0 ||
      proposal.magnitude >
        0.25
    ) {
      return {
        authorized: false,
        reason:
          'Proposal magnitude exceeds the v0.3 minimal-intervention boundary.',
      };
    }

    return {
      authorized: true,
      reason:
        'Proposal is within the current simulation intervention allowlist.',
    };
  }
}
