import { stableJsonStringify } from '../core/stableJson';
import { createStableId } from '../core/stableId';
import {
  StaleWorldObservationError,
  WorldRevisionConflictError,
} from '../world/persistence';
import type { WorldMutationResult } from '../world/WorldEngine';
import type { WorldState } from '../world/types';
import {
  InMemoryInterventionGatewayLedger,
  type GatewayLedgerEntry,
  type InterventionGatewayLedger,
} from './InterventionGatewayLedger';
import type {
  InterventionKind,
  InterventionProposal,
  InterventionRecord,
} from './types';

export const ABSOLUTE_MAX_INTERVENTION_MAGNITUDE = 0.25;
export const ABSOLUTE_MAX_INTERVENTION_DURATION = 32;
export const INTERVENTION_GATEWAY_POLICY_VERSION =
  'ainkrad-intervention-gateway-0.3.4';

const ALLOWED_INTERVENTION_KINDS = new Set<string>([
  'resource_relief',
  'open_shared_space',
  'safety_support',
]);

export interface SimulationInterventionTarget {
  snapshot(): WorldState;
  applyAuthorizedIntervention(
    worldId: string,
    kind: InterventionKind,
    magnitude: number,
    now: number,
    duration: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult>;
}

export interface InterventionGatewayOptions {
  maxMagnitude?: number;
  minInterval?: number;
  effectDuration?: number;
  ledger?: InterventionGatewayLedger;
  policyVersion?: string;
}

interface AuthorizationDecision {
  authorized: boolean;
  reason: string;
}

/**
 * Independent simulation boundary.
 *
 * Cardinal may request an intervention. The gateway owns authorization policy,
 * cooldown, execution intent and the mutation capability. Pending authorization
 * is recorded before mutation so a crash can be recovered without duplicating
 * the intervention.
 */
export class IndependentInterventionGateway {
  private readonly maxMagnitude: number;
  private readonly minInterval: number;
  private readonly effectDuration: number;
  private readonly ledger: InterventionGatewayLedger;
  readonly policyVersion: string;

  constructor(
    private readonly target: SimulationInterventionTarget,
    options: InterventionGatewayOptions = {},
  ) {
    const maxMagnitude = options.maxMagnitude ?? ABSOLUTE_MAX_INTERVENTION_MAGNITUDE;
    const minInterval = options.minInterval ?? 5;
    const effectDuration = options.effectDuration ?? 8;
    const policyVersion = options.policyVersion ?? INTERVENTION_GATEWAY_POLICY_VERSION;

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
    if (!policyVersion.trim()) {
      throw new Error('Gateway policyVersion must not be empty.');
    }

    this.maxMagnitude = maxMagnitude;
    this.minInterval = minInterval;
    this.effectDuration = effectDuration;
    this.ledger = options.ledger ?? new InMemoryInterventionGatewayLedger();
    this.policyVersion = policyVersion;
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

    const targetWorldId = this.target.snapshot().id;
    await this.recover(targetWorldId);

    const proposalFingerprint = stableJsonStringify(proposal);
    const prior = await this.ledger.get(targetWorldId, proposal.proposalId);
    if (prior) {
      this.assertSameRequest(prior, evaluationId, proposalFingerprint);
      if (prior.phase === 'final') {
        return structuredClone(prior.record);
      }
      return await this.resumePending(prior);
    }

    const authorization = await this.authorize(proposal, expectedWorld, now);
    const baseRecord: InterventionRecord = {
      interventionId: createStableId('intervention', {
        worldId: targetWorldId,
        proposalId: proposal.proposalId,
        evaluationId,
      }),
      evaluationId,
      worldId: targetWorldId,
      requestedAt: now,
      observedWorldRevision: expectedWorld.revision,
      gatewayPolicyVersion: this.policyVersion,
      proposal: structuredClone(proposal),
      authorized: authorization.authorized,
      authorizationReason: authorization.reason,
      executionStatus: authorization.authorized ? 'authorized_pending' : 'denied',
      executed: false,
    };

    const entry: GatewayLedgerEntry = {
      worldId: targetWorldId,
      proposalId: proposal.proposalId,
      evaluationId,
      proposalFingerprint,
      expectedWorldRevision: expectedWorld.revision,
      effectDuration: this.effectDuration,
      gatewayPolicyVersion: this.policyVersion,
      phase: authorization.authorized ? 'pending' : 'final',
      record: structuredClone(baseRecord),
    };

    const stored = await this.ledger.begin(entry);
    if (stored.phase === 'final') {
      return structuredClone(stored.record);
    }
    return await this.resumePending(stored);
  }

