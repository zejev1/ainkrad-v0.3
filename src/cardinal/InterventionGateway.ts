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
import {
  DEFAULT_GATEWAY_COOLDOWN_WORLD_MINUTES,
  DEFAULT_GATEWAY_EFFECT_DURATION_WORLD_MINUTES,
  MAX_CARDINAL_PREDICTION_HORIZON_WORLD_MINUTES,
  MAX_GATEWAY_EFFECT_DURATION_WORLD_MINUTES,
  isCanonicalWorldMinutes,
} from '../v15/WorldTimeContract';

export const ABSOLUTE_MAX_INTERVENTION_MAGNITUDE = 0.25;
export const ABSOLUTE_MAX_INTERVENTION_DURATION_WORLD_MINUTES =
  MAX_GATEWAY_EFFECT_DURATION_WORLD_MINUTES;
export const INTERVENTION_GATEWAY_POLICY_VERSION =
  'ainkrad-intervention-gateway-0.3.15';

const ALLOWED_INTERVENTION_KINDS = new Set<string>([
  'resource_relief',
  'open_shared_space',
  'safety_support',
  'habitat_support',
]);

export interface SimulationInterventionTarget {
  snapshot(): WorldState;
  applyAuthorizedIntervention(
    worldId: string,
    kind: InterventionKind,
    magnitude: number,
    now: number,
    durationWorldMinutes: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult>;
}

export interface InterventionGatewayOptions {
  maxMagnitude?: number;
  minIntervalWorldMinutes?: number;
  effectDurationWorldMinutes?: number;
  ledger?: InterventionGatewayLedger;
  policyVersion?: string;
}

export interface InterventionEvidenceContext {
  worldEpoch: number;
  policyVersion: string;
  sensorVersion: string;
  researchVersion: string;
  evaluatedWorldMinutes: number;
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
  private readonly minIntervalWorldMinutes: number;
  private readonly effectDurationWorldMinutes: number;
  private readonly ledger: InterventionGatewayLedger;
  readonly policyVersion: string;

  constructor(
    private readonly target: SimulationInterventionTarget,
    options: InterventionGatewayOptions = {},
  ) {
    const maxMagnitude = options.maxMagnitude ?? ABSOLUTE_MAX_INTERVENTION_MAGNITUDE;
    const minIntervalWorldMinutes =
      options.minIntervalWorldMinutes ??
      DEFAULT_GATEWAY_COOLDOWN_WORLD_MINUTES;
    const effectDurationWorldMinutes =
      options.effectDurationWorldMinutes ??
      DEFAULT_GATEWAY_EFFECT_DURATION_WORLD_MINUTES;
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
    if (
      !Number.isFinite(minIntervalWorldMinutes) ||
      minIntervalWorldMinutes < 0
    ) {
      throw new Error(
        'Gateway minIntervalWorldMinutes must be finite and non-negative.',
      );
    }
    if (
      !Number.isFinite(effectDurationWorldMinutes) ||
      effectDurationWorldMinutes < 1 ||
      effectDurationWorldMinutes >
        ABSOLUTE_MAX_INTERVENTION_DURATION_WORLD_MINUTES
    ) {
      throw new Error(
        `Gateway effectDurationWorldMinutes must be from 1 to ${ABSOLUTE_MAX_INTERVENTION_DURATION_WORLD_MINUTES}.`,
      );
    }
    if (!policyVersion.trim()) {
      throw new Error('Gateway policyVersion must not be empty.');
    }

    this.maxMagnitude = maxMagnitude;
    this.minIntervalWorldMinutes = minIntervalWorldMinutes;
    this.effectDurationWorldMinutes = effectDurationWorldMinutes;
    this.ledger = options.ledger ?? new InMemoryInterventionGatewayLedger();
    this.policyVersion = policyVersion;
  }

  async execute(
    evaluationId: string,
    proposal: Readonly<InterventionProposal>,
    expectedWorld: Readonly<WorldState>,
    now: number,
    evidenceContext?: Readonly<InterventionEvidenceContext>,
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
    const requestedWorldMinutes = expectedWorld.calendar.elapsedWorldMinutes;
    const context: InterventionEvidenceContext = evidenceContext ?? {
      worldEpoch: expectedWorld.epoch ?? 1,
      policyVersion: 'legacy-unversioned',
      sensorVersion: 'legacy-unversioned',
      researchVersion: 'legacy-unversioned',
      evaluatedWorldMinutes: requestedWorldMinutes,
    };
    if (
      context.worldEpoch !== (expectedWorld.epoch ?? 1) ||
      context.evaluatedWorldMinutes !== requestedWorldMinutes
    ) {
      throw new Error(
        'Gateway evidence context does not match the observed world epoch/time.',
      );
    }
    const baseRecord: InterventionRecord = {
      interventionId: createStableId('intervention', {
        worldId: targetWorldId,
        proposalId: proposal.proposalId,
        evaluationId,
      }),
      evaluationId,
      worldId: targetWorldId,
      worldEpoch: context.worldEpoch,
      policyVersion: context.policyVersion,
      sensorVersion: context.sensorVersion,
      researchVersion: context.researchVersion,
      requestedAt: now,
      requestedWorldMinutes,
      observedWorldRevision: expectedWorld.revision,
      gatewayPolicyVersion: this.policyVersion,
      authorizedEffectDurationWorldMinutes:
        this.effectDurationWorldMinutes,
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
      effectDurationWorldMinutes: this.effectDurationWorldMinutes,
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

    if (
      !isCanonicalWorldMinutes(entry.effectDurationWorldMinutes) ||
      !isCanonicalWorldMinutes(entry.record.requestedWorldMinutes)
    ) {
      const final: GatewayLedgerEntry = {
        ...entry,
        phase: 'final',
        record: {
          ...entry.record,
          authorizationReason:
            `${entry.record.authorizationReason} Legacy tick-only pending intent was closed without execution because its duration cannot be safely converted into canonical world time.`,
          executionStatus: 'stale',
          executed: false,
        },
      };
      return structuredClone((await this.ledger.finalize(final)).record);
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
        entry.effectDurationWorldMinutes,
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

    if (!proposal.hypothesisId?.trim()) {
      return {
        authorized: false,
        reason: 'Proposal is not bound to a Cardinal hypothesis.',
      };
    }

    const prediction = proposal.prediction;
    if (
      !prediction ||
      ![
        'civilizationCriticality',
        'resourcePressure',
        'socialIsolation',
        'safetyPressure',
        'averageStress',
        'wildlifePressure',
      ].includes(
        prediction.metric as string,
      ) ||
      prediction.direction !== 'decrease' ||
      !Number.isFinite(prediction.minimumImprovement) ||
      prediction.minimumImprovement < 0 ||
      !isCanonicalWorldMinutes(prediction.horizonWorldMinutes) ||
      prediction.horizonWorldMinutes < 1 ||
      prediction.horizonWorldMinutes >
        MAX_CARDINAL_PREDICTION_HORIZON_WORLD_MINUTES ||
      typeof prediction.statement !== 'string' ||
      !prediction.statement.trim()
    ) {
      return {
        authorized: false,
        reason: 'Proposal does not contain a valid bounded falsifiable prediction.',
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

    const requestedWorldMinutes = expectedWorld.calendar.elapsedWorldMinutes;
    const lastExecutionWorldMinutes =
      await this.ledger.lastExecutedWorldMinutes(proposal.worldId);
    if (
      lastExecutionWorldMinutes !== undefined &&
      requestedWorldMinutes - lastExecutionWorldMinutes <
        this.minIntervalWorldMinutes
    ) {
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
