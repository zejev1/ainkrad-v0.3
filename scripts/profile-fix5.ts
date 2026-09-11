import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { WORLD_MINUTES_PER_YEAR as YEAR } from '../src/world/WorldClock';
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const temp=process.env.RUNNER_TEMP!;
const probe=join(temp,'fix5-io');writeFileSync(probe,'ok');assert.equal(readFileSync(probe,'utf8'),'ok');rmSync(probe);
console.log('FIX5_ENVIRONMENT_IO=passed');
const runtime=await LiveWorldRuntime.create({worldId:'fix5-profile',seed:'ainkrad-browser-world',mode:'intervene',boundedLiveAcceleration:true});
while(!(await runtime.catchUpBatchTo(27*YEAR,24)).completed){}
const snapshot=runtime.worldSnapshot();snapshot.revision=0;
writeFileSync(join(temp,'fix5-mature.json'),JSON.stringify(snapshot));
console.log('FIX5_FIXTURE='+JSON.stringify({living:Object.values(snapshot.agents).filter(a=>a.life.alive).length,bytes:JSON.stringify(snapshot).length}));
