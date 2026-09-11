import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Session } from 'node:inspector';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';

const temp = process.env.RUNNER_TEMP;
assert(temp);
const probe = join(temp, 'ainkrad-fix4-io.txt');
writeFileSync(probe, 'commands-read-write-ok');
assert.equal(readFileSync(probe, 'utf8'), 'commands-read-write-ok');
rmSync(probe);
console.log('ENVIRONMENT_IO=passed');
const runtime = await LiveWorldRuntime.create({ worldId: 'fix4-profile', seed: 'ainkrad-browser-world',
  mode: 'intervene', store: new InMemoryWorldStore(), controlLog: new InMemoryAppendOnlyLog(),
  worldSpeedId: 'century_per_minute', worldSpeedMultiplier: 1 });
runtime.enqueueLiveElapsed(60_000);
const queuedBefore = runtime.liveTiming().pendingWorldMinutes;
runtime.setWorldSpeed('real_time', 1);
console.log('SPEED_CHANGE=' + JSON.stringify({ yearsBefore: queuedBefore / WORLD_MINUTES_PER_YEAR,
  yearsAfter: runtime.liveTiming().pendingWorldMinutes / WORLD_MINUTES_PER_YEAR }));
const warmStarted = performance.now();
const target = WORLD_MINUTES_PER_YEAR * 27;
while (!(await runtime.catchUpBatchTo(target, 24)).completed) { /* every semantic quantum */ }
console.log('MATURE_WORLD=' + JSON.stringify({ seconds: (performance.now()-warmStarted)/1000,
  living: Object.values(runtime.worldSnapshot().agents).filter(a=>a.life.alive).length,
  places: Object.keys(runtime.worldSnapshot().places).length }));
writeFileSync(join(temp,'ainkrad-profile-world.json'), JSON.stringify(runtime.worldSnapshot()));
const session = new Session(); session.connect();
const post = (method: string) => new Promise<any>((resolve,reject) => session.post(method as any,(error, result)=>error?reject(error):resolve(result)));
await post('Profiler.enable'); await post('Profiler.start');
const started=performance.now(); let batches=0;
while (!(await runtime.catchUpBatchTo(target+WORLD_MINUTES_PER_YEAR, 1)).completed) batches++;
const seconds=(performance.now()-started)/1000;
const { profile } = await post('Profiler.stop'); session.disconnect();
writeFileSync(join(temp,'ainkrad-fix4-baseline.cpuprofile'),JSON.stringify(profile));
const counts = new Map<number,number>();
for(const id of profile.samples ?? []) counts.set(id,(counts.get(id)??0)+1);
const hot = profile.nodes.map((n:any)=>({name:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber+1,
  samples:counts.get(n.id)??0})).sort((a:any,b:any)=>b.samples-a.samples).slice(0,25);
console.log('BASELINE_PROFILE='+JSON.stringify({seconds,batches:batches+1,hot}));
