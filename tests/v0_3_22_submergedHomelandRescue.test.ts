import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';
import { bindWorldTerrain } from '../src/world/geography/WorldTerrain';
import { rebuildWorldRoutes } from '../src/world/WorldNavigation';
import type { WorldPoint2D, WorldState } from '../src/world/types';

const nonHuman = ['elf','dwarf','goblin','orc','ogre'] as const;

function moveSettlementTo(world:WorldState, settlementId:string, target:WorldPoint2D):void {
  const center=world.places[settlementId];
  const dx=target.x-center.mapX,dy=target.y-center.mapY;
  for(const place of Object.values(world.places)) {
    if(place.settlementId!==settlementId)continue;
    place.mapX+=dx;place.mapY+=dy;
    if(place.boundaryPolygon)place.boundaryPolygon=place.boundaryPolygon.map(p=>({x:p.x+dx,y:p.y+dy}));
  }
  const town=world.settlements[settlementId];
  town.centerX+=dx;town.centerY+=dy;
  for(const agent of Object.values(world.agents)) {
    if(world.places[agent.locationId]?.settlementId!==settlementId)continue;
    agent.position.x+=dx;agent.position.y+=dy;
    // The old F2 relocation rebuilt these movements. Keep this fixture focused
    // on persisted geography rather than inventing a half-translated route.
    delete agent.movement;
  }
}

describe('F2 submerged homeland rescue',()=>{
  it('reserves every future non-human homeland on actual mainland across seeds',async()=>{
    for(let index=0;index<8;index++){
      const world=(await WorldEngine.create({
        worldId:`homeland-mainland-${index}`,
        seed:`homeland-mainland-seed-${index}`,
        store:new InMemoryWorldStore(),
        startTime:0,
      })).snapshot();
      const terrain=bindWorldTerrain(world)!;
      const anchors=nonHuman.map(race=>world.terrain!.anchors.find(a=>a.id===`foundation_${race}`)!);
      expect(anchors.every(Boolean)).toBe(true);
      for(const anchor of anchors)expect(terrain.sample(anchor.x,anchor.y).water).toBe(false);
      for(let a=0;a<anchors.length;a++)for(let b=a+1;b<anchors.length;b++)
        expect(Math.hypot(anchors[a].x-anchors[b].x,anchors[a].y-anchors[b].y)).toBeGreaterThan(14_000);
    }
  },60_000);

  it('opens an already-lived drowned world by creating land under it without moving people, cities, time or RNG',async()=>{
    const sourceStore=new InMemoryWorldStore();
    const engine=await WorldEngine.create({
      worldId:'f2-drowned-homeland-save',
      seed:'f2-drowned-homeland-save',
      store:sourceStore,
      startTime:0,
    });
    for(let year=1;year<=12;year++)await engine.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR*year);
    const drowned=engine.snapshot();

    const targets:Record<string,WorldPoint2D>={
      settlement_dwarf_homeland:{x:2_000,y:-12_000},
      settlement_orc_homeland:{x:2_000,y:0},
      settlement_ogre_homeland:{x:2_000,y:12_000},
    };
    for(const [id,target] of Object.entries(targets))moveSettlementTo(drowned,id,target);
    drowned.routes=rebuildWorldRoutes(drowned.places,drowned.routes);
    const preTerrain=bindWorldTerrain(drowned)!;
    for(const id of Object.keys(targets)) {
      const center=drowned.places[id];
      expect(preTerrain.sample(center.mapX,center.mapY).water).toBe(true);
    }

    const preserved={
      minute:drowned.calendar.elapsedWorldMinutes,
      rng:drowned.determinism.rngState,
      settlements:Object.fromEntries(Object.keys(targets).map(id=>[
        id,{x:drowned.settlements[id].centerX,y:drowned.settlements[id].centerY},
      ])),
      agents:Object.fromEntries(Object.values(drowned.agents)
        .filter(agent=>Object.keys(targets).includes(drowned.places[agent.homeId]?.settlementId??''))
        .map(agent=>[agent.id,{...agent.position}])),
    };

    drowned.revision=0;
    const store=new InMemoryWorldStore();
    await store.initializeWorld(drowned);
    const repaired=await WorldEngine.open({worldId:drowned.id,store});
    const saved=repaired.snapshot();
    const terrain=bindWorldTerrain(saved)!;

    expect(saved.calendar.elapsedWorldMinutes).toBe(preserved.minute);
    expect(saved.determinism.rngState).toBe(preserved.rng);
    for(const [id,center] of Object.entries(preserved.settlements)){
      expect(saved.settlements[id].centerX).toBe(center.x);
      expect(saved.settlements[id].centerY).toBe(center.y);
      const members=Object.values(saved.places).filter(place=>place.settlementId===id);
      expect(members.length).toBeGreaterThan(10);
      expect(members.every(place=>!terrain.sample(place.mapX,place.mapY).water)).toBe(true);
    }
    for(const [id,position] of Object.entries(preserved.agents)){
      expect(saved.agents[id].position).toEqual(position);
    }
    expect(saved.terrain!.offshore?.filter(land=>land.id.startsWith('homeland-rescue:')).length).toBe(3);

    const reopened=await WorldEngine.open({worldId:saved.id,store});
    expect(reopened.snapshot()).toEqual(saved);
  },120_000);
});
