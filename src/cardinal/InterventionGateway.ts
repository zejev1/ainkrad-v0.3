import { stableJsonStringify } from '../core/stableJson';
import { createStableId } from '../core/stableId';
import type { WorldState } from '../world/types';
import type {
  InterventionKind,
  InterventionProposal,
  InterventionRecord,
} from './types';

export const ABSOLUTE_MAX_INTERVENTION_MAGNITUDE = 0.25;
export const ABSOLUTE_MAX_INTERVENTION_DURATION = 32;

const ALLOWED_INTERVENTION_KINDS = new Set<string>([
  'resource_relief',
  'open_shared_space',
  'safety_support',
]);

export interface SimulationInterventionTarget {
  snapshot(): WorldState;
  applyAuthorizedIntervention(
    kind: InterventionKind,
    magnitude: number,
    now: number,
    duration: number,
    operationId: string,
  ): Promise<boolean>;
}

export interface InterventionGatewayOptions {
  maxMagnitude?: number;
  minInterval?: number;
  effectDuration?: number;
}

interface StoredExecution {
  evaluationId: string;
  proposalFingerprint: string;
  record: InterventionRecord;
}

// This component owns the simulation mutation capability. Cardinal Core never
// receives it. Runtime allowlisting is intentional: TypeScript union types are
// not a security boundary when proposals can eventually arrive from serialized
// data or a model.
export class IndependentInterventionGateway {
  private readonly maxMagnitude: number;
  private readonly minInterval: number;
  private readonly effectDuration: number;
  private readonly lastExecutionAt = new Map<string, number>();
  private readonly executionsByProposal = new Map<string, StoredExecution>();

  constructor(
    private readonly target: SimulationInterventionTarget,
    options: InterventionGatewayOptions = {},
  ) {
    const maxMagnitude = options.maxMagnitude ?? ABSOLUTE_MAX_INTERVENTION_MAGNITUDE;
    const minInterval = options.minInterval ?? 5;
    const effectDuration = options.effectDuration ?? 8;

    if (
      !Number.isFinite(maxMagnitude) ||
      maxMagnitude <= 0 ||
      maxMagnitude > ABSOLUTE_MAX_INTERVENTION_MAGNITUDE
    ) {
      throw new Error(
        `Gateway maxMagnitude must be > 0 and <= ${ABSOLUTE_MAX_INTERVENTION_MAGNITUDE}.`,
      );
    }
    if (!Number.isFinite(minInterval) || minInterval < 0) {
      throw new Error('Gateway minInterval must be finite and non-negative.');
    }
    if (
      !Number.isFinite(effectDuration) ||
      effectDuration < 1 ||
      effectDuration > ABSOLUTE_MAX_INTERVENTION_DURATION
    ) {
      throw new Error(
        `Gateway effectDuration must be from 1 to ${ABSOLUTE_MAX_INTERVENTION_DURATION}.`,
      );
    }

    this.maxMagnitude = maxMagnitude;
    this.minInterval = minInterval;
    this.effectDuration = effectDuration;
  }

  async execute(
    evaluationId: string,
    proposal: Readonly<InterventionProposal>,
    expectedWorld: Readonly<WorldState>,
    now: number,
  ): Promise<InterventionRecord> {
    if (!evaluationId.trim()) {
      throw new Error('Gateway evaluationId must not be empty.');
    }
    if (!proposal.proposalId.trim()) {
      throw new Error('Gateway proposalId must not be empty.');
    }

    const proposalKey = `${proposal.worldId}::${proposal.proposalId}`;
    const proposalFingerprint = stableJsonStringify(proposal);
    const prior = this.executionsByProposal.get(proposalKey);

    if (prior) {
      if (
        prior.evaluationId !== evaluationId ||
        prior.proposalFingerprint !== proposalFingerprint
      ) {
        throw new Error(
          `Proposal ID ${proposal.proposalId} was reused with different content.`,
        );
      }
      return structuredClone(prior.record);
    }

    const authorization = this.authorize(proposal, expectedWorld, now);

    const record: InterventionRecord = {
      interventionId: createStableId('intervention', {
        worldId: proposal.worldId,
        proposalId: proposal.proposalId,
        evaluationId,
      }),
      evaluationId,
      worldId: proposal.worldId,
      requestedAt: now,
      proposal: structuredClone(proposal),
      authorized: authorization.authorized,
      authorizationReason: authorization.reason,
      executed: false,
    };

    if (authorization.authorized) {
      // proposalId is the stable world-operation id. If the gateway process is
      // retried after the target already committed, the target treats the same
      // proposal as an idempotent replay rather than a second intervention.
      await this.target.applyAuthorizedIntervention(
        proposal.kind,
        proposal.magnitude,
        now,
        this.effectDuration,
        proposal.proposalId,
      );

      record.executed = true;
      this.lastExecutionAt.set(proposal.worldId, now);
    }

    this.executionsByProposal.set(proposalKey, {
      evaluationId,
      proposalFingerprint,
      record: structuredClone(record),
    });

    return structuredClone(record);
  }

  private authorize(
    proposal: Readonly<InterventionProposal>,
    expectedWorld: Readonly<WorldState>,
    now: number,
  ): { authorized: boolean; reason: string } {
    if (!ALLOWED_INTERVENTION_KINDS.has(proposal.kind as string)) {
      return {
        authorized: false,
        reason: 'Proposal kind is not in the independent gateway allowlist.',
      };
    }

    const actualWorld = this.target.snapshot();

    if (proposal.worldId !== expectedWorld.id || proposal.worldId !== actualWorld.id) {
      return {
        authorized: false,
        reason: 'Proposal world does not match the authorized simulation target.',
      };
    }

    if (!Number.isFinite(now) || now !== expectedWorld.now) {
      return {
        authorized: false,
        reason: 'Proposal execution time does not match the observed world time.',
      };
    }

    if (stableJsonStringify(actualWorld) !== stableJsonStringify(expectedWorld)) {
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
      reason: 'Proposal is inside the runtime allowlist and independent gateway limits.',
    };
  }
}
