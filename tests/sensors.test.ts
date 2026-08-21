import { describe, expect, it } from 'vitest';
import { WorldSensors } from '../src/sensors/WorldSensors';
import { InMemoryEventStore } from '../src/world/InMemoryEventStore';
import type { WorldState } from '../src/world/types';

const testLife = () => ({
  bornAt: -24 * 96,
  ageYears: 24,
  lifespanYears: 82,
  stage: 'adult' as const,
  alive: true,
  health: 0.9,
  generation: 0,
  parentIds: [],
  childIds: [],
});

const testMind = (agentId: string) => ({
  identityId: `person:world_1:${agentId}`,
  continuity: 1,
  autonomy: 0.7,
  memoryCoherence: 0.8,
  emotions: { joy: 0.5, fear: 0.1, grief: 0, awe: 0.1, hope: 0.6 },
  values: { care: 0.5, freedom: 0.5, knowledge: 0.5, tradition: 0.5, ambition: 0.5 },
  beliefs: { worldTrust: 0.6, divinePresence: 0.1, fate: 0.1, afterlife: 0.1 },
});

function emptyWorld(): WorldState {
  return {
    id: 'world_1',
    now: 1,
    revision: 0,
    rulesVersion: 'ainkrad-world-rules-0.3.10',
    environment: {
      resourcePool: 1,
      resourceRegenerationRate: 0.01,
      socialOpportunity: 0.5,
      safetySupport: 0.5,
      habitatSupport: 0.5,
    },
    determinism: {
      rngState: 1,
      eventSequence: 0,
    },
    places: {
      commons: {
        id: 'commons',
        name: 'Common Square',
        kind: 'commons',
        capacity: 8,
        biome: 'settlement',
        mapX: 50,
        mapY: 50,
        connectedPlaceIds: [],
        fertility: 0.5,
        danger: 0.02,
      },
    },
    growth: {
      stage: 0,
      explorationProgress: 0,
      lastExpansionAt: 1,
      discoveredRegionIds: [],
      frontierSequence: 0,
    },
    population: { nextAgentSequence: 1, births: 0, deaths: 0 },
    cosmology: { mysteryLevel: 0.1, omenCount: 0, traditions: [], deities: {} },
    governance: {
      constitutionVersion: 'ainkrad-constitution-0.3.10',
      authorityRevision: 0,
      protectedPersonhoodDomains: [
        'identity',
        'memory',
        'agency',
        'values',
        'relationships',
      ],
      laws: {},
    },
    wildlife: {},
    agents: {},
    relationships: {},
  };
}

describe('World sensors', () => {
  it('uses world evidence without treating Cardinal output as independent evidence', async () => {
    const events = new InMemoryEventStore();

    await events.append({
      eventId: 'agent_fact',
      worldId: 'world_1',
      kind: 'agent.test',
      source: 'agent',
      occurredAt: 1,
      payload: {},
    });
    await events.append({
      eventId: 'cardinal_action',
      worldId: 'world_1',
      kind: 'cardinal.effect.open_shared_space',
      source: 'cardinal',
      occurredAt: 1,
      activeUntil: 5,
      payload: { magnitude: 0.1 },
    });

    const observation = await new WorldSensors(events).observe(emptyWorld(), 1);
    expect(observation.evidenceEventIds).toEqual(['agent_fact']);
    expect(observation.metrics.activeSignalCount).toBe(1);
  });

  it('does not use future events as present evidence', async () => {
    const events = new InMemoryEventStore();
    await events.append({
      eventId: 'future_fact',
      worldId: 'world_1',
      kind: 'agent.future',
      source: 'agent',
      occurredAt: 10,
      payload: {},
    });

    const observation = await new WorldSensors(events).observe(emptyWorld(), 1);
    expect(observation.evidenceEventIds).not.toContain('future_fact');
  });

  it('derives ecology metrics from discovered habitats without mutating them', async () => {
    const events = new InMemoryEventStore();
    const world = emptyWorld();
    world.growth = {
      stage: 2,
      explorationProgress: 0.4,
      lastExpansionAt: 1,
      discoveredRegionIds: ['meadow', 'forest'],
      frontierSequence: 2,
    };
    world.places.meadow = {
      id: 'meadow',
      name: 'Wild Meadow',
      kind: 'meadow',
      capacity: 12,
      biome: 'plains',
      mapX: 8,
      mapY: 13,
      connectedPlaceIds: ['forest'],
      fertility: 0.8,
      danger: 0.1,
      discoveredAt: 1,
    };
    world.places.forest = {
      id: 'forest',
      name: 'Northern Forest',
      kind: 'forest',
      capacity: 14,
      biome: 'forest',
      mapX: 50,
      mapY: 12,
      connectedPlaceIds: ['meadow'],
      fertility: 0.7,
      danger: 0.3,
      discoveredAt: 1,
    };
    world.wildlife = {
      rabbits: {
        id: 'rabbits',
        species: 'rabbit',
        habitatId: 'meadow',
        count: 2,
        carryingCapacity: 8,
        reproductionRate: 0.16,
        alertness: 0.2,
        lastChangedAt: 1,
      },
      deer: {
        id: 'deer',
        species: 'deer',
        habitatId: 'forest',
        count: 7,
        carryingCapacity: 7,
        reproductionRate: 0.1,
        alertness: 0.3,
        lastChangedAt: 1,
      },
    };
    const before = structuredClone(world);

    const observation = await new WorldSensors(events).observe(world, 1);

    expect(observation.metrics.exploredWorldRatio).toBeCloseTo(2 / 5);
    expect(observation.metrics.wildlifePressure).toBeCloseTo(0.375);
    expect(observation.metrics.ecologicalDiversity).toBeCloseTo(2 / 6);
    expect(world).toEqual(before);
  });
});

