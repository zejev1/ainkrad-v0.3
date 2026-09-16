import { describe, expect, it, vi } from 'vitest';
import { FeatureIndex } from '../src/world/geography/FeatureIndex';
import { PreparedPolygonQuery } from '../src/world/PreparedPolygonQuery';
import { pointInPolygon, segmentHitsPolygon } from '../src/world/BuildingFootprints';
import { rebuildWorldRoutes, routeIdBetween } from '../src/world/WorldNavigation';
import { pathCrossesWater } from '../src/world/WaterNavigation';
import { segmentEntersBuilding } from '../src/world/SettlementStreets';
import type { WorldPlace, WorldPoint2D } from '../src/world/types';

function place(id: string, x: number, y: number, kind: WorldPlace['kind'] = 'meadow'): WorldPlace {
  return { id, name: id, kind, capacity: 5, biome: 'plains', mapX: x, mapY: y,
    connectedPlaceIds: [], fertility: .5, danger: .1, surface: 'land' };
}
const rectangle = (x: number, y: number, w: number, h: number): WorldPoint2D[] =>
  [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];

describe('indexed physical polygon predicates', () => {
  it('matches the existing even-odd and segment rules, including an ocean with a land hole', () => {
    const outer = rectangle(-50,-50,100,100), hole = rectangle(-10,-12,20,24);
    const polygons = [rectangle(-1,-2,2,4), [...rectangle(-2,-2,4,4)].reverse(),
      [{x:-4,y:0},{x:0,y:-1},{x:4,y:0},{x:1,y:1},{x:0,y:6},{x:-1,y:1}],
      [...outer, outer[0], ...hole, hole[0], outer[0]], [], [{x:0,y:0}]];
    let rng = 17;
    const next = () => { rng = (Math.imul(rng,1664525) + 1013904223) >>> 0; return rng/2**32; };
    for (const polygon of polygons) {
      const query = new PreparedPolygonQuery(polygon);
      for (let i=0;i<1800;i++) {
        const a={x:next()*140-70,y:next()*140-70}, b={x:next()*140-70,y:next()*140-70};
        expect(query.contains(a)).toBe(pointInPolygon(a,polygon));
        expect(query.hitsSegment(a,b)).toBe(segmentHitsPolygon(a,b,polygon));
      }
    }
  });
  it('keeps duplicated ocean-to-island connectors nonphysical', () => {
    const outer=rectangle(-100,-100,200,200), land=rectangle(-20,-20,40,40);
    const polygon=[...outer,outer[0],...land,land[0],outer[0]];
    const query=new PreparedPolygonQuery(polygon);
    expect(query.hitsSegment({x:-8,y:-5},{x:8,y:5})).toBe(false);
    expect(query.hitsSegment({x:0,y:0},{x:25,y:0})).toBe(true);
  });
});

