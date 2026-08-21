import type { InterventionKind } from '../cardinal/types';
import { stableJsonStringify } from '../core/stableJson';
import type { InputEnvelope } from '../runtime/inputBus/types';
import { SeededRng } from '../utils/rng';
import type { WorldEvent } from './events';
import type { WorldStore } from './persistence';
import { StaleWorldObservationError, WorldRevisionConflictError } from './persistence';
import type {
  AgentActionKind,
  AgentGoalKind,
  AgentState,
  MemoryRecord,
  RelationshipState,
  WorldDisturbanceKind,
  WorldEnvironment,
  WorldPlace,
  WorldPlaceKind,
  WorldState,
} from './types';

export const WORLD_RULES_VERSION = 'ainkrad-world-rules-0.3.7';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clampSigned = (value: number) => Math.max(-1, Math.min(1, value));

const ACTION_KINDS: readonly AgentActionKind[] = [
  'rest',
  'gather',
  'work',
  'socialize',
  'help',
  'explore',
  'reflect',
];

const GOAL_KINDS: readonly AgentGoalKind[] = [
  'recover',
  'secure_resources',
  'connect',
  'contribute',
  'explore',
  'reflect',
];

const PLACE_KINDS: readonly WorldPlaceKind[] = [
  'home',
  'commons',
  'resource_field',
  'workshop',
  'quiet_space',
  'outskirts',
];

function relationshipKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be finite.`);
  }
  return value;
}

function unitNumber(value: unknown, path: string): number {
  const result = finiteNumber(value, path);
  if (result < 0 || result > 1) {
    throw new Error(`${path} must be between 0 and 1.`);
  }
  return result;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${path} must be a non-negative integer.`);
  }
  return value;
}

function assertUnitFields(
  record: Record<string, unknown>,
  fields: readonly string[],
  path: string,
): void {
  for (const field of fields) {
    unitNumber(record[field], `${path}.${field}`);
  }
}

function assertWorldState(value: unknown): asserts value is WorldState {
  const state = asRecord(value, 'World state');
  const id = requiredString(state.id, 'World state id');
  finiteNumber(state.now, 'World state time');
  nonNegativeInteger(state.revision, 'World state revision');
  requiredString(state.rulesVersion, 'World state rulesVersion');

  const determinism = asRecord(state.determinism, 'World determinism');
  finiteNumber(determinism.rngState, 'World RNG state');
  nonNegativeInteger(determinism.eventSequence, 'World event sequence');

  const environment = asRecord(state.environment, 'World environment');
  assertUnitFields(
    environment,
    ['resourcePool', 'resourceRegenerationRate', 'socialOpportunity', 'safetySupport'],
    'World environment',
  );

  const places = asRecord(state.places, 'World places');
  if (Object.keys(places).length === 0) {
    throw new Error('World must contain at least one place.');
  }
  for (const [placeId, rawPlace] of Object.entries(places)) {
    const place = asRecord(rawPlace, `World place ${placeId}`);
    if (requiredString(place.id, `World place ${placeId}.id`) !== placeId) {
      throw new Error(`World place key ${placeId} does not match its id.`);
    }
    requiredString(place.name, `World place ${placeId}.name`);
    if (!PLACE_KINDS.includes(place.kind as WorldPlaceKind)) {
      throw new Error(`World place ${placeId}.kind is invalid.`);
    }
    const capacity = finiteNumber(place.capacity, `World place ${placeId}.capacity`);
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error(`World place ${placeId}.capacity must be a positive integer.`);
    }
  }

  const agents = asRecord(state.agents, 'World agents');
  for (const [agentId, rawAgent] of Object.entries(agents)) {
    const agent = asRecord(rawAgent, `Agent ${agentId}`);
    if (requiredString(agent.id, `Agent ${agentId}.id`) !== agentId) {
      throw new Error(`Agent key ${agentId} does not match its id.`);
    }
    requiredString(agent.name, `Agent ${agentId}.name`);
    assertUnitFields(
      agent,
      ['energy', 'stress', 'resources', 'socialDrive'],
      `Agent ${agentId}`,
    );
    finiteNumber(agent.lastMeaningfulEventAt, `Agent ${agentId}.lastMeaningfulEventAt`);

    const personality = asRecord(agent.personality, `Agent ${agentId}.personality`);
    assertUnitFields(
      personality,
      ['sociability', 'diligence', 'curiosity', 'generosity', 'resilience', 'riskTolerance'],
      `Agent ${agentId}.personality`,
    );

    const needs = asRecord(agent.needs, `Agent ${agentId}.needs`);
    assertUnitFields(needs, ['belonging', 'purpose'], `Agent ${agentId}.needs`);

    const skills = asRecord(agent.skills, `Agent ${agentId}.skills`);
    assertUnitFields(
      skills,
      ['gathering', 'craft', 'social', 'exploration'],
      `Agent ${agentId}.skills`,
    );

    const goal = asRecord(agent.goal, `Agent ${agentId}.goal`);
    if (!GOAL_KINDS.includes(goal.kind as AgentGoalKind)) {
      throw new Error(`Agent ${agentId}.goal.kind is invalid.`);
    }
    unitNumber(goal.strength, `Agent ${agentId}.goal.strength`);
    finiteNumber(goal.since, `Agent ${agentId}.goal.since`);

    const homeId = requiredString(agent.homeId, `Agent ${agentId}.homeId`);
    const locationId = requiredString(agent.locationId, `Agent ${agentId}.locationId`);
    if (!places[homeId]) {
      throw new Error(`Agent ${agentId} references missing home ${homeId}.`);
    }
    if (!places[locationId]) {
      throw new Error(`Agent ${agentId} references missing location ${locationId}.`);
    }
    if (
      agent.lastAction !== undefined &&
      !ACTION_KINDS.includes(agent.lastAction as AgentActionKind)
    ) {
      throw new Error(`Agent ${agentId}.lastAction is invalid.`);
    }
  }

  const relationships = asRecord(state.relationships, 'World relationships');
  for (const [key, rawRelationship] of Object.entries(relationships)) {
    const relationship = asRecord(rawRelationship, `Relationship ${key}`);
    const agentA = requiredString(relationship.agentA, `Relationship ${key}.agentA`);
    const agentB = requiredString(relationship.agentB, `Relationship ${key}.agentB`);
    if (agentA === agentB || !agents[agentA] || !agents[agentB]) {
      throw new Error(`Relationship ${key} references invalid agents.`);
    }
    if (relationshipKey(agentA, agentB) !== key) {
      throw new Error(`Relationship ${key} is stored under the wrong key.`);
    }
    assertUnitFields(
      relationship,
      ['trust', 'affinity', 'respect', 'conflict'],
      `Relationship ${key}`,
    );
    finiteNumber(relationship.updatedAt, `Relationship ${key}.updatedAt`);
  }

  if (!id.trim()) {
    throw new Error('World state id must not be empty.');
  }
}

