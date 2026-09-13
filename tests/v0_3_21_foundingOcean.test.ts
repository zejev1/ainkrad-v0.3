import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import 'fake-indexeddb/auto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { LogBackedCardinalJournal } from '../src/cardinal/LogBackedCardinalJournal';
import { createIndexedDbPersistence } from '../src/persistence/IndexedDbPersistence';
import { RECOVERY_STORE, type WorldRecovery } from '../src/persistence/IndexedDbRecovery';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { CANONICAL_WORLD_QUANTUM_MINUTES as QUANTUM } from '../src/v15/WorldTimeContract';
import { createFoundingOcean, repairFoundingOcean, AINKRAD_OCEAN_ID as OCEAN } from '../src/world/FoundingOcean';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import { WORLD_MINUTES_PER_YEAR as YEAR } from '../src/world/WorldClock';
import { buildRoute, rebuildWorldRoutes, routeIdBetween } from '../src/world/WorldNavigation';
import type { WorldState } from '../src/world/types';

const seed = 'ainkrad-browser-world';
const worldId = 'ainkrad_live_world';
let beforeShore: WorldState;
let afterShore: WorldState;

function life(world: WorldState) {
  const { places: _places, routes: _routes, revision: _revision, ...preserved } = world;
  return preserved;
}

async function oldSave(snapshot: WorldState) {
  const old = structuredClone(snapshot);
  old.revision = 0;
  delete old.places[OCEAN];
  const store = new InMemoryWorldStore();
  await store.initializeWorld(old);
  return { old, store };
}

async function catchUp(runtime: LiveWorldRuntime, target: number) {
  for (let i = 0; i < 600; i++) {
    const result = await runtime.catchUpBatchTo(target, 24);
    if (result.completed) return;
  }
  throw new Error('Catch-up did not reach its bounded target.');
}

const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
});
async function rows(name: string, table: string, write?: (s: IDBObjectStore) => void) {
  const db = await request(indexedDB.open(name));
  const tx = db.transaction(table, write ? 'readwrite' : 'readonly');
  const complete = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
  if (write) write(tx.objectStore(table));
  const values = await request(tx.objectStore(table).getAll());
  await complete; db.close(); return values;
}

beforeAll(() => {
  beforeShore = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/fix10-2-before-shore.json.gz', import.meta.url))).toString());
  afterShore = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/fix10-2-after-shore.json.gz', import.meta.url))).toString());
  expect(beforeShore.epoch).toBe(2);
  expect(afterShore.places.shore).toBeDefined();
});
afterEach(() => vi.restoreAllMocks());

