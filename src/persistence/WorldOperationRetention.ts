import type { CommittedWorldOperation } from '../world/persistence';
export const WORLD_TIME_OPERATION_RETENTION=2048;
export const WORLD_TIME_RETENTION_INTERVAL=300;
export const MAX_TIME_OPERATIONS_REMOVED=4096;
export function isWorldTimeOperation(id:string):boolean {
  return /^(tick:|canonical-frame:|canonical-world-time:|canonical-world-slice:)/.test(id);
}
/** Only replaceable time-idempotency receipts expire. World evidence and
 * Cardinal/Gateway journals are separate stores and never enter this sweep. */
export async function pruneWorldTimeOperations(database:IDBDatabase,worldId:string,revision:number):Promise<void> {
  const cutoff=revision-WORLD_TIME_OPERATION_RETENTION;if(cutoff<=0)return;
  const transaction=database.transaction('operations','readwrite');
  const completion=new Promise<void>((resolve,reject)=>{
    transaction.oncomplete=()=>resolve();
    transaction.onabort=()=>reject(transaction.error??new Error('Time receipt retention aborted.'));
    transaction.onerror=()=>reject(transaction.error??new Error('Time receipt retention failed.'));
  });
  const prefix=worldId+'::operation::';
  const request=transaction.objectStore('operations').openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));
  let removed=0;
  request.onsuccess=()=>{
    const cursor=request.result;if(!cursor||removed>=MAX_TIME_OPERATIONS_REMOVED)return;
    const operation=cursor.value as CommittedWorldOperation;
    if(operation.worldId===worldId&&isWorldTimeOperation(operation.operationId)&&operation.committedRevision<cutoff) {
      cursor.delete();removed++;
    }
    cursor.continue();
  };
  await completion;
}
