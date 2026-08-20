import {
  createEventId,
} from '../runtime/inputBus/createEventId';

import type {
  InputEnvelope,
} from '../runtime/inputBus/types';

import {
  SeededRng,
} from '../utils/rng';

import type {
  EventStore,
  WorldEvent,
} from './events';

import type {
  AgentState,
  MemoryRecord,
  RelationshipState,
  WorldState,
} from './types';

const clamp01 = (
  value: number,
) =>
  Math.max(
    0,
    Math.min(
      1,
      value,
    ),
  );

function pairKey(
  a: string,
  b: string,
): string {
  return [
    a,
    b,
  ]
    .sort()
    .join('::');
}

export interface WorldEngineOptions {
  worldId: string;
  seed: string;
  eventStore: EventStore;
  agentNames?: string[];
  startTime?: number;
}

export class WorldEngine {
  private readonly rng:
    SeededRng;

  private readonly eventStore:
    EventStore;

  private state:
    WorldState;

  constructor(
    options:
      WorldEngineOptions,
  ) {
    this.rng =
      new SeededRng(
        options.seed,
      );

    this.eventStore =
      options.eventStore;

    const now =
      options.startTime ??
      0;

    const names =
      options.agentNames ??
      [
        'Alex',
        'Mira',
        'Kai',
        'Noa',
        'Ilan',
        'Rin',
      ];

    const agents:
      Record<
        string,
        AgentState
      > = {};

    names.forEach(
      (
        name,
        index,
      ) => {
        const id =
          `agent_${index + 1}`;

        agents[id] = {
          id,
          name,
          energy:
            this.rng.between(
              0.55,
              0.95,
            ),
          stress:
            this.rng.between(
              0.05,
              0.25,
            ),
          resources:
            this.rng.between(
              0.35,
              0.8,
            ),
          socialDrive:
            this.rng.between(
              0.25,
              0.85,
            ),
          lastMeaningfulEventAt:
            now,
        };
      },
    );

    this.state = {
      id:
        options.worldId,
      now,
      environment: {
        resourcePool:
          1,
        socialOpportunity:
          0.5,
        safetySupport:
          0.5,
      },
      agents,
      relationships: {},
      memories: [],
    };
  }

  snapshot(): WorldState {
    return structuredClone(
      this.state,
    );
  }

  async handleInput(
    input: InputEnvelope,
  ): Promise<void> {
    if (
      input.worldId !==
      this.state.id
    ) {
      throw new Error(
        `Input belongs to world ${input.worldId}, expected ${this.state.id}.`,
      );
    }

    const event:
      WorldEvent = {
        eventId:
          createEventId(
            'world',
          ),
        worldId:
          this.state.id,
        kind:
          `input.${input.type}`,
        source:
          input.source,
        occurredAt:
          input.createdAt,
        payload:
          input.payload,
        correlationId:
          input.correlationId ??
          input.eventId,
      };

    await this.eventStore
      .append(event);
  }

  async step(
    now: number,
  ): Promise<void> {
    this.state.now =
      now;

    const agents =
      Object.values(
        this.state.agents,
      );

    for (
      const agent of
      agents
    ) {
      await this.stepAgent(
        agent,
        agents,
        now,
      );
    }
  }

  private async stepAgent(
    agent: AgentState,
    allAgents:
      AgentState[],
    now: number,
  ): Promise<void> {
    agent.energy =
      clamp01(
        agent.energy -
          0.025,
      );

    agent.stress =
      clamp01(
        agent.stress +
          (
            1 -
            agent.energy
          ) *
          0.012 -
          this.state
            .environment
            .safetySupport *
            0.004,
      );

    if (
      agent.energy <
      0.25
    ) {
      agent.energy =
        clamp01(
          agent.energy +
            0.28,
        );

      agent.stress =
        clamp01(
          agent.stress -
            0.05,
        );

      agent.lastAction =
        'rest';

      await this.recordAgentEvent(
        agent,
        now,
        'agent.rested',
        {
          energy:
            agent.energy,
        },
      );

      return;
    }

    if (
      agent.resources <
      0.25 &&
      this.state
        .environment
        .resourcePool >
        0.05
    ) {
      const gathered =
        Math.min(
          0.16,
          this.state
            .environment
            .resourcePool,
        );

      agent.resources =
        clamp01(
          agent.resources +
            gathered,
        );

      this.state
        .environment
        .resourcePool =
          clamp01(
            this.state
              .environment
              .resourcePool -
              gathered *
                0.25,
          );

      agent.lastAction =
        'gather';

      agent.lastMeaningfulEventAt =
        now;

      await this.recordAgentEvent(
        agent,
        now,
        'agent.gathered',
        {
          gathered,
        },
      );

      return;
    }

    const others =
      allAgents.filter(
        (other) =>
          other.id !==
          agent.id,
      );

    const socialChance =
      agent.socialDrive *
      (
        0.15 +
        this.state
          .environment
          .socialOpportunity *
          0.3
      );

    if (
      others.length >
        0 &&
      this.rng.next() <
        socialChance
    ) {
      const other =
        this.rng.pick(
          others,
        );

      await this.interact(
        agent,
        other,
        now,
      );

      return;
    }

    agent.resources =
      clamp01(
        agent.resources -
          0.015,
      );

    agent.lastAction =
      'explore';

    await this.recordAgentEvent(
      agent,
      now,
      'agent.explored',
      {
        stress:
          agent.stress,
      },
    );
  }

