import 'fake-indexeddb/auto';
import { describe,it,expect } from 'vitest';
import { pruneWorldTimeOperations,WORLD_TIME_OPERATION_RETENTION } from '../src/persistence/WorldOperationRetention';

const result=<T>(request:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
describe('FIX5 bounded time receipts',()=>{
  it('expires old clock receipts while retaining recent retries and all non-clock evidence',async()=>{
    const opening=indexedDB.open('fix5-retention',1);opening.onupgradeneeded=()=>{
      opening.result.createObjectStore('operations',{keyPath:'key'});opening.result.createObjectStore('stream_records',{keyPath:'id'});
    };
    const db=await result(opening),tx=db.transaction(['operations','stream_records'],'readwrite');
    for(let revision=1;revision<=2500;revision++) {
      const id=(revision%2?'canonical-world-slice:1:':'canonical-world-time:1:')+revision;
      tx.objectStore('operations').put({key:'w::operation::'+id,worldId:'w',operationId:id,committedRevision:revision});
    }
    for(const [worldId,id]of [['w','migration:protected'],['w','gateway:protected'],['other','canonical-world-time:1:1']])
      tx.objectStore('operations').put({key:worldId+'::operation::'+id,worldId,operationId:id,committedRevision:1});
    tx.objectStore('stream_records').put({id:'cardinal',record:'lived experience'});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
    await pruneWorldTimeOperations(db,'w',2500);
    const rows=await result(db.transaction('operations').objectStore('operations').getAll());
    expect(rows.length).toBe(WORLD_TIME_OPERATION_RETENTION+1+3);
    for(const id of ['migration:protected','gateway:protected'])expect(rows.some(r=>r.operationId===id)).toBe(true);
    expect(rows.some(r=>r.worldId==='other')).toBe(true);
    expect(await result(db.transaction('stream_records').objectStore('stream_records').getAll())).toEqual([{id:'cardinal',record:'lived experience'}]);
    db.close();
  });
});