describe('dependency-scoped route validation', () => {
  it('reuses verified roads for unrelated discoveries and distant construction, with their traversal evidence', () => {
    const a=place('a',-2,0), b=place('b',2,0); a.connectedPlaceIds=['b']; b.connectedPlaceIds=['a'];
    const places: Record<string,WorldPlace>={a,b};
    const first=rebuildWorldRoutes(places), id=routeIdBetween('a','b');
    first[id].completedTraversals=37;
    places.forest=place('forest',500,500,'forest');
    places.house=place('house',-600,200,'home');
    const second=rebuildWorldRoutes(places,first);
    expect(second[id]).toBe(first[id]);
    expect(second[id].completedTraversals).toBe(37);
    expect(second[id].waypoints).toEqual(first[id].waypoints);
  });
  it('invalidates only the road affected by a house moved into its middle', () => {
    const a=place('a',-.4,0),b=place('b',.4,0),c=place('c',20,20),d=place('d',21,20);
    a.connectedPlaceIds=['b']; b.connectedPlaceIds=['a']; c.connectedPlaceIds=['d'];d.connectedPlaceIds=['c'];
    const places:Record<string,WorldPlace>={a,b,c,d,house:place('house',50,50,'home')};
    const first=rebuildWorldRoutes(places), id=routeIdBetween('a','b');
    const bend=first[id].waypoints[Math.floor(first[id].waypoints.length/2)];
    places.house.mapX=bend.x;places.house.mapY=bend.y;
    const second=rebuildWorldRoutes(places,first);
    expect(second[id]).toBeDefined();expect(second[id]).not.toBe(first[id]);
    expect(second[routeIdBetween('c','d')]).toBe(first[routeIdBetween('c','d')]);
    expect(second[id].waypoints.slice(1).some((p,i)=>segmentEntersBuilding(second[id].waypoints[i],p,places.house))).toBe(false);
  });
  it('detects a water polygon edited in place without a length change', () => {
    const a=place('a',-2,0),b=place('b',2,0);a.connectedPlaceIds=['b'];b.connectedPlaceIds=['a'];
    const lake={...place('lake',20,20,'lake'),waterPolygon:rectangle(20,20,1,1)};
    const places:Record<string,WorldPlace>={a,b,lake};
    const first=rebuildWorldRoutes(places),id=routeIdBetween('a','b');
    const next=rectangle(-.3,-1,.6,2);
    next.forEach((p,i)=>Object.assign(lake.waterPolygon[i],p));
    const second=rebuildWorldRoutes(places,first);
    if (second[id]) {
      expect(second[id]).not.toBe(first[id]);
      expect(pathCrossesWater(second[id].waypoints,places)).toBe(false);
    }
    // Not a false positive passing because there was no original road.
    expect(first[id]).toBeDefined();
  });
  it('never trusts a persisted version flag or a mutated waypoint as proof of a safe path', () => {
    const a=place('a',-2,0),b=place('b',2,0);a.connectedPlaceIds=['b'];b.connectedPlaceIds=['a'];
    const places:Record<string,WorldPlace>={a,b,lake:{...place('lake',0,0,'lake'),waterPolygon:rectangle(-.3,-1,.6,2)}};
    const first=rebuildWorldRoutes(places),id=routeIdBetween('a','b');
    expect(first[id]).toBeDefined();
    first[id].waypoints=[{x:-2,y:0},{x:0,y:0},{x:2,y:0}];
    const second=rebuildWorldRoutes(places,first);
    expect(second[id]).toBeDefined();expect(pathCrossesWater(second[id].waypoints,places)).toBe(false);
    const loaded=structuredClone(first); // no runtime validation certificate
    const third=rebuildWorldRoutes(places,loaded);
    expect(third[id]).toBeDefined();expect(pathCrossesWater(third[id].waypoints,places)).toBe(false);
  });
  it('revokes an existing walking route when an endpoint becomes open water', () => {
    const a=place('a',-2,0), b=place('b',2,0); a.connectedPlaceIds=['b'];b.connectedPlaceIds=['a'];
    const places={a,b}; const first=rebuildWorldRoutes(places), id=routeIdBetween('a','b');
    expect(first[id]).toBeDefined(); b.surface='water';
    expect(rebuildWorldRoutes(places,first)[id]).toBeUndefined();
  });

  it('does not repeat an impossible construction for remote discoveries, but retries after its actual blocker changes', () => {
    const a=place('negative-a',-2,0), b=place('negative-b',2,0);
    a.connectedPlaceIds=[b.id]; b.connectedPlaceIds=[a.id];
    const lake={...place('negative-lake',-2,0,'lake'),waterPolygon:rectangle(-2.5,-.5,1,1)};
    const places:Record<string,WorldPlace>={[a.id]:a,[b.id]:b,[lake.id]:lake};
    const id=routeIdBetween(a.id,b.id);
    const checks=vi.spyOn(PreparedPolygonQuery.prototype,'hitsSegment');
    try {
      expect(rebuildWorldRoutes(places)[id]).toBeUndefined();
      const calls=checks.mock.calls.length;
      expect(calls).toBeGreaterThan(0);
      places.remote=place('negative-remote',800,800,'forest');
      expect(rebuildWorldRoutes(places)[id]).toBeUndefined();
      expect(checks.mock.calls.length).toBe(calls);
      // Runtime certificates survive clones, not via a trusted field in a save.
      expect(rebuildWorldRoutes(structuredClone(places))[id]).toBeUndefined();
      expect(checks.mock.calls.length).toBe(calls);
      rectangle(50,50,1,1).forEach((point,i)=>Object.assign(lake.waterPolygon[i],point));
      const opened=rebuildWorldRoutes(places);
      expect(opened[id]).toBeDefined();
      // The blocker is now outside the query; there is no water to intersect.
      // The newly constructed route, not another polygon call, proves retry.
      expect(opened[id].waypoints.length).toBeGreaterThan(1);
      expect(pathCrossesWater(opened[id].waypoints,places)).toBe(false);
    } finally { checks.mockRestore(); }
  });

});


describe('static feature bounds are prepared once, not rebuilt per navigation edge', () => {
  it('matches linear overlap for small/large queries without recalculating polygons', () => {
    const items=Array.from({length:120},(_,i)=>({id:i,minX:(i%12)*4,minY:Math.floor(i/12)*3,maxX:(i%12)*4+1,maxY:Math.floor(i/12)*3+1}));
    items.push({id:120,minX:-100,minY:-100,maxX:100,maxY:100});
    const bounds=vi.fn((item:typeof items[number])=>item);
    const index=new FeatureIndex(items,bounds,2);
    for(let i=0;i<160;i++) {
      const b=i===159?{minX:-200,minY:-200,maxX:200,maxY:200}:{minX:(i%16)*3-.5,minY:Math.floor(i/16)*3-.5,maxX:(i%16)*3+2,maxY:Math.floor(i/16)*3+2};
      const expected=items.filter(p=>p.minX<=b.maxX&&p.maxX>=b.minX&&p.minY<=b.maxY&&p.maxY>=b.minY).map(p=>p.id).sort((a,b)=>a-b);
      expect(index.query(b).map(p=>p.id).sort((a,b)=>a-b)).toEqual(expected);
    }
    expect(bounds).toHaveBeenCalledTimes(items.length);
  });
});
