import { describe, expect, it } from 'vitest';
import { PLANT_BY_ID, PLANT_SPECIES, PLANT_DATA_VERSION } from '../src/world/systems/plants/PlantKnowledge';
import { assessPlant, buildSeedEdges, disperseSeeds, initializePatch, DAY, YEAR, type PlantHabitat, type PlantWeather } from '../src/world/systems/plants/VegetationModel';
import { VegetationSystemAgent, VEGETATION_AGENT_MANIFEST } from '../src/world/systems/VegetationSystemAgent';
import { vegetationSections } from '../src/presentation/VegetationPanel';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';

const habitat = (id = 'plot', override: Partial<PlantHabitat> = {}): PlantHabitat => ({
  id, region: 'town', x: 0, y: 0, elevationM: 0, moisture: 0.6, fertility: 0.7,
  slope: 0.1, soilPh: 6.6, kind: 'meadow', marine: false, seedCarriers: false, ...override,
});
const climate = (start: number, days: number, override: Partial<PlantWeather> = {}): PlantWeather[] =>
  Array.from({ length: days }, (_, i) => ({ minute: start + i * DAY, duration: DAY,
    temperatureC: 18, precipitation: 0.6, rain: i % 3 === 0, snow: false, wind: 0.4, ...override }));
function agent(h = habitat(), species = 'poa_pratensis') {
  const a = new VegetationSystemAgent(undefined, 0, 'ecology-acceptance');
  a.synchronizeHabitats([h], 0, () => true);
  const patch = a.stateForCommit().sites[h.id];
  patch.plants = [{ speciesId: species, adult: 0.6, adultAge: PLANT_BY_ID.get(species)!.model.maturityYears * 2, juvenile: 0.05, juvenileAge: 0,
    seeds: 0.1, suitability: 1, limitation: 'suitable' }];
  return a;
}

