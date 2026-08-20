import type { InputEnvelope } from '../runtime/inputBus/types';
import { SeededRng } from '../utils/rng';
import type { EventStore, WorldEvent } from './events';
import type { MemoryStore } from './memory';
import type {
  AgentState,
  MemoryRecord,
  RelationshipState,
  WorldDisturbanceKind,
  WorldEnvironment,
  WorldState,
} from './types';
import type { InterventionKind } from '../cardinal/types';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clampSigned = (value: number) => Math.max(-1, Math.min(1, value));

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

export interface WorldEngineOptions {
  worldId: string;
  seed: string;
  eventStore: EventStore;
  memoryStore: MemoryStore;
  agentNames?: string[];
  startTime?: number;
}

export class WorldEngine {
  private readonly rng: SeededRng;
  private readonly eventStore: EventStore;
  private readonly memoryStore: MemoryStore;
  private state: WorldState;

  constructor(options: WorldEngineOptions) {
    this.rng = new SeededRng(options.seed);
    this.eventStore = options.eventStore;
    this.memoryStore = options.memoryStore;

    const now = options.startTime ?? 0;
    const names = options.agentNames ?? ['Alex', 'Mira', 'Kai', 'Noa', 'Ilan', 'Rin'];
    const agents: Record<string, AgentState> = {};

    names.forEach((name, index) => {
      const id = `agent_${index + 1}`;
      agents[id] = {
        id,
        name,
        energy: this.rng.between(0.55, 0.95),
        stress: this.rng.between(0.05, 0.25),
        resources: this.rng.between(0.35, 0.8),
        socialDrive: this.rng.between(0.25, 0.85),
        lastMeaningfulEventAt: now,
      };
    });

    this.state = {
      id: options.worldId,
      now,
      environment: {
        resourcePool: 1,
        resourceRegenerationRate: 0.012,
        socialOpportunity: 0.5,
        safetySupport: 0.5,
      },
      determinism: {
        rngState: this.rng.snapshot(),
        eventSequence: 0,
      },
      agents,
      relationships: {},
    };
  }

  snapshot(): WorldState {
    this.syncDeterminismState();
    return structuredClone(this.state);
  }

  async handleInput(input: InputEnvelope): Promise<void> {
    if (input.worldId !== this.state.id) {
      throw new Error(
        `Input belongs to world ${input.worldId}, expected ${this.state.id}.`,
      );
    }

    // Stable event ID makes transport retries idempotent. If a worker crashes
    // after the world event is appended but before queue acknowledgement, the
    // next attempt becomes a no-op instead of duplicating experiment history.
    const event: WorldEvent = {
      eventId: `input:${input.eventId}`,
      worldId: this.state.id,
      kind: `input.${input.type}`,
      source: input.source,
      occurredAt: input.createdAt,
      payload: structuredClone(input.payload),
      correlationId: input.correlationId ?? input.eventId,
    };

    await this.eventStore.append(event);
  }

  async step(now: number): Promise<void> {
    this.state.now = now;

    // The control world must have endogenous recovery mechanisms. Cardinal is
    // not allowed to be the only source of resources or recovery.
    this.state.environment.resourcePool = clamp01(
      this.state.environment.resourcePool +
        this.state.environment.resourceRegenerationRate,
    );

    const effectiveEnvironment = await this.effectiveEnvironment(now);
    const agents = Object.values(this.state.agents);

    for (const agent of agents) {
      await this.stepAgent(agent, agents, effectiveEnvironment, now);
    }

    this.syncDeterminismState();
  }

  async applyDisturbance(
    kind: WorldDisturbanceKind,
    magnitude: number,
    now: number,
    duration = 8,
  ): Promise<void> {
    const amount = Math.max(0, Math.min(0.8, magnitude));

    if (kind === 'resource_shock') {
      this.state.environment.resourcePool = clamp01(
        this.state.environment.resourcePool - amount,
      );

      await this.eventStore.append({
        eventId: this.nextId('disturbance'),
        worldId: this.state.id,
        kind: 'world.disturbance.resource_shock',
        source: 'system',
        occurredAt: now,
        payload: { magnitude: amount },
      });
      return;
    }

    await this.eventStore.append({
      eventId: this.nextId('disturbance'),
      worldId: this.state.id,
      kind:
        kind === 'social_barrier'
          ? 'world.effect.social_barrier'
          : 'world.effect.safety_shock',
      source: 'system',
      occurredAt: now,
      payload: { magnitude: amount },
      activeUntil: now + Math.max(1, duration),
    });
  }

