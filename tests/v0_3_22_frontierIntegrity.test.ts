import { describe, expect, it } from 'vitest';
import { chooseCulturalPlaceNameV18 } from '../src/v18/CulturalNamingV18';
import { appraiseFrontierSitesV18, MAX_FRONTIER_SETTLEMENT_DISTANCE_MAP_UNITS } from '../src/v18/SettlementMobilityV18';
import {
  MAX_DUNGEON_EXPEDITION_DISTANCE_MAP_UNITS,
  chooseDungeonExpeditionV19,
  syncAdventureEconomyV19,
} from '../src/v19/AdventureEconomyV19';
import { sharePlaceKnowledgeV20 } from '../src/v20/KnowledgeBoundariesV20';
import { genesisBootstrapAvailableToV15 } from '../src/v15/GenesisBootstrap';
import { libraryIdForAgent } from '../src/v21/LibraryAdmissions';
import { localSurveySite } from '../src/world/geography/LocalExploration';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { residentExplorationTarget, MAX_LOCAL_EXPLORATION_TARGET_DISTANCE } from '../src/world/ResidentExploration';
import { WorldEngine } from '../src/world/WorldEngine';
import type { AgentState, WorldPlace, WorldState } from '../src/world/types';
import type { V19DungeonState } from '../src/v19/types';

const fresh = async (id: string) =>
  (await WorldEngine.create({ worldId: id, seed: id, store: new InMemoryWorldStore(), startTime: 0 })).snapshot();

function freePlace(source: WorldPlace, id: string, x: number, y: number): WorldPlace {
  return {
    ...structuredClone(source),
    id,
    name: id,
    kind: 'meadow',
    biome: 'plains',
    mapX: x,
    mapY: y,
    surface: 'land',
    settlementId: undefined,
    connectedPlaceIds: [],
    discoveredAt: 0,
    boundaryPolygon: undefined,
    waterPolygon: undefined,
  };
}