describe('Source-backed ecological behavior', () => {
  it('keeps source observations separate from calibration and derives habitat restrictions from them', () => {
    expect(PLANT_SPECIES).toHaveLength(13);
    expect(new Set(PLANT_SPECIES.map(s => s.source)).size).toBe(13);
    const wet = initializePatch(habitat('marsh', { kind: 'wetland', moisture: 0.95 }), 0, 'x');
    const dry = initializePatch(habitat('dry', { moisture: 0.12 }), 0, 'x');
    expect(assessPlant(PLANT_BY_ID.get('typha_latifolia')!, wet, 20, 0).suitability).toBeGreaterThan(0.8);
    expect(assessPlant(PLANT_BY_ID.get('typha_latifolia')!, dry, 20, 0).suitability).toBe(0);
    expect(assessPlant(PLANT_BY_ID.get('pteridium_aquilinum')!, wet, 20, 0).suitability).toBe(0);
    expect(PLANT_BY_ID.get('poa_pratensis')!.facts.measured!.soilPh).toEqual([5.8, 8.2]);
    expect(initializePatch(habitat('sea', { marine: true }), 0, 'x').plants).toEqual([]);
    const pine = PLANT_BY_ID.get('pinus_sylvestris')!, beech = PLANT_BY_ID.get('fagus_sylvatica')!;
    expect(assessPlant(beech, wet, 20, 0.95).suitability).toBeLessThan(0.1); // flooding still matters despite shade tolerance
    const forest = initializePatch(habitat('forest', { kind: 'woodland' }), 0, 'x');
    expect(assessPlant(beech, forest, 20, 0.95).suitability).toBeGreaterThan(assessPlant(pine, forest, 20, 0.95).suitability);
  });

  it('makes sustained drought kill moisture-demanding vegetation and reduce real regional recovery', () => {
    const dry = agent(), wet = agent();
    const input = [{ id: 'town', base: 0.5, fertility: 0.7, baseRecovery: 0.12, soilRecovery: 0.01 }];
    const a = dry.advance(climate(0, 365 * 3, { temperatureC: 32, rain: false, precipitation: 0 }), input, YEAR * 3);
    const b = wet.advance(climate(0, 365 * 3), input, YEAR * 3);
    const dp = dry.snapshot().sites.plot, wp = wet.snapshot().sites.plot;
    expect(dp.water).toBeLessThan(wp.water);
    expect(dp.plants[0].adult + dp.plants[0].juvenile).toBeLessThan(wp.plants[0].adult + wp.plants[0].juvenile);
    expect(a.resources[0].base).toBeLessThan(b.resources[0].base);
    expect(dp.lastMortality).toBeGreaterThan(0);
    expect(a.resources[0].base).toBeLessThan(input[0].base + input[0].baseRecovery);
  });

  it('retains winter dormancy and snowmelt, without treating ordinary winter as an executor fault', () => {
    const a = agent(habitat(), 'pinus_sylvestris');
    a.advance(climate(0, 40, { temperatureC: -8, snow: true, rain: false }), [], DAY * 40);
    const frozen = a.snapshot().sites.plot;
    expect(frozen.snow).toBeGreaterThan(0);
    expect(frozen.lastGrowth).toBe(0);
    expect(a.health().healthy).toBe(true);
    a.advance(climate(DAY * 40, 10, { temperatureC: 15, rain: false }), [], DAY * 50);
    expect(a.snapshot().sites.plot.snow).toBeLessThan(frozen.snow);
    expect(a.snapshot().sites.plot.plants[0].adult).toBeGreaterThan(0.4);
  });

  it('requires propagules and reproductive age; catalog suitability cannot spontaneously plant a site', () => {
    const empty = agent(); empty.stateForCommit().sites.plot.plants = [];
    empty.advance(climate(0, 365), [], YEAR);
    expect(empty.snapshot().sites.plot.plants).toEqual([]);
    const juvenile = agent(habitat(), 'quercus_robur');
    Object.assign(juvenile.stateForCommit().sites.plot.plants[0], { adult: 0, adultAge: 0, juvenile: 0.1, seeds: 0 });
    juvenile.advance(climate(0, 365 * 2), [], YEAR * 2);
    const c = juvenile.snapshot().sites.plot.plants[0];
    expect(c.adult).toBe(0); expect(c.seeds).toBe(0); expect(c.juvenile).toBeGreaterThan(0);
    juvenile.advance(climate(YEAR * 2, 365 * 31), [], YEAR * 33);
    const mature = juvenile.snapshot().sites.plot.plants[0];
    expect(mature.adult).toBeGreaterThan(0);
    expect(mature.seeds).toBeGreaterThan(0); // The complete juvenile → reproductive adult → seed cycle.
  });

  it('disperses over physical distances, conserves propagules and cannot teleport through an ocean or relay in one step', () => {
    const habitats = [habitat('a'), habitat('b', { x: 8 }), habitat('c', { x: 16 })];
    const a = agent(habitats[0], 'betula_pendula'); a.synchronizeHabitats(habitats, 0, () => true);
    const sites = a.stateForCommit().sites;
    sites.b.plants = []; sites.c.plants = [];
    const before = sites.a.plants[0].seeds;
    const edges = buildSeedEdges(habitats, () => true);
    disperseSeeds(sites, edges, climate(0, 1, { wind: 1 })[0]);
    expect(sites.b.plants[0].seeds).toBeGreaterThan(0);
    expect(sites.c.plants).toEqual([]);
    expect(sites.a.plants[0].seeds + sites.b.plants[0].seeds).toBeCloseTo(before, 14);
    expect(buildSeedEdges(habitats, () => false)).toEqual([]);
    const water = buildSeedEdges([habitat('up', { watercourse: 'actual-river', elevationM: 10 }), habitat('down', { x: 1, watercourse: 'actual-river', elevationM: 5 })], () => true);
    expect(water.find(e => e.from === 'up')!.waterConnected).toBe(true);
    expect(water.find(e => e.from === 'down')!.waterConnected).toBe(false);
  });

  it('continues the same ecological model after stop, thrown replacement or invalid output, retaining all lived plants', () => {
    const normal = agent();
    for (const replacement of [() => { throw new Error('injected'); }, (p: any) => { p.water = NaN; }]) {
      const broken = new VegetationSystemAgent(normal.snapshot(), 0, 'x', replacement);
      broken.synchronizeHabitats([habitat()], 0, () => true);
      const control = new VegetationSystemAgent(normal.snapshot(), 0, 'x');
      control.synchronizeHabitats([habitat()], 0, () => true);
      broken.advance(climate(0, 30), [], DAY * 30); control.advance(climate(0, 30), [], DAY * 30);
      expect(broken.snapshot().sites).toEqual(control.snapshot().sites);
      expect(broken.health().healthy).toBe(false);
      const present = broken.snapshot().sites;
      broken.applyCardinalCommand({ kind: 'restore', reason: 'reconnect' });
      expect(broken.snapshot().sites).toEqual(present);
    }
    const stopped = new VegetationSystemAgent(normal.snapshot(), 0, 'x');
    stopped.synchronizeHabitats([habitat()], 0, () => true);
    stopped.applyCardinalCommand({ kind: 'stop', reason: 'isolate executor' });
    stopped.advance(climate(0, 30), [], DAY * 30); normal.advance(climate(0, 30), [], DAY * 30);
    expect(stopped.snapshot().sites).toEqual(normal.snapshot().sites);
    expect(() => stopped.applyCardinalCommand({ kind: 'restrict', allowedCapabilityIds: ['sparks.minds.write'], reason: 'denied' })).toThrow();
    expect(VEGETATION_AGENT_MANIFEST.capabilities[0].readScopes.join()).not.toMatch(/sparks|residents|knowledge/);
  });

  it('does zero ecology calculations or topology rebuilds for repeated observations at the same time', () => {
    const a = agent(), weather = climate(0, 1);
    a.advance(weather, [], DAY); const counts = a.operationCounts();
    for (let i = 0; i < 100_000; i++) a.advance(weather, [], DAY);
    expect(a.operationCounts()).toEqual(counts);
    expect(a.snapshot().sites.plot.plants.length).toBeLessThanOrEqual(PLANT_SPECIES.length);
  });
});

