import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const temp=process.env.RUNNER_TEMP;
const server=await createServer({server:{host:'127.0.0.1',port:4173,strictPort:true}});
await server.listen();
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:4173/index.html');
 // Stop the app worker; the harness uses its own isolated disposable world database.
 await page.goto('http://127.0.0.1:4173/diagnostic.html');
 const fixture=JSON.parse(readFileSync(join(temp,'fix5-mature.json'),'utf8'));
 await page.evaluate(async snapshot=>{
  const {createIndexedDbPersistence}=await import('/src/persistence/IndexedDbPersistence.ts');
  const {LiveWorldRuntime}=await import('/src/runtime/LiveWorldRuntime.ts');
  const p=createIndexedDbPersistence('ainkrad-disposable-fix5-profile');
  await p.worldStore.initializeWorld(snapshot);
  window.profileRuntime=await LiveWorldRuntime.create({worldId:snapshot.id,seed:'ainkrad-browser-world',mode:'intervene',store:p.worldStore,controlLog:p.controlLog,durable:true,boundedLiveAcceleration:true});
 },fixture);
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 const result=await page.evaluate(async()=>{
  const runtime=window.profileRuntime,started=performance.now();let count=0,maxMs=0;
  let cloneMs=0,cloneCount=0;const clone=window.structuredClone;
  window.structuredClone=function(...args){const t=performance.now();try{return clone(...args)}finally{cloneMs+=performance.now()-t;cloneCount++}};
  const target=runtime.worldSnapshot().calendar.elapsedWorldMinutes+525600/4;
  while(true){const t=performance.now(),b=await runtime.catchUpBatchTo(target,4);maxMs=Math.max(maxMs,performance.now()-t);count++;if(b.completed)break;}
  window.structuredClone=clone;
  return {milliseconds:performance.now()-started,batches:count,maxBatchMs:maxMs,cloneMs,cloneCount,heap:performance.memory?.usedJSHeapSize};
 });
 const {profile}=await cdp.send('Profiler.stop');
 const counts=new Map();for(let i=0;i<(profile.samples??[]).length;i++){const id=profile.samples[i];counts.set(id,(counts.get(id)??0)+(profile.timeDeltas?.[i]??0));}
 const totals=new Map();for(const n of profile.nodes){const k=n.callFrame.functionName+' '+n.callFrame.url.split('/').slice(-2).join('/')+':'+n.callFrame.lineNumber;totals.set(k,(totals.get(k)??0)+(counts.get(n.id)??0));}
 const top=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([name,us])=>({name,ms:Math.round(us/1000)}));
 const report={environment:'Chromium, real IndexedDB, CPU throttle 4x; not physical Android',...result,top};
 console.log('FIX5_BROWSER_PROFILE='+JSON.stringify(report));
 writeFileSync(join(temp,'fix5-browser-profile.json'),JSON.stringify(report,null,2));
 writeFileSync(join(temp,'fix5-profile.cpuprofile'),JSON.stringify(profile));
}finally{await browser.close();await server.close();}
