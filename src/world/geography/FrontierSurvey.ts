import type {WorldState,WorldBiome,WorldPoint2D} from '../types';
import {bindWorldTerrain,terrainPlotIsDry} from './WorldTerrain';
import {pointInPolygon} from '../BuildingFootprints';
import {nearestRiverPoint} from './RiverCourses';

/** The explorer still chooses to explore. The discovered ground is read from
 * the existing landscape instead of rolling a disconnected patch into being. */
export function surveyFrontier<T extends WorldPoint2D>(world:Readonly<WorldState>,proposed:T,wanted:WorldBiome,compatible:readonly WorldBiome[]=[wanted]):(T&{biome:WorldBiome})|undefined {
  const model=bindWorldTerrain(world);if(!model)return {...proposed,biome:wanted};
  let best:(T&{biome:WorldBiome})|undefined,bestCost=Infinity;
  for(let i=0;i<96;i++) {
    const radius=i?Math.sqrt(i)*2:0,angle=i*2.3999632297,x=proposed.x+Math.cos(angle)*radius,y=proposed.y+Math.sin(angle)*radius;
    const sample=model.sample(x,y);if(sample.water)continue;
    let biome:WorldBiome=sample.biome;
    if(wanted==='ancient_ruins')biome='ancient_ruins';
    for(const r of model.rivers.query({minX:x-2,minY:y-2,maxX:x+2,maxY:y+2}))if(nearestRiverPoint({x,y},r).distance<r.width+1)biome='river';
    for(const a of model.anchors.query({minX:x-3,minY:y-3,maxX:x+3,maxY:y+3}))if(a.water&&a.kind==='lake'&&a.water.some(p=>Math.hypot(p.x-x,p.y-y)<2))biome='lake';
    if(!pointInPolygon({x:x+2,y},model.outline)||!pointInPolygon({x:x-2,y},model.outline))biome='coast';
    const cost=radius+(compatible.includes(biome)?0:40);
    if(cost<bestCost){best={...proposed,x,y,biome};bestCost=cost;}if(i===0&&biome===wanted)break;
  }
  return best;
}

/** A new settlement reserves enough dry ground for its first streets and
 * fields. Existing town centres are never moved by this search. */
export function surveySettlementSite(world:Readonly<WorldState>,proposed:WorldPoint2D):WorldPoint2D|undefined {
  const model=bindWorldTerrain(world);if(!model)return proposed;
  for(let i=0;i<160;i++) {
    const radius=Math.sqrt(i)*.8,angle=i*2.3999632297;
    const p={x:proposed.x+Math.cos(angle)*radius,y:proposed.y+Math.sin(angle)*radius};
    if(model.sample(p.x,p.y).slope<.18&&terrainPlotIsDry(world.places,p,2))return p;
  }
  return undefined;
}
