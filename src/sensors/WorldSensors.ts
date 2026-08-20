import type { EventReader } from '../world/events';
import type { WorldState } from '../world/types';
import type { CardinalMetrics, SensorSnapshot } from './types';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function standardDeviation(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export class WorldSensors {
  constructor(private readonly events: EventReader) {}

  async observe(world: Readonly<WorldState>, now: number): Promise<SensorSnapshot> {
    const agents = Object.values(world.agents);
    const relationships = Object.values(world.relationships);

    const activeAgents = agents.filter(
      (agent) => now - agent.lastMeaningfulEventAt <= 5,
    ).length;

    const populationActivity = agents.length === 0 ? 0 : activeAgents / agents.length;
    const averageStress =
      agents.length === 0
        ? 0
        : agents.reduce((sum, agent) => sum + agent.stress, 0) / agents.length;

    const connected = new Set<string>();
    for (const relationship of relationships) {
      // Contact can be positive or conflictual; both mean the agent is not
      // socially isolated. Quality is measured separately.
      if (relationship.affinity > 0.15 || relationship.conflict > 0.15) {
        connected.add(relationship.agentA);
        connected.add(relationship.agentB);
      }
    }

    const socialIsolation =
      agents.length === 0 ? 0 : 1 - connected.size / agents.length;

    const conflictPressure =
      relationships.length === 0
        ? 0
        : relationships.reduce((sum, relationship) => sum + relationship.conflict, 0) /
          relationships.length;

    const resourcePressure =
      agents.length === 0
        ? 0
        : agents.reduce((sum, agent) => sum + (1 - agent.resources), 0) /
          agents.length;

    const relationshipDiversity = clamp01(
      standardDeviation(
        relationships.map((relationship) => relationship.affinity - relationship.conflict),
      ) * 2,
    );

    const averageEnergy =
      agents.length === 0
        ? 0
        : agents.reduce((sum, agent) => sum + agent.energy, 0) / agents.length;

    const recoveryCapacity = clamp01(
      (1 - averageStress) * 0.35 +
        (1 - socialIsolation) * 0.25 +
        (1 - resourcePressure) * 0.2 +
        averageEnergy * 0.2,
    );

    const activeSignals = await this.events.activeSignals(world.id, now);
    const recent = await this.events.recent(world.id, 50);

    const metrics: CardinalMetrics = {
      populationActivity: clamp01(populationActivity),
      averageStress: clamp01(averageStress),
      socialIsolation: clamp01(socialIsolation),
      conflictPressure: clamp01(conflictPressure),
      resourcePressure: clamp01(resourcePressure),
      relationshipDiversity: clamp01(relationshipDiversity),
      recoveryCapacity: clamp01(recoveryCapacity),
      activeSignalCount: activeSignals.length,
    };

    return {
      worldId: world.id,
      observedAt: now,
      metrics,
      evidenceEventIds: recent.map((event) => event.eventId),
    };
  }
}