function createPlace(
  id: string,
  name: string,
  kind: WorldPlaceKind,
  capacity: number,
): WorldPlace {
  return { id, name, kind, capacity };
}

function goalFromInitialState(agent: Omit<AgentState, 'goal'>, now: number): AgentState['goal'] {
  const scores: Array<{ kind: AgentGoalKind; strength: number }> = [
    { kind: 'recover', strength: (1 - agent.energy) * 0.75 + agent.stress * 0.55 },
    { kind: 'secure_resources', strength: (1 - agent.resources) * 0.9 },
    { kind: 'connect', strength: (1 - agent.needs.belonging) * agent.socialDrive },
    {
      kind: 'contribute',
      strength:
        (1 - agent.needs.purpose) * 0.45 +
        agent.personality.diligence * 0.35 +
        agent.personality.generosity * 0.2,
    },
    { kind: 'explore', strength: agent.personality.curiosity * 0.75 },
    {
      kind: 'reflect',
      strength:
        agent.stress * 0.35 +
        (1 - agent.needs.purpose) * 0.2 +
        (1 - agent.personality.riskTolerance) * 0.25 +
        (1 - agent.personality.sociability) * 0.15,
    },
  ];
  scores.sort((a, b) => b.strength - a.strength);
  return {
    kind: scores[0].kind,
    strength: clamp01(scores[0].strength),
    since: now,
  };
}

export interface WorldEngineOptions {
  worldId: string;
  seed: string;
  store: WorldStore;
  agentNames?: string[];
  startTime?: number;
}

export interface OpenWorldEngineOptions {
  worldId: string;
  store: WorldStore;
}

export interface WorldMutationResult {
  committed: boolean;
  committedRevision: number;
}

/**
 * WorldEngine mutates only a private working copy during a logical operation.
 * Events and memories are staged beside that copy. The live engine state is
 * replaced only after WorldStore atomically commits state + evidence + the
 * operation tombstone.
 */
export class WorldEngine {
  private readonly rng: SeededRng;
  private committedState: WorldState;
  private workingState: WorldState | undefined;
  private operationTail: Promise<void> = Promise.resolve();
  private stagedEvents: WorldEvent[] | undefined;
  private stagedMemories: MemoryRecord[] | undefined;

  private constructor(
    private readonly store: WorldStore,
    state: WorldState,
  ) {
    assertWorldState(state);
    this.committedState = structuredClone(state);
    this.rng = new SeededRng('restored-world', state.determinism.rngState);
  }

  static async create(options: WorldEngineOptions): Promise<WorldEngine> {
    if (!options.worldId.trim()) {
      throw new Error('World id must not be empty.');
    }
    const existing = await options.store.loadWorld(options.worldId);
    if (existing) {
      throw new Error(`World ${options.worldId} already exists in the store.`);
    }

    const now = options.startTime ?? 0;
    if (!Number.isFinite(now)) {
      throw new Error('World start time must be finite.');
    }

    const rng = new SeededRng(options.seed);
    const names = options.agentNames ?? ['Alex', 'Mira', 'Kai', 'Noa', 'Ilan', 'Rin'];
    const places: Record<string, WorldPlace> = {
      commons: createPlace('commons', 'Common Square', 'commons', Math.max(8, names.length * 2)),
      resource_field: createPlace('resource_field', 'Resource Field', 'resource_field', Math.max(6, names.length)),
      workshop: createPlace('workshop', 'Workshop', 'workshop', Math.max(6, names.length)),
      quiet_space: createPlace('quiet_space', 'Quiet Garden', 'quiet_space', Math.max(4, names.length)),
      outskirts: createPlace('outskirts', 'Outskirts', 'outskirts', Math.max(8, names.length * 2)),
    };
    const agents: Record<string, AgentState> = {};

    names.forEach((name, index) => {
      const id = `agent_${index + 1}`;
      const homeId = `home_${id}`;
      places[homeId] = createPlace(homeId, `${name}'s Home`, 'home', 3);

      const personality = {
        sociability: rng.between(0.18, 0.92),
        diligence: rng.between(0.18, 0.92),
        curiosity: rng.between(0.18, 0.92),
        generosity: rng.between(0.18, 0.92),
        resilience: rng.between(0.18, 0.92),
        riskTolerance: rng.between(0.18, 0.92),
      };
      const socialDrive = clamp01(
        personality.sociability * 0.75 + rng.between(0.05, 0.25),
      );
      const partial = {
        id,
        name,
        energy: rng.between(0.55, 0.95),
        stress: rng.between(0.05, 0.25),
        resources: rng.between(0.35, 0.8),
        socialDrive,
        personality,
        needs: {
          belonging: rng.between(0.35, 0.8),
          purpose: rng.between(0.35, 0.8),
        },
        skills: {
          gathering: rng.between(0.15, 0.55),
          craft: rng.between(0.15, 0.55),
          social: rng.between(0.15, 0.55),
          exploration: rng.between(0.15, 0.55),
        },
        homeId,
        locationId: homeId,
        lastMeaningfulEventAt: now,
      } satisfies Omit<AgentState, 'goal'>;

      agents[id] = {
        ...partial,
        goal: goalFromInitialState(partial, now),
      };
    });

    const state: WorldState = {
      id: options.worldId,
      now,
      revision: 0,
      rulesVersion: WORLD_RULES_VERSION,
      environment: {
        resourcePool: 1,
        resourceRegenerationRate: 0.012,
        socialOpportunity: 0.5,
        safetySupport: 0.5,
      },
      determinism: {
        rngState: rng.snapshot(),
        eventSequence: 0,
      },
      places,
      agents,
      relationships: {},
    };

    assertWorldState(state);
    await options.store.initializeWorld(state);
    return new WorldEngine(options.store, state);
  }

