import { describe, it, expect, vi } from 'vitest';
import { HydrologySystemAgent, HYDROLOGY_AGENT_MANIFEST } from '../src/world/systems/HydrologySystemAgent';
import { initializeWater, evolveWater, waterVolume, waterForPlants, type WaterUnitSpec, type WaterClimate } from '../src/world/systems/water/HydrologyModel';
import { HYDROLOGY_DATA_VERSION, HYDROLOGY_SOURCES } from '../src/world/systems/water/HydrologyKnowledge';
import { hydrologyTopology } from '../src/world/systems/water/HydrologyTopology';
import { bindWorldTerrain, terrainWalkingScale } from '../src/world/geography/WorldTerrain';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { hydrologySections } from '../src/presentation/HydrologyPanel';
import { bindPhysicalWater, localFloodDepth } from '../src/world/geography/HydrologySurface';
import { FeatureIndex } from '../src/world/geography/FeatureIndex';
import type { WorldState } from '../src/world/types';

it('looks up only actual floods, invalidates after water changes and matches point-index boundaries',()=>{
  const regions=[{minX:-1000,minY:-1000,maxX:1000,maxY:1000},
    {minX:-8,minY:-1,maxX:8,maxY:1},{minX:8,minY:0,maxX:9,maxY:2}];
  const index=new FeatureIndex(regions,r=>r,8);
  for(const x of [-1001,-1000,-8,0,8,9,1000,1001])for(const y of [-1000,-1,0,1,2,1000])
    expect(index.queryPoint(x,y)).toEqual(index.query({minX:x,maxX:x,minY:y,maxY:y}));
  const spec:WaterUnitSpec={id:'flood-site',kind:'plot',x:0,y:0,elevationM:0,areaM2:10000,
    moisture:0.5,slope:0,soilCapacityMm:240,surfaceAreaM2:10000,bankfullM3:50,residenceDays:1};
  const agent=new HydrologySystemAgent(undefined,0);agent.synchronize([spec]);
  const state=agent.stateForCommit(),world={places:{},hydrologySystem:state} as WorldState;
  bindPhysicalWater(world);const queries=vi.spyOn(FeatureIndex.prototype,'queryPoint');
  for(let i=0;i<1000;i++)expect(localFloodDepth(world.places,0,0)).toBe(0);
  expect(queries).not.toHaveBeenCalled();
  state.units[spec.id].surfaceM3=1050;state.updates++;
  expect(localFloodDepth(world.places,0,0)).toBe(0.1);expect(queries).toHaveBeenCalledTimes(1);
  state.units[spec.id].surfaceM3=50;state.updates++;
  expect(localFloodDepth(world.places,0,0)).toBe(0);expect(queries).toHaveBeenCalledTimes(1);
  queries.mockRestore();
});

const DAY=1440;
const spec=(id='up',extra:Partial<WaterUnitSpec>={}):WaterUnitSpec=>({id,x:0,y:0,elevationM:100,areaM2:10000,
  kind:'catchment',moisture:0.6,slope:0.1,soilCapacityMm:240,surfaceAreaM2:100,bankfullM3:100,residenceDays:2,...extra});
