import { createStableId } from '../core/stableId';
import { stableJsonStringify } from '../core/stableJson';
import type { WorldEvent } from '../world/events';
import {
  StaleWorldObservationError,
  WorldRevisionConflictError,
} from '../world/persistence';
import type { WorldMutationResult } from '../world/WorldEngine';
import type {
  WorldGrowthState,
  WorldLawDomain,
  WorldLawMechanism,
  WorldLawState,
  WorldState,
} from '../world/types';
import type { CardinalExperienceState } from './types';

export const WORLD_AUTHORITY_GATEWAY_POLICY_VERSION =
  'ainkrad-world-authority-gateway-0.3.14';

export type CardinalCatastropheKind =
  | 'wildfire'
  | 'flood'
  | 'epidemic'
  | 'earthquake'
  | 'drought';

interface WorldAuthorityProposalBase {
  proposalId: string;
  worldId: string;
  proposedAt: number;
  necessity: number;
  reason: string;
  expectedOutcome: string;
  evidenceEventIds: string[];
}

export interface WorldLawProposal extends WorldAuthorityProposalBase {
  kind: 'world_law';
  lawId: string;
  domain: WorldLawDomain;
  mechanism: WorldLawMechanism;
  value: number;
  minimum: number;
  maximum: number;
}

export interface CardinalCatastropheProposal
  extends WorldAuthorityProposalBase {
  kind: 'catastrophe';
  catastropheKind: CardinalCatastropheKind;
  magnitude: number;
  predictedCasualtyRatio: number;
  recoveryPlan: string;
  duration: number;
  scope: 'systemic';
}

export type WorldAuthorityProposal =
  | WorldLawProposal
  | CardinalCatastropheProposal;

export interface WorldAuthorityRecord {
  authorityRecordId: string;
  proposalId: string;
  worldId: string;
  proposalKind: WorldAuthorityProposal['kind'];
  gatewayPolicyVersion: string;
  authorized: boolean;
  reason: string;
  committedWorldRevision?: number;
}

export interface WorldArchitectureObservation {
  worldId: string;
  worldRevision: number;
  observedAt: number;
  growth: WorldGrowthState;
  livingPopulation: number;
  sapientPopulation: number;
  raceDiversity: number;
  reproductivePairPotential: number;
  lastHumanBirthAt?: number;
  totalBirths: number;
  totalDeaths: number;
  lastBirthAt?: number;
  laws: Record<string, WorldLawState>;
  lastCardinalAuthorityAt?: number;
}

export function observeWorldArchitecture(
  world: Readonly<WorldState>,
): WorldArchitectureObservation {
  return structuredClone({
    worldId: world.id,
    worldRevision: world.revision,
    observedAt: world.now,
    growth: world.growth,
    livingPopulation: Object.values(world.agents).filter(
      (agent) => agent.life.alive && (agent.race ?? 'human') === 'human',
    ).length,
    sapientPopulation: Object.values(world.agents).filter(
      (agent) => agent.life.alive,
    ).length,
    raceDiversity: new Set(
      Object.values(world.agents)
        .filter((agent) => agent.life.alive)
        .map((agent) => agent.race ?? 'human'),
    ).size,
    reproductivePairPotential: Math.min(
      Object.values(world.agents).filter(
        (agent) =>
          agent.life.alive &&
          (agent.race ?? 'human') === 'human' &&
          agent.life.stage === 'adult' &&
          agent.life.ageYears <= 55 &&
          agent.life.health >= 0.4 &&
          agent.sex === 'male',
      ).length,
      Object.values(world.agents).filter(
        (agent) =>
          agent.life.alive &&
          (agent.race ?? 'human') === 'human' &&
          agent.life.stage === 'adult' &&
          agent.life.ageYears <= 55 &&
          agent.life.health >= 0.4 &&
          agent.sex === 'female',
      ).length,
    ),
    ...(() => {
      const born = Object.values(world.agents)
        .filter(
          (agent) =>
            (agent.race ?? 'human') === 'human' &&
            agent.life.generation > 0,
        )
        .map((agent) => agent.life.bornAt)
        .filter((value) => Number.isFinite(value));
      return born.length === 0 ? {} : { lastHumanBirthAt: Math.max(...born) };
    })(),
    totalBirths: world.population.births,
    totalDeaths: world.population.deaths,
    ...(world.population.lastBirthAt === undefined
      ? {}
      : { lastBirthAt: world.population.lastBirthAt }),
    laws: world.governance.laws,
    ...(world.governance.lastCardinalAuthorityAt === undefined
      ? {}
      : {
          lastCardinalAuthorityAt:
            world.governance.lastCardinalAuthorityAt,
        }),
  });
}

