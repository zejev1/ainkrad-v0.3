import { describe,it,expect } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { CANONICAL_WORLD_QUANTUM_MINUTES as Q } from '../src/v15/WorldTimeContract';

describe('FIX5 cooperative exact-time execution',()=>{
  it('commits the completed quantum on cancellation and can resume the same absolute target',async()=>{
    const create=()=>WorldEngine.create({worldId:'slice',seed:'slice',store:new InMemoryWorldStore()});
    const a=await create(),b=await create();let yielded=0;
    await a.advanceCanonicalTimeTo(8*Q,{afterQuantum:async()=>{yielded++;},shouldStop:()=>yielded===2});
    expect(a.snapshot().calendar.elapsedWorldMinutes).toBe(2*Q);
    await a.advanceCanonicalTimeTo(8*Q,{afterQuantum:async()=>{},shouldStop:()=>false});
    await b.advanceCanonicalTimeTo(8*Q);
    const {revision:r1,...left}=a.snapshot(),{revision:r2,...right}=b.snapshot();expect(left).toEqual(right);
  });
  it('does not leave the runtime counting unprocessed time when execution yields early',async()=>{
    const runtime=await LiveWorldRuntime.create({worldId:'slice-runtime',seed:'clock',mode:'observer',boundedLiveAcceleration:true});
    runtime.setCooperativeExecution({afterQuantum:async()=>{},shouldStop:()=>true});
    runtime.enqueueLiveElapsed(60000);
    await runtime.advanceResponsive(0);
    expect(runtime.worldSnapshot().calendar.elapsedWorldMinutes).toBe(Q);
    expect(runtime.liveTiming().pendingWorldMinutes).toBeGreaterThan(0);
    const result=await runtime.catchUpBatchTo(20*Q,16);
    expect(result.currentWorldMinutes).toBe(2*Q);expect(result.completed).toBe(false);
    expect(result.semanticQuantaProcessed).toBe(1);
  });
});
