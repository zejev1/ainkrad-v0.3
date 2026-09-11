import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const temp=process.env.RUNNER_TEMP,output=join(temp,'fix5-browser');
const fixture=JSON.parse(readFileSync(join(output,'world.json'),'utf8'));
const browser=await chromium.launch({headless:true}),results={};
try {
 for(const [name,root,batch] of [['baseline',join(temp,'fix5-baseline'),4],['fix5',process.cwd(),8]]) {
  const server=await createServer({root,server:{host:'127.0.0.1',port:4183,strictPort:true}});
  await server.listen();results[name]=[];
  try {
   for(let sample=0;sample<3;sample++) {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage();
    await page.route('**/__profile',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Disposable performance test</title>'}));
    await page.goto('http://127.0.0.1:4183/__profile');
    await page.evaluate(async snapshot=>{
     const {createIndexedDbPersistence}=await import('/src/persistence/IndexedDbPersistence.ts');
     const {LiveWorldRuntime}=await import('/src/runtime/LiveWorldRuntime.ts');
     const bundle=createIndexedDbPersistence('ainkrad-disposable-fix5-performance');
     await bundle.worldStore.initializeWorld(snapshot);
     window.runtime=await LiveWorldRuntime.create({worldId:snapshot.id,seed:'ainkrad-browser-world',mode:'intervene',store:bundle.worldStore,controlLog:bundle.controlLog,durable:true,boundedLiveAcceleration:true});
     if(window.runtime.setCooperativeExecution) {
       const {cooperativeWorldTimeExecution}=await import('/src/world/WorldTimeExecution.ts');
       window.runtime.setCooperativeExecution(cooperativeWorldTimeExecution(()=>false));
     }
    },fixture);
    const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    const measured=await page.evaluate(async batch=>{
     const runtime=window.runtime,target=runtime.worldContinuityPosition().elapsedWorldMinutes+525600/4;
     let cloneCount=0,cloneMs=0,batches=0,maxBatchMs=0;
     const original=window.structuredClone;
     window.structuredClone=function(...args){const t=performance.now();try{return original(...args)}finally{cloneCount++;cloneMs+=performance.now()-t;}};
     const start=performance.now();
     while(true){const t=performance.now(),r=await runtime.catchUpBatchTo(target,batch);maxBatchMs=Math.max(maxBatchMs,performance.now()-t);batches++;if(r.completed)break;}
     const milliseconds=performance.now()-start;window.structuredClone=original;
     return {milliseconds,cloneCount,cloneMs,batches,maxBatchMs,heap:performance.memory?.usedJSHeapSize,
       actualMinutes:runtime.worldContinuityPosition().elapsedWorldMinutes,target};
    },batch);
    assert.equal(measured.actualMinutes,measured.target);
    results[name].push(measured);await context.close();
   }
  } finally {await server.close();}
 }
 const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
 const baselineMs=median(results.baseline.map(r=>r.milliseconds)),fix5Ms=median(results.fix5.map(r=>r.milliseconds));
 const report={status:'passed',environment:'Chromium native IndexedDB, 4x CPU slowdown; three fresh-profile samples per version; not Android/Xbox',
   base:'339970d2b2ca0545415b11460bb58b7c164915f4',fixtureYears:27,living:Object.values(fixture.agents).filter(a=>a.life.alive).length,
   intervalYears:.25,baselineMs,fix5Ms,ratio:baselineMs/fix5Ms,
   caveat:'FIX5 migrates physical geography before timing; future life outcomes may consequently differ. Exact resident history across scheduling partitions is checked separately.',samples:results};
 console.log('FIX5_BROWSER_PERFORMANCE='+JSON.stringify(report));
 writeFileSync(join(output,'performance.json'),JSON.stringify(report,null,2));
} finally {await browser.close();}