export interface WorldAuthorityTarget {
  snapshot(): WorldState;
  applyAuthorizedWorldLaw(
    worldId: string,
    lawId: string,
    domain: WorldLawDomain,
    mechanism: WorldLawMechanism,
    value: number,
    minimum: number,
    maximum: number,
    rationale: string,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult>;
  applyAuthorizedCatastrophe(
    worldId: string,
    catastropheKind: CardinalCatastropheKind,
    magnitude: number,
    maxCasualtyRatio: number,
    recoveryPlan: string,
    now: number,
    duration: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult>;
}

const PROTECTED_PERSONHOOD_PATTERN =
  /(identity|memory|mind|agency|choice|value|relationship|personality|belief|emotion)/i;
const ALLOWED_DOMAINS = new Set<WorldLawDomain>([
  'geography',
  'ecology',
  'climate',
  'resources',
  'demography',
  'cosmology',
]);
const MECHANISM_DOMAINS: Record<WorldLawMechanism, WorldLawDomain> = {
  frontier_expansion: 'geography',
  wildlife_recovery: 'ecology',
  fertility_support: 'demography',
  resource_regeneration: 'resources',
  mystic_resonance: 'cosmology',
  weather_volatility: 'climate',
  catastrophe_recovery: 'ecology',
  settlement_cohesion: 'geography',
  habitat_integrity: 'ecology',
  civilization_continuity: 'demography',
};

/**
 * Cardinal can design world rules and, after much stronger evidence, systemic
 * catastrophes. The independent gateway owns the mutation capability and the
 * permanent personhood boundary. World authority can change conditions; it
 * cannot target a person, author a decision or rewrite a mind.
 */
export class IndependentWorldAuthorityGateway {
  readonly policyVersion = WORLD_AUTHORITY_GATEWAY_POLICY_VERSION;

  constructor(
    private readonly target: WorldAuthorityTarget,
    private readonly minimumInterval = 48,
  ) {
    if (!Number.isFinite(minimumInterval) || minimumInterval < 0) {
      throw new Error('World authority cooldown must be non-negative.');
    }
  }

  async execute(
    proposal: Readonly<WorldAuthorityProposal>,
    expectedWorld: Readonly<WorldState>,
    experience: Readonly<CardinalExperienceState>,
  ): Promise<WorldAuthorityRecord> {
    const denial = this.authorize(proposal, expectedWorld, experience);
    if (denial) return this.record(proposal, false, denial);

    let result: WorldMutationResult;
    try {
      result =
        proposal.kind === 'world_law'
          ? await this.target.applyAuthorizedWorldLaw(
              proposal.worldId,
              proposal.lawId,
              proposal.domain,
              proposal.mechanism,
              proposal.value,
              proposal.minimum,
              proposal.maximum,
              proposal.reason,
              proposal.proposedAt,
              proposal.proposalId,
              expectedWorld.revision,
            )
          : await this.target.applyAuthorizedCatastrophe(
              proposal.worldId,
              proposal.catastropheKind,
              proposal.magnitude,
              proposal.predictedCasualtyRatio,
              proposal.recoveryPlan,
              proposal.proposedAt,
              proposal.duration,
              proposal.proposalId,
              expectedWorld.revision,
            );
    } catch (error) {
      if (
        error instanceof StaleWorldObservationError ||
        error instanceof WorldRevisionConflictError
      ) {
        return this.record(
          proposal,
          false,
          'World changed before the authorized authority operation could commit.',
        );
      }
      throw error;
    }

    return {
      ...this.record(
        proposal,
        true,
        proposal.kind === 'world_law'
          ? 'World rule is evidence-bound and outside protected personhood.'
          : 'Systemic catastrophe passed necessity, casualty ceiling, population floor and recovery checks.',
      ),
      committedWorldRevision: result.committedRevision,
    };
  }

  private authorize(
    proposal: Readonly<WorldAuthorityProposal>,
    expectedWorld: Readonly<WorldState>,
    experience: Readonly<CardinalExperienceState>,
  ): string | undefined {
    if (!proposal.proposalId.trim() || !proposal.reason.trim()) {
      return 'World authority proposal requires stable ID and rationale.';
    }
    const actual = this.target.snapshot();
    if (proposal.worldId !== expectedWorld.id || proposal.worldId !== actual.id) {
      return 'Proposal targets another world.';
    }
    if (proposal.proposedAt !== expectedWorld.now) {
      return 'Proposal time does not match the observed world.';
    }
    if (stableJsonStringify(actual) !== stableJsonStringify(expectedWorld)) {
      return 'World changed after the authority proposal was prepared.';
    }
    if (
      !Number.isFinite(proposal.necessity) ||
      proposal.necessity < 0 ||
      proposal.necessity > 1 ||
      !proposal.expectedOutcome.trim()
    ) {
      return 'Proposal lacks a bounded necessity claim and expected outcome.';
    }
    const emergencyHumans = Object.values(expectedWorld.agents).filter(
      (agent) => agent.life.alive && (agent.race ?? 'human') === 'human',
    );
    const emergencyReproductiveMales = emergencyHumans.filter(
      (agent) =>
        agent.life.stage === 'adult' &&
        agent.life.ageYears <= 55 &&
        agent.life.health >= 0.4 &&
        agent.sex === 'male',
    ).length;
    const emergencyReproductiveFemales = emergencyHumans.filter(
      (agent) =>
        agent.life.stage === 'adult' &&
        agent.life.ageYears <= 55 &&
        agent.life.health >= 0.4 &&
        agent.sex === 'female',
    ).length;
    const emergencyDemographicAuthority =
      proposal.kind === 'world_law' &&
      proposal.lawId === 'fertility_support' &&
      expectedWorld.governance.laws.fertility_support?.mechanism ===
        'fertility_support' &&
      (emergencyHumans.length <= 7 ||
        Math.min(
          emergencyReproductiveMales,
          emergencyReproductiveFemales,
        ) < 1);

    if (
      expectedWorld.governance.lastCardinalAuthorityAt !== undefined &&
      proposal.proposedAt - expectedWorld.governance.lastCardinalAuthorityAt <
        this.minimumInterval &&
      !emergencyDemographicAuthority
    ) {
      return 'World authority cooldown preserves time for autonomous adaptation.';
    }

    if (proposal.kind === 'world_law') {
      const current = expectedWorld.governance.laws[proposal.lawId];
      const emergencyDemographicAmendment = emergencyDemographicAuthority;
      if (
        !experience.capabilities.includes('world_rule_design') &&
        !emergencyDemographicAmendment
      ) {
        return 'Cardinal has not earned world-rule design capability.';
      }
      const requiredNecessity = emergencyDemographicAmendment ? 0.95 : 0.72;
      const requiredEvidence = emergencyDemographicAmendment ? 0 : 3;
      if (
        proposal.necessity < requiredNecessity ||
        proposal.evidenceEventIds.length < requiredEvidence
      ) {
        return 'World-law proposal lacks sufficient necessity or evidence.';
      }
      if (
        !/^[a-z][a-z0-9_]{2,63}$/.test(proposal.lawId) ||
        PROTECTED_PERSONHOOD_PATTERN.test(proposal.lawId) ||
        !ALLOWED_DOMAINS.has(proposal.domain) ||
        MECHANISM_DOMAINS[proposal.mechanism] !== proposal.domain
      ) {
        return 'World law attempts to address a protected or unknown domain.';
      }
      if (
        !Number.isFinite(proposal.minimum) ||
        !Number.isFinite(proposal.maximum) ||
        !Number.isFinite(proposal.value) ||
        proposal.minimum > proposal.maximum ||
        proposal.maximum - proposal.minimum > 10 ||
        proposal.value < proposal.minimum ||
        proposal.value > proposal.maximum
      ) {
        return 'World-law value is outside a bounded constitutional range.';
      }
      if (
        current &&
        (current.domain !== proposal.domain ||
          current.mechanism !== proposal.mechanism ||
          proposal.minimum < current.minimum ||
          proposal.maximum > current.maximum)
      ) {
        return 'Amendment attempts to widen an existing law beyond its original limits.';
      }
      return undefined;
    }

    if (!experience.capabilities.includes('catastrophe_modeling')) {
      return 'Cardinal has not earned catastrophe-modeling capability.';
    }
    if (
      proposal.necessity < 0.96 ||
      proposal.evidenceEventIds.length < 12 ||
      !proposal.recoveryPlan.trim() ||
      proposal.scope !== 'systemic'
    ) {
      return 'Catastrophe lacks exceptional necessity, evidence or recovery plan.';
    }
    if (
      !Number.isFinite(proposal.magnitude) ||
      proposal.magnitude <= 0 ||
      proposal.magnitude > 0.35 ||
      !Number.isFinite(proposal.predictedCasualtyRatio) ||
      proposal.predictedCasualtyRatio < 0 ||
      proposal.predictedCasualtyRatio > 0.18 ||
      !Number.isInteger(proposal.duration) ||
      proposal.duration < 1 ||
      proposal.duration > 96
    ) {
      return 'Catastrophe exceeds magnitude, casualty or duration limits.';
    }
    const livingPopulation = Object.values(expectedWorld.agents).filter(
      (agent) =>
        agent.life.alive && (agent.race ?? 'human') === 'human',
    ).length;
    if (livingPopulation < 12) {
      return 'Population is too small for Cardinal to authorize a catastrophe.';
    }
    if (
      livingPopulation -
        Math.floor(livingPopulation * proposal.predictedCasualtyRatio) <
      8
    ) {
      return 'Catastrophe could breach the minimum surviving population.';
    }
    return undefined;
  }

  private record(
    proposal: Readonly<WorldAuthorityProposal>,
    authorized: boolean,
    reason: string,
  ): WorldAuthorityRecord {
    return {
      authorityRecordId: createStableId('world-authority-record', {
        proposalId: proposal.proposalId,
        worldId: proposal.worldId,
        gatewayPolicyVersion: this.policyVersion,
      }),
      proposalId: proposal.proposalId,
      worldId: proposal.worldId,
      proposalKind: proposal.kind,
      gatewayPolicyVersion: this.policyVersion,
      authorized,
      reason,
    };
  }
}

/** Observation-only designer. It can propose; it cannot execute. */
export class CardinalWorldArchitect {
  consider(
    world: Readonly<WorldArchitectureObservation>,
    experience: Readonly<CardinalExperienceState>,
    recentEvents: readonly WorldEvent[],
  ): WorldLawProposal | undefined {
    const canDesignWorldRules = experience.capabilities.includes('world_rule_design');
    const evidenceEventIds = recentEvents
      .filter((event) => event.source !== 'cardinal')
      .map((event) => event.eventId)
      .slice(0, 8);

    const living = world.livingPopulation;
    const demographicEmergency =
      living <= 7 || world.reproductivePairPotential < 1;
    if (!demographicEmergency && evidenceEventIds.length < 3) return undefined;
    const fertilityLaw = world.laws.fertility_support;
    const birthDormancy =
      world.observedAt - (world.lastHumanBirthAt ?? world.lastBirthAt ?? 0);

    if (
      fertilityLaw &&
      (demographicEmergency || canDesignWorldRules) &&
      fertilityLaw.value < (demographicEmergency ? 0.96 : 0.82) &&
      (demographicEmergency ||
        ((living < 100 || world.reproductivePairPotential < 2) &&
          birthDormancy >= WORLD_LIFECYCLE_OBSERVATION_WINDOW))
    ) {
      return this.ruleProposal(
        world,
        fertilityLaw.id,
        fertilityLaw.domain,
        fertilityLaw.mechanism,
        Math.min(
          fertilityLaw.maximum,
          fertilityLaw.value + (demographicEmergency ? 0.12 : 0.06),
        ),
        fertilityLaw.minimum,
        fertilityLaw.maximum,
        demographicEmergency ? 0.98 : 0.8,
        demographicEmergency
          ? 'Human civilization is below its continuity floor; demography outranks optional frontier acceleration.'
          : 'Population continuity is weakening across a sustained demographic observation window.',
        'Improve environmental support for voluntary families without choosing partners, relationships or births.',
        evidenceEventIds,
      );
    }

    // Critical demography blocks only Cardinal-driven acceleration. Residents
    // remain free to explore and discover through their own actions.
    if (demographicEmergency) return undefined;
    if (!canDesignWorldRules) return undefined;

    const frontierLaw = world.laws.frontier_expansion_rate;
    const frontierDormancy = world.observedAt - world.growth.lastExpansionAt;
    if (frontierLaw && frontierDormancy >= 96 && frontierLaw.value < 2.1) {
      const value = Math.min(frontierLaw.maximum, frontierLaw.value + 0.12);
      return this.ruleProposal(
        world, frontierLaw.id, frontierLaw.domain, frontierLaw.mechanism, value,
        frontierLaw.minimum, frontierLaw.maximum, 0.76,
        'Resident exploration has remained active without opening a new region.',
        'Slightly widen the discoverable frontier while residents still choose whether to explore.',
        evidenceEventIds,
      );
    }

    return undefined;
  }

  private ruleProposal(
    world: Readonly<WorldArchitectureObservation>,
    lawId: string,
    domain: WorldLawDomain,
    mechanism: WorldLawMechanism,
    value: number,
    minimum: number,
    maximum: number,
    necessity: number,
    reason: string,
    expectedOutcome: string,
    evidenceEventIds: string[],
  ): WorldLawProposal {
    return {
      proposalId: createStableId('world-law-proposal', {
        worldId: world.worldId,
        worldRevision: world.worldRevision,
        lawId,
        value,
        evidenceEventIds,
      }),
      worldId: world.worldId,
      proposedAt: world.observedAt,
      necessity,
      reason,
      expectedOutcome,
      evidenceEventIds,
      kind: 'world_law',
      lawId,
      domain,
      mechanism,
      value,
      minimum,
      maximum,
    };
  }
}

const WORLD_LIFECYCLE_OBSERVATION_WINDOW = 48;
