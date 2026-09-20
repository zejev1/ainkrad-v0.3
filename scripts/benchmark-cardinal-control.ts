import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const [baseline, output] = process.argv.slice(2);
assert(baseline && output);
const load = (root: string, path: string) => import(pathToFileURL(resolve(root, path)).href);
const implementations = await Promise.all([baseline, '.'].map(async root => ({
  Runtime: (await load(root, 'src/runtime/LiveWorldRuntime.ts')).LiveWorldRuntime,
  Store: (await load(root, 'src/world/InMemoryWorldStore.ts')).InMemoryWorldStore,
  Log: (await load(root, 'src/persistence/AppendOnlyLog.ts')).InMemoryAppendOnlyLog,
})));
const samples = [[], []] as Array<Array<{ ms: number; cpuMs: number; heapDelta: number }>>;
let expected: any;
for (let round = -1; round < 5; round++) {
  for (const i of round % 2 ? [1, 0] : [0, 1]) {
    const impl = implementations[i], store = new impl.Store(), log = new impl.Log();
    const runtime = await impl.Runtime.create({ worldId: 'control-performance', seed: 'control-performance',
      mode: 'intervene', store, controlLog: log });
    // Identical one-year simulation, observation cadence, history and persistence.
    const cpu = process.cpuUsage(), heap = process.memoryUsage().heapUsed, start = performance.now();
    for (let q = 0; q < 60; q++) await runtime.tick(8760);
    const ms = performance.now() - start, used = process.cpuUsage(cpu);
    if (round >= 0) samples[i].push({ ms, cpuMs: (used.user + used.system) / 1000, heapDelta: process.memoryUsage().heapUsed - heap });
    const state = runtime.worldSnapshot();
    const actual = { state, events: [...store.eventsById.entries()], memories: [...store.memoriesById.entries()] };
    if (!expected) expected = actual;
    else assert.deepEqual(actual, expected, 'Physical world, events or resident memories changed');
    const reopened = await impl.Runtime.create({ worldId: 'control-performance', seed: 'control-performance', mode: 'intervene', store, controlLog: log });
    assert.deepEqual(reopened.worldSnapshot(), state);
  }
}
const median = (values: number[]) => values.sort((a,b) => a-b)[Math.floor(values.length / 2)];
const result = { baselineCommit: 'bddb5e73ae1cd7565c06753467149e0c5bee7eea', worldMinutes: 525600,
  environment: `Node ${process.version}; in-memory persistence; local container, not physical Android`,
  exactWorldEventsMemoriesAndReloadEquality: true,
  measurements: samples.map((runs, i) => ({ name: i ? 'cardinal_weather_control' : 'accepted_weather_agent',
    medianMs: median(runs.map(r => r.ms)), medianCpuMs: median(runs.map(r => r.cpuMs)), runs })),
  memoryNote: 'Heap deltas contain garbage-collector noise. Hot journal view is bounded to 8; healthy checks write no history.',
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
