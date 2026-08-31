import type { EventReader } from '../world/events';
import type { WorldEvent } from '../world/events';
import type { WorldState } from '../world/types';
import type { CardinalMetrics, SensorSnapshot } from './types';
import { CANONICAL_WORLD_QUANTUM_MINUTES } from '../v15/WorldTimeContract';

export const WORLD_SENSOR_VERSION = 'ainkrad-world-sensors-0.3.18';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const SOCIAL_CONTACT_WINDOW = 8;
const SOCIAL_CONTACT_WINDOW_WORLD_MINUTES =
  SOCIAL_CONTACT_WINDOW * CANONICAL_WORLD_QUANTUM_MINUTES;
const SENSOR_EVENT_READ_LIMIT = 256;

function standardDeviation(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function occurredWithinWorldWindow(
  event: Readonly<WorldEvent>,
  currentWorldMinutes: number,
  windowWorldMinutes: number,
  legacyCurrentTick: number,
  legacyTickWindow: number,
): boolean {
  if (event.occurredWorldMinutes !== undefined) {
    return (
      event.occurredWorldMinutes <= currentWorldMinutes &&
      currentWorldMinutes - event.occurredWorldMinutes <= windowWorldMinutes
    );
  }
  return event.occurredAt >= legacyCurrentTick - legacyTickWindow;
}

export class WorldSensors {
  constructor(private readonly events: EventReader) {}

  async observe(world: Readonly<WorldState>, now: number): Promise<SensorSnapshot> {
    if (!Number.isFinite(now) || now !== world.now) {
      throw new Error(
        'WorldSensors observation time must match the supplied world snapshot time.',
      );
    }

    const agents = Object.values(world.agents).filter(
      (agent) => agent.life?.alive !== false,
    );
    const livingAgentIds = new Set(agents.map((agent) => agent.id));
    const relationships = Object.values(world.relationships).filter(
      (relationship) =>
        livingAgentIds.has(relationship.agentA) &&
        livingAgentIds.has(relationship.agentB),
    );
    const wildlife = Object.values(world.wildlife ?? {});
    const ordinaryWildlife = wildlife.filter(
      (population) => population.isMonster !== true,
    );
    const monsters = wildlife.filter((population) => population.isMonster === true);
    const epochFloor = world.epochStartedAt ?? 0;
    const worldEpoch = world.epoch ?? 1;
    const observedWorldMinutes = world.calendar.elapsedWorldMinutes;
    const belongsToCurrentEpoch = (event: Readonly<WorldEvent>) =>
      event.worldEpoch !== undefined
        ? event.worldEpoch === worldEpoch
        : event.occurredAt >= epochFloor;
    const activeSignals = (
      await this.events.activeSignals(world.id, now, observedWorldMinutes)
    ).filter(
      belongsToCurrentEpoch,
    );
    const recent = (
      await this.events.recent(world.id, SENSOR_EVENT_READ_LIMIT, now)
    ).filter(belongsToCurrentEpoch);

    const recentDeaths = recent.filter((event) => event.kind === 'agent.died');
    const recentBirths = recent.filter((event) => event.kind === 'agent.born');
    const humanDeaths = recentDeaths.filter((event) => {
      const agentId = event.payload.agentId;
      const agent = typeof agentId === 'string' ? world.agents[agentId] : undefined;
      return (agent?.race ?? 'human') === 'human';
    });
    const humanBirths = recentBirths.filter((event) => {
      const agentId = event.payload.agentId;
      const agent = typeof agentId === 'string' ? world.agents[agentId] : undefined;
      return (agent?.race ?? 'human') === 'human';
    });
    const monsterDeaths = humanDeaths.filter(
      (event) => event.payload.cause === 'monster',
    ).length;
    const wildlifeAttackDeaths = humanDeaths.filter(
      (event) => event.payload.cause === 'wildlife',
    ).length;
    const sapientPopulation = agents.length;
    const humanAgents = agents.filter(
      (agent) => (agent.race ?? 'human') === 'human',
    );
    const livingPopulation = humanAgents.length;
    const raceDiversity = new Set(
      agents.map((agent) => agent.race ?? 'human'),
    ).size;
    const reproductiveAdults = humanAgents.filter(
      (agent) =>
        agent.life.stage === 'adult' &&
        agent.life.ageYears <= 55 &&
        agent.life.health >= 0.4,
    );
    const reproductiveAdultMales = reproductiveAdults.filter(
      (agent) => agent.sex === 'male',
    ).length;
    const reproductiveAdultFemales = reproductiveAdults.filter(
      (agent) => agent.sex === 'female',
    ).length;
    const reproductivePairPotential = Math.min(
      reproductiveAdultMales,
      reproductiveAdultFemales,
    );
    const reproductiveContinuity = clamp01(reproductivePairPotential / 2);
    const civilizationPressure = clamp01(1 - livingPopulation / 100);
    const sizeCriticality =
      livingPopulation <= 7
        ? 1
        : livingPopulation < 20
          ? 0.78
          : livingPopulation < 100
            ? clamp01(0.42 + (100 - livingPopulation) / 250)
            : 0;
    const reproductiveCriticality =
      livingPopulation >= 4
        ? clamp01((1 - reproductiveContinuity) * (livingPopulation < 20 ? 0.92 : 0.62))
        : 1;
    const civilizationCriticality = Math.max(
      sizeCriticality,
      reproductiveCriticality,
    );
    const recentDeathPressure = clamp01(
      Math.max(0, humanDeaths.length - humanBirths.length) /
        Math.max(7, livingPopulation + humanDeaths.length),
    );
    const monsterDeathShare =
      humanDeaths.length === 0 ? 0 : monsterDeaths / humanDeaths.length;
    const wildlifeAttackDeathShare =
      humanDeaths.length === 0
        ? 0
        : wildlifeAttackDeaths / humanDeaths.length;

    const activeAgents = agents.filter(
      (agent) => now - agent.lastMeaningfulEventAt <= 5,
    ).length;

    const populationActivity = agents.length === 0 ? 0 : activeAgents / agents.length;
    const averageStress =
      agents.length === 0
        ? 0
        : agents.reduce((sum, agent) => sum + agent.stress, 0) / agents.length;

    // Social isolation is about recent contact, not whether two agents happened
    // to create a relationship row months ago. Persistent relationship state is
    // still used separately for conflict/quality metrics.
    const connected = new Set<string>();
    for (const relationship of relationships) {
      if (relationship.updatedAt < now - SOCIAL_CONTACT_WINDOW) continue;
      connected.add(relationship.agentA);
      connected.add(relationship.agentB);
    }
    for (const event of recent) {
      if (
        event.source !== 'agent' ||
        event.kind !== 'relationship.changed' ||
        !occurredWithinWorldWindow(
          event,
          observedWorldMinutes,
          SOCIAL_CONTACT_WINDOW_WORLD_MINUTES,
          now,
          SOCIAL_CONTACT_WINDOW,
        )
      ) {
        continue;
      }
      const agentA = event.payload.agentA;
      const agentB = event.payload.agentB;
      if (typeof agentA === 'string' && world.agents[agentA]) connected.add(agentA);
      if (typeof agentB === 'string' && world.agents[agentB]) connected.add(agentB);
    }

    const socialIsolation =
      agents.length === 0 ? 0 : 1 - connected.size / agents.length;

    const conflictPressure =
      relationships.length === 0
        ? 0
        : relationships.reduce((sum, relationship) => sum + relationship.conflict, 0) /
          relationships.length;

    const safetySignalPressure = activeSignals.reduce((pressure, signal) => {
      const magnitude =
        typeof signal.payload.magnitude === 'number'
          ? signal.payload.magnitude
          : 0;
      if (signal.kind === 'world.effect.safety_shock') {
        return pressure + magnitude;
      }
      if (signal.kind === 'cardinal.effect.safety_support') {
        return pressure - magnitude;
      }
      return pressure;
    }, 0);
    const recentMonsterEncounterPressure =
      agents.length === 0
        ? 0
        : recent.filter(
            (event) =>
              event.kind === 'world.monster.encountered' &&
              occurredWithinWorldWindow(
                event,
                observedWorldMinutes,
                SOCIAL_CONTACT_WINDOW_WORLD_MINUTES,
                now,
                SOCIAL_CONTACT_WINDOW,
              ),
          ).length / agents.length;
    const frontierMonsterPressure =
      monsters.length === 0
        ? 0
        : monsters.reduce(
            (sum, population) =>
              sum +
              (population.threat ?? 0.7) *
                (population.count / population.carryingCapacity),
            0,
          ) / monsters.length;
    const wildlifeDangerPressure =
      ordinaryWildlife.length === 0
        ? 0
        : clamp01(
            ordinaryWildlife.reduce(
              (sum, population) =>
                sum +
                (population.threat >= 0.28
                  ? population.threat *
                    (population.count / population.carryingCapacity)
                  : 0),
              0,
            ) / ordinaryWildlife.length,
          );
    const monsterPressure = clamp01(
      frontierMonsterPressure * 0.62 +
        recentMonsterEncounterPressure * 0.38,
    );
    const safetyPressure = clamp01(
      1 - world.environment.safetySupport +
        safetySignalPressure +
        frontierMonsterPressure * 0.18 +
        recentMonsterEncounterPressure * 0.36,
    );

    const resourcePressure =
      agents.length === 0
        ? 0
        : agents.reduce((sum, agent) => sum + (1 - agent.resources), 0) /
          agents.length;

    const rhythms = agents
      .map((agent) => world.v18?.lifeRhythmByAgentId[agent.id])
      .filter((rhythm) => rhythm !== undefined);
    const averageSatiety =
      rhythms.length === 0
        ? 0
        : rhythms.reduce((sum, rhythm) => sum + rhythm.satiety, 0) /
          rhythms.length;
    const outsideHomeSettlementShare =
      agents.length === 0
        ? 0
        : agents.filter((agent) => {
            const homeSettlementId = world.places[agent.homeId]?.settlementId;
            const currentSettlementId =
              world.places[agent.locationId]?.settlementId;
            const targetSettlementId = agent.movement
              ? world.places[agent.movement.targetPlaceId]?.settlementId
              : currentSettlementId;
            return (
              !homeSettlementId ||
              currentSettlementId !== homeSettlementId ||
              targetSettlementId !== homeSettlementId
            );
          }).length /
          agents.length;
    const livelihoods = agents
      .map((agent) => world.v18?.livelihoodByAgentId[agent.id])
      .filter((livelihood) => livelihood !== undefined);
    const chosenLivelihoods = livelihoods.filter(
      (livelihood) => livelihood.primary !== 'undecided',
    );
    const professionDiversity = clamp01(
      new Set(chosenLivelihoods.map((livelihood) => livelihood.primary)).size /
        Math.max(1, Math.min(8, agents.length)),
    );
    const undecidedLivelihoodShare =
      livelihoods.length === 0
        ? 1
        : livelihoods.filter((livelihood) => livelihood.primary === 'undecided')
            .length / livelihoods.length;
    const lifetimeActionCounts: Record<string, number> = {};
    for (const agent of agents) {
      const evidence = world.v16?.residentEvidenceByAgentId[agent.id];
      for (const [action, count] of Object.entries(
        evidence?.actionCounts ?? {},
      )) {
        lifetimeActionCounts[action] =
          (lifetimeActionCounts[action] ?? 0) + count;
      }
    }
    const lifetimeActionTotal = Object.values(lifetimeActionCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    const lifetimeShare = (actions: readonly string[]) =>
      lifetimeActionTotal === 0
        ? 0
        : actions.reduce(
            (sum, action) => sum + (lifetimeActionCounts[action] ?? 0),
            0,
          ) / lifetimeActionTotal;
    const productiveActionShare = lifetimeShare([
      'gather',
      'hunt',
      'work',
      'help',
      'explore',
    ]);
    const communicationActionShare = lifetimeShare(['socialize', 'bond']);
    const workActionShare = lifetimeShare(['work']);
    const prayerActionShare = lifetimeShare(['pray']);

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

    const frontierStage = world.growth?.stage ?? 0;
    // The frontier is unbounded, so there is no truthful finite "percent of
    // the whole world". This maturity curve keeps every new region visible to
    // Cardinal while approaching, but never reaching, total completion.
    const exploredWorldRatio =
      frontierStage === 0 ? 0 : frontierStage / (frontierStage + 3);
    const wildlifePressure =
      ordinaryWildlife.length === 0
        ? 0
        : ordinaryWildlife.reduce(
            (sum, population) =>
              sum + 1 - population.count / population.carryingCapacity,
            0,
          ) / ordinaryWildlife.length;
    const ecologicalDiversity = clamp01(
      new Set(ordinaryWildlife.map((population) => population.species)).size / 6,
    );

    // Cardinal's own prior interventions are context, not independent evidence
    // that the society itself exhibited a condition. Avoid circular evidence.
    const worldEvidence = recent.filter(
      (event) => event.source !== 'cardinal' && event.source !== 'auditor',
    );
    const limitations: string[] = [];
    const possibleRelationships = (agents.length * (agents.length - 1)) / 2;

    if (agents.length < 2) {
      limitations.push('Population is too small for meaningful social-system inference.');
    }
    if (
      possibleRelationships > 0 &&
      relationships.length / possibleRelationships < 0.25
    ) {
      limitations.push('Relationship graph is sparse; social metrics have limited coverage.');
    }
    if (worldEvidence.length < Math.min(10, Math.max(1, agents.length))) {
      limitations.push('Recent independent world-event evidence is sparse.');
    }
    if (
      recent.length === SENSOR_EVENT_READ_LIMIT &&
      recent[0] !== undefined &&
      occurredWithinWorldWindow(
        recent[0],
        observedWorldMinutes,
        SOCIAL_CONTACT_WINDOW_WORLD_MINUTES,
        now,
        SOCIAL_CONTACT_WINDOW,
      )
    ) {
      limitations.push(
        'Recent event density exceeded the bounded sensor window; social-contact coverage may be incomplete.',
      );
    }
    if ((world.growth?.stage ?? 0) > 0 && ordinaryWildlife.length === 0) {
      limitations.push(
        'Discovered natural regions have no wildlife populations to observe.',
      );
    }
    if (rhythms.length < agents.length || livelihoods.length < agents.length) {
      limitations.push(
        'Some residents predate v0.3.18 livelihood or satiety evidence; observer aggregates have partial coverage.',
      );
    }

    const metrics: CardinalMetrics = {
      livingPopulation,
      sapientPopulation,
      raceDiversity,
      reproductiveAdultMales,
      reproductiveAdultFemales,
      reproductivePairPotential,
      reproductiveContinuity,
      civilizationPressure,
      civilizationCriticality,
      recentDeathPressure,
      wildlifeAttackDeathShare: clamp01(wildlifeAttackDeathShare),
      monsterDeathShare: clamp01(monsterDeathShare),
      wildlifeDangerPressure,
      monsterPressure,
      populationActivity: clamp01(populationActivity),
      averageStress: clamp01(averageStress),
      socialIsolation: clamp01(socialIsolation),
      conflictPressure: clamp01(conflictPressure),
      safetyPressure,
      resourcePressure: clamp01(resourcePressure),
      relationshipDiversity: clamp01(relationshipDiversity),
      recoveryCapacity: clamp01(recoveryCapacity),
      exploredWorldRatio,
      wildlifePressure: clamp01(wildlifePressure),
      ecologicalDiversity,
      activeSignalCount: activeSignals.length,
      averageSatiety: clamp01(averageSatiety),
      outsideHomeSettlementShare: clamp01(outsideHomeSettlementShare),
      professionDiversity,
      undecidedLivelihoodShare: clamp01(undecidedLivelihoodShare),
      productiveActionShare: clamp01(productiveActionShare),
      communicationActionShare: clamp01(communicationActionShare),
      workActionShare: clamp01(workActionShare),
      prayerActionShare: clamp01(prayerActionShare),
    };

    return {
      sensorVersion: WORLD_SENSOR_VERSION,
      worldId: world.id,
      worldEpoch,
      worldRevision: world.revision,
      observedAt: now,
      observedWorldMinutes,
      metrics,
      evidenceEventIds: worldEvidence.map((event) => event.eventId),
      limitations,
    };
  }
}