  static async open(options: OpenWorldEngineOptions): Promise<WorldEngine> {
    const state = await options.store.loadWorld(options.worldId);
    if (!state) {
      throw new Error(`World ${options.worldId} does not exist in the store.`);
    }
    if (state.rulesVersion !== WORLD_RULES_VERSION) {
      throw new Error(
        `World ${options.worldId} uses rules ${state.rulesVersion}; runtime expects ${WORLD_RULES_VERSION}. Explicit migration is required.`,
      );
    }
    assertWorldState(state);
    return new WorldEngine(options.store, state);
  }

  snapshot(): WorldState {
    // Never expose an operation's uncommitted working copy. Sensors and other
    // readers see only the last atomically committed world projection.
    return structuredClone(this.committedState);
  }

  async reload(): Promise<void> {
    await this.runExclusive(async () => {
      await this.reloadFromStore();
    });
  }

  async handleInput(input: InputEnvelope, appliedAt: number): Promise<boolean> {
    if (input.worldId !== this.committedState.id) {
      throw new Error(
        `Input belongs to world ${input.worldId}, expected ${this.committedState.id}.`,
      );
    }

    if (!Number.isFinite(appliedAt)) {
      throw new Error('Input appliedAt must be finite.');
    }

    const operationId = `input:${input.eventId}`;
    const fingerprint = stableJsonStringify({ kind: 'input', input, appliedAt });

    return await this.mutate(operationId, fingerprint, async () => {
      if (appliedAt < this.state.now) {
        throw new Error('Input appliedAt cannot precede world time.');
      }
      this.state.now = appliedAt;

      this.stageEvent({
        eventId: `input:${this.state.id}:${input.eventId}`,
        worldId: this.state.id,
        kind: `input.${input.type}`,
        source: input.source,
        occurredAt: appliedAt,
        payload: structuredClone(input.payload),
        correlationId: input.correlationId ?? input.eventId,
      });
    });
  }

  async step(now: number): Promise<boolean> {
    if (!Number.isFinite(now)) {
      throw new Error('World step time must be finite.');
    }
    const operationId = `tick:${now}`;
    const fingerprint = stableJsonStringify({ kind: 'tick', now });

    return await this.mutate(operationId, fingerprint, async () => {
      if (now < this.state.now) {
        throw new Error(
          `World cannot step backwards from ${this.state.now} to ${now}.`,
        );
      }
      this.state.now = now;

      // The control world has endogenous recovery. Cardinal is not the only
      // source of resources, production, social repair or stress recovery.
      this.state.environment.resourcePool = clamp01(
        this.state.environment.resourcePool +
          this.state.environment.resourceRegenerationRate,
      );

      const effectiveEnvironment = await this.effectiveEnvironment(now);
      const agents = this.shuffled(Object.values(this.state.agents));

      for (const agent of agents) {
        await this.stepAgent(agent, agents, effectiveEnvironment, now);
      }
    });
  }

  async applyDisturbance(
    kind: WorldDisturbanceKind,
    magnitude: number,
    now: number,
    duration: number,
    operationId: string,
  ): Promise<boolean> {
    if (!['resource_shock', 'social_barrier', 'safety_shock'].includes(kind as string)) {
      throw new Error('Unknown disturbance kind.');
    }
    if (!Number.isFinite(now)) {
      throw new Error('Disturbance time must be finite.');
    }
    if (!Number.isFinite(magnitude) || magnitude < 0) {
      throw new Error('Disturbance magnitude must be finite and non-negative.');
    }
    if (!Number.isFinite(duration) || duration < 1) {
      throw new Error('Disturbance duration must be finite and at least 1.');
    }
    if (!operationId.trim()) {
      throw new Error('Disturbance operationId is required for retry safety.');
    }

    const amount = Math.max(0, Math.min(0.8, magnitude));
    const fingerprint = stableJsonStringify({
      kind: 'disturbance',
      disturbanceKind: kind,
      magnitude: amount,
      now,
      duration,
    });

    return await this.mutate(`disturbance:${operationId}`, fingerprint, async () => {
      if (now < this.state.now) {
        throw new Error('Disturbance cannot be applied retroactively to a progressed world.');
      }
      this.state.now = now;

      const eventKind =
        kind === 'resource_shock'
          ? 'world.disturbance.resource_shock'
          : kind === 'social_barrier'
            ? 'world.effect.social_barrier'
            : 'world.effect.safety_shock';

      if (kind === 'resource_shock') {
        this.state.environment.resourcePool = clamp01(
          this.state.environment.resourcePool - amount,
        );

        // A systemic resource shock affects both shared raw availability and
        // household reserves. The control world still retains work, gathering,
        // exploration and cooperation as endogenous recovery paths.
        for (const agent of Object.values(this.state.agents)) {
          const householdLoss = amount * 0.6;
          agent.resources = clamp01(agent.resources - householdLoss);
          agent.stress = clamp01(
            agent.stress + amount * 0.08 * (1.15 - agent.personality.resilience * 0.3),
          );
        }

        this.stageEvent({
          eventId: this.stableOperationEventId('disturbance', operationId),
          worldId: this.state.id,
          kind: eventKind,
          source: 'system',
          occurredAt: now,
          payload: { magnitude: amount, householdLoss: amount * 0.6 },
        });
        return;
      }

      this.stageEvent({
        eventId: this.stableOperationEventId('disturbance', operationId),
        worldId: this.state.id,
        kind: eventKind,
        source: 'system',
        occurredAt: now,
        payload: { magnitude: amount },
        activeUntil: now + Math.max(1, duration),
      });
    });
  }

