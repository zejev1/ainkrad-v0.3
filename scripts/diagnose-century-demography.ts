import {InMemoryWorldStore} from '../src/world/InMemoryWorldStore';
import {WorldEngine} from '../src/world/WorldEngine';
import {WORLD_MINUTES_PER_YEAR} from '../src/world/WorldClock';
import {SAPIENT_RACE_LIFE_PROFILES_V16} from '../src/v16/SocietyFoundationV16';
import {evaluateFamilyAgency, type FamilyPerson} from '../src/v15/FamilyAgency';
import type {AgentState, RelationshipState, WorldState} from '../src/world/types';

const seed=process.argv.find(value=>value.startsWith('--seed='))?.slice(7)??'v16-demography-01';
const through=Number(process.argv.find(value=>value.startsWith('--through='))?.slice(10)??130);
const step=Number(process.argv.find(value=>value.startsWith('--step='))?.slice(7)??10);

const closeRelative=(a:AgentState,b:AgentState)=>
  a.life.parentIds.includes(b.id)||b.life.parentIds.includes(a.id)||
  a.life.parentIds.some(parent=>b.life.parentIds.includes(parent));
const settlementOf=(state:Readonly<WorldState>,agent:Readonly<AgentState>)=>
  state.places[agent.homeId]?.settlementId;
const agencyPerson=(state:Readonly<WorldState>,agent:AgentState):FamilyPerson=>{
  const agency=state.v15!.familyAgencyByAgentId[agent.id];
  return {
    id:agent.id,sex:agent.sex==='female'?'female':'male',ageYears:agent.life.ageYears,
    alive:agent.life.alive,health:agent.life.health,stress:agent.stress,resources:agent.resources,
    personality:{...agency},parentIds:[...agent.life.parentIds],childIds:[...agent.life.childIds],
    ...(agent.life.lastChildWorldMinute===undefined?{}:{lastChildWorldMinute:agent.life.lastChildWorldMinute}),
  };
};
const familySignals=(state:Readonly<WorldState>,a:AgentState,b:AgentState,relationship:RelationshipState)=>{
  const profile=SAPIENT_RACE_LIFE_PROFILES_V16.human;
  const attachment=Math.max(0,Math.min(1,relationship.affinity*.5+relationship.trust*.28+relationship.respect*.14-relationship.conflict*.16));
  return evaluateFamilyAgency(agencyPerson(state,a),agencyPerson(state,b),{
    worldMinutes:state.calendar.elapsedWorldMinutes,
    relationship:{trust:relationship.trust,affinity:relationship.affinity,respect:relationship.respect,conflict:relationship.conflict,attachment},
    householdResourceSecurity:Math.min(a.resources,b.resources),
    physicalEligibility:{minimumAdultAge:profile.adultAtAge,maximumReproductiveAge:profile.maximumReproductiveAge,minimumReproductiveHealth:profile.minimumReproductiveHealth},
  });
};

