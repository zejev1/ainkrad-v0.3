import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { bindWorldTerrain } from '../src/world/geography/WorldTerrain';
import { continentOutline } from '../src/world/geography/ContinentalRelief';
import { worldCalendarAtMinutes, WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';
import type { WorldState } from '../src/world/types';

const inputs = process.argv.slice(2);
assert(inputs.length > 0, 'Supply actual F2 save paths');
mkdirSync('audit-evidence', { recursive: true });
const reports: unknown[] = [];
for (const file of inputs) {
  const before = JSON.parse(readFileSync(file,'utf8')) as WorldState;
  const oldTerrain = bindWorldTerrain(before)!;
  const offshoreBefore = Object.values(before.settlements).filter(town => {
    const p = before.places[town.centerPlaceId]; return oldTerrain.sample(p.mapX,p.mapY).water;
  }).map(town => town.id);
  const store = new InMemoryWorldStore();
  await store.initializeWorld(before);
  const engine = await WorldEngine.open({worldId:before.id,store});
  const after = engine.snapshot();
  assert.deepEqual(after.agents,before.agents, 'An existing resident was rewritten during rescue');
  assert.deepEqual(after.relationships,before.relationships);
  assert.deepEqual(after.calendar,before.calendar);
  assert.deepEqual(after.determinism,before.determinism);
  assert.deepEqual(after.v15,before.v15);
  assert.deepEqual(after.v16?.familyLifecycleByPairId,before.v16?.familyLifecycleByPairId);
  assert.deepEqual(after.v16?.settlementEconomyById,before.v16?.settlementEconomyById);
  assert.deepEqual(after.v18?.secretLibrary,before.v18?.secretLibrary);
  assert.deepEqual(after.v19,before.v19);
  assert.deepEqual(after.terrain!.anchors,before.terrain!.anchors);
  assert.deepEqual(continentOutline(after.terrain!),continentOutline(before.terrain!));
  assert.deepEqual(bindWorldTerrain(after)!.reaches,oldTerrain.reaches);
  for (const [id,place] of Object.entries(before.places)) {
    assert(after.places[id], `Deleted place: ${id}`);
    assert.deepEqual([after.places[id].mapX,after.places[id].mapY],[place.mapX,place.mapY],`Relocated place: ${id}`);
  }
  for (const [id,route] of Object.entries(before.routes)) {
    assert(after.routes[id], `Deleted route: ${id}`);
    assert.equal(after.routes[id].completedTraversals,route.completedTraversals,`Lost route history: ${id}`);
    if (route.traversal === 'boat') assert.deepEqual(after.routes[id],route,`Rewrote physical voyage: ${id}`);
  }
  const newTerrain = bindWorldTerrain(after)!;
  for (const town of Object.values(after.settlements)) {
    for (const id of town.memberPlaceIds) {
      const p = after.places[id];
      if (!p || p.surface === 'water') continue;
      assert(!newTerrain.sample(p.mapX,p.mapY).water, `Still submerged: ${id}`);
      assert(!newTerrain.sample(p.mapX,p.mapY,false).water, `Overview still submerged: ${id}`);
    }
  }
  const reopened = (await WorldEngine.open({worldId:after.id,store})).snapshot();
  assert.deepEqual(reopened,after,'Rescue not idempotent on actual reopen');
  // Equivalent future across partitioning/reload. No missing decision quantum.
  const storeB = new InMemoryWorldStore(); await storeB.initializeWorld(after);
  const uninterrupted = await WorldEngine.open({worldId:after.id,store:storeB});
  const target = after.calendar.elapsedWorldMinutes + WORLD_MINUTES_PER_YEAR / 30;
  await uninterrupted.advanceCanonicalTimeTo(target);
  const storeC = new InMemoryWorldStore(); await storeC.initializeWorld(after);
  const split = await WorldEngine.open({worldId:after.id,store:storeC});
  await split.advanceCanonicalTimeTo(after.calendar.elapsedWorldMinutes + WORLD_MINUTES_PER_YEAR/60);
  const continuation = await WorldEngine.open({worldId:after.id,store:storeC});
  await continuation.advanceCanonicalTimeTo(target);
  const full = uninterrupted.snapshot(), resumed = continuation.snapshot();
  assert.deepEqual(full.agents,resumed.agents,'Resident future differs after restart');
  assert.deepEqual(full.determinism,resumed.determinism,'RNG future differs after restart');
  assert.deepEqual(full.population,resumed.population,'Demography differs after restart');
  const report = {worldId:before.id,calendar:worldCalendarAtMinutes(before.calendar.elapsedWorldMinutes),
    offshoreBefore,settlements:Object.keys(after.settlements).length,agents:Object.keys(after.agents).length,
    addedIslands:(after.terrain!.offshore?.length??0)-(before.terrain!.offshore?.length??0),
    unchangedResidentState:true,unchangedCoordinates:true,unchangedMainlandAndRivers:true,deterministicContinuation:true};
  reports.push(report); console.log(JSON.stringify(report));
  writeFileSync(`audit-evidence/${before.id}-before.json`,JSON.stringify(before));
  writeFileSync(`audit-evidence/${before.id}-after.json`,JSON.stringify(after));
}
writeFileSync('audit-evidence/rescue-audit.json',JSON.stringify(reports,null,2));