  // This is intentionally named as an authorized capability. CardinalCore does
  // not receive a reference to WorldEngine. Only the independent gateway holds
  // this capability in the current architecture.
  async applyAuthorizedIntervention(
    kind: InterventionKind,
    magnitude: number,
    now: number,
    duration = 8,
  ): Promise<void> {
    const amount = Math.max(0, Math.min(0.25, magnitude));

    if (kind === 'resource_relief') {
      this.state.environment.resourcePool = clamp01(
        this.state.environment.resourcePool + amount,
      );

      await this.eventStore.append({
        eventId: this.nextId('intervention'),
        worldId: this.state.id,
        kind: 'cardinal.intervention.resource_relief',
        source: 'cardinal',
        occurredAt: now,
        payload: { magnitude: amount },
      });
      return;
    }

    await this.eventStore.append({
      eventId: this.nextId('intervention'),
      worldId: this.state.id,
      kind:
        kind === 'open_shared_space'
          ? 'cardinal.effect.open_shared_space'
          : 'cardinal.effect.safety_support',
      source: 'cardinal',
      occurredAt: now,
      payload: { magnitude: amount },
      activeUntil: now + Math.max(1, duration),
    });
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

      await this.recordAgentEvent(agent, now, 'agent.rested', {
        energy: agent.energy,
      });
      return;
    }

    if (agent.resources < 0.25 && this.state.environment.resourcePool > 0.05) {
      const gathered = Math.min(0.16, this.state.environment.resourcePool);
      agent.resources = clamp01(agent.resources + gathered);
      this.state.environment.resourcePool = clamp01(
        this.state.environment.resourcePool - gathered * 0.25,
      );
      agent.lastAction = 'gather';
      agent.lastMeaningfulEventAt = now;

      await this.recordAgentEvent(agent, now, 'agent.gathered', { gathered });
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

    await this.recordAgentEvent(agent, now, 'agent.explored', {
      stress: agent.stress,
    });
  }

  private async chooseSocialTarget(
    agent: AgentState,
    others: AgentState[],
  ): Promise<AgentState> {
    // Preserve exploration so social structure does not freeze into a clique.
    if (this.rng.next() < 0.2) {
      return this.rng.pick(others);
    }

    const weighted: Array<{ other: AgentState; weight: number }> = [];

    for (const other of others) {
      const relationship = this.state.relationships[pairKey(agent.id, other.id)];
      let weight = 0.6;

      if (relationship) {
        weight =
          0.2 +
          relationship.affinity * 0.35 +
          relationship.trust * 0.25 +
          relationship.respect * 0.15 -
          relationship.conflict * 0.3;
      }

      // Long-term interaction memory influences future local decisions instead
      // of existing only as dead archival text.
      const recentMemories = await this.memoryStore.recentForPair(
        this.state.id,
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
    const key = pairKey(a.id, b.id);
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

    await this.maybeShareResources(a, b, next, sentiment, now);

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
      await this.memoryStore.append(memory);
    }

    await this.eventStore.append({
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

  private async maybeShareResources(
    a: AgentState,
    b: AgentState,
    relationship: RelationshipState,
    sentiment: number,
    now: number,
  ): Promise<void> {
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

    await this.eventStore.append({
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
    const activeSignals = await this.eventStore.activeSignals(this.state.id, now);
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

  private async recordAgentEvent(
    agent: AgentState,
    now: number,
    kind: string,
    payload: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    await this.eventStore.append({
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

  private nextId(prefix: string): string {
    this.state.determinism.eventSequence += 1;
    return `${prefix}:${this.state.id}:${this.state.determinism.eventSequence.toString(36)}`;
  }

  private syncDeterminismState(): void {
    this.state.determinism.rngState = this.rng.snapshot();
  }
}