describe('FIX3 founding sea after a new epoch and accelerated continuation', () => {
  it('uses the same physical sea in first creation and consecutive player resets', async () => {
    const engine = await WorldEngine.create({ worldId: 'coast-epochs', seed, store: new InMemoryWorldStore() });
    expect(engine.snapshot().places[OCEAN]).toEqual(createFoundingOcean(0));
    for (let epoch = 2; epoch <= 3; epoch++) {
      await engine.resetEpoch(seed, ['Aron', 'Mira', 'Kai', 'Noa'], 'reset-' + epoch);
      const state = engine.snapshot();
      expect(state.epoch).toBe(epoch);
      expect(state.places[OCEAN]).toEqual(createFoundingOcean(state.epochStartedAt!));
      expect(state.places.shore).toBeUndefined();
      expect(state.growth.discoveredRegionIds).toEqual([]);
      for (const agent of Object.values(state.agents)) {
        expect(agent.knownPlaceIds ?? []).not.toContain(OCEAN);
      }
      expect(Object.values(state.routes).some(r => [r.fromPlaceId, r.toPlaceId].includes(OCEAN))).toBe(false);
    }
  });

  it('repairs the saved state before discovery and then crosses the formerly failing shore boundary', async () => {
    const { old, store } = await oldSave(beforeShore);
    const engine = await WorldEngine.open({ worldId, store });
    const repaired = engine.snapshot();
    expect(life(repaired)).toEqual(life(old));
    expect(repaired.revision).toBe(old.revision + 1);
    expect(repaired.places.shore).toBeUndefined();
    expect(repaired.routes).toEqual(old.routes);
    for (const [id, place] of Object.entries(old.places)) expect(repaired.places[id]).toEqual(place);
    expect(store.migrationBackups).toEqual([old]);
    expect((await WorldEngine.open({ worldId, store })).snapshot()).toEqual(repaired);
    expect(store.migrationBackups).toHaveLength(1);
    await engine.advanceCanonicalTimeTo(repaired.calendar.elapsedWorldMinutes + YEAR);
    const next = engine.snapshot();
    expect(next.growth.stage).toBeGreaterThanOrEqual(3);
    expect(next.growth.discoveredRegionIds.slice(0, 2)).toEqual(['meadow', 'forest']);
    expect(next.places[next.growth.discoveredRegionIds[2]]).toBeDefined();
    expect(next.places[OCEAN]).toBeDefined();
    expect(next.routes[routeIdBetween('shore', OCEAN)]).toBeUndefined();
  });

  it('repairs an already dangling shore link while retaining life, knowledge and travelled roads', async () => {
    const { old, store } = await oldSave(afterShore);
    expect(old.places.shore.connectedPlaceIds).toContain(OCEAN);
    const engine = await WorldEngine.open({ worldId, store });
    const repaired = engine.snapshot();
    expect(life(repaired)).toEqual(life(old));
    expect(repaired.routes).toEqual(old.routes);
    expect(repaired.places.shore).toEqual(old.places.shore);
    expect(repaired.places[OCEAN].connectedPlaceIds).toEqual(['shore']);
    expect(store.migrationBackups).toEqual([old]);
    expect((await WorldEngine.open({ worldId, store })).snapshot()).toEqual(repaired);
  });

  it('preserves an existing customised coast and an explicit boat route', () => {
    const world = structuredClone(afterShore);
    world.places[OCEAN].name = 'Recorded local sea name';
    world.places[OCEAN].fertility = .42;
    const boat = buildRoute(world.places.shore, world.places[OCEAN], 'boat', world.places);
    boat.completedTraversals = 37;
    world.routes[boat.id] = boat;
    const before = structuredClone(world);
    expect(repairFoundingOcean(world)).toBe(false);
    expect(world).toEqual(before);
    const routes = rebuildWorldRoutes(world.places, world.routes);
    expect(routes[boat.id].traversal).toBe('boat');
    expect(routes[boat.id].completedTraversals).toBe(37);
  });

  it('keeps strict validation and never replaces a save with unrelated missing geography', async () => {
    const snapshot = structuredClone(beforeShore);
    snapshot.places.outskirts.connectedPlaceIds.push('missing_unrelated_place');
    const { old, store } = await oldSave(snapshot);
    const initialize = vi.spyOn(store, 'initializeWorld');
    await expect(WorldEngine.open({ worldId, store })).rejects.toThrow('missing_unrelated_place');
    expect(await store.loadWorld(worldId)).toEqual(old);
    expect(initialize).not.toHaveBeenCalled();
  });

  it('leaves the existing world intact when its migration backup fails', async () => {
    const { old, store } = await oldSave(beforeShore);
    vi.spyOn(store, 'checkpointWorld').mockRejectedValueOnce(new Error('backup unavailable'));
    await expect(WorldEngine.open({ worldId, store })).rejects.toThrow('backup unavailable');
    expect(await store.loadWorld(worldId)).toEqual(old);
    expect(await store.history(worldId)).toEqual([]);
  });

  it.each([1, 10] as const)('continues the old epoch at year-per-minute x%s through the live clock, reload and offline catch-up', async multiplier => {
    const { old, store } = await oldSave(beforeShore);
    const options = { worldId, seed, store, controlLog: new InMemoryAppendOnlyLog(), mode: 'observer' as const, durable: true };
    const runtime = await LiveWorldRuntime.create(options);
    runtime.setWorldSpeed('year_per_minute', multiplier);
    runtime.enqueueLiveElapsed(60_000 / multiplier);
    for (let i = 0; i < 600 && runtime.liveTiming().pendingWorldMinutes > 1e-6; i++) {
      await runtime.advanceResponsive(0);
    }
    expect(runtime.liveTiming().pendingWorldMinutes).toBeLessThan(1e-6);
    expect(runtime.worldSnapshot().calendar.elapsedWorldMinutes).toBeCloseTo(old.calendar.elapsedWorldMinutes + YEAR, 5);
    expect(runtime.worldSnapshot().growth.stage).toBeGreaterThanOrEqual(3);
    const saved = runtime.worldSnapshot();
    const reopened = await LiveWorldRuntime.create(options);
    expect(reopened.worldSnapshot()).toEqual(saved);
    await catchUp(reopened, saved.calendar.elapsedWorldMinutes + YEAR);
    expect(reopened.worldSnapshot().epoch).toBe(2);
    expect(reopened.worldSnapshot().calendar.elapsedWorldMinutes).toBe(saved.calendar.elapsedWorldMinutes + YEAR);
    expect((await LiveWorldRuntime.create(options)).worldSnapshot()).toEqual(reopened.worldSnapshot());
  });

  it('preserves IndexedDB world identity and nonzero Cardinal history during repair, acceleration and reload', async () => {
    const dbName = 'fix3-ocean-continuity';
    const bundle = createIndexedDbPersistence(dbName);
    const options = { worldId, seed, store: bundle.worldStore, controlLog: bundle.controlLog, mode: 'observer' as const, durable: true };
    const runtime = await LiveWorldRuntime.create(options);
    for (let i = 0; i < 6; i++) await runtime.tick();
    await runtime.resetWorld(seed);
    await catchUp(runtime, QUANTUM * 6);
    const frame = await runtime.tick(0);
    expect(frame.evaluation!.experience.totalExperience).toBeGreaterThan(0);
    const old = structuredClone(frame.world);
    delete old.places[OCEAN]; // exact omission made by the old reset path
    await rows(dbName, 'worlds', s => s.put(old));
    const journal = await rows(dbName, 'stream_records');
    expect(journal.length).toBeGreaterThan(0);
    const recordedEvaluations = await new LogBackedCardinalJournal(bundle.controlLog).evaluations(worldId);
    const recordedExperience = Math.max(...recordedEvaluations.map(e => e.experience?.totalExperience ?? 0));
    expect(recordedExperience).toBeGreaterThan(0);
    const restored = await LiveWorldRuntime.create(options);
    expect(life(restored.worldSnapshot())).toEqual(life(old));
    expect(await rows(dbName, 'stream_records')).toEqual(journal);
    const backups = await rows(dbName, RECOVERY_STORE) as WorldRecovery[];
    expect(backups.some(b => b.state.revision === old.revision && JSON.stringify(b.state) === JSON.stringify(old))).toBe(true);
    const resumed = await restored.tick(0);
    expect(resumed.evaluation!.experience.totalExperience).toBe(recordedExperience);
    expect(await rows(dbName, 'stream_records')).toEqual(journal);
    await catchUp(restored, 3 * YEAR);
    expect(restored.worldSnapshot().growth.discoveredRegionIds.length).toBeGreaterThanOrEqual(3);
    expect(restored.worldSnapshot().places[OCEAN]).toBeDefined();
    expect(restored.worldSnapshot().epoch).toBe(2);
    expect(restored.worldSnapshot().id).toBe(worldId);
    const final = await LiveWorldRuntime.create(options);
    expect(final.worldSnapshot()).toEqual(restored.worldSnapshot());
  });
});