  // CardinalCore never receives this capability. Only the independent
  // simulation gateway owns it.
  async applyAuthorizedIntervention(
    worldId: string,
    kind: InterventionKind,
    magnitude: number,
    now: number,
    duration: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    if (worldId !== this.committedState.id) {
      throw new Error(
        `Intervention belongs to world ${worldId}, expected ${this.committedState.id}.`,
      );
    }
    if (!['resource_relief', 'open_shared_space', 'safety_support'].includes(kind as string)) {
      throw new Error('Unknown intervention kind.');
    }
    if (!Number.isFinite(now)) {
      throw new Error('Intervention time must be finite.');
    }
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      throw new Error('Intervention magnitude must be positive and finite.');
    }
    if (!Number.isFinite(duration) || duration < 1) {
      throw new Error('Intervention duration must be finite and at least 1.');
    }
    if (!operationId.trim()) {
      throw new Error('Intervention operationId is required for retry safety.');
    }
    if (!Number.isInteger(expectedWorldRevision) || expectedWorldRevision < 0) {
      throw new Error('Intervention expectedWorldRevision must be a non-negative integer.');
    }

    const amount = Math.max(0, Math.min(0.25, magnitude));
    const fingerprint = stableJsonStringify({
      kind: 'intervention',
      worldId,
      interventionKind: kind,
      magnitude: amount,
      now,
      duration,
      expectedWorldRevision,
    });