  /**
   * Resolve authorization intents that were persisted before a process failure.
   * New proposals must not bypass a pending intervention by restarting gateway RAM.
   */
  async recover(worldId: string): Promise<void> {
    if (this.target.snapshot().id !== worldId) {
      throw new Error(
        `Gateway target ${this.target.snapshot().id} cannot recover world ${worldId}.`,
      );
    }
    const pending = (await this.ledger.entries(worldId)).filter(
      (entry) => entry.phase === 'pending',
    );
    for (const entry of pending) {
      await this.resumePending(entry);
    }
  }

  async ledgerEntries(worldId: string): Promise<GatewayLedgerEntry[]> {
    return await this.ledger.entries(worldId);
  }

  private async resumePending(entry: GatewayLedgerEntry): Promise<InterventionRecord> {
    if (entry.phase !== 'pending') {
      return structuredClone(entry.record);
    }

    const proposal = entry.record.proposal;
    if (entry.worldId !== this.target.snapshot().id || proposal.worldId !== entry.worldId) {
      throw new Error(
        `Gateway ledger entry ${entry.proposalId} does not belong to its simulation target.`,
      );
    }

    try {
      // The target performs a second, commit-bound revision check. If a crash
      // occurred after the world commit, the same stable proposal ID is treated
      // as an exact retry and returns without applying the effect twice.
      const applyResult = await this.target.applyAuthorizedIntervention(
        entry.worldId,
        proposal.kind,
        proposal.magnitude,
        entry.record.requestedAt,
        entry.effectDuration,
        proposal.proposalId,
        entry.expectedWorldRevision,
      );

      const final: GatewayLedgerEntry = {
        ...entry,
        phase: 'final',
        record: {
          ...entry.record,
          executionStatus: 'executed',
          executed: true,
          committedWorldRevision: applyResult.committedRevision,
        },
      };
      return structuredClone((await this.ledger.finalize(final)).record);
    } catch (error) {
      if (
        error instanceof StaleWorldObservationError ||
        error instanceof WorldRevisionConflictError
      ) {
        const final: GatewayLedgerEntry = {
          ...entry,
          phase: 'final',
          record: {
            ...entry.record,
            authorizationReason:
              `${entry.record.authorizationReason} Execution cancelled because the observed world revision became stale before commit.`,
            executionStatus: 'stale',
            executed: false,
          },
        };
        return structuredClone((await this.ledger.finalize(final)).record);
      }

      // Unknown/transient failures intentionally leave the authorization intent
      // pending. A restarted gateway can recover it using the stable proposal ID.
      throw error;
    }
  }

  private async authorize(
    proposal: Readonly<InterventionProposal>,
    expectedWorld: Readonly<WorldState>,
    now: number,
  ): Promise<AuthorizationDecision> {
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

    const lastExecution = await this.ledger.lastExecutedAt(proposal.worldId);
    if (lastExecution !== undefined && now - lastExecution < this.minInterval) {
      return {
        authorized: false,
        reason: 'Independent gateway cooldown prevents repeated intervention.',
      };
    }

    return {
      authorized: true,
      reason:
        'Proposal is inside the runtime allowlist, persisted cooldown and independent gateway limits.',
    };
  }

  private assertSameRequest(
    prior: GatewayLedgerEntry,
    evaluationId: string,
    proposalFingerprint: string,
  ): void {
    if (
      prior.evaluationId !== evaluationId ||
      prior.proposalFingerprint !== proposalFingerprint ||
      prior.gatewayPolicyVersion !== this.policyVersion
    ) {
      throw new Error(
        `Proposal ID ${prior.proposalId} was reused with different content or execution context.`,
      );
    }
  }
}
