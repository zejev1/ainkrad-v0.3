import type { WorldState } from '../world/types';
import { WorldRevisionConflictError } from '../world/persistence';
import { validateWorldSave, missingWorldRecord } from './WorldSaveSafety';

export const RECOVERY_STORE='world_recovery';
export const IDENTITY_STORE='world_identity';
export const RECOVERY_LIMIT=3;
export interface WorldIdentity { id:string; epoch:number; revision:number; nextBackup:number; lastBackupRevision?:number }
export interface WorldRecovery { key:string; worldId:string; reason:string; state:WorldState; streamHeads:unknown[] }

function result<T>(r:IDBRequest<T>):Promise<T> {
  return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error??new Error('IndexedDB recovery read failed.'));});
}
function done(t:IDBTransaction):Promise<void> {
  const p=new Promise<void>((resolve,reject)=>{t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error??new Error('Recovery transaction aborted.'));t.onerror=()=>reject(t.error??new Error('Recovery transaction failed.'));});
  void p.catch(()=>undefined);return p;
}
export function putWorldIdentity(t:IDBTransaction, state:WorldState, prior?:WorldIdentity): void {
  t.objectStore(IDENTITY_STORE).put({...prior,id:state.id,epoch:state.epoch??1,revision:state.revision,nextBackup:prior?.nextBackup??0});
}
export async function checkpointWorld(database: IDBDatabase, worldId:string, expectedRevision:number, reason:string):Promise<void> {
  const t=database.transaction(['worlds',RECOVERY_STORE,IDENTITY_STORE,'stream_heads'],'readwrite'),completion=done(t);
  try {
    const [state,identity,heads]=await Promise.all([result(t.objectStore('worlds').get(worldId)),
      result(t.objectStore(IDENTITY_STORE).get(worldId)) as Promise<WorldIdentity|undefined>,
      result(t.objectStore('stream_heads').getAll())]);
    if(state===undefined)missingWorldRecord(worldId);
    validateWorldSave(state,worldId);
    if(state.revision!==expectedRevision)throw new WorldRevisionConflictError(worldId,expectedRevision,state.revision);
    if(identity?.lastBackupRevision!==state.revision) {
      const slot=(identity?.nextBackup??0)%RECOVERY_LIMIT;
      t.objectStore(RECOVERY_STORE).put({key:`${worldId}:slot:${slot}`,worldId,reason:reason.slice(0,120),
        state,streamHeads:heads} satisfies WorldRecovery);
      putWorldIdentity(t,state,{id:worldId,epoch:state.epoch??1,revision:state.revision,
        nextBackup:(slot+1)%RECOVERY_LIMIT,lastBackupRevision:state.revision});
    }
    await completion;
  } catch(error) {
    try {t.abort();} catch { /* already aborted */ }
    await completion.catch(()=>undefined);throw error;
  }
}