const dry:WaterClimate={temperatureC:28,precipitation:0,rain:false,snow:false,wind:0.4};
const wet:WaterClimate={...dry,precipitation:0.9,rain:true};
function make(specs=[spec('up',{downstream:'down'}),spec('down')]){const a=new HydrologySystemAgent(undefined,0);a.synchronize(specs);return a;}
describe('Conservative autonomous hydrology',()=>{
  it('balances rain, snow, aquifers, plant uptake and outlet discharge over complete seasons',()=>{
    const a=make();
    for(let day=0;day<730;day++){
      const winter=day%365<80,weather={...(day%4===0?wet:dry),temperatureC:winter?-8:22,snow:winter&&day%4===0};
      a.advance(day*DAY,DAY,{up:weather,down:weather},{up:0.8,down:0.5});
      expect(a.stateForCommit().budget.relativeError).toBeLessThan(1e-12);
      for(const s of Object.values(a.stateForCommit().units))for(const k of ['soilM3','groundwaterM3','snowM3','surfaceM3'] as const)expect(s[k]).toBeGreaterThanOrEqual(0);
    }
    const state=a.stateForCommit(), total=Object.values(state.units).reduce((n,s)=>n+waterVolume(s),0);
    expect(Math.abs(total-state.totals.initialM3-state.totals.precipitationM3+state.totals.atmosphereM3+state.totals.oceanM3)).toBeLessThan(1e-7);
    expect(state.totals.oceanM3).toBeGreaterThan(0);
    expect(HYDROLOGY_SOURCES).toHaveLength(3);
  });
  it('stores snowfall until thaw and depletes groundwater during prolonged drought without hidden replenishment',()=>{
    const a=make([spec()]);
    for(let d=0;d<40;d++)a.advance(d*DAY,DAY,{up:{...wet,temperatureC:-10,snow:true,rain:false}},{up:0.6});
    const snow=a.snapshot().units.up.snowM3;
    expect(snow).toBeGreaterThan(0);expect(a.snapshot().units.up.flux.meltM3).toBe(0);
    a.advance(40*DAY,DAY,{up:dry},{up:0.6});
    expect(a.snapshot().units.up.flux.meltM3).toBeGreaterThan(0);
    for(let d=41;d<730;d++)a.advance(d*DAY,DAY,{up:dry},{up:0.6});
    const s=a.snapshot().units.up;
    expect(s.snowM3).toBe(0);expect(s.groundwaterM3).toBeLessThan(0.1);expect(s.condition).toBe('drought');
    expect(waterForPlants(s).water).toBeLessThan(0.1);
  });
  it('routes only downstream, delays a second hop and gives lakes finite seasonal storage',()=>{
    const a=make([spec('up',{downstream:'lake'}),spec('lake',{kind:'lake',downstream:'sea',residenceDays:12}),spec('sea')]);
    const units=a.stateForCommit().units;
    for(const s of Object.values(units)){s.soilM3=0;s.groundwaterM3=0;s.surfaceM3=0;}
    units.up.surfaceM3=1000;
    const climate={...dry,temperatureC:-3};
    a.advance(0,DAY,{up:climate,lake:climate,sea:climate},{});
    expect(units.lake.flux.inflowM3).toBeGreaterThan(0);expect(units.lake.flux.outflowM3).toBe(0);expect(units.sea.surfaceM3).toBe(0);
    a.advance(DAY,DAY,{up:climate,lake:climate,sea:climate},{});
    expect(units.sea.flux.inflowM3).toBeGreaterThan(0);expect(units.lake.surfaceM3).toBeGreaterThan(0);
    expect(()=>make([spec('a',{downstream:'b'}),spec('b',{downstream:'a'})])).toThrow(/topology/);
  });
  it('draws riparian inundation from real channel water and conserves that lateral transfer',()=>{
    const a=make([spec('channel'),spec('plot',{kind:'plot',downstream:'channel',riparian:true,surfaceAreaM2:10000,bankfullM3:50})]);
    a.stateForCommit().units.channel.surfaceM3=4000;
    a.advance(0,DAY,{channel:wet,plot:wet},{});
    expect(a.stateForCommit().units.plot.flux.exchangeInM3).toBeGreaterThan(0);
    expect(a.stateForCommit().units.channel.flux.exchangeOutM3).toBe(a.stateForCommit().units.plot.flux.exchangeInM3);
    expect(a.stateForCommit().budget.relativeError).toBeLessThan(1e-12);
  });
  it('uses exactly the same physics after stops, executor failure, and a mass-creating replacement',()=>{
    const original=make();
    const faultModels=[()=>{throw new Error('injected failure');},(s:any,w:any,d:number,c:number)=>{const f=evolveWater(s,w,d,c);s.soilM3+=100;return f;}];
    for(const model of faultModels){
      const a=new HydrologySystemAgent(original.snapshot(),0,model),b=new HydrologySystemAgent(original.snapshot(),0);
      const specs=Object.values(original.stateForCommit().units).map(s=>s.spec);a.synchronize(specs);b.synchronize(specs);
      a.advance(0,DAY,{up:wet,down:wet},{});b.advance(0,DAY,{up:wet,down:wet},{});
      expect(a.snapshot().units).toEqual(b.snapshot().units);expect(a.health().healthy).toBe(false);
      const before=a.snapshot().units;a.applyCardinalCommand({kind:'restore',reason:'recover'});expect(a.snapshot().units).toEqual(before);
    }
    const off=make(),on=make();off.applyCardinalCommand({kind:'stop',reason:'executor isolated'});
    for(let d=0;d<10;d++){off.advance(d*DAY,DAY,{up:wet,down:dry},{});on.advance(d*DAY,DAY,{up:wet,down:dry},{});}
    expect(off.snapshot().units).toEqual(on.snapshot().units);
    expect(()=>off.applyCardinalCommand({kind:'restrict',allowedCapabilityIds:['sparks.resources.write'],reason:'invalid'})).toThrow();
    expect(HYDROLOGY_AGENT_MANIFEST.capabilities[0].readScopes.join()).not.toMatch(/spark|resident|mind|knowledge/);
  });
  it('isolates corrupt physical records without replacing them or losing upstream outflow',()=>{
    const saved=make().snapshot();saved.units.down.soilM3=NaN;
    const a=new HydrologySystemAgent(saved,0);a.synchronize([spec('up',{downstream:'down'}),spec('down')]);
    a.advance(0,DAY,{up:wet,down:wet},{});
    expect(Number.isNaN(a.stateForCommit().units.down.soilM3)).toBe(true);
    expect(a.stateForCommit().units.up.flux.outflowM3).toBe(0);
    expect(a.stateForCommit().budget.relativeError).toBeLessThan(1e-12);
    a.applyCardinalCommand({kind:'restore',reason:'cannot recreate data'});expect(a.health().healthy).toBe(false);
    const missing=make().snapshot();missing.units.down=null as any;
    const isolated=new HydrologySystemAgent(missing,0);isolated.synchronize([spec('up',{downstream:'down'}),spec('down')]);
    isolated.advance(0,DAY,{up:wet},{});
    expect(isolated.stateForCommit().units.down).toBeNull();
    expect(isolated.stateForCommit().units.up.flux.outflowM3).toBe(0);
  });
  it('does no recalculation for repeated presentation and refines land without generating extra water',()=>{
    const a=make([spec('basin',{areaM2:100000})]);
    a.advance(0,DAY,{basin:wet},{});const count=a.operationCounts();
    for(let i=0;i<100000;i++)a.advance(0,DAY,{basin:wet},{});
    expect(a.operationCounts()).toEqual(count);
    const before=waterVolume(a.stateForCommit().units.basin);
    a.synchronize([spec('basin',{areaM2:90000}),spec('plot',{kind:'plot',downstream:'basin'})]);
    expect(Object.values(a.stateForCommit().units).reduce((n,s)=>n+waterVolume(s),0)).toBeCloseTo(before,8);
  });
});
async function fixture(){const worldId='water-live',store=new InMemoryWorldStore(),engine=await WorldEngine.create({worldId,seed:worldId,store,startTime:0});return {worldId,store,engine,controlLog:new InMemoryAppendOnlyLog()};}
describe('Water in the lived world',()=>{
  it('adopts f13 water/plant indices without resetting any resident, stored resource, terrain or history',async()=>{
    const f=await fixture(),legacy=f.engine.snapshot();delete legacy.hydrologySystem;
    legacy.vegetationSystem!.sites.resource_field.water=0.37;legacy.vegetationSystem!.sites.resource_field.snow=0.23;
    const store=new InMemoryWorldStore();await store.initializeWorld(legacy);
    const engine=await WorldEngine.open({worldId:f.worldId,store});const before=engine.snapshot();
    await engine.controlHydrologySystem({kind:'start'},'adopt-water',before.revision);
    const after=engine.snapshot();expect(after.hydrologySystem!.dataVersion).toBe(HYDROLOGY_DATA_VERSION);
    expect(waterForPlants(after.hydrologySystem!.units.resource_field)).toMatchObject({water:0.37,snow:0.23});
    delete after.hydrologySystem;after.revision=before.revision;expect(after).toEqual(before);expect(await store.history(f.worldId)).toEqual([]);
  });
  it('covers the existing drainage once, couples real plant water, persists exactly, and exposes evidence',async()=>{
    const f=await fixture();await f.engine.advanceCanonicalTimeTo(8760*3);const after=f.engine.snapshot();
    const terrain=bindWorldTerrain(after)!,topology=hydrologyTopology(terrain);expect(hydrologyTopology(terrain)).toBe(topology);
    expect(topology.cellBasins.filter(Boolean).length).toBe(terrain.land.reduce((n,x)=>n+x,0));
    expect(topology.specs.length).toBeLessThan(256);
    const water=after.hydrologySystem!.units.resource_field,p=after.vegetationSystem!.sites.resource_field;
    expect(p.water).toBe(waterForPlants(water).water);expect(p.snow).toBe(waterForPlants(water).snow);
    expect(p.localHydrology).toBeUndefined();
    expect(hydrologySections(after,'resource_field')[0].rows.some(r=>r.label==='Сток')).toBe(true);
    expect((await WorldEngine.open({worldId:f.worldId,store:f.store})).snapshot()).toEqual(after);
    const point={x:p.habitat.x,y:p.habitat.y},next={x:point.x+0.01,y:point.y};
    water.surfaceM3=water.spec.bankfullM3;after.hydrologySystem!.updates++;
    const drySpeed=terrainWalkingScale(after.places,point,next);
    water.surfaceM3+=water.spec.surfaceAreaM2*0.5;after.hydrologySystem!.updates++;
    expect(terrainWalkingScale(after.places,point,next)).toBeLessThan(drySpeed);
    water.surfaceM3=water.spec.bankfullM3;after.hydrologySystem!.updates++;
    expect(terrainWalkingScale(after.places,point,next)).toBe(drySpeed);
  });
  it('adopts a legacy save between world quanta at the actual soil timestamp without losing plant time',async()=>{
    const f=await fixture();await f.engine.advanceCanonicalTimeTo(8760+100);
    const before=f.engine.snapshot(),legacy=structuredClone(before);delete legacy.hydrologySystem;legacy.revision++;
    expect(legacy.vegetationSystem!.lastMinute).toBeLessThan(legacy.calendar.elapsedWorldMinutes);
    await f.store.commit({worldId:f.worldId,operationId:'legacy-mid-quantum',operationFingerprint:'legacy-mid-quantum',
      expectedRevision:before.revision,nextState:legacy,events:[],memories:[]});
    const reopened=await WorldEngine.open({worldId:f.worldId,store:f.store});
    await reopened.controlHydrologySystem({kind:'start'},'adopt-mid-quantum',legacy.revision);
    expect(reopened.snapshot().hydrologySystem!.lastMinute).toBe(legacy.vegetationSystem!.lastMinute);
    expect(reopened.snapshot().calendar).toEqual(legacy.calendar);
    await reopened.advanceCanonicalTimeTo(17520);const after=reopened.snapshot();
    expect(after.hydrologySystem!.lastMinute).toBe(17520);expect(after.vegetationSystem!.lastMinute).toBe(17520);
  });
  it('recovers from the first launch, preserves OFF through reload, and never rolls back absent years',async()=>{
    const f=await fixture(),checkpoint=f.engine.snapshot();checkpoint.hydrologySystem!.lifecycle='faulted';checkpoint.hydrologySystem!.fallback=true;
    const store=new InMemoryWorldStore();await store.initializeWorld(checkpoint);
    let runtime=await LiveWorldRuntime.create({...f,store,mode:'observer'});
    const frame=await runtime.tick(0);expect(frame.cardinalControl!.hydrology!.recoveries).toBe(1);
    expect(frame.world.hydrologySystem!.units).toEqual(checkpoint.hydrologySystem!.units);
    await runtime.setCardinalEnabled(false);await runtime.tick(8760);
    runtime=await LiveWorldRuntime.create({...f,store,mode:'observer'});expect((await runtime.tick(0)).cardinalControl!.status).toBe('OFF');
    runtime.disconnectCardinal('removed');await runtime.tick(525600*2);const present=runtime.worldSnapshot();
    await runtime.setCardinalEnabled(true);expect(runtime.worldSnapshot()).toEqual(present);
  });
});
