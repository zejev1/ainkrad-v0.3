import { buildingRadius, dryBuildingPlot, nextUrbanHomeLot } from './SettlementStreets';
import { compactLibraryPlot } from './SettlementLibraryLayout';
import type { WorldPlace, WorldPoint2D, WorldState } from './types';

export const SETTLEMENT_LAYOUT_VERSION = 2;
/** Called only by schema repair and construction, never by a render frame. */
export function updateSettlementGeometry(world: WorldState,
  move: (id: string, point: WorldPoint2D) => void): void {
  const all=Object.values(world.places),water=all.filter(p=>p.surface==='water');
  const safePlot=(place:WorldPlace,origin:WorldPoint2D,preferred:WorldPoint2D,minimumDistance=0):WorldPoint2D|undefined=>{
    const radius=buildingRadius(place) || .05;
    for(let i=0;i<256;i++) {
      const r=i===0?0:.12*Math.sqrt(i),angle=i*2.3999632297;
      const p={x:preferred.x+Math.cos(angle)*r,y:preferred.y+Math.sin(angle)*r};
      if(!dryBuildingPlot(p,radius,radius,water))continue;
      if(Math.hypot(p.x-origin.x,p.y-origin.y)<Math.max(radius+.08,minimumDistance))continue;
      if(all.some(b=>b.id!==place.id && buildingRadius(b)>0 && b.urbanLayoutVersion===2 &&
        Math.abs(b.mapX-p.x)<buildingRadius(b)+radius+.035 &&
        Math.abs(b.mapY-p.y)<(b.kind==='home'?.05:buildingRadius(b))+radius+.035))continue;
      return p;
    }
    return undefined;
  };
  for(const town of Object.values(world.settlements)) {
    const center=world.places[town.centerPlaceId];if(!center)continue;
    const origin={x:center.mapX,y:center.mapY};
    const members=all.filter(p=>p.settlementId===town.id ||
      (p.id===world.v18?.secretLibrary.placeId && world.v18.secretLibrary.anchorPlaceId===center.id));
    const signature=members.map(p=>p.id+':'+p.kind).sort().join('|');
    if(town.layoutVersion===2 && town.layoutSignature===signature && members.every(p =>
      !['home','workshop','library','quiet_space','resource_field','outskirts'].includes(p.kind) || p.urbanLayoutVersion===2))continue;
    for(const place of members.filter(p=>p.kind==='library')) {
      if(place.urbanLayoutVersion===2)continue;
      const plot=compactLibraryPlot(world.places,origin,place.id);
      if(plot) {
        move(place.id,plot);
        if(place.id===world.v18?.secretLibrary.placeId) {
          world.v18.secretLibrary.anchorMapX=plot.x;world.v18.secretLibrary.anchorMapY=plot.y;
        }
      }
    }
    let civic=0;
    for(const place of members.filter(p=>p.kind==='workshop'||p.kind==='quiet_space').sort((a,b)=>a.id.localeCompare(b.id))) {
      const index=civic++,side=index%2? -1:1;
      if(place.urbanLayoutVersion===2)continue;
      const plot=safePlot(place,origin,{x:origin.x+side*(.25+Math.floor(index/2)*.21),y:origin.y-.14-.012*Math.sin(index)});
      if(plot)move(place.id,plot);
    }
    for(const home of members.filter(p=>p.kind==='home').sort((a,b)=>a.id.localeCompare(b.id))) {
      if(home.urbanLayoutVersion===2)continue;
      const plot=nextUrbanHomeLot(world.places,origin,town.id);
      if(plot) {move(home.id,plot);home.urbanLot=plot.lot;}
    }
    const built=members.filter(p=>['home','workshop','library','commons','city','village','quiet_space'].includes(p.kind));
    const edge=Math.max(.2,...built.map(p=>Math.hypot(p.mapX-origin.x,p.mapY-origin.y)+(buildingRadius(p)||.08)));
    town.radius=edge;
    let field=0,fringe=0;
    for(const place of members.filter(p=>p.kind==='resource_field'||p.kind==='outskirts')) {
      // Moving the agricultural perimeter after construction keeps it outside the enlarged town.
      const isField=place.kind==='resource_field',index=isField?field++:fringe++;
      const angle=(isField?.3:1.1)+index*1.7;
      const radius=edge+(isField?.28:.08);
      const preferred={x:origin.x+Math.cos(angle)*radius,y:origin.y+Math.sin(angle)*radius};
      const plot=safePlot(place,origin,preferred,edge+(isField?.12:0));
      if(plot)move(place.id,plot);
    }
    town.layoutVersion=2;town.layoutSignature=signature;
  }
}