  private async interact(
    a: AgentState,
    b: AgentState,
    now: number,
  ): Promise<void> {
    const sentiment =
      this.rng.between(
        -1,
        1,
      );

    const key =
      pairKey(
        a.id,
        b.id,
      );

    const ids =
      [
        a.id,
        b.id,
      ].sort();

    const current =
      this.state
        .relationships[key] ??
      {
        agentA:
          ids[0],
        agentB:
          ids[1],
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        conflict: 0.1,
        updatedAt:
          now,
      };

    const next:
      RelationshipState = {
        ...current,
        trust:
          clamp01(
            current.trust +
              sentiment *
                0.04,
          ),
        affinity:
          clamp01(
            current.affinity +
              sentiment *
                0.05,
          ),
        respect:
          clamp01(
            current.respect +
              sentiment *
                0.025,
          ),
        conflict:
          clamp01(
            current.conflict -
              sentiment *
                0.05,
          ),
        updatedAt:
          now,
      };

    this.state
      .relationships[key] =
        next;

    a.lastMeaningfulEventAt =
      now;

    b.lastMeaningfulEventAt =
      now;

    a.lastAction =
      'interact';

    b.lastAction =
      'interact';

    const summary =
      sentiment >= 0
        ? `${a.name} and ${b.name} had a constructive interaction.`
        : `${a.name} and ${b.name} had a tense interaction.`;

    const memories:
      MemoryRecord[] = [
        a,
        b,
      ].map(
        (agent) => ({
          memoryId:
            createEventId(
              'memory',
            ),
          worldId:
            this.state.id,
          agentId:
            agent.id,
          createdAt:
            now,
          kind:
            'interaction',
          summary,
          importance:
            clamp01(
              0.4 +
              Math.abs(
                sentiment,
              ) *
                0.5,
            ),
          relatedAgentIds:
            [
              agent.id ===
              a.id
                ? b.id
                : a.id,
            ],
        }),
      );

    this.state.memories.push(
      ...memories,
    );

    await this.eventStore
      .append({
        eventId:
          createEventId(
            'world',
          ),
        worldId:
          this.state.id,
        kind:
          'relationship.changed',
        source:
          'agent',
        occurredAt:
          now,
        payload: {
          agentA:
            next.agentA,
          agentB:
            next.agentB,
          sentiment,
          trust:
            next.trust,
          affinity:
            next.affinity,
          respect:
            next.respect,
          conflict:
            next.conflict,
        },
      });
  }

  private async recordAgentEvent(
    agent: AgentState,
    now: number,
    kind: string,
    payload:
      Record<
        string,
        string |
        number |
        boolean |
        null
      >,
  ): Promise<void> {
    await this.eventStore
      .append({
        eventId:
          createEventId(
            'world',
          ),
        worldId:
          this.state.id,
        kind,
        source:
          'agent',
        occurredAt:
          now,
        payload: {
          agentId:
            agent.id,
          ...payload,
        },
      });
  }

  async applyEnvironmentalIntervention(
    kind:
      | 'resource_relief'
      | 'open_shared_space'
      | 'safety_support',
    magnitude: number,
    now: number,
  ): Promise<void> {
    const amount =
      Math.max(
        0,
        Math.min(
          0.25,
          magnitude,
        ),
      );

    switch (kind) {
      case 'resource_relief':
        this.state
          .environment
          .resourcePool =
            clamp01(
              this.state
                .environment
                .resourcePool +
                amount,
            );
        break;

      case 'open_shared_space':
        this.state
          .environment
          .socialOpportunity =
            clamp01(
              this.state
                .environment
                .socialOpportunity +
                amount,
            );
        break;

      case 'safety_support':
        this.state
          .environment
          .safetySupport =
            clamp01(
              this.state
                .environment
                .safetySupport +
                amount,
            );
        break;
    }

    await this.eventStore
      .append({
        eventId:
          createEventId(
            'cardinal',
          ),
        worldId:
          this.state.id,
        kind:
          `cardinal.intervention.${kind}`,
        source:
          'cardinal',
        occurredAt:
          now,
        payload: {
          magnitude:
            amount,
        },
        activeUntil:
          now + 10,
      });
  }
}