function sample(state:Readonly<WorldState>,year:number,prior?:ReturnType<typeof sample>){
  const humans=Object.values(state.agents).filter(a=>a.life.alive&&(a.race??'human')==='human');
  const profile=SAPIENT_RACE_LIFE_PROFILES_V16.human;
  const reproductive=humans.filter(a=>a.life.stage==='adult'&&a.life.ageYears<=profile.maximumReproductiveAge&&a.life.health>=profile.minimumReproductiveHealth);
  let physicalRelationshipPairs=0,readyRelationshipPairs=0,coLocatedUnrelatedPairs=0,unmetLocalPairs=0;
  for(let i=0;i<humans.length;i++)for(let j=i+1;j<humans.length;j++){
    const a=humans[i],b=humans[j];
    if(a.sex===b.sex||closeRelative(a,b))continue;
    const sameSettlement=settlementOf(state,a)!==undefined&&settlementOf(state,a)===settlementOf(state,b);
    if(a.locationId===b.locationId)coLocatedUnrelatedPairs++;
    const relationship=state.relationships[[a.id,b.id].sort().join('::')];
    if(!relationship&&sameSettlement)unmetLocalPairs++;
    if(!relationship||!sameSettlement||!reproductive.includes(a)||!reproductive.includes(b))continue;
    const cooldown=[a,b].some(person=>person.life.lastChildWorldMinute!==undefined&&state.calendar.elapsedWorldMinutes-person.life.lastChildWorldMinute<WORLD_MINUTES_PER_YEAR*1.3);
    if(cooldown)continue;
    physicalRelationshipPairs++;
    if(familySignals(state,a,b,relationship).childDecisionPossible)readyRelationshipPairs++;
  }
  const byGeneration=Object.fromEntries([...new Set(humans.map(a=>a.life.generation))].sort((a,b)=>a-b).map(g=>[g,humans.filter(a=>a.life.generation===g).length]));
  const ageBands={child:0,adolescent:0,adult18to35:0,adult36to55:0,older:0};
  for(const a of humans){
    if(a.life.ageYears<12)ageBands.child++;
    else if(a.life.ageYears<18)ageBands.adolescent++;
    else if(a.life.ageYears<=35)ageBands.adult18to35++;
    else if(a.life.ageYears<=55)ageBands.adult36to55++;
    else ageBands.older++;
  }
  const deathCauses:Record<string,number>={};
  for(const death of state.v15?.deathTelemetry??[])deathCauses[death.cause]=(deathCauses[death.cause]??0)+1;
  const opportunity=state.v16?.raceFamilyOpportunityByRace.human;
  const settlements=Object.values(state.settlements).map(s=>{
    const residents=humans.filter(a=>settlementOf(state,a)===s.id);
    return {id:s.id,living:residents.length,male:residents.filter(a=>a.sex==='male').length,female:residents.filter(a=>a.sex==='female').length};
  }).filter(s=>s.living>0);
  const result={
    year,living:humans.length,male:humans.filter(a=>a.sex==='male').length,female:humans.filter(a=>a.sex==='female').length,
    births:state.population.births,deaths:state.population.deaths,
    birthsSincePrior:state.population.births-(prior?.births??0),deathsSincePrior:state.population.deaths-(prior?.deaths??0),
    byGeneration,ageBands,
    reproductive:{male:reproductive.filter(a=>a.sex==='male').length,female:reproductive.filter(a=>a.sex==='female').length},
    physicalRelationshipPairs,readyRelationshipPairs,coLocatedUnrelatedPairs,unmetLocalPairs,
    opportunity:opportunity?{checks:opportunity.opportunityChecks,eligible:opportunity.eligiblePairChecks,intimacy:opportunity.voluntaryIntimacyChoices,child:opportunity.voluntaryChildChoices,births:opportunity.birthsSinceTracking}:undefined,
    mean:{health:Number((humans.reduce((n,a)=>n+a.life.health,0)/Math.max(1,humans.length)).toFixed(3)),stress:Number((humans.reduce((n,a)=>n+a.stress,0)/Math.max(1,humans.length)).toFixed(3)),resources:Number((humans.reduce((n,a)=>n+a.resources,0)/Math.max(1,humans.length)).toFixed(3))},
    lowHealth:humans.filter(a=>a.life.health<profile.minimumReproductiveHealth).length,
    moving:humans.filter(a=>a.movement).length,deathCauses,settlements,
  };
  return result;
}

const store=new InMemoryWorldStore();
const world=await WorldEngine.create({worldId:'century-diagnosis-'+seed,seed,store,startTime:0});
let prior:ReturnType<typeof sample>|undefined;
for(let year=step;year<=through;year+=step){
  const started=performance.now();
  await world.advanceCanonicalTimeTo(year*WORLD_MINUTES_PER_YEAR);
  const current=sample(world.snapshot(),year,prior);
  console.error(JSON.stringify({...current,calculationSeconds:Number(((performance.now()-started)/1000).toFixed(2))}));
  prior=current;
  if(current.living===0)break;
}
