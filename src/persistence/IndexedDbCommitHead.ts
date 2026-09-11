import { IDENTITY_STORE, type WorldIdentity } from './IndexedDbRecovery';
import { validateWorldSave, missingWorldRecord } from './WorldSaveSafety';

function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve,reject) => {
    request.addEventListener('success',()=>resolve(request.result),{once:true});
    request.addEventListener('error',()=>reject(request.error ?? new Error('World commit head read failed.')),{once:true});
  });
}
/** Identity and world are written in the same transaction. Read the small head
 * and verify the world key, rather than decoding megabytes merely for revision.
 * Legacy heads are validated against the full record before the first write. */
export async function readWorldCommitHead(transaction: IDBTransaction, id: string) {
  const worlds=transaction.objectStore('worlds');
  const [identity,key]=await Promise.all([
    read(transaction.objectStore(IDENTITY_STORE).get(id)) as Promise<WorldIdentity|undefined>,
    read(worlds.getKey(id)),
  ]);
  if(key===undefined) { if(identity)missingWorldRecord(id); return {current:undefined,identity}; }
  if(identity?.id===id && Number.isInteger(identity.revision) && identity.revision>=0 &&
     Number.isInteger(identity.epoch) && identity.epoch>=1) {
    return {current:{id,revision:identity.revision,epoch:identity.epoch},identity};
  }
  const state=await read(worlds.get(id));validateWorldSave(state,id);
  return {current:{id,revision:state.revision,epoch:state.epoch??1},identity};
}