describe('Sensor snapshot time integrity', () => {
  it('rejects mixing a current snapshot with a different observation time', async () => {
    const events = new InMemoryEventStore();
    await expect(new WorldSensors(events).observe(emptyWorld(), 2)).rejects.toThrow();
  });
});

describe('Recent social-contact sensing', () => {
  it('does not treat an old relationship projection as current social contact', async () => {
    const events = new InMemoryEventStore();
    const world = emptyWorld();
    world.now = 20;
    world.agents = {
      a: {
        id: 'a',
        name: 'A',
        origin: 'native',
        energy: 0.8,
        stress: 0.1,
        resources: 0.7,
        socialDrive: 0.5,
        personality: { sociability: 0.5, diligence: 0.5, curiosity: 0.5, generosity: 0.5, resilience: 0.5, riskTolerance: 0.5 },
        life: testLife(),
        mind: testMind('a'),
        needs: { belonging: 0.5, purpose: 0.5 },
        skills: { gathering: 0.3, hunting: 0.3, craft: 0.3, social: 0.3, exploration: 0.3 },
        goal: { kind: 'connect', strength: 0.5, since: 1 },
        homeId: 'commons',
        locationId: 'commons',
        lastMeaningfulEventAt: 20,
      },
      b: {
        id: 'b',
        name: 'B',
        origin: 'native',
        energy: 0.8,
        stress: 0.1,
        resources: 0.7,
        socialDrive: 0.5,
        personality: { sociability: 0.5, diligence: 0.5, curiosity: 0.5, generosity: 0.5, resilience: 0.5, riskTolerance: 0.5 },
        life: testLife(),
        mind: testMind('b'),
        needs: { belonging: 0.5, purpose: 0.5 },
        skills: { gathering: 0.3, hunting: 0.3, craft: 0.3, social: 0.3, exploration: 0.3 },
        goal: { kind: 'connect', strength: 0.5, since: 1 },
        homeId: 'commons',
        locationId: 'commons',
        lastMeaningfulEventAt: 20,
      },
    };
    world.relationships = {
      'a::b': {
        agentA: 'a',
        agentB: 'b',
        trust: 0.9,
        affinity: 0.9,
        respect: 0.9,
        conflict: 0.05,
        updatedAt: 1,
      },
    };

    const isolated = await new WorldSensors(events).observe(world, 20);
    expect(isolated.metrics.socialIsolation).toBe(1);

    await events.append({
      eventId: 'recent_contact',
      worldId: 'world_1',
      kind: 'relationship.changed',
      source: 'agent',
      occurredAt: 18,
      payload: { agentA: 'a', agentB: 'b' },
    });
    const connected = await new WorldSensors(events).observe(world, 20);
    expect(connected.metrics.socialIsolation).toBe(0);
  });
});
