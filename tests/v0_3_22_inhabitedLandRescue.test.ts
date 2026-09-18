import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { bindWorldTerrain, assertTerrainFoundation, homelandCenterForWorld } from '../src/world/geography/WorldTerrain';
import { ensureInhabitedLandRescue } from '../src/world/geography/InhabitedLandRescue';
import { continentOutline } from '../src/world/geography/ContinentalRelief';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';
import { pointInPolygon } from '../src/world/BuildingFootprints';
import { lifeStageForRaceV16 } from '../src/v16/SocietyFoundationV16';
import type { AgentRace, WorldState } from '../src/world/types';

const races: AgentRace[] = ['elf','dwarf','goblin','orc','ogre'];
async function create(id: string) {
  return (await WorldEngine.create({worldId:id,seed:id,store:new InMemoryWorldStore(),startTime:0})).snapshot();
}
function checkReservations(world: WorldState) {
  const terrain = bindWorldTerrain(world)!;
  const originalRng = world.determinism.rngState;
  const points = Object.values(world.settlements).map(town => ({x:world.places[town.centerPlaceId].mapX,y:world.places[town.centerPlaceId].mapY}));
  for (const race of races) {
    const p = homelandCenterForWorld(world,race);
    expect(pointInPolygon(p,terrain.outline), `${race} outside physical mainland`).toBe(true);
    expect(terrain.sample(p.x,p.y).water, `${race} in water`).toBe(false);
    for (const q of points) expect(Math.hypot(p.x-q.x,p.y-q.y)).toBeGreaterThanOrEqual(10_000);
    points.push(p);
  }
  expect(world.determinism.rngState).toBe(originalRng);
}
async function offshoreFixture() {
  const world = await create('reported-offshore-homelands');
  world.calendar.elapsedWorldMinutes = WORLD_MINUTES_PER_YEAR * 20;
  world.v15!.simulationClock.simulatedWorldMinutes = world.calendar.elapsedWorldMinutes;
  world.v15!.simulationClock.quantumIndex = 20 * 60;
  world.v15!.simulationClock.pendingWorldMinutes = 0;
  const settlementId = 'settlement_dwarf_homeland';
  const p = {x:-41_000,y:-30_000};
  world.places[settlementId] = {id:settlementId,name:'Каменные Залы',kind:'village',surface:'land',biome:'mountains',mapX:p.x,mapY:p.y,
    capacity:30,connectedPlaceIds:['dwarf_test_home'],fertility:0.7,danger:0.08,settlementId,geographyVersion:1};
  world.places.dwarf_test_home = {id:'dwarf_test_home',name:'Сохранённый дом',kind:'home',surface:'land',biome:'settlement',mapX:p.x+0.25,mapY:p.y+0.2,
    capacity:4,connectedPlaceIds:[settlementId],fertility:0.5,danger:0.03,settlementId,urbanLayoutVersion:3};
  world.settlements[settlementId] = {id:settlementId,name:'Каменные Залы',kind:'village',centerPlaceId:settlementId,centerX:p.x,centerY:p.y,
    radius:1,memberPlaceIds:[settlementId,'dwarf_test_home'],foundedAt:0,layoutVersion:3,layoutSignature:'saved'};
  const a = world.agents.agent_1;
  a.homeId = 'dwarf_test_home'; a.locationId = a.homeId; a.race = 'dwarf'; delete a.movement;
  a.life.stage = lifeStageForRaceV16('dwarf',a.life.ageYears);
  a.position = {x:p.x+0.25,y:p.y+0.2,layerId:'surface'};
  a.knownPlaceIds = [a.homeId,settlementId];
  return world;
}

