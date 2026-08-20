import type { InterventionKind } from '../cardinal/types';
import { stableJsonStringify } from '../core/stableJson';
import type { InputEnvelope } from '../runtime/inputBus/types';
import { SeededRng } from '../utils/rng';
import type { WorldEvent } from './events';
import type { WorldStore } from './persistence';
import type {
  AgentState,
  MemoryRecord,
  RelationshipState,
  WorldDisturbanceKind,
  WorldEnvironment,
  WorldState,
} from './types';

export const WORLD_RULES_VERSION = 'ainkrad-world-rules-0.3.3';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clampSigned = (value: number) => Math.max(-1, Math.min(1, value));

function relationshipKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

function assertWorldState(state: WorldState): void {
  if (!state.id.trim()) {
    throw new Error('World state id must not be empty.');
  }
  if (!Number.isFinite(state.now)) {
    throw new Error('World state time must be finite.');
  }
  if (!state.rulesVersion?.trim()) {
    throw new Error('World rulesVersion must not be empty.');
  }
  if (!Number.isInteger(state.revision) || state.revision < 0) {
    throw new Error('World state revision must be a non-negative integer.');
  }
  if (!Number.isInteger(state.determinism.eventSequence) || state.determinism.eventSequence < 0) {
    throw new Error('World event sequence must be a non-negative integer.');
  }
  if (!Number.isFinite(state.determinism.rngState)) {
    throw new Error('World RNG state must be finite.');
  }
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
    const agents: Record<string, AgentState> = {};

    names.forEach((name, index) => {
      const id = `agent_${index + 1}`;
      agents[id] = {
        id,
        name,
        energy: rng.between(0.55, 0.95),
        stress: rng.between(0.05, 0.25),
        resources: rng.between(0.35, 0.8),
        socialDrive: rng.between(0.25, 0.85),
        lastMeaningfulEventAt: now,
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
      agents,
      relationships: {},
    };

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

      // createdAt belongs to transport. The world event records the logical
      // simulation time at which the input is actually applied. Wall-clock
      // delivery jitter must not contaminate replayable world history.
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
      // source of resources or recovery capacity.
      this.state.environment.resourcePool = clamp01(
        this.state.environment.resourcePool +
          this.state.environment.resourceRegenerationRate,
      );

      const effectiveEnvironment = await this.effectiveEnvironment(now);
      const agents = Object.values(this.state.agents);

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

        this.stageEvent({
          eventId: this.stableOperationEventId('disturbance', operationId),
          worldId: this.state.id,
          kind: eventKind,
          source: 'system',
          occurredAt: now,
          payload: { magnitude: amount },
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
    kind: InterventionKind,
    magnitude: number,
    now: number,
    duration: number,
    operationId: string,
  ): Promise<boolean> {
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

    const amount = Math.max(0, Math.min(0.25, magnitude));
    const fingerprint = stableJsonStringify({
      kind: 'intervention',
      interventionKind: kind,
      magnitude: amount,
      now,
      duration,
    });

    return await this.mutate(`intervention:${operationId}`, fingerprint, async () => {
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
    });
  }

  private async mutate(
    operationId: string,
    operationFingerprint: string,
    apply: () => Promise<void>,
  ): Promise<boolean> {
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

        // Exact retries remain valid even after the world has progressed beyond
        // the operation's original logical time. Reload the newest committed
        // projection rather than reapplying old effects.
        await this.reloadFromStore();
        return false;
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
        return result.committed;
      } catch (error) {
        this.rng.restore(beforeRng);
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
    agent.energy = clamp01(agent.energy - 0.025);
    agent.stress = clamp01(
      agent.stress + (1 - agent.energy) * 0.012 - environment.safetySupport * 0.004,
    );

    if (agent.energy < 0.25) {
      agent.energy = clamp01(agent.energy + 0.28);
      agent.stress = clamp01(agent.stress - 0.05);
      agent.lastAction = 'rest';

      this.recordAgentEvent(agent, now, 'agent.rested', {
        energy: agent.energy,
      });
      return;
    }

    if (agent.resources < 0.25 && this.state.environment.resourcePool > 0.05) {
      const gathered = Math.min(0.16, this.state.environment.resourcePool);
      agent.resources = clamp01(agent.resources + gathered);
      this.state.environment.resourcePool = clamp01(
        this.state.environment.resourcePool - gathered,
      );
      agent.lastAction = 'gather';
      agent.lastMeaningfulEventAt = now;

      this.recordAgentEvent(agent, now, 'agent.gathered', { gathered });
      return;
    }

    const others = allAgents.filter((other) => other.id !== agent.id);
    const socialChance =
      agent.socialDrive * (0.15 + environment.socialOpportunity * 0.3);

    if (others.length > 0 && this.rng.next() < socialChance) {
      const other = await this.chooseSocialTarget(agent, others);
      await this.interact(agent, other, now);
      return;
    }

    agent.resources = clamp01(agent.resources - 0.015);
    agent.lastAction = 'explore';

    this.recordAgentEvent(agent, now, 'agent.explored', {
      stress: agent.stress,
    });
  }

  private async chooseSocialTarget(
    agent: AgentState,
    others: AgentState[],
  ): Promise<AgentState> {
    // Preserve exploration so early relationships cannot permanently freeze the
    // society into a scripted clique.
    if (this.rng.next() < 0.2) {
      return this.rng.pick(others);
    }

    const weighted: Array<{ other: AgentState; weight: number }> = [];

    for (const other of others) {
      const relationship = this.state.relationships[relationshipKey(agent.id, other.id)];
      let weight = 0.6;

      if (relationship) {
        weight =
          0.2 +
          relationship.affinity * 0.35 +
          relationship.trust * 0.25 +
          relationship.respect * 0.15 -
          relationship.conflict * 0.3;
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
        weight += memoryValence * 0.15;
      }

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
    const key = relationshipKey(a.id, b.id);
    const ids = [a.id, b.id].sort();

    const current =
      this.state.relationships[key] ??
      ({
        agentA: ids[0],
        agentB: ids[1],
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        conflict: 0.1,
        updatedAt: now,
      } satisfies RelationshipState);

    const priorMood =
      (current.trust + current.affinity + current.respect) / 3 - current.conflict;
    const sentiment = clampSigned(
      this.rng.between(-0.8, 0.8) + (priorMood - 0.4) * 0.6,
    );

    const next: RelationshipState = {
      ...current,
      trust: clamp01(current.trust + sentiment * 0.04),
      affinity: clamp01(current.affinity + sentiment * 0.05),
      respect: clamp01(current.respect + sentiment * 0.025),
      conflict: clamp01(current.conflict - sentiment * 0.05),
      updatedAt: now,
    };

    this.state.relationships[key] = next;
    a.lastMeaningfulEventAt = now;
    b.lastMeaningfulEventAt = now;
    a.lastAction = 'interact';
    b.lastAction = 'interact';

    if (sentiment > 0.2) {
      a.stress = clamp01(a.stress - 0.02);
      b.stress = clamp01(b.stress - 0.02);
    } else if (sentiment < -0.2) {
      a.stress = clamp01(a.stress + 0.03);
      b.stress = clamp01(b.stress + 0.03);
    }

    this.maybeShareResources(a, b, next, sentiment, now);

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

    this.stageEvent({
      eventId: this.nextId('relationship'),
      worldId: this.state.id,
      kind: 'relationship.changed',
      source: 'agent',
      occurredAt: now,
      payload: {
        agentA: next.agentA,
        agentB: next.agentB,
        sentiment,
        trust: next.trust,
        affinity: next.affinity,
        respect: next.respect,
        conflict: next.conflict,
      },
    });
  }

  private maybeShareResources(
    a: AgentState,
    b: AgentState,
    relationship: RelationshipState,
    sentiment: number,
    now: number,
  ): void {
    if (sentiment <= 0.35 || relationship.trust <= 0.55) {
      return;
    }

    const donor = a.resources >= b.resources ? a : b;
    const receiver = donor.id === a.id ? b : a;

    if (donor.resources < 0.65 || receiver.resources > 0.35) {
      return;
    }

    const transfer = Math.min(0.08, donor.resources - 0.55, 0.45 - receiver.resources);
    if (transfer <= 0) {
      return;
    }

    donor.resources = clamp01(donor.resources - transfer);
    receiver.resources = clamp01(receiver.resources + transfer);

    this.stageEvent({
      eventId: this.nextId('resource-share'),
      worldId: this.state.id,
      kind: 'resource.shared',
      source: 'agent',
      occurredAt: now,
      payload: {
        donorId: donor.id,
        receiverId: receiver.id,
        amount: transfer,
      },
    });
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
