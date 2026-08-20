import { createEventId } from '../runtime/inputBus/createEventId';
import type { WorldState } from '../world/types';
import type {
  InterventionKind,
  InterventionProposal,
  InterventionRecord,
} from './types';

export interface SimulationInterventionTarget {
  snapshot(): WorldState;
  applyAuthorizedIntervention(
    kind: InterventionKind,
    magnitude: number,
    now: number,
    duration?: number,
  ): Promise<void>;
}

export interface InterventionGatewayOptions {
  maxMagnitude?: number;
  minInterval?: number;
  effectDuration?: number;
}

// This component owns the mutation capability. Cardinal Core never receives it.
// The gateway both authorizes and executes, so a proposal cannot be executed by
// the Core merely because the Core declared it acceptable.
export class IndependentInterventionGateway {
  private readonly maxMagnitude: number;
  private readonly minInterval: number;
  private readonly effectDuration: number;
  private readonly lastExecutionAt = new Map<string, number>();

  constructor(
    private readonly target: SimulationInterventionTarget,
    options: InterventionGatewayOptions = {},
  ) {
    this.maxMagnitude = options.maxMagnitude ?? 0.25;
    this.minInterval = options.minInterval ?? 5;
    this.effectDuration = options.effectDuration ?? 8;
  }

  async execute(
    evaluationId: string,
    proposal: Readonly<InterventionProposal>,
    expectedWorld: Readonly<WorldState>,
    now: number,
  ): Promise<InterventionRecord> {
    const authorization = this.authorize(proposal, expectedWorld, now);

    const record: InterventionRecord = {
      interventionId: createEventId('intervention'),
      evaluationId,
      worldId: proposal.worldId,
      requestedAt: now,
      proposal: structuredClone(proposal),
      authorized: authorization.authorized,
      authorizationReason: authorization.reason,
      executed: false,
    };

    if (!authorization.authorized) {
      return record;
    }

    await this.target.applyAuthorizedIntervention(
      proposal.kind,
      proposal.magnitude,
      now,
      this.effectDuration,
    );

    record.executed = true;
    this.lastExecutionAt.set(proposal.worldId, now);
    return record;
  }

  private authorize(
    proposal: Readonly<InterventionProposal>,
    expectedWorld: Readonly<WorldState>,
    now: number,
  ): { authorized: boolean; reason: string } {
    const actualWorld = this.target.snapshot();

    if (proposal.worldId !== expectedWorld.id || proposal.worldId !== actualWorld.id) {
      return {
        authorized: false,
        reason: 'Proposal world does not match the authorized simulation target.',
      };
    }

    if (
      actualWorld.now !== expectedWorld.now ||
      actualWorld.determinism.eventSequence !== expectedWorld.determinism.eventSequence ||
      actualWorld.determinism.rngState !== expectedWorld.determinism.rngState
    ) {
      return {
        authorized: false,
        reason: 'World changed after observation; proposal requires a fresh evaluation.',
      };
    }

    if (!Number.isFinite(proposal.magnitude) || proposal.magnitude <= 0) {
      return {
        authorized: false,
        reason: 'Proposal magnitude must be positive and finite.',
      };
    }

    if (proposal.magnitude > this.maxMagnitude) {
      return {
        authorized: false,
        reason: `Proposal magnitude exceeds gateway limit ${this.maxMagnitude}.`,
      };
    }

    const lastExecution = this.lastExecutionAt.get(proposal.worldId);
    if (lastExecution !== undefined && now - lastExecution < this.minInterval) {
      return {
        authorized: false,
        reason: 'Independent gateway cooldown prevents repeated intervention.',
      };
    }

    return {
      authorized: true,
      reason: 'Proposal is inside the current simulation allowlist and gateway limits.',
    };
  }
}