describe('physical homeland integrity and explicit island rescue', () => {
  it('reserves every people on real mainland for 24 deterministic seeds', async () => {
    const positions = new Set<string>();
    for (let i=0;i<24;i++) {
      const world = await create(`mainland-reservation-${i}`);
      checkReservations(world);
      positions.add(JSON.stringify(homelandCenterForWorld(world,'dwarf')));
    }
    expect(positions.size).toBe(24);
  },60_000);

  it('keeps the same seed repeatable and gives reset epochs valid new reservations', async () => {
    const store = new InMemoryWorldStore();
    const engine = await WorldEngine.create({worldId:'mainland-reset',seed:'mainland-reset',store});
    const before = engine.snapshot();
    const duplicate = await create('mainland-reset');
    expect(duplicate.terrain).toEqual(before.terrain);
    const names = Object.values(before.agents).map(a=>a.name);
    for (let epoch=2;epoch<=3;epoch++) {
      // Opening a second engine may atomically commit compatible metadata.
      // Refresh the original writer, rather than bypass revision protection.
      await engine.reload();
      await engine.resetEpoch(`mainland-reset-${epoch}`,names,`reset-${epoch}`);
      const world = engine.snapshot(); checkReservations(world);
      const reloaded = (await WorldEngine.open({worldId:world.id,store})).snapshot();
      expect(reloaded.terrain).toEqual(world.terrain);
      expect(reloaded.agents).toEqual(world.agents);
    }
  },60_000);

  it('creates real dry islands under saved coordinates without moving or teaching anybody', async () => {
    const world = await offshoreFixture();
    const before = structuredClone(world);
    const model = bindWorldTerrain(world)!;
    expect(model.sample(world.agents.agent_1.position.x,world.agents.agent_1.position.y).water).toBe(true);
    const oldOutline = continentOutline(world.terrain!);
    const oldRivers = structuredClone(model.reaches);
    const result = ensureInhabitedLandRescue(world);
    expect(result.blockedSettlementIds).toEqual([]);
    expect(result.addedIslandIds.length).toBeGreaterThanOrEqual(3);
    expect(result.addedPlaceIds).toHaveLength(3);
    assertTerrainFoundation(world.terrain);
    const after = bindWorldTerrain(world)!;
    for (const id of ['settlement_dwarf_homeland','dwarf_test_home']) {
      expect(world.places[id]).toMatchObject({mapX:before.places[id].mapX,mapY:before.places[id].mapY});
      expect(after.sample(world.places[id].mapX,world.places[id].mapY).water).toBe(false);
      expect(after.sample(world.places[id].mapX,world.places[id].mapY,false).water).toBe(false);
    }
    expect(world.agents).toEqual(before.agents);
    expect(world.calendar).toEqual(before.calendar);
    expect(world.determinism).toEqual(before.determinism);
    expect(world.v15).toEqual(before.v15);
    expect(world.v16).toEqual(before.v16);
    expect(world.v18).toEqual(before.v18);
    expect(world.v19).toEqual(before.v19);
    expect(world.relationships).toEqual(before.relationships);
    expect(world.routes).toEqual(before.routes);
    expect(world.terrain!.anchors).toEqual(before.terrain!.anchors);
    expect(continentOutline(world.terrain!)).toEqual(oldOutline);
    expect(after.reaches).toEqual(oldRivers);
    const committed = structuredClone(world);
    expect(ensureInhabitedLandRescue(world).changed).toBe(false);
    expect(world).toEqual(committed);
  });

  it('does not refill harvested wildlife or manufacture settlement stock on reload', async () => {
    const world = await offshoreFixture();
    const stocks = structuredClone(world.v16!.settlementEconomyById);
    ensureInhabitedLandRescue(world);
    for (const population of Object.values(world.wildlife)) if (population.id.startsWith('habitat-rescue:')) population.count = 0;
    const saved = JSON.parse(JSON.stringify(world)) as WorldState;
    expect(ensureInhabitedLandRescue(saved).changed).toBe(false);
    expect(saved.wildlife).toEqual(world.wildlife);
    expect(saved.v16!.settlementEconomyById).toEqual(stocks);
  });

  it('preserves a living world through the actual open/migration path and a second reload', async () => {
    const world = await offshoreFixture();
    const store = new InMemoryWorldStore(); await store.initializeWorld(world);
    const before = structuredClone(world.agents);
    const opened = await WorldEngine.open({worldId:world.id,store});
    const first = opened.snapshot();
    expect(first.agents).toEqual(before);
    expect(first.calendar).toEqual(world.calendar);
    expect(first.determinism.rngState).toBe(world.determinism.rngState);
    expect(bindWorldTerrain(first)!.sample(before.agent_1.position.x,before.agent_1.position.y).water).toBe(false);
    const again = (await WorldEngine.open({worldId:world.id,store})).snapshot();
    expect(again).toEqual(first);
  });

  it('retains all five actually founded peoples on land and at the same positions after reopening', async () => {
    const store = new InMemoryWorldStore();
    const engine = await WorldEngine.create({worldId:'mainland-lived-12-years',seed:'mainland-lived-12-years',store});
    await engine.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR * 12);
    const before = engine.snapshot(); const terrain = bindWorldTerrain(before)!;
    for (const race of races) {
      const town = before.settlements[`settlement_${race}_homeland`]; expect(town).toBeDefined();
      for (const id of town.memberPlaceIds) {
        const place = before.places[id];
        if (place.surface === 'water') continue;
        expect(terrain.sample(place.mapX,place.mapY).water, id).toBe(false);
      }
    }
    const after = (await WorldEngine.open({worldId:before.id,store})).snapshot();
    expect(after.agents).toEqual(before.agents);
    for (const race of races) {
      const id = `settlement_${race}_homeland`;
      expect([after.places[id].mapX,after.places[id].mapY]).toEqual([before.places[id].mapX,before.places[id].mapY]);
    }
  },60_000);
});
