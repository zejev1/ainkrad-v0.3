import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

// node --import tsx scripts/benchmark-weather.ts BASELINE_DIR V1_DIR OUTPUT_JSON
// Both reference directories must be unmodified git archives of the recorded SHAs.
const [baselineDir, v1Dir, output] = process.argv.slice(2);
assert(baselineDir && v1Dir && output);
const moduleAt = (root: string, file: string) => import(pathToFileURL(resolve(root, file)).href);
const roots = { baseline: baselineDir, firstAgent: v1Dir, optimized: '.' };
const implementations = await Promise.all(Object.entries(roots).map(async ([name, root]) => ({
  name,
  weather: (await moduleAt(root, 'src/v21/WeatherV21.ts')).worldWeatherV21,
  Engine: (await moduleAt(root, 'src/world/WorldEngine.ts')).WorldEngine,
  Store: (await moduleAt(root, 'src/world/InMemoryWorldStore.ts')).InMemoryWorldStore,
})));
const median = (values: number[]) => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)];
const queryWorld = { id: 'weather-performance', epoch: 1, calendar: { elapsedWorldMinutes: 8760 },
  governance: { laws: { weather_volatility: { value: 0.2 } } } };
const queries = 200_000;
const micro: Record<string, unknown> = {};
let consumed = 0;
for (const [scenario, minute] of Object.entries({ repeated: (_i: number) => 8760,
  alternating: (i: number) => 8760 + i % 2, unique: (i: number) => i })) {
  const samples: Record<string, number[]> = Object.fromEntries(implementations.map(x => [x.name, []]));
  for (const impl of implementations) for (let i=0;i<10_000;i++) consumed += impl.weather(queryWorld, minute(i)).severity;
  for (let round=0;round<5;round++) {
    for (const impl of round % 2 ? [...implementations].reverse() : implementations) {
      const started = performance.now();
      for (let i=0;i<queries;i++) consumed += impl.weather(queryWorld, minute(i)).severity;
      samples[impl.name].push(performance.now()-started);
    }
  }
  micro[scenario] = Object.fromEntries(Object.entries(samples).map(([name, ms]) => [name, { medianMs: median(ms), samplesMs: ms }]));
}
console.log('MICRO', JSON.stringify(micro));

const options = { worldId: 'weather-performance', seed: 'weather-performance', startTime: 0 };
const referenceStore = new implementations[0].Store();
const reference = await implementations[0].Engine.create({ ...options, store: referenceStore });
const checkpoint = reference.snapshot();
const worldMeasurements: Record<string, { ms: number[]; cpuMs: number[]; heapDeltaBytes: number[] }> =
  Object.fromEntries(implementations.map(x => [x.name, { ms: [], cpuMs: [], heapDeltaBytes: [] }]));
let expected: unknown;
let finalPopulation = 0;
for (let round=0;round<5;round++) {
  for (const impl of round % 2 ? [...implementations].reverse() : implementations) {
    const store = new impl.Store();
    await store.initializeWorld(structuredClone(checkpoint));
    const engine = await impl.Engine.open({ worldId: options.worldId, store });
    // Same one-year warm-up, then one year in four equal commit batches.
    await engine.advanceCanonicalTimeTo(525600);
    const cpu = process.cpuUsage(), heap = process.memoryUsage().heapUsed, started = performance.now();
    for (let quarter=1;quarter<=4;quarter++) await engine.advanceCanonicalTimeTo(525600+131400*quarter);
    const elapsed = performance.now()-started, used = process.cpuUsage(cpu);
    worldMeasurements[impl.name].ms.push(elapsed);
    worldMeasurements[impl.name].cpuMs.push((used.user+used.system)/1000);
    worldMeasurements[impl.name].heapDeltaBytes.push(process.memoryUsage().heapUsed-heap);
    const state = engine.snapshot();
    delete state.weatherSystem; // The sole additive infrastructure field, not resident history.
    const semantic = { state, events: [...store.eventsById.entries()], memories: [...store.memoriesById.entries()] };
    if (expected === undefined) expected = semantic;
    else assert.deepEqual(semantic, expected, `${impl.name}: world history changed`);
    const reopened = await impl.Engine.open({ worldId: options.worldId, store });
    const reloaded = reopened.snapshot(); delete reloaded.weatherSystem;
    assert.deepEqual(reloaded, state, 'Save/reload changed world state');
    finalPopulation = Object.values(state.agents).filter((a: any) => a.life.alive).length;
  }
}
const report = {
  environment: `Node ${process.version}; local container; in-memory persistence; not Android/browser FPS`,
  baselineCommit: '5019f6eb48dca6a62adf5e9329360e132b203208',
  firstAgentCommit: '22c93de04c59ec2805c16f67996a32f18059e4da',
  queriesPerMicroSample: queries, repetitions: 5, micro,
  world: Object.fromEntries(Object.entries(worldMeasurements).map(([name, values]) => [name,
    { medianMs: median(values.ms), medianCpuMs: median(values.cpuMs), ...values }])),
  measuredWorldMinutes: 525600, finalPopulation, exactHistoryAndEventsAndMemoriesEqual: true,
  saveReloadEqual: true,
  memoryNote: 'Heap deltas include GC noise; cache-size bounds are checked separately, not inferred from these samples.',
  consumed,
};
writeFileSync(output, JSON.stringify(report, null, 2)+'\n');
console.log('WORLD', JSON.stringify(report.world));
console.log('Exact world, event, memory and reload equality: PASS');
