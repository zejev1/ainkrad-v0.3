import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const base = process.argv[2];
assert(base, 'Pass the detached base checkout path.');
const moduleAt = (path: string) => import(pathToFileURL(resolve(base, path)).href);
const { LiveWorldRuntime } = await moduleAt('src/runtime/LiveWorldRuntime.ts');
const { InMemoryWorldStore } = await moduleAt('src/world/InMemoryWorldStore.ts');
const { InMemoryAppendOnlyLog } = await moduleAt('src/persistence/AppendOnlyLog.ts');
const store = new InMemoryWorldStore();
const worldId = 'ainkrad_live_world';
const runtime = await LiveWorldRuntime.create({
  worldId, seed: 'ainkrad-browser-world', mode: 'observer',
  store, controlLog: new InMemoryAppendOnlyLog(), durable: true,
});
await runtime.resetWorld();
assert.equal(runtime.worldSnapshot().epoch, 2);
assert.equal(runtime.worldSnapshot().places.ocean_ainkrad, undefined);
runtime.setWorldSpeed('year_per_minute', 1);
let reproduced = false;
for (let i = 0; i < 600; i++) {
  try { await runtime.tick(); }
  catch (error) {
    assert.equal((error as Error).message, 'World place shore references missing connection ocean_ainkrad.');
    const saved = await store.loadWorld(worldId);
    assert.deepEqual(saved, runtime.worldSnapshot(), 'Failed expansion must not replace the saved world.');
    const result = {
      message: (error as Error).message, epoch: saved.epoch, revision: saved.revision,
      worldMinutes: saved.calendar.elapsedWorldMinutes, growthStage: saved.growth.stage,
      lastCommittedStatePreserved: true,
    };
    writeFileSync(resolve(process.env.RUNNER_TEMP!, 'ainkrad-shore-reproduction.json'), JSON.stringify(result));
    console.log('BASELINE_SHORE_FAILURE_REPRODUCED=' + JSON.stringify(result));
    reproduced = true; break;
  }
}
assert(reproduced, 'Baseline must reproduce the reported missing-ocean failure.');