    return await this.mutateDetailed(
      `intervention:${operationId}`,
      fingerprint,
      async () => {
        if (now < this.state.now) {
          throw new Error('Intervention cannot be applied retroactively to a progressed world.');
        }
        this.state.now = now;

        const eventKind =
          kind === 'resource_relief'
            ? 'cardinal.intervention.resource_relief'
            : kind === 'open_shared_space'
              ? 'cardinal.effect.open_shared_space'
              : 'cardinal.effect.safety_support';

        if (kind === 'resource_relief') {
          this.state.environment.resourcePool = clamp01(
            this.state.environment.resourcePool + amount,
          );

          this.stageEvent({
            eventId: this.stableOperationEventId('intervention', operationId),
            worldId: this.state.id,
            kind: eventKind,
            source: 'cardinal',
            occurredAt: now,
            payload: { magnitude: amount },
          });
          return;
        }

        this.stageEvent({
          eventId: this.stableOperationEventId('intervention', operationId),
          worldId: this.state.id,
          kind: eventKind,
          source: 'cardinal',
          occurredAt: now,
          payload: { magnitude: amount },
          activeUntil: now + Math.max(1, duration),
        });
      },
      expectedWorldRevision,
    );
  }

  private async mutate(
    operationId: string,
    operationFingerprint: string,
    apply: () => Promise<void>,
    requiredWorldRevision?: number,
  ): Promise<boolean> {
    return (
      await this.mutateDetailed(
        operationId,
        operationFingerprint,
        apply,
        requiredWorldRevision,
      )
    ).committed;
  }

  private async mutateDetailed(
    operationId: string,
    operationFingerprint: string,
    apply: () => Promise<void>,
    requiredWorldRevision?: number,
  ): Promise<WorldMutationResult> {
    return await this.runExclusive(async () => {
      const prior = await this.store.committedOperation(
        this.committedState.id,
        operationId,
      );
      if (prior) {
        if (prior.operationFingerprint !== operationFingerprint) {
          throw new Error(
            `World operation ${operationId} was retried with different content.`,
          );
        }

        await this.reloadFromStore();
        return {
          committed: false,
          committedRevision: prior.committedRevision,
        };
      }

      if (
        requiredWorldRevision !== undefined &&
        this.committedState.revision !== requiredWorldRevision
      ) {
        throw new StaleWorldObservationError(
          this.committedState.id,
          requiredWorldRevision,
          this.committedState.revision,
        );
      }

      const before = structuredClone(this.committedState);
      const beforeRng = this.rng.snapshot();
      this.workingState = structuredClone(before);
      this.rng.restore(before.determinism.rngState);
      this.stagedEvents = [];
      this.stagedMemories = [];

      try {
        await apply();
        this.syncDeterminismState();
        this.state.revision = before.revision + 1;
        assertWorldState(this.state);

        const result = await this.store.commit({
          operationId,
          operationFingerprint,
          worldId: before.id,
          expectedRevision: before.revision,
          nextState: structuredClone(this.state),
          events: this.stagedEvents.map((event) => structuredClone(event)),
          memories: this.stagedMemories.map((memory) => structuredClone(memory)),
        });

        this.adopt(result.state);
        return {
          committed: result.committed,
          committedRevision: result.operation.committedRevision,
        };
      } catch (error) {
        this.rng.restore(beforeRng);
        if (error instanceof WorldRevisionConflictError) {
          await this.reloadFromStore();
        }
        throw error;
      } finally {
        this.workingState = undefined;
        this.stagedEvents = undefined;
        this.stagedMemories = undefined;
      }
    });
  }

  private get state(): WorldState {
    if (!this.workingState) {
      throw new Error('World mutable state was accessed outside a logical operation.');
    }
    return this.workingState;
  }

  private async runExclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.operationTail;
    let release!: () => void;
    this.operationTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  private async reloadFromStore(): Promise<void> {
    const worldId = this.committedState.id;
    const state = await this.store.loadWorld(worldId);
    if (!state) {
      throw new Error(`World ${worldId} disappeared from the store.`);
    }
    this.adopt(state);
  }

  private async stepAgent(
    agent: AgentState,
    allAgents: AgentState[],
    environment: WorldEnvironment,
    now: number,
  ): Promise<void> {
    this.applyPassiveNeeds(agent, environment);
    this.updateGoal(agent, now);

    const action = this.chooseAction(agent, allAgents, environment);
    switch (action) {
      case 'rest':
        this.performRest(agent, now);
        break;
      case 'gather':
        this.performGather(agent, now);
        break;
      case 'work':
        this.performWork(agent, now);
        break;
      case 'socialize': {
        const others = allAgents.filter((other) => other.id !== agent.id);
        if (others.length === 0) {
          this.performReflect(agent, now);
        } else {
          const accessChance = clamp01(
            0.12 +
              environment.socialOpportunity * 0.76 +
              agent.personality.sociability * 0.12,
          );
          if (this.rng.next() > accessChance) {
            this.performBlockedSocialize(agent, now);
          } else {
            const target = await this.chooseSocialTarget(agent, others);
            await this.interact(agent, target, now);
          }
        }
        break;
      }
      case 'help': {
        const target = this.chooseHelpTarget(agent, allAgents);
        if (!target) {
          this.performWork(agent, now);
        } else {
          await this.performHelp(agent, target, now);
        }
        break;
      }
      case 'explore':
        this.performExplore(agent, now);
        break;
      case 'reflect':
        this.performReflect(agent, now);
        break;
    }
  }

  private applyPassiveNeeds(agent: AgentState, environment: WorldEnvironment): void {
    agent.energy = clamp01(agent.energy - 0.022);
    agent.resources = clamp01(agent.resources - 0.006);
    agent.needs.belonging = clamp01(agent.needs.belonging - 0.012);
    agent.needs.purpose = clamp01(agent.needs.purpose - 0.008);
    agent.stress = clamp01(
      agent.stress +
        (1 - agent.energy) * 0.012 +
        (1 - agent.resources) * 0.006 +
        (1 - environment.safetySupport) * 0.012 -
        environment.safetySupport * (0.003 + agent.personality.resilience * 0.002),
    );
  }

  private updateGoal(agent: AgentState, now: number): void {
    const scores: Array<{ kind: AgentGoalKind; strength: number }> = [
      {
        kind: 'recover',
        strength: (1 - agent.energy) * 0.85 + agent.stress * 0.55,
      },
      {
        kind: 'secure_resources',
        strength: (1 - agent.resources) * 0.95,
      },
      {
        kind: 'connect',
        strength:
          (1 - agent.needs.belonging) * (0.55 + agent.socialDrive * 0.55),
      },
      {
        kind: 'contribute',
        strength:
          (1 - agent.needs.purpose) * 0.5 +
          agent.personality.diligence * 0.32 +
          agent.personality.generosity * 0.18,
      },
      {
        kind: 'explore',
        strength:
          agent.personality.curiosity * 0.65 +
          agent.personality.riskTolerance * 0.12 +
          (1 - agent.needs.purpose) * 0.2,
      },
      {
        kind: 'reflect',
        strength:
          agent.stress * 0.38 +
          (1 - agent.needs.purpose) * 0.2 +
          (1 - agent.personality.riskTolerance) * 0.25 +
          (1 - agent.personality.sociability) * 0.15,
      },
    ];
    scores.sort((a, b) => b.strength - a.strength);
    const next = scores[0];
    const currentAge = now - agent.goal.since;
    const shouldSwitch =
      next.kind !== agent.goal.kind &&
      (next.strength > agent.goal.strength + 0.08 || currentAge >= 5);

    if (shouldSwitch) {
      const previous = agent.goal.kind;
      agent.goal = {
        kind: next.kind,
        strength: clamp01(next.strength),
        since: now,
      };
      this.recordAgentEvent(agent, now, 'agent.goal.changed', {
        previous,
        next: next.kind,
        strength: agent.goal.strength,
      });
    } else {
      agent.goal.strength = clamp01(
        scores.find((item) => item.kind === agent.goal.kind)?.strength ?? next.strength,
      );
    }
  }

  private chooseAction(
    agent: AgentState,
    allAgents: AgentState[],
    environment: WorldEnvironment,
  ): AgentActionKind {
    const helpTarget = this.chooseHelpTarget(agent, allAgents);
    const socialAvailable = allAgents.some((other) => other.id !== agent.id);
    const goalBoost = (kind: AgentGoalKind) => (agent.goal.kind === kind ? 0.24 : 0);

    const scores: Array<{ action: AgentActionKind; score: number }> = [
      {
        action: 'rest',
        score:
          (1 - agent.energy) * 1.45 +
          agent.stress * 0.42 +
          goalBoost('recover'),
      },
      {
        action: 'gather',
        score:
          (1 - agent.resources) * 1.05 +
          this.state.environment.resourcePool * 0.22 +
          agent.skills.gathering * 0.2 +
          goalBoost('secure_resources'),
      },
      {
        action: 'work',
        score:
          (1 - agent.resources) * 0.72 +
          (1 - agent.needs.purpose) * 0.38 +
          agent.personality.diligence * 0.52 +
          agent.skills.craft * 0.18 +
          goalBoost('contribute'),
      },
      {
        action: 'socialize',
        score:
          (socialAvailable ? 1 : 0) *
          ((1 - agent.needs.belonging) * 0.78 +
            agent.socialDrive * 0.4 +
            agent.personality.sociability * 0.3 +
            environment.socialOpportunity * 0.2 +
            goalBoost('connect')),
      },
      {
        action: 'help',
        score: helpTarget
          ? agent.personality.generosity * 0.65 +
            (1 - agent.needs.purpose) * 0.24 +
            Math.max(0, agent.resources - 0.45) * 0.35 +
            goalBoost('contribute')
          : -1,
      },
      {
        action: 'explore',
        score:
          agent.personality.curiosity * 0.68 +
          agent.personality.riskTolerance * 0.15 +
          agent.skills.exploration * 0.16 +
          (1 - agent.needs.purpose) * 0.2 +
          goalBoost('explore') -
          Math.max(0, 0.35 - agent.resources) * 0.7,
      },
      {
        action: 'reflect',
        score:
          0.18 +
          agent.stress * 0.55 +
          (1 - agent.needs.purpose) * 0.42 +
          (1 - agent.personality.riskTolerance) * 0.22 +
          (1 - agent.personality.sociability) * 0.08 +
          goalBoost('reflect'),
      },
    ];

    // Small seeded noise preserves individuality and exploration without turning
    // choice into a fixed routine. The RNG state is persisted with the world.
    for (const item of scores) {
      item.score += this.rng.between(-0.07, 0.07);
    }

    // Severe physiological pressure is a constraint, not a central script.
    if (agent.energy < 0.12) {
      return 'rest';
    }
    if (agent.resources < 0.08) {
      const gather = scores.find((item) => item.action === 'gather')!;
      const work = scores.find((item) => item.action === 'work')!;
      return gather.score >= work.score && this.state.environment.resourcePool > 0.03
        ? 'gather'
        : 'work';
    }

    scores.sort((a, b) => b.score - a.score);
    return scores[0].action;
  }

  private performRest(agent: AgentState, now: number): void {
    this.moveAgent(agent, agent.homeId);
    agent.energy = clamp01(agent.energy + 0.3);
    agent.stress = clamp01(agent.stress - 0.055 - agent.personality.resilience * 0.02);
    agent.lastAction = 'rest';

    this.recordAgentEvent(agent, now, 'agent.rested', {
      energy: agent.energy,
      stress: agent.stress,
      locationId: agent.locationId,
    });
  }

  private performBlockedSocialize(agent: AgentState, now: number): void {
    this.moveAgent(agent, 'commons');
    agent.energy = clamp01(agent.energy - 0.01);
    agent.stress = clamp01(agent.stress + 0.018);
    agent.needs.belonging = clamp01(agent.needs.belonging - 0.015);
    agent.lastAction = 'socialize';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.socialize.blocked', {
      socialOpportunity: 0,
      locationId: agent.locationId,
    });
  }

  private performGather(agent: AgentState, now: number): void {
    this.moveAgent(agent, 'resource_field');
    const available = this.state.environment.resourcePool;
    const effort = 0.06 + agent.skills.gathering * 0.08;
    const gathered = Math.min(effort, available);

    agent.energy = clamp01(agent.energy - 0.035);
    agent.stress = clamp01(agent.stress + 0.006);
    agent.resources = clamp01(agent.resources + gathered);
    agent.skills.gathering = clamp01(agent.skills.gathering + 0.004);
    this.state.environment.resourcePool = clamp01(available - gathered);
    agent.lastAction = 'gather';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.gathered', {
      gathered,
      resources: agent.resources,
      poolRemaining: this.state.environment.resourcePool,
      locationId: agent.locationId,
    });
  }

  private performWork(agent: AgentState, now: number): void {
    this.moveAgent(agent, 'workshop');
    const produced =
      0.035 +
      agent.skills.craft * 0.05 +
      agent.personality.diligence * 0.04;

    agent.resources = clamp01(agent.resources + produced);
    agent.energy = clamp01(agent.energy - 0.045);
    agent.stress = clamp01(
      agent.stress + 0.012 * (1 - agent.personality.resilience),
    );
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.045);
    agent.skills.craft = clamp01(agent.skills.craft + 0.004);
    agent.lastAction = 'work';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.worked', {
      produced,
      resources: agent.resources,
      skill: agent.skills.craft,
      locationId: agent.locationId,
    });
  }

  private performExplore(agent: AgentState, now: number): void {
    this.moveAgent(agent, 'outskirts');
    agent.energy = clamp01(agent.energy - 0.04);
    agent.resources = clamp01(agent.resources - 0.008);
    agent.skills.exploration = clamp01(agent.skills.exploration + 0.003);
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.012);

    const discoveryChance = clamp01(
      0.08 +
        agent.skills.exploration * 0.2 +
        agent.personality.curiosity * 0.18 +
        agent.personality.riskTolerance * 0.08,
    );
    const discovered = this.rng.next() < discoveryChance;
    let discovery = 0;
    if (discovered) {
      discovery = this.rng.between(0.035, 0.11);
      this.state.environment.resourcePool = clamp01(
        this.state.environment.resourcePool + discovery,
      );
      agent.needs.purpose = clamp01(agent.needs.purpose + 0.035);
    }

    agent.lastAction = 'explore';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.explored', {
      discovered,
      discovery,
      resourcePool: this.state.environment.resourcePool,
      locationId: agent.locationId,
    });
  }

  private performReflect(agent: AgentState, now: number): void {
    this.moveAgent(agent, 'quiet_space');
    agent.energy = clamp01(agent.energy + 0.025);
    agent.stress = clamp01(
      agent.stress - 0.055 - agent.personality.resilience * 0.025,
    );
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.045);
    agent.lastAction = 'reflect';
    agent.lastMeaningfulEventAt = now;

    this.stageMemory({
      memoryId: this.nextId('memory'),
      worldId: this.state.id,
      agentId: agent.id,
      createdAt: now,
      kind: 'reflection',
      summary: `${agent.name} reflected on recent needs and priorities.`,
      importance: clamp01(0.35 + agent.stress * 0.3),
      valence: clampSigned(0.15 - agent.stress * 0.2),
      relatedAgentIds: [],
    });

    this.recordAgentEvent(agent, now, 'agent.reflected', {
      stress: agent.stress,
      purpose: agent.needs.purpose,
      locationId: agent.locationId,
    });
  }

  private chooseHelpTarget(agent: AgentState, allAgents: AgentState[]): AgentState | undefined {
    const candidates = allAgents
      .filter((other) => other.id !== agent.id)
      .map((other) => {
        const relationship = this.state.relationships[relationshipKey(agent.id, other.id)];
        const need =
          (1 - other.resources) * 0.65 +
          other.stress * 0.2 +
          (1 - other.needs.belonging) * 0.15;
        const willingness = relationship
          ? relationship.trust * 0.3 +
            relationship.affinity * 0.2 +
            relationship.respect * 0.15 -
            relationship.conflict * 0.35
          : 0.05;
        return { other, score: need + willingness };
      })
      .filter((item) => item.other.resources < 0.5 && item.score > 0.42)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.other;
  }

  private async performHelp(a: AgentState, b: AgentState, now: number): Promise<void> {
    this.moveAgent(a, b.locationId);
    const key = relationshipKey(a.id, b.id);
    const current = this.relationshipFor(a, b, now);
    const offered = Math.min(0.065, Math.max(0, a.resources - 0.35), 0.72 - b.resources);
    const acceptance = clamp01(
      0.35 +
        current.trust * 0.28 +
        current.affinity * 0.18 +
        current.respect * 0.12 -
        current.conflict * 0.35 +
        b.personality.sociability * 0.08,
    );
    const accepted = offered > 0.005 && this.rng.next() < acceptance;

    if (accepted) {
      a.resources = clamp01(a.resources - offered);
      b.resources = clamp01(b.resources + offered);
      a.needs.purpose = clamp01(a.needs.purpose + 0.06);
      b.needs.belonging = clamp01(b.needs.belonging + 0.06);
      b.stress = clamp01(b.stress - 0.025);
      this.state.relationships[key] = {
        ...current,
        trust: clamp01(current.trust + 0.025),
        affinity: clamp01(current.affinity + 0.018),
        respect: clamp01(current.respect + 0.03),
        conflict: clamp01(current.conflict - 0.012),
        updatedAt: now,
      };
    } else {
      a.stress = clamp01(a.stress + 0.008);
      this.state.relationships[key] = {
        ...current,
        respect: clamp01(current.respect - 0.006),
        conflict: clamp01(current.conflict + 0.01),
        updatedAt: now,
      };
    }

    a.energy = clamp01(a.energy - 0.018);
    a.lastAction = 'help';
    a.lastMeaningfulEventAt = now;
    b.lastMeaningfulEventAt = now;

    const summary = accepted
      ? `${b.name} accepted help from ${a.name}.`
      : `${b.name} declined help from ${a.name}.`;
    for (const agent of [a, b]) {
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'interaction',
        summary,
        importance: accepted ? 0.62 : 0.52,
        valence: accepted ? 0.45 : -0.18,
        relatedAgentIds: [agent.id === a.id ? b.id : a.id],
      });
    }

    this.recordAgentEvent(a, now, accepted ? 'agent.help.accepted' : 'agent.help.rejected', {
      targetId: b.id,
      amount: accepted ? offered : 0,
      locationId: a.locationId,
    });
    this.recordRelationshipEvent(this.state.relationships[key], accepted ? 0.45 : -0.18, now);
  }

  private async chooseSocialTarget(
    agent: AgentState,
    others: AgentState[],
  ): Promise<AgentState> {
    if (this.rng.next() < 0.18) {
      return this.rng.pick(others);
    }

    const weighted: Array<{ other: AgentState; weight: number }> = [];

    for (const other of others) {
      const relationship = this.state.relationships[relationshipKey(agent.id, other.id)];
      let weight = 0.55;

      if (relationship) {
        weight =
          0.18 +
          relationship.affinity * 0.34 +
          relationship.trust * 0.24 +
          relationship.respect * 0.14 -
          relationship.conflict * 0.28;
      }

      const recentMemories = await this.recentMemoriesForPair(
        agent.id,
        other.id,
        5,
      );

      if (recentMemories.length > 0) {
        const memoryValence =
          recentMemories.reduce((sum, memory) => sum + memory.valence, 0) /
          recentMemories.length;
        weight += memoryValence * 0.16;
      }

      // Similar interests help, but do not make unlike people impossible to meet.
      const curiosityCompatibility = 1 - Math.abs(
        agent.personality.curiosity - other.personality.curiosity,
      );
      weight += curiosityCompatibility * 0.08;

      weighted.push({
        other,
        weight: Math.max(0.05, weight),
      });
    }

    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.rng.next() * total;

    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) {
        return item.other;
      }
    }

    return weighted[weighted.length - 1].other;
  }

  private async interact(a: AgentState, b: AgentState, now: number): Promise<void> {
    this.moveAgent(a, 'commons');
    this.moveAgent(b, 'commons');
    const key = relationshipKey(a.id, b.id);
    const current = this.relationshipFor(a, b, now);

    const priorMood =
      (current.trust + current.affinity + current.respect) / 3 - current.conflict;
    const compatibility =
      1 -
      (Math.abs(a.personality.curiosity - b.personality.curiosity) +
        Math.abs(a.personality.sociability - b.personality.sociability) +
        Math.abs(a.personality.generosity - b.personality.generosity)) /
        3;
    const stressPenalty = (a.stress + b.stress) * 0.12;
    const socialSkill = (a.skills.social + b.skills.social) / 2;
    const sentiment = clampSigned(
      this.rng.between(-0.72, 0.72) +
        (priorMood - 0.35) * 0.5 +
        (compatibility - 0.5) * 0.24 +
        socialSkill * 0.08 -
        stressPenalty,
    );

    const next: RelationshipState = {
      ...current,
      trust: clamp01(current.trust + sentiment * 0.038),
      affinity: clamp01(current.affinity + sentiment * 0.05),
      respect: clamp01(current.respect + sentiment * 0.026),
      conflict: clamp01(current.conflict - sentiment * 0.048),
      updatedAt: now,
    };

    this.state.relationships[key] = next;
    a.lastMeaningfulEventAt = now;
    b.lastMeaningfulEventAt = now;
    a.lastAction = 'socialize';
    a.energy = clamp01(a.energy - 0.018);
    a.skills.social = clamp01(a.skills.social + 0.003);
    b.skills.social = clamp01(b.skills.social + 0.002);

    if (sentiment > 0.18) {
      a.stress = clamp01(a.stress - 0.024);
      b.stress = clamp01(b.stress - 0.018);
      a.needs.belonging = clamp01(a.needs.belonging + 0.09);
      b.needs.belonging = clamp01(b.needs.belonging + 0.07);
    } else if (sentiment < -0.18) {
      a.stress = clamp01(a.stress + 0.032);
      b.stress = clamp01(b.stress + 0.026);
      a.needs.belonging = clamp01(a.needs.belonging - 0.018);
      b.needs.belonging = clamp01(b.needs.belonging - 0.012);
    } else {
      a.needs.belonging = clamp01(a.needs.belonging + 0.035);
      b.needs.belonging = clamp01(b.needs.belonging + 0.025);
    }

    const summary =
      sentiment >= 0
        ? `${a.name} and ${b.name} had a constructive interaction.`
        : `${a.name} and ${b.name} had a tense interaction.`;

    const memories: MemoryRecord[] = [a, b].map((agent) => ({
      memoryId: this.nextId('memory'),
      worldId: this.state.id,
      agentId: agent.id,
      createdAt: now,
      kind: 'interaction',
      summary,
      importance: clamp01(0.4 + Math.abs(sentiment) * 0.5),
      valence: sentiment,
      relatedAgentIds: [agent.id === a.id ? b.id : a.id],
    }));

    for (const memory of memories) {
      this.stageMemory(memory);
    }

    this.recordRelationshipEvent(next, sentiment, now);
  }

  private relationshipFor(a: AgentState, b: AgentState, now: number): RelationshipState {
    const key = relationshipKey(a.id, b.id);
    const ids = [a.id, b.id].sort();
    return (
      this.state.relationships[key] ?? {
        agentA: ids[0],
        agentB: ids[1],
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        conflict: 0.1,
        updatedAt: now,
      }
    );
  }

  private recordRelationshipEvent(
    relationship: RelationshipState,
    sentiment: number,
    now: number,
  ): void {
    this.stageEvent({
      eventId: this.nextId('relationship'),
      worldId: this.state.id,
      kind: 'relationship.changed',
      source: 'agent',
      occurredAt: now,
      payload: {
        agentA: relationship.agentA,
        agentB: relationship.agentB,
        sentiment,
        trust: relationship.trust,
        affinity: relationship.affinity,
        respect: relationship.respect,
        conflict: relationship.conflict,
      },
    });
  }

  private moveAgent(agent: AgentState, locationId: string): void {
    if (!this.state.places[locationId]) {
      throw new Error(`Cannot move ${agent.id} to unknown place ${locationId}.`);
    }
    agent.locationId = locationId;
  }

  private shuffled<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.rng.next() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  private async effectiveEnvironment(now: number): Promise<WorldEnvironment> {
    const committed = await this.store.activeSignals(this.state.id, now);
    const staged = (this.stagedEvents ?? []).filter(
      (event) =>
        event.occurredAt <= now &&
        event.activeUntil !== undefined &&
        event.activeUntil > now,
    );
    const activeSignals = [...committed, ...staged];
    let socialModifier = 0;
    let safetyModifier = 0;

    for (const signal of activeSignals) {
      const magnitude =
        typeof signal.payload.magnitude === 'number' ? signal.payload.magnitude : 0;

      if (signal.kind === 'cardinal.effect.open_shared_space') {
        socialModifier += magnitude;
      } else if (signal.kind === 'world.effect.social_barrier') {
        socialModifier -= magnitude;
      } else if (signal.kind === 'cardinal.effect.safety_support') {
        safetyModifier += magnitude;
      } else if (signal.kind === 'world.effect.safety_shock') {
        safetyModifier -= magnitude;
      }
    }

    return {
      ...this.state.environment,
      socialOpportunity: clamp01(
        this.state.environment.socialOpportunity + socialModifier,
      ),
      safetySupport: clamp01(this.state.environment.safetySupport + safetyModifier),
    };
  }

  private recordAgentEvent(
    agent: AgentState,
    now: number,
    kind: string,
    payload: Record<string, string | number | boolean | null>,
  ): void {
    this.stageEvent({
      eventId: this.nextId('agent-event'),
      worldId: this.state.id,
      kind,
      source: 'agent',
      occurredAt: now,
      payload: {
        agentId: agent.id,
        ...payload,
      },
    });
  }

  private async recentMemoriesForPair(
    agentId: string,
    otherAgentId: string,
    limit: number,
  ): Promise<MemoryRecord[]> {
    const committed = await this.store.recentForPair(
      this.state.id,
      agentId,
      otherAgentId,
      limit,
    );
    const staged = (this.stagedMemories ?? []).filter(
      (memory) =>
        memory.agentId === agentId && memory.relatedAgentIds.includes(otherAgentId),
    );

    return [...committed, ...staged]
      .slice(Math.max(0, committed.length + staged.length - limit))
      .map((memory) => structuredClone(memory));
  }

  private stageEvent(event: WorldEvent): void {
    if (!this.stagedEvents) {
      throw new Error('World event was produced outside a logical operation.');
    }
    this.stagedEvents.push(structuredClone(event));
  }

  private stageMemory(memory: MemoryRecord): void {
    if (!this.stagedMemories) {
      throw new Error('World memory was produced outside a logical operation.');
    }
    this.stagedMemories.push(structuredClone(memory));
  }

  private stableOperationEventId(prefix: string, operationId: string): string {
    return `${prefix}:${this.state.id}:op:${operationId}`;
  }

  private nextId(prefix: string): string {
    this.state.determinism.eventSequence += 1;
    return `${prefix}:${this.state.id}:${this.state.determinism.eventSequence.toString(36)}`;
  }

  private syncDeterminismState(): void {
    this.state.determinism.rngState = this.rng.snapshot();
  }

  private adopt(state: WorldState): void {
    assertWorldState(state);
    if (state.rulesVersion !== WORLD_RULES_VERSION) {
      throw new Error(
        `World ${state.id} uses rules ${state.rulesVersion}; runtime expects ${WORLD_RULES_VERSION}. Explicit migration is required.`,
      );
    }
    this.committedState = structuredClone(state);
    this.rng.restore(state.determinism.rngState);
  }
}
