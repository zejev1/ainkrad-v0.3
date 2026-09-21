import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const [baseline, output, persistence = 'memory'] = process.argv.slice(2);
assert(baseline && output);
if(persistence==='indexeddb') await import('fake-indexeddb/auto');
const load = (root: string, path: string) => import(pathToFileURL(resolve(root, path)).href);
const implementations = await Promise.all([baseline, '.'].map(async root => ({
  Runtime: (await load(root, 'src/runtime/LiveWorldRuntime.ts')).LiveWorldRuntime,
  Store: (await load(root, 'src/world/InMemoryWorldStore.ts')).InMemoryWorldStore,
  Log: (await load(root, 'src/persistence/AppendOnlyLog.ts')).InMemoryAppendOnlyLog,
  persistence: (await load(root,'src/persistence/IndexedDbPersistence.ts')).createIndexedDbPersistence,
  Weather: (await load(root,'src/world/systems/WeatherSystemAgent.ts')).WeatherSystemAgent,
})));
let databaseSequence=0;
function stores(impl:any){
  if(persistence==='indexeddb') { const p=impl.persistence(`water-audit-${++databaseSequence}`);return {store:p.worldStore,controlLog:p.controlLog}; }
  return {store:new impl.Store(),controlLog:new impl.Log()};
}
async function memories(store:any,state:any){return (await Promise.all(Object.keys(state.agents).map(id=>store.historyForAgent(state.id,id)))).flat();}
const digest=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function lifeEvidence(state:any){const agents:any[]=Object.values(state.agents);return {
  ageYears:agents.reduce((n,a)=>n+a.life.ageYears,0),activeJourneys:agents.filter(a=>a.movement).length,
  evaluatedLearningAttempts:agents.reduce((n,a)=>n+(a.learning?.totalEvaluated??0),0),
  retainedMethods:agents.reduce((n,a)=>n+(a.learning?.methods?.length??0),0),
  knownPlaces:agents.reduce((n,a)=>n+(a.knownPlaceIds?.length??0),0),learningSequence:state.v15?.learningSequence,
  knowledgeDigest:digest(state.v15?.knowledgeByAgentId),mapDigest:digest([state.cartography,agents.map(a=>[a.id,a.cartography])]),
  familyPairs:Object.keys(state.v16?.familyLifecycleByPairId??{}).length,
  pregnancies:Object.values(state.v16?.familyLifecycleByPairId??{}).filter((p:any)=>p.stage==='pregnant').length,
  familyDigest:digest([agents.map(a=>[a.id,a.life.parentIds,a.life.childIds]),state.v15?.familyAgencyByAgentId,state.v16?.familyLifecycleByPairId]),
  learningDigest:digest(agents.map(a=>[a.id,a.learning,a.skills])),
};}
// Prefix-hash/cache/batch optimizations must preserve the accepted physical weather exactly.
const oldWeather=new implementations[0].Weather(),newWeather=new implementations[1].Weather();
for(const id of ['weather-audit','очень-длинный-идентификатор'])for(const epoch of [1,4])for(const minute of [0,8760,200000,525600])for(let i=0;i<320;i++){
  const site={x:i*430-50000,y:(i%29)*3000-40000,elevationM:i*13,moisture:(i%10)/10,maritime:(i%11)/11,upwindElevationM:i*3};
  assert.deepEqual(newWeather.sampleAt({id,epoch,volatility:0.3},minute,site),oldWeather.sampleAt({id,epoch,volatility:0.3},minute,site));
}
const samples: any[][] = [[], []];
const outcomes: any[] = [];
// Five alternating warmups let both implementations compile hot paths before
// process CPU (which also includes background JIT/GC) is compared.
const warmupRounds=5;
for (let round = -warmupRounds; round < 5; round++) {
  for (const i of round % 2 ? [1, 0] : [0, 1]) {
    const impl = implementations[i], {store,controlLog}=stores(impl);
    const options = { worldId: 'vegetation-performance', seed: 'vegetation-performance', mode: 'observer', store, controlLog };
    const runtime = await impl.Runtime.create(options);
    global.gc?.(); // Both implementations start with the same explicit GC boundary.
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
      memories: (await memories(store,state)).length, ...lifeEvidence(state), stateBytes: Buffer.byteLength(JSON.stringify(state)),
      hydrologyBytes: state.hydrologySystem ? Buffer.byteLength(JSON.stringify(state.hydrologySystem)) : 0,
      waterReservoirs: Object.keys(state.hydrologySystem?.units ?? {}).length,
      vegetationBytes: state.vegetationSystem ? Buffer.byteLength(JSON.stringify(state.vegetationSystem)) : 0 };
  }
}
// Fair control: both modes execute exactly the SAME ecology, including fallback.
const impl = implementations[1], runs = [];
for (const mode of ['observer', 'off']) {
  const {store,controlLog}=stores(impl);
  const runtime = await impl.Runtime.create({ worldId: 'vegetation-paired', seed: 'vegetation-paired', mode, store, controlLog });
  for (let q = 0; q < 60; q++) await runtime.tick(8760);
  runs.push({ state: runtime.worldSnapshot(), events: await store.history('vegetation-paired'), memories: await memories(store,runtime.worldSnapshot()) });
}
assert.deepEqual(runs[0], runs[1], 'Cardinal changed autonomous life');
const median = (values: number[]) => values.sort((a,b) => a-b)[Math.floor(values.length / 2)];
const result = { baselineCommit: execFileSync('git', ['-C', baseline, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), worldMinutes: 525600,
  environment: `Node ${process.version}; ${persistence==='indexeddb'?'real IndexedDb adapter with fake-indexeddb':'in-memory store'}; not physical Android`,
  exactAcceptedRegionalWeatherEquality:true,
  gcBeforeEachMeasurement:Boolean(global.gc),warmupRounds,
  exactCardinalOnOffWorldEventsMemoriesEquality: true, exactSaveReloadEquality: true,
  physicsNote: 'Finite hydrology is a user-authorized simulation change. Equality to old ecology is not claimed; the canonical opportunity schedule and Spark implementations are unchanged.',
  measurements: samples.map((runs, i) => ({ name: i ? 'hydrology_f14' : 'accepted_f13',
    medianMs: median(runs.map(r => r.ms)), medianCpuMs: median(runs.map(r => r.cpuMs)), runs, outcomes: outcomes[i] })),
  memoryNote: 'Heap deltas include GC noise. Hydrology adds finite records per physical basin/site, latest fluxes and cumulative budgets. Condition transitions remain committed history; no per-frame hydrology history.',
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