describe('F2 frontier integrity', () => {
  it('never turns a remote remembered place into one cross-continent explore action', async () => {
    const world = await fresh('frontier-local-target');
    const agent = world.agents.agent_1;
    const current = world.places[agent.locationId];
    const local = freePlace(current, 'local_frontier', agent.position.x + 30, agent.position.y);
    const remote = freePlace(current, 'remote_frontier', agent.position.x + MAX_LOCAL_EXPLORATION_TARGET_DISTANCE + 2_000, agent.position.y);
    world.places[local.id] = local;
    world.places[remote.id] = remote;
    agent.knownPlaceIds = [agent.locationId, agent.homeId, local.id, remote.id];
    agent.plan = {
      kind: 'explore_frontier',
      targetPlaceId: remote.id,
      startedAt: 0,
      expiresAt: 999_999,
    };

    const target = residentExplorationTarget(world, agent, () => true, [], 0.8);
    expect(target).not.toBe(remote.id);
    expect(Math.hypot(world.places[target].mapX - agent.position.x, world.places[target].mapY - agent.position.y))
      .toBeLessThanOrEqual(MAX_LOCAL_EXPLORATION_TARGET_DISTANCE);
    expect(agent.plan).toBeUndefined();
  });

  it('grows a lived frontier in kilometre-scale legs without packing permanent regions every 100 metres', async () => {
    const world = await fresh('frontier-step-chain');
    const agent = world.agents.agent_1;
    const start = world.places.outskirts;
    agent.locationId = start.id;
    agent.position = { x: start.mapX, y: start.mapY, layerId: 'surface' };
    agent.movement = undefined;
    const created: WorldPlace[] = [];

    for (let sequence = 1; sequence <= 14; sequence += 1) {
      const site = localSurveySite(world, agent, sequence, ((sequence * 37) % 97) / 97);
      expect(site).toBeDefined();
      const step = Math.hypot(site!.x - agent.position.x, site!.y - agent.position.y);
      expect(step).toBeGreaterThanOrEqual(5.999);
      expect(step).toBeLessThanOrEqual(36.001);
      for (const prior of created) {
        expect(Math.hypot(site!.x - prior.mapX, site!.y - prior.mapY)).toBeGreaterThanOrEqual(5.49);
      }
      const place = freePlace(start, `chain_${sequence}`, site!.x, site!.y);
      place.biome = site!.biome;
      place.connectedPlaceIds = [agent.locationId];
      world.places[place.id] = place;
      world.places[agent.locationId].connectedPlaceIds.push(place.id);
      created.push(place);
      agent.locationId = place.id;
      agent.position = { x: place.mapX, y: place.mapY, layerId: 'surface' };
    }
    expect(created).toHaveLength(14);
  });

  it('does not let a settlement colonize globally known land on the far side of the continent', async () => {
    const world = await fresh('frontier-settlement-locality');
    const settlement = world.settlements.settlement_ainkrad;
    const source = world.places[settlement.centerPlaceId];
    const local = freePlace(source, 'local_colony_site', settlement.centerX + 120, settlement.centerY);
    const remote = freePlace(source, 'remote_colony_site', settlement.centerX + MAX_FRONTIER_SETTLEMENT_DISTANCE_MAP_UNITS + 2_000, settlement.centerY);
    local.connectedPlaceIds = [settlement.centerPlaceId];
    remote.connectedPlaceIds = [settlement.centerPlaceId];
    world.places[local.id] = local;
    world.places[remote.id] = remote;
    world.cartography ??= { version: 1, bySettlementId: {} };
    world.cartography.bySettlementId[settlement.id] = {
      revision: 2,
      points: {
        [local.id]: { knownRevision: 1 },
        [remote.id]: { knownRevision: 2 },
      },
      routes: {},
    };
    const sites = appraiseFrontierSitesV18(world, settlement.id, () => 1);
    expect(sites.some(site => site.placeId === local.id)).toBe(true);
    expect(sites.some(site => site.placeId === remote.id)).toBe(false);
  });

  it('does not spread a stale remote place or dungeon id through one local conversation', async () => {
    const world = await fresh('frontier-knowledge-boundary');
    const speaker = world.agents.agent_1;
    const listener = world.agents.agent_2;
    const current = world.places.commons;
    const remote = freePlace(current, 'legacy_remote_memory', current.mapX + 9_000, current.mapY + 3_000);
    world.places[remote.id] = remote;
    for (const agent of [speaker, listener]) {
      agent.locationId = current.id;
      agent.position = { x: current.mapX, y: current.mapY, layerId: 'surface' };
      agent.movement = undefined;
    }
    speaker.knownPlaceIds = [...new Set([...(speaker.knownPlaceIds ?? []), remote.id])];
    speaker.knownDungeonIds = ['dungeon:legacy_remote_memory'];
    listener.knownPlaceIds = [listener.homeId, current.id];
    listener.knownDungeonIds = [];

    sharePlaceKnowledgeV20(world, speaker, listener);
    expect(listener.knownPlaceIds).not.toContain(remote.id);
    expect(listener.knownDungeonIds).not.toContain('dungeon:legacy_remote_memory');
  });

  it('lets the discovering Spark create a deterministic cultural place name instead of a tiny canned full-name list', async () => {
    const world = await fresh('frontier-cultural-names');
    const explorer = world.agents.agent_1;
    const first = chooseCulturalPlaceNameV18({ world, explorer, biome: 'forest', sequence: 41, x: 123, y: -88 });
    const replay = chooseCulturalPlaceNameV18({ world, explorer, biome: 'forest', sequence: 41, x: 123, y: -88 });
    const second = chooseCulturalPlaceNameV18({ world, explorer, biome: 'plains', sequence: 42, x: 180, y: -40 });
    expect(first).toBe(replay);
    expect(second).not.toBe(first);
    expect(first).not.toMatch(/^(Скрытые|Дикие|Серебряные|Ветреные)\b/u);
    expect(second).not.toMatch(/^(Скрытые|Дикие|Серебряные|Ветреные)\b/u);
  });

  it('lets any physically present Spark discover a dungeon while keeping guild eligibility separate', async () => {
    const world = await fresh('frontier-dungeon-physicality');
    const source = world.places.outskirts;
    const ruins: WorldPlace = {
      ...freePlace(source, 'goblin_remote_ruins', source.mapX + 60, source.mapY),
      kind: 'ruins',
      biome: 'ancient_ruins',
      danger: 0.8,
    };
    world.places[ruins.id] = ruins;
    const template = world.agents.agent_1;
    const goblin: AgentState = structuredClone(template);
    goblin.id = 'test_goblin';
    goblin.name = 'Тестовый гоблин';
    goblin.race = 'goblin';
    goblin.locationId = ruins.id;
    goblin.position = { x: ruins.mapX, y: ruins.mapY, layerId: 'surface' };
    goblin.movement = undefined;
    world.agents[goblin.id] = goblin;
    syncAdventureEconomyV19(world);
    const dungeon = world.v19!.adventureEconomy.dungeonsById[`dungeon:${ruins.id}`];
    expect(dungeon).toBeDefined();
    goblin.knownPlaceIds = [...new Set([...(goblin.knownPlaceIds ?? []), ruins.id])];
    goblin.knownDungeonIds = [dungeon!.id];
    expect(chooseDungeonExpeditionV19(world, goblin, [dungeon!.id], 0)).toBeUndefined();
  });

  it('refuses a legacy known dungeon thousands of kilometres away as one expedition target', async () => {
    const world = await fresh('frontier-dungeon-distance');
    const agent = world.agents.agent_1;
    agent.energy = 1;
    agent.resources = 1;
    agent.life.stage = 'adult';
    agent.life.health = 1;
    world.v18!.livelihoodByAgentId[agent.id].primary = 'adventurer';
    const source = world.places[agent.locationId];
    const remote = {
      ...freePlace(source, 'legacy_remote_dungeon_entrance', agent.position.x + MAX_DUNGEON_EXPEDITION_DISTANCE_MAP_UNITS + 4_000, agent.position.y),
      kind: 'ruins' as const,
      biome: 'ancient_ruins' as const,
      danger: 0.8,
    };
    world.places[remote.id] = remote;
    const dungeon: V19DungeonState = {
      id: `dungeon:${remote.id}`,
      name: 'Дальний старый лабиринт',
      entrancePlaceId: remote.id,
      rank: 'F',
      depth: 100,
      threat: 0.3,
      discoveredWorldMinute: 0,
      clearedDepth: 0,
      runCount: 0,
      successfulRunCount: 0,
      treasureReserve: 20,
      treasureCapacity: 20,
      lastRenewedWorldMinute: 0,
      formationStartedWorldMinute: 0,
      lastDevelopedWorldMinute: 0,
      formationProgress: 1,
      formationStage: 'labyrinth',
      bossFloors: [10,20,30,40,50,60,70,80,90,100],
      active: true,
    };
    world.v19!.adventureEconomy.dungeonsById[dungeon.id] = dungeon;
    agent.knownPlaceIds = [...new Set([...(agent.knownPlaceIds ?? []), remote.id])];
    agent.knownDungeonIds = [dungeon.id];
    expect(chooseDungeonExpeditionV19(world, agent, [dungeon.id], 0)).toBeUndefined();
  });
});