async function worldFixture() {
  const worldId = 'vegetation-live', store = new InMemoryWorldStore();
  const engine = await WorldEngine.create({ worldId, seed: worldId, store, startTime: 0 });
  return { worldId, store, engine, seed: worldId, controlLog: new InMemoryAppendOnlyLog() };
}
describe('Complete world integration and detachable Cardinal', () => {
  it('adds the agent to a legacy save without changing stores, soil, residents, history or geography', async () => {
    const f = await worldFixture(), legacy = f.engine.snapshot(); delete legacy.vegetationSystem;
    const store = new InMemoryWorldStore(); await store.initializeWorld(legacy);
    const world = await WorldEngine.open({ worldId: f.worldId, store });
    const before = world.snapshot();
    await world.controlVegetationSystem({ kind: 'start' }, 'initialize', before.revision);
    const after = world.snapshot();
    expect(after.vegetationSystem?.dataVersion).toBe(PLANT_DATA_VERSION);
    delete after.vegetationSystem; after.revision = before.revision;
    expect(after).toEqual(before);
    expect(await store.history(f.worldId)).toEqual([]);
  });

  it('advances plant and soil state in the actual world, survives reload, and exposes real diagnostics', async () => {
    const f = await worldFixture(), before = f.engine.snapshot();
    await f.engine.advanceCanonicalTimeTo(8760 * 4);
    const after = f.engine.snapshot();
    expect(after.vegetationSystem!.updates).toBe(4);
    expect(after.vegetationSystem!.sites.resource_field).not.toEqual(before.vegetationSystem!.sites.resource_field);
    expect(after.places.resource_field.fertility).toBe(after.vegetationSystem!.sites.resource_field.fertility);
    const reopened = await WorldEngine.open({ worldId: f.worldId, store: f.store });
    expect(reopened.snapshot()).toEqual(after);
    expect(JSON.stringify(vegetationSections(after, 'resource_field'))).toMatch(/Источник|источник/);
    expect(vegetationSections(after, 'resource_field')[0].rows.some(r => r.label.includes('Покрытие'))).toBe(true);
  });

  it('preserves the same autonomous life and vegetation with Cardinal ON, OFF and abruptly disconnected', async () => {
    const f = await worldFixture(), initial = f.engine.snapshot();
    const runs = [];
    for (const mode of ['observer', 'off', 'unplugged'] as const) {
      const store = new InMemoryWorldStore(); await store.initializeWorld(initial);
      let runtime = await LiveWorldRuntime.create({ ...f, store, controlLog: new InMemoryAppendOnlyLog(), mode: mode === 'unplugged' ? 'observer' : mode });
      if (mode === 'unplugged') runtime.disconnectCardinal('physically removed');
      for (let i = 0; i < 12; i++) await runtime.tick(8760);
      runs.push({ state: runtime.worldSnapshot(), events: await store.history(f.worldId), memories: [...store.memoriesById] });
      const saved = runtime.worldSnapshot();
      await runtime.setCardinalEnabled(false); await runtime.setCardinalEnabled(true);
      expect(runtime.worldSnapshot()).toEqual(saved);
    }
    expect(runs[1]).toEqual(runs[0]); expect(runs[2]).toEqual(runs[0]);
  });

  it('repairs vegetation from year zero and preserves all physical state', async () => {
    for (const minute of [0, YEAR * 199, YEAR * 200]) {
      const f = await worldFixture(), checkpoint = f.engine.snapshot();
      checkpoint.calendar.elapsedWorldMinutes = minute;
      Object.assign(checkpoint.v15!.simulationClock, { simulatedWorldMinutes: minute, pendingWorldMinutes: 0, quantumIndex: minute / 8760 });
      checkpoint.vegetationSystem!.lifecycle = 'faulted'; checkpoint.vegetationSystem!.fallback = true;
      checkpoint.vegetationSystem!.lastFault = 'injected lifecycle failure';
      checkpoint.vegetationSystem!.lastMinute = minute;
      const store = new InMemoryWorldStore(); await store.initializeWorld(checkpoint);
      const runtime = await LiveWorldRuntime.create({ ...f, store, mode: 'observer' });
      const before = runtime.worldSnapshot();
      const frame = await runtime.tick(0);
      expect(frame.world.vegetationSystem!.fallback).toBe(false);
      expect(frame.cardinalControl!.vegetation!.recoveries).toBe(1);
      expect(frame.world.vegetationSystem!.sites).toEqual(before.vegetationSystem!.sites);
      expect(frame.world.agents).toEqual(before.agents);
      expect(frame.world.calendar).toEqual(before.calendar);
      expect(frame.world.v16?.settlementResourcesById).toEqual(before.v16?.settlementResourcesById);
    }
  });
});
