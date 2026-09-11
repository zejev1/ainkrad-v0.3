import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIndexedDbPersistence, DEFAULT_AINKRAD_DATABASE_NAME } from '../src/persistence/IndexedDbPersistence';
import { RECOVERY_STORE, IDENTITY_STORE, RECOVERY_LIMIT, type WorldRecovery } from '../src/persistence/IndexedDbRecovery';
import { worldStorageDiagnostics } from '../src/persistence/WorldSaveSafety';
import { WorldEngine } from '../src/world/WorldEngine';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';

let sequence=0;
const name=()=> 'idb-test-'+sequence++;
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function raw(dbName:string,storeName:string,write?:(s:IDBObjectStore)=>void) {
  const db=await request(indexedDB.open(dbName)),t=db.transaction(storeName,write?'readwrite':'readonly');
  const complete=new Promise<void>((resolve,reject)=>{t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error);t.onerror=()=>reject(t.error);});
  if(write)write(t.objectStore(storeName));
  const rows=await request(t.objectStore(storeName).getAll());await complete;db.close();return rows;
}
afterEach(()=>vi.restoreAllMocks());
describe('durable continuity, migration backup and failure atomicity',()=>{
  it('upgrades the existing database in place and preserves the original snapshot before geometry migration',async()=>{
    const dbName=name(),old=(await WorldEngine.create({worldId:'ainkrad_live_world',seed:'old',store:new InMemoryWorldStore()})).snapshot();
    old.places.resource_field.mapX=56;delete old.places.resource_field.urbanLayoutVersion;
    const opening=indexedDB.open(dbName,1);opening.onupgradeneeded=()=>opening.result.createObjectStore('worlds',{keyPath:'id'});
    const db=await request(opening),t=db.transaction('worlds','readwrite');
    const done=new Promise<void>(r=>{t.oncomplete=()=>r();});t.objectStore('worlds').put(old);await done;db.close();
    const bundle=createIndexedDbPersistence(dbName);
    const engine=await WorldEngine.open({worldId:old.id,store:bundle.worldStore}),now=engine.snapshot();
    expect(now.calendar).toEqual(old.calendar);expect(now.determinism).toEqual(old.determinism);
    expect(now.agents).toEqual(old.agents);expect(now.v18!.secretLibrary.knowledgeByAgentId).toEqual(old.v18!.secretLibrary.knowledgeByAgentId);
    expect(now.places.resource_field.mapX).not.toBe(56);
    const backups=await raw(dbName,RECOVERY_STORE) as WorldRecovery[];expect(backups).toHaveLength(1);expect(backups[0].state).toEqual(old);
    const reopened=await WorldEngine.open({worldId:old.id,store:bundle.worldStore});
    expect(reopened.snapshot()).toEqual(now);expect(await raw(dbName,RECOVERY_STORE)).toHaveLength(1);
    expect(DEFAULT_AINKRAD_DATABASE_NAME).toBe('ainkrad-v0-3-browser-world-v1');
  });
  it('does not create a replacement on read error, malformed record or a missing known world',async()=>{
    const dbName=name(),bundle=createIndexedDbPersistence(dbName);
    const engine=await WorldEngine.create({worldId:'protected',seed:'protected',store:bundle.worldStore}),before=engine.snapshot();
    const initialize=vi.spyOn(bundle.worldStore,'initializeWorld');
    const load=vi.spyOn(bundle.worldStore,'loadWorld').mockRejectedValueOnce(new Error('read failure'));
    await expect(LiveWorldRuntime.create({worldId:'protected',seed:'x',store:bundle.worldStore})).rejects.toThrow('read failure');
    load.mockRestore();expect(initialize).not.toHaveBeenCalled();
    await raw(dbName,'worlds',s=>s.put({id:'protected',rulesVersion:'broken'}));
    await expect(LiveWorldRuntime.create({worldId:'protected',seed:'x',store:bundle.worldStore})).rejects.toThrow('сохранение');
    expect((await raw(dbName,'worlds'))[0]).toEqual({id:'protected',rulesVersion:'broken'});
    await raw(dbName,'worlds',s=>s.delete('protected'));
    await expect(LiveWorldRuntime.create({worldId:'protected',seed:'x',store:bundle.worldStore})).rejects.toThrow('следы предыдущего мира');
    await expect(bundle.worldStore.initializeWorld(before)).rejects.toThrow('следы предыдущего мира');
    expect(await raw(dbName,'worlds')).toHaveLength(0);
  });
  it('keeps the old world when a backup cannot be written and bounds successful checkpoints',async()=>{
    const dbName=name(),bundle=createIndexedDbPersistence(dbName);
    const engine=await WorldEngine.create({worldId:'backup',seed:'backup',store:bundle.worldStore}),old=engine.snapshot();
    old.places.resource_field.mapX=56;delete old.places.resource_field.urbanLayoutVersion;
    await raw(dbName,'worlds',s=>s.put(old));
    const original=IDBObjectStore.prototype.put;
    const spy=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(value:any,key?:IDBValidKey) {
      if(this.name===RECOVERY_STORE)throw new DOMException('full','QuotaExceededError');
      return original.call(this,value,key);
    });
    await expect(WorldEngine.open({worldId:old.id,store:bundle.worldStore})).rejects.toThrow('full');spy.mockRestore();
    expect(await bundle.worldStore.loadWorld(old.id)).toEqual(old);
    expect(await raw(dbName,RECOVERY_STORE)).toHaveLength(0);
    for(let i=0;i<6;i++) {
      const state={...old,revision:i};await raw(dbName,'worlds',s=>s.put(state));
      await bundle.worldStore.checkpointWorld(old.id,i,'test');await bundle.worldStore.checkpointWorld(old.id,i,'test');
    }
    const backups=await raw(dbName,RECOVERY_STORE) as WorldRecovery[];
    expect(backups).toHaveLength(RECOVERY_LIMIT);expect(backups.map(b=>b.state.revision).sort()).toEqual([3,4,5]);
  });
  it('rolls back world, events, memories and operation together when writing evidence fails',async()=>{
    const dbName=name(),bundle=createIndexedDbPersistence(dbName);
    const engine=await WorldEngine.create({worldId:'atomic',seed:'atomic',store:bundle.worldStore}),before=engine.snapshot();
    const original=IDBObjectStore.prototype.add;
    const spy=vi.spyOn(IDBObjectStore.prototype,'add').mockImplementation(function(value:any,key?:IDBValidKey) {
      if(this.name==='memories')throw new DOMException('injected evidence failure','QuotaExceededError');
      return original.call(this,value,key);
    });
    await expect(bundle.worldStore.commit({operationId:'atomic-fail',operationFingerprint:'atomic-fail',worldId:before.id,
      expectedRevision:before.revision,nextState:{...before,revision:before.revision+1},
      events:[{eventId:'e',worldId:before.id,kind:'world.migrated',source:'system',occurredAt:0,payload:{}}],
      memories:[{memoryId:'m',worldId:before.id,agentId:'agent_1',createdAt:0,kind:'reflection',summary:'evidence',
        importance:.5,valence:0,relatedAgentIds:[]}]})).rejects.toThrow('injected evidence failure');spy.mockRestore();
    expect(await bundle.worldStore.loadWorld(before.id)).toEqual(before);
    expect(await raw(dbName,'events')).toHaveLength(0);expect(await raw(dbName,'memories')).toHaveLength(0);
    expect(await raw(dbName,'operations')).toHaveLength(0);
    expect((await raw(dbName,IDENTITY_STORE))[0].revision).toBe(before.revision);
  });
  it('retains Cardinal journal, personal history and RNG through an update and accelerated continuation',async()=>{
    const dbName=name(),bundle=createIndexedDbPersistence(dbName);
    const options={worldId:'continuity',seed:'ainkrad-browser-world',store:bundle.worldStore,controlLog:bundle.controlLog,durable:true};
    const runtime=await LiveWorldRuntime.create(options);let frame=await runtime.tick();
    for(let i=0;i<5;i++)frame=await runtime.tick();
    const old=structuredClone(frame.world),records=await raw(dbName,'stream_records');
    expect(records.length).toBeGreaterThan(0);
    old.places.resource_field.mapX=56;delete old.places.resource_field.urbanLayoutVersion;
    await raw(dbName,'worlds',s=>s.put(old));
    const restored=await LiveWorldRuntime.create(options),resumed=await restored.tick(0);
    expect(resumed.world.calendar).toEqual(old.calendar);expect(resumed.world.determinism).toEqual(old.determinism);
    expect(resumed.world.agents).toEqual(old.agents);expect(resumed.world.population).toEqual(old.population);
    expect(resumed.evaluation!.experience.totalExperience).toBeGreaterThanOrEqual(frame.evaluation!.experience.totalExperience);
    expect(await raw(dbName,'stream_records')).toEqual(records);
    const target=old.calendar.elapsedWorldMinutes+WORLD_MINUTES_PER_YEAR/60;
    restored.setWorldSpeed('century_per_minute',10);
    await restored.catchUpBatchTo(target,1);
    expect(restored.worldSnapshot().calendar.elapsedWorldMinutes).toBeGreaterThan(old.calendar.elapsedWorldMinutes);
    const final=await LiveWorldRuntime.create(options);expect(final.worldSnapshot()).toEqual(restored.worldSnapshot());
    const a=worldStorageDiagnostics(old,'https://ainkrad-v0-3.vercel.app');
    const b=worldStorageDiagnostics(old,'https://ainkrad-v0-3-preview.vercel.app');
    expect(a).not.toEqual(b);expect(a).toContain(old.id);expect(a).toContain('ревизия');
  });
});
