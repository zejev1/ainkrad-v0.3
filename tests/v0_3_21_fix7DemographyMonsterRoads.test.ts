import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { observeWorldArchitecture } from '../src/cardinal/WorldAuthorityGateway';
import {
  CENTURY_HUMPBACK_INTERVAL,
  CENTURY_HUMPBACK_LARVA_KILLED_INTERVAL,
  canDefeatAdultCenturyHumpback,
  centuryHumpbackKnowledgeForRace,
  createCenturyHumpbackState,
  ensureCenturyHumpbackState,
} from '../src/world/CenturyHumpback';
import { demographyByRace } from '../src/world/DemographyByRace';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import { pathCrossesWater } from '../src/world/WaterNavigation';
import { rebuildWorldRoutes, routeIdBetween } from '../src/world/WorldNavigation';
import { bindWorldTerrain } from '../src/world/geography/WorldTerrain';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';
import type { AgentState, WorldState } from '../src/world/types';

const fresh = async (id: string) =>
  (await WorldEngine.create({ worldId: id, seed: 'fix7', store: new InMemoryWorldStore() })).snapshot();

describe('FIX7 demography, century parasite and physical roads', () => {
  it('reports human births and deaths without counting the other peoples', async () => {
    const world = await fresh('fix7-demography');
    const source = world.agents.agent_1;
    const add = (id: string, race: AgentState['race'], alive: boolean): void => {
      world.agents[id] = {
        ...structuredClone(source),
        id,
        race,
        life: {
          ...structuredClone(source.life),
          generation: 1,
          bornAt: source.life.bornAt + 100,
          alive,
          ...(alive ? {} : { diedAt: 200, deathCause: 'old_age' as const }),
        },
      };
    };
    add('human_child', 'human', true);
    add('human_dead', 'human', false);
    add('elf_child', 'elf', true);
    add('orc_child', 'orc', true);
    world.population.births = 214;
    world.population.deaths = 99;

    const byRace = demographyByRace(world);
    expect(byRace.human).toMatchObject({ living: 31, births: 2, deaths: 1 });
    expect(byRace.elf.births).toBe(1);
    expect(byRace.orc.births).toBe(1);
    expect(observeWorldArchitecture(world)).toMatchObject({
      livingPopulation: 31,
      totalBirths: 2,
      totalDeaths: 1,
    });
  });

  it('keeps one scripted egg and the exact 85% adult threshold', () => {
    const state = createCenturyHumpbackState();
    expect(state.nextEmergenceWorldMinute).toBe(CENTURY_HUMPBACK_INTERVAL);
    expect(canDefeatAdultCenturyHumpback(0.849999)).toBe(false);
    expect(canDefeatAdultCenturyHumpback(0.85)).toBe(true);
    expect(CENTURY_HUMPBACK_LARVA_KILLED_INTERVAL / CENTURY_HUMPBACK_INTERVAL).toBe(2);
    expect(centuryHumpbackKnowledgeForRace('human').length).toBeGreaterThan(3);
    expect(centuryHumpbackKnowledgeForRace('elf').length).toBeGreaterThan(3);
    expect(centuryHumpbackKnowledgeForRace('orc')).toHaveLength(1);
    expect(state.knowledgeByRace).toMatchObject({
      human: 'countermeasures',
      elf: 'countermeasures',
      dwarf: 'warning',
      goblin: 'warning',
      orc: 'warning',
      ogre: 'warning',
    });
  });

  it('runs one adult to one host and exactly one crawling larva', async () => {
    const fixture = JSON.parse(
      gunzipSync(
        readFileSync(new URL('./fixtures/fix5-year21.json.gz', import.meta.url)),
      ).toString(),
    ) as WorldState;
    fixture.revision = 0;
    const migrationStore = new InMemoryWorldStore();
    await migrationStore.initializeWorld(fixture);
    const migrated = await WorldEngine.open({ worldId: fixture.id, store: migrationStore });
    const state = migrated.snapshot();
    state.revision = 0;
    const parasite = ensureCenturyHumpbackState(state);
    parasite.phase = 'dormant';
    parasite.nextEmergenceWorldMinute = state.calendar.elapsedWorldMinutes;
    for (const resident of Object.values(state.agents)) {
      if (resident.race === 'dwarf') resident.life.health = 0.5;
    }
    const store = new InMemoryWorldStore();
    await store.initializeWorld(state);
    const engine = await WorldEngine.open({ worldId: state.id, store });
    const from = engine.snapshot().calendar.elapsedWorldMinutes;
    const deathsBefore = engine.snapshot().population.deaths;
    await engine.advanceCanonicalTimeTo(from + (WORLD_MINUTES_PER_YEAR / 60) * 3);
    const after = engine.snapshot();
    const cycle = after.centuryHumpback!;
    const population = after.wildlife[cycle.populationId!];
    expect(cycle).toMatchObject({
      phase: 'larva_crawling',
      nearbyRace: 'dwarf',
      lastOutcome: 'host_killed',
    });
    expect(population).toMatchObject({ count: 1, carryingCapacity: 1, reproductionRate: 0 });
    expect(after.population.deaths - deathsBefore).toBe(1);
  });

  it('migrates a straight inter-settlement road into a winding terrain trail', async () => {
    const world = await fresh('fix7-roads');
    const from = world.places.commons;
    const terrain = bindWorldTerrain(world)!;
    let target = { x: from.mapX - 1400, y: from.mapY - 900 };
    for (let ring = 0; ring < 40 && terrain.sample(target.x, target.y).water; ring += 1) {
      target = { x: from.mapX - 1200 - ring * 45, y: from.mapY - 700 + ring * 31 };
    }
    expect(terrain.sample(target.x, target.y).water).toBe(false);
    const to = {
      ...structuredClone(from),
      id: 'remote_point',
      name: 'Дальняя точка',
      kind: 'meadow' as const,
      biome: 'plains' as const,
      settlementId: undefined,
      mapX: target.x,
      mapY: target.y,
      connectedPlaceIds: ['commons'],
    };
    world.places.remote_point = to;
    from.connectedPlaceIds.push(to.id);
    bindWorldTerrain(world);
    const id = routeIdBetween(from.id, to.id);
    const routes = rebuildWorldRoutes(world.places, {
      [id]: {
        id,
        fromPlaceId: from.id,
        toPlaceId: to.id,
        traversal: 'walk',
        waypoints: [{ x: from.mapX, y: from.mapY }, { x: to.mapX, y: to.mapY }],
        distance: Math.hypot(to.mapX - from.mapX, to.mapY - from.mapY),
        geometryVersion: 1,
        completedTraversals: 521,
      },
    });
    const route = routes[id];
    expect(route.geometryVersion).toBe(3);
    expect(route.completedTraversals).toBe(521);
    expect(route.waypoints.length).toBeGreaterThan(12);
    expect(pathCrossesWater(route.waypoints, world.places)).toBe(false);
    const dx = to.mapX - from.mapX;
    const dy = to.mapY - from.mapY;
    const length = Math.hypot(dx, dy);
    const maximumDeviation = Math.max(
      ...route.waypoints.map((point) =>
        Math.abs(dy * (point.x - from.mapX) - dx * (point.y - from.mapY)) / length,
      ),
    );
    expect(maximumDeviation).toBeGreaterThan(50);
  });
});
