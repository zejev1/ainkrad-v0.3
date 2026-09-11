import { execFileSync } from 'node:child_process';
import { mkdirSync,writeFileSync,symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const temp=process.env.RUNNER_TEMP!,root=process.cwd(),base=join(temp,'fix5-baseline');
execFileSync('git',['worktree','add','--detach',base,'339970d2b2ca0545415b11460bb58b7c164915f4'],{stdio:'pipe'});
symlinkSync(join(root,'node_modules'),join(base,'node_modules'),'dir');
const {LiveWorldRuntime}=await import(pathToFileURL(join(base,'src/runtime/LiveWorldRuntime.ts')).href);
const runtime=await LiveWorldRuntime.create({worldId:'ainkrad_live_world',seed:'ainkrad-browser-world',mode:'intervene',boundedLiveAcceleration:true});
while(!(await runtime.catchUpBatchTo(27*525600,24)).completed){}
const snapshot=runtime.worldSnapshot();snapshot.revision=0;
mkdirSync(join(temp,'fix5-browser'),{recursive:true});
writeFileSync(join(temp,'fix5-browser','world.json'),JSON.stringify(snapshot));
console.log('FIX5_BROWSER_FIXTURE='+JSON.stringify({baseline:'339970d2b2ca0545415b11460bb58b7c164915f4',year:27,living:Object.values(snapshot.agents).filter((a:any)=>a.life.alive).length,bytes:JSON.stringify(snapshot).length}));
