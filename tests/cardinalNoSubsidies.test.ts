import { describe, it, expect, vi } from 'vitest';
import { IndependentInterventionGateway } from '../src/cardinal/InterventionGateway';
import { InMemoryInterventionGatewayLedger, type GatewayLedgerEntry } from '../src/cardinal/InterventionGatewayLedger';
import { IndependentWorldAuthorityGateway, type WorldAuthorityProposal } from '../src/cardinal/WorldAuthorityGateway';
import { deriveCardinalExperience } from '../src/cardinal/CardinalExperience';
import { stableJsonStringify } from '../src/core/stableJson';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import type { InterventionProposal } from '../src/cardinal/types';

const proposal=(kind:'resource_relief'|'habitat_support'):InterventionProposal=>({proposalId:`old-${kind}`,worldId:'no-subsidy',
  hypothesisId:'old-hypothesis',kind,magnitude:0.1,reason:'legacy scarcity',expectedOutcome:'legacy relief',
  prediction:{metric:'resourcePressure',direction:'decrease',minimumImprovement:0.01,horizonWorldMinutes:8760,statement:'test'}});
async function setup(){const store=new InMemoryWorldStore();const world=await WorldEngine.create({worldId:'no-subsidy',seed:'no-subsidy',store,startTime:0});return {store,world};}
function pending(p:InterventionProposal, revision:number):GatewayLedgerEntry {
  return {worldId:p.worldId,proposalId:p.proposalId,evaluationId:'old-evaluation',proposalFingerprint:stableJsonStringify(p),
    expectedWorldRevision:revision,effectDurationWorldMinutes:8760,gatewayPolicyVersion:'old-gateway',phase:'pending',
    record:{interventionId:'old-intervention',evaluationId:'old-evaluation',worldId:p.worldId,worldEpoch:1,policyVersion:'old-policy',
      sensorVersion:'old-sensor',researchVersion:'old-research',requestedAt:0,requestedWorldMinutes:0,observedWorldRevision:revision,
      gatewayPolicyVersion:'old-gateway',authorizedEffectDurationWorldMinutes:8760,proposal:p,authorized:true,
      authorizationReason:'pre-f14 authorization',executionStatus:'authorized_pending',executed:false}};
}
describe('Cardinal cannot subsidize resources in f14',()=>{
  it('rejects both historical subsidy kinds at the gateway and the final world writer',async()=>{
    const {world,store}=await setup(),before=world.snapshot();
    const gateway=new IndependentInterventionGateway(world);
    for(const kind of ['resource_relief','habitat_support'] as const){
      const result=await gateway.execute('test',proposal(kind),before,0);
      expect(result.executionStatus).toBe('denied');expect(result.authorizationReason).toContain('subsidies');
      await expect(world.applyAuthorizedIntervention(before.id,kind,0.1,0,8760,`bypass-${kind}`,before.revision)).rejects.toThrow('subsidies');
    }
    expect(world.snapshot()).toEqual(before);expect(await store.history(before.id)).toEqual([]);
  });
  it('closes uncommitted old pending help without invoking the writer',async()=>{
    const {world}=await setup(),before=world.snapshot(),ledger=new InMemoryInterventionGatewayLedger();
    await ledger.begin(pending(proposal('resource_relief'),before.revision));
    const writer=vi.spyOn(world,'applyAuthorizedIntervention');
    const gateway=new IndependentInterventionGateway(world,{ledger});await gateway.recover(before.id);
    expect(writer).not.toHaveBeenCalled();expect(world.snapshot()).toEqual(before);
    expect((await ledger.entries(before.id))[0].record.executionStatus).toBe('denied');
  });
  it('retains an already committed historical subsidy receipt after a crash without replaying or undoing it',async()=>{
    const {world,store}=await setup(),before=world.snapshot(),p=proposal('resource_relief'),ledger=new InMemoryInterventionGatewayLedger();
    await ledger.begin(pending(p,before.revision));
    const next=structuredClone(before);next.revision++;next.environment.resourcePool=Math.min(1,next.environment.resourcePool+0.1);
    const fingerprint=stableJsonStringify({kind:'intervention',worldId:before.id,interventionKind:p.kind,magnitude:0.1,now:0,
      durationWorldMinutes:8760,expectedWorldRevision:before.revision});
    await store.commit({worldId:before.id,operationId:`intervention:${p.proposalId}`,operationFingerprint:fingerprint,
      expectedRevision:before.revision,nextState:next,events:[],memories:[]});
    const reopened=await WorldEngine.open({worldId:before.id,store}),writer=vi.spyOn(reopened,'applyAuthorizedIntervention');
    await new IndependentInterventionGateway(reopened,{ledger}).recover(before.id);
    expect(writer).not.toHaveBeenCalled();expect(reopened.snapshot()).toEqual(next);
    expect((await ledger.entries(before.id))[0].record).toMatchObject({executionStatus:'executed',committedWorldRevision:next.revision});
  });
  it('blocks indirect resource-boost laws even with maximum historical experience and direct writer access',async()=>{
    const {world}=await setup(),before=world.snapshot(),gateway=new IndependentWorldAuthorityGateway(world,0);
    const experience={...deriveCardinalExperience([],[]),level:99,totalExperience:1e6,capabilities:['world_rule_design' as const]};
    for(const mechanism of ['resource_regeneration','wildlife_recovery','habitat_integrity','catastrophe_recovery'] as const){
      const domain=mechanism==='resource_regeneration'?'resources':'ecology';
      const p:WorldAuthorityProposal={proposalId:mechanism,worldId:before.id,proposedAt:0,proposedWorldMinutes:0,necessity:1,
        evidenceEventIds:['1','2','3'],reason:'legacy subsidy',expectedOutcome:'extra resources',kind:'world_law',lawId:`help_${mechanism}`,
        domain,mechanism,value:1.5,minimum:0,maximum:2};
      expect((await gateway.execute(p,before,experience)).authorized).toBe(false);
      await expect(world.applyAuthorizedWorldLaw(before.id,p.lawId,domain,mechanism,1.5,0,2,p.reason,0,p.proposalId,before.revision)).rejects.toThrow('subsidies');
    }
    expect(world.snapshot()).toEqual(before);
  });
  it('keeps old law records readable but uses the natural resource law instead of their subsidy',async()=>{
    const {world}=await setup(),saved=world.snapshot();
    const natural=Object.values(saved.governance.laws).find(l=>l.mechanism==='resource_regeneration')!;
    saved.governance.laws.old_boost={...natural,id:'old_boost',value:natural.maximum,createdBy:'cardinal',createdAt:99};
    const store=new InMemoryWorldStore();await store.initializeWorld(saved);
    const reopened=await WorldEngine.open({worldId:saved.id,store});
    expect(reopened.snapshot().governance.laws.old_boost).toEqual(saved.governance.laws.old_boost);
    await world.advanceCanonicalTimeTo(17520);await reopened.advanceCanonicalTimeTo(17520);
    const after=reopened.snapshot();delete after.governance.laws.old_boost;
    expect(after).toEqual(world.snapshot());
  });
});