describe('F2 founding human parity', () => {
  it('makes all three public squares true civic centres and gives each human foundation its own local library', async () => {
    const world = await fresh('founding-parity');
    const expected = [
      ['settlement_ainkrad', 'commons', 'secret_library_v18'],
      ['settlement_rulid', 'rulid_commons', 'secret_library_rulid_v18'],
      ['settlement_zakkaria', 'zakkaria_commons', 'secret_library_zakkaria_v18'],
    ] as const;
    for (const [settlementId, commonsId, libraryId] of expected) {
      const settlement = world.settlements[settlementId];
      expect(settlement.centerPlaceId).toBe(commonsId);
      expect(world.places[commonsId].settlementId).toBe(settlementId);
      expect(world.places[libraryId]).toMatchObject({ kind: 'library' });
      if (libraryId !== 'secret_library_v18') {
        expect(world.places[libraryId].settlementId).toBe(settlementId);
      }
      const founder = Object.values(world.agents).find(agent => world.places[agent.homeId]?.settlementId === settlementId)!;
      expect(libraryIdForAgent(world, founder)).toBe(libraryId);
      expect(genesisBootstrapAvailableToV15(founder.race, settlementId)).toBe(true);
    }
    expect(genesisBootstrapAvailableToV15('elf', 'settlement_elf_homeland')).toBe(false);
    expect(genesisBootstrapAvailableToV15('goblin', 'settlement_goblin_homeland')).toBe(false);
  });
});
