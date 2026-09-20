import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';

const [baseline, output] = process.argv.slice(2);
assert(baseline && output);
const load = (root: string, path: string) => import(pathToFileURL(resolve(root, path)).href);
const implementations = await Promise.all([baseline, '.'].map(async root => ({
  Runtime: (await load(root, 'src/runtime/LiveWorldRuntime.ts')).LiveWorldRuntime,
  Store: (await load(root, 'src/world/InMemoryWorldStore.ts')).InMemoryWorldStore,
  Log: (await load(root, 'src/persistence/AppendOnlyLog.ts')).InMemoryAppendOnlyLog,
})));
const samples: any[][] = [[], []];
const outcomes: any[] = [];
for (let round = -1; round < 5; round++) {
  for (const i of round % 2 ? [1, 0] : [0, 1]) {
    const impl = implementations[i], store = new impl.Store(), controlLog = new impl.Log();
    const options = { worldId: 'vegetation-performance', seed: 'vegetation-performance', mode: 'observer', store, controlLog };
    const runtime = await impl.Runtime.create(options);
    const cpu = process.cpuUsage(), heap = process.memoryUsage().heapUsed, start = performance.now();
    for (let q = 0; q < 60; q++) await runtime.tick(8760);
    const ms = performance.now() - start, used = process.cpuUsage(cpu);
    if (round >= 0) samples[i].push({ ms, cpuMs: (used.user + used.system) / 1000, heapDelta: process.memoryUsage().heapUsed - heap });
    const state = runtime.worldSnapshot(), events = await store.history(options.worldId);
    const reopened = await impl.Runtime.create(options);
    assert.deepEqual(reopened.worldSnapshot(), state, 'Reload changed the lived world');
    outcomes[i] = { living: Object.values(state.agents).filter((a: any) => a.life.alive).length,
      residents: Object.keys(state.agents).length, births: events.filter((e: any) => e.kind.includes('birth')).length,
      deaths: events.filter((e: any) => e.kind.includes('death')).length,
      actionEvents: events.filter((e: any) => e.kind.startsWith('agent.')).length,
      explorationEvents: events.filter((e: any) => /explor|discover|moved/.test(e.kind)).length,
      memories: store.memoriesById.size, stateBytes: Buffer.byteLength(JSON.stringify(state)),
      vegetationBytes: state.vegetationSystem ? Buffer.byteLength(JSON.stringify(state.vegetationSystem)) : 0 };
  }
}
// Fair control: both modes execute exactly the SAME ecology, including fallback.
const impl = implementations[1], runs = [];
for (const mode of ['observer', 'off']) {
  const store = new impl.Store(), controlLog = new impl.Log();
  const runtime = await impl.Runtime.create({ worldId: 'vegetation-paired', seed: 'vegetation-paired', mode, store, controlLog });
  for (let q = 0; q < 60; q++) await runtime.tick(8760);
  runs.push({ state: runtime.worldSnapshot(), events: await store.history('vegetation-paired'), memories: [...store.memoriesById] });
}
assert.deepEqual(runs[0], runs[1], 'Cardinal changed autonomous life');
const median = (values: number[]) => values.sort((a,b) => a-b)[Math.floor(values.length / 2)];
const result = { baselineCommit: execFileSync('git', ['-C', baseline, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), worldMinutes: 525600,
  environment: `Node ${process.version}; local in-memory store; not physical Android`,
  exactCardinalOnOffWorldEventsMemoriesEquality: true, exactSaveReloadEquality: true,
  physicsNote: 'Regional climate is a user-authorized simulation change. Equality to old ecology is not claimed; the canonical opportunity schedule and Spark implementations are unchanged.',
  measurements: samples.map((runs, i) => ({ name: i ? 'regional_weather_and_pause' : 'accepted_vegetation_f12',
    medianMs: median(runs.map(r => r.ms)), medianCpuMs: median(runs.map(r => r.cpuMs)), runs, outcomes: outcomes[i] })),
  memoryNote: 'Heap deltas include GC noise. Persistent vegetation is bounded by physical sites × catalog species; no per-render history or full per-tree population.',
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
