import { chromium } from 'playwright';
import { preview } from 'vite';
import { readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const output=join(process.env.RUNNER_TEMP,'fix5-browser'),fixture=JSON.parse(readFileSync(join(output,'world.json'),'utf8'));
const server=await preview({preview:{host:'127.0.0.1',port:4173,strictPort:true}});
const browser=await chromium.launch({headless:true});
const report={environment:'Production bundle in Chromium; mobile viewport 390x844; not physical Android or Xbox',checks:[],screenshots:[]};
try {
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/__seed',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Disposable fixture</title>'}));
 await page.goto('http://127.0.0.1:4173/');
 await page.waitForFunction(()=>document.getElementById('live-label')?.textContent?.startsWith('МИР '),{},{timeout:30000});
 await page.goto('http://127.0.0.1:4173/__seed');
 // This is a disposable origin/profile, never a user database. The first page
 // creates the real schema; the old-version world below exercises migration.
 await page.evaluate(async world=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('ainkrad-v0-3-browser-world-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const tx=db.transaction([...db.objectStoreNames],'readwrite');
  for(const name of db.objectStoreNames)tx.objectStore(name).clear();
  tx.objectStore('worlds').put(world);tx.objectStore('world_identity').put({id:world.id,epoch:world.epoch??1,revision:world.revision,nextBackup:0});
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
  localStorage.clear();
  localStorage.setItem('ainkrad-v0.3.external-clock',JSON.stringify({speedId:'real_time',multiplier:1}));
  localStorage.setItem('ainkrad-v0.3.offline-clock-anchor',JSON.stringify({version:'ainkrad-offline-world-clock-2',worldEpoch:world.epoch??1,worldMinutes:world.calendar.elapsedWorldMinutes,wallClockMs:Date.now(),speedId:'real_time',multiplier:1,clockRevision:0,backgroundMode:'real_time'}));
 },fixture);
 await page.goto('http://127.0.0.1:4173/');
 await page.waitForFunction(()=>/^МИР (ЖИВ|ПРОД)/.test(document.getElementById('live-label')?.textContent??''),{},{timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll('#settlement-picker option').length>2);
 assert.equal(await page.locator('.eyebrow').first().innerText(),'v0.3.21.5');
 assert.equal(await page.locator('.developer-diagnostics').getAttribute('open'),null);
 assert(!/игровые минуты|видимые жители|путь к underworld/i.test(await page.locator('body').innerText()));
 assert.equal(await page.locator('.world-notice').isVisible(),false);
 report.checks.push('old main world loaded and migrated; observer header and hidden diagnostics');
 async function snapshot(){return page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('ainkrad-v0-3-browser-world-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const state=await new Promise((resolve,reject)=>{const r=db.transaction('worlds').objectStore('worlds').get('ainkrad_live_world');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return state;});}
 const loaded=await snapshot();
 assert.equal(loaded.id,fixture.id);assert.equal(loaded.epoch,fixture.epoch);
 assert(loaded.calendar.elapsedWorldMinutes>=fixture.calendar.elapsedWorldMinutes);
 assert.deepEqual(Object.keys(loaded.agents).sort(),Object.keys(fixture.agents).sort());
 assert.equal(loaded.determinism.rngState,fixture.determinism.rngState);
 for(const id of Object.keys(fixture.agents))for(const key of ['life','identity','knowledge','family','memories'])
   if(fixture.agents[id][key]!==undefined)assert.deepEqual(loaded.agents[id][key],fixture.agents[id][key],id+':'+key);
 report.checks.push('migration preserves resident records, world identity, RNG and lived calendar');
 async function shot(name,locator){const bytes=await (locator??page).screenshot({animations:'disabled',type:'png'});writeFileSync(join(output,name+'.png'),bytes);console.log('FIX5_SCREENSHOT_'+name.toUpperCase()+'='+bytes.toString('base64'));report.screenshots.push(name);}
 await page.evaluate(()=>window.scrollTo(0,0));await shot('header');
 const map=page.locator('#world-map-viewport');
 await page.locator('#map-city-focus').click();await map.scrollIntoViewIfNeeded();await page.waitForTimeout(180);
 await shot('city',map);
 assert((await page.locator('.map-place[data-place-id]').count())<=180);
 const townOptions=await page.locator('#settlement-picker option').evaluateAll(options=>options.filter(o=>o.value).map(o=>({value:o.value,label:o.textContent})));
 const beforeSelect=await snapshot();
 await page.locator('#settlement-picker select').selectOption(townOptions.at(-1).value);
 await page.waitForTimeout(150);await shot('other_town',map);
 const afterSelect=await snapshot();
 assert.equal(afterSelect.determinism.rngState,beforeSelect.determinism.rngState);
 assert.deepEqual(afterSelect.agents,beforeSelect.agents);
 assert.deepEqual(afterSelect.places,beforeSelect.places);
 report.checks.push('settlement selection leaves residents, RNG and physical world unchanged');
 await page.locator('#map-city-focus').click();
 for(let i=0;i<7;i++)await page.locator('#map-zoom-in').click();
 await map.scrollIntoViewIfNeeded();await page.waitForTimeout(150);await shot('close',map);
 await page.locator('#map-zoom-fit').click();await map.scrollIntoViewIfNeeded();await page.waitForTimeout(150);await shot('world',map);
 let maxSurface=0,maxPlaces=0,maxResidents=0;
 for(let i=0;i<12;i++){
  await page.locator(i%2?'#map-city-focus':'#map-zoom-fit').click();
  await map.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');await page.waitForTimeout(40);
  const sizes=await page.locator('#world-map-stage,#world-map').evaluateAll(elements=>elements.map(e=>({w:e.clientWidth,h:e.clientHeight})));
  for(const size of sizes){assert(size.w<=1280&&size.h<=800,JSON.stringify(size));maxSurface=Math.max(maxSurface,size.w*size.h);}
  maxPlaces=Math.max(maxPlaces,await page.locator('.map-place').count());maxResidents=Math.max(maxResidents,await page.locator('.resident-avatar').count());
 }
 assert(maxPlaces<=180);assert(maxResidents<=120);
 // Real touch events pass through the production gesture handlers.
 await page.locator('#map-city-focus').click();await map.scrollIntoViewIfNeeded();
 const cdp=await context.newCDPSession(page),box=await map.boundingBox();
 const x=box.x+box.width/2,y=box.y+box.height/2,zoomBefore=await page.locator('#map-zoom-fit').innerText();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-65,y,id:1},{x:x+65,y,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(100);
 const zoomAfter=await page.locator('#map-zoom-fit').innerText();assert.notEqual(zoomAfter,zoomBefore);
 report.checks.push('touch pinch and keyboard camera controls; bounded map surfaces and visible nodes');
 const stop=page.getByRole('button',{name:'Остановить догон',exact:true});
 await page.locator('#world-speed-select').selectOption('century_per_minute');await page.waitForTimeout(2000);
 const start=performance.now();await stop.click();await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Остановить догон');return b&&!b.disabled&&document.getElementById('world-speed-select').value==='real_time';},{},{timeout:10000});
 report.stopAcknowledgementMs=performance.now()-start;
 const stopped=await snapshot();await page.reload();
 await page.waitForFunction(()=>/^МИР (ЖИВ|ПРОД)/.test(document.getElementById('live-label')?.textContent??''),{},{timeout:30000});
 const reopened=await snapshot();assert.equal(reopened.id,stopped.id);assert.equal(reopened.epoch,stopped.epoch);
 assert(reopened.calendar.elapsedWorldMinutes>=stopped.calendar.elapsedWorldMinutes);
 assert(reopened.calendar.elapsedWorldMinutes-stopped.calendar.elapsedWorldMinutes<8760,'Reload resurrected an accelerated queue.');
 assert.equal(await page.locator('#catch-up-overlay').isVisible(),false);
 assert.equal(await page.locator('.world-notice').isVisible(),false);assert.deepEqual(errors,[]);
 report.checks.push('100-year speed stop acknowledged; reload does not resurrect queue; no browser exception');
 report.towns=townOptions;report.maxSurfacePixels=maxSurface;report.maxVisiblePlaces=maxPlaces;report.maxVisibleResidents=maxResidents;report.status='passed';
 console.log('FIX5_BROWSER_SMOKE='+JSON.stringify(report));
 writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2));
} catch(error) {
 report.status='failed';report.error=String(error);console.log('FIX5_BROWSER_SMOKE='+JSON.stringify(report));
 writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2));throw error;
} finally {await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
