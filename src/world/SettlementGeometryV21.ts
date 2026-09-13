import { buildingRadius, dryBuildingPlot, nextUrbanHomeLot } from './SettlementStreets';
import { buildingPolygon, buildingsHaveClearance, buildingSize, polygonsOverlap } from './BuildingFootprints';
import { convexHull, fieldPolygon, geographySeed } from './WorldGeography';
import type { WorldPlace, WorldPoint2D, WorldState } from './types';
import {terrainPlotIsDry,terrainParcelIsDry} from './geography/WorldTerrain';

export const SETTLEMENT_LAYOUT_VERSION=3;
/** Plan on migration/construction only. Daily work never repeats this survey. */
export function updateSettlementGeometry(world:WorldState,move:(id:string,point:WorldPoint2D)=>void):void {
  const all=Object.values(world.places),water=all.filter(p=>p.surface==='water'||p.waterPolygon);
  for(const town of Object.values(world.settlements)) {
    const center=world.places[town.centerPlaceId];if(!center)continue;
    const origin={x:center.mapX,y:center.mapY};
    const layoutSeed=geographySeed(`${town.id}:${origin.x.toFixed(4)}:${origin.y.toFixed(4)}`);
    const members=all.filter(p=>p.settlementId===town.id ||
      (p.id===world.v18?.secretLibrary.placeId&&world.v18.secretLibrary.anchorPlaceId===center.id));
    const managed=['home','construction_site','workshop','library','quiet_space','resource_field','outskirts','cemetery'];
    const signature=members.map(p=>p.id+':'+p.kind).sort().join('|');
    if(town.layoutVersion===3&&town.layoutSignature===signature&&members.every(p=>!managed.includes(p.kind)||p.urbanLayoutVersion===3))continue;
    const safe=(place:WorldPlace,preferred:WorldPoint2D,minimum=0):WorldPoint2D|undefined=>{
      const size=buildingSize(place),hx=size.width/2||.10,hy=size.height/2||.10;
      for(let i=0;i<384;i++) {
        const r=i?.10*Math.sqrt(i):0,a=i*2.3999632297;
        const point={x:preferred.x+Math.cos(a)*r,y:preferred.y+Math.sin(a)*r};
        if(Math.hypot(point.x-origin.x,point.y-origin.y)<minimum)continue;
        if(!terrainPlotIsDry(world.places,point,Math.max(hx,hy))||!dryBuildingPlot(point,hx,hy,water,place.rotation))continue;
        const candidate={...place,mapX:point.x,mapY:point.y};
        if(all.some(p=>p.id!==place.id&&p.urbanLayoutVersion===3&&!buildingsHaveClearance(candidate,p)))continue;
        if(size.width>0&&Math.abs(point.x-origin.x)<hx+.06&&Math.abs(point.y-origin.y)<hy+.06)continue;
        return point;
      }
      return undefined;
    };
    let civic=0;
    for(const place of members.filter(p=>['library','workshop','quiet_space','cemetery'].includes(p.kind))
      .sort((a,b)=>Number(b.kind==='library')-Number(a.kind==='library')||a.id.localeCompare(b.id))) {
      const n=civic++;if(place.urbanLayoutVersion===3)continue;
      place.rotation=(layoutSeed-.5)*Math.PI*.72;
      const sx=n%2?-1:1,sy=n%4<2?-1:1;
      const plot=safe(place,{x:origin.x+sx*(.20+Math.floor(n/4)*.22),y:origin.y+sy*.19},.19);
      if(plot) {
        move(place.id,plot);
        if(place.id===world.v18?.secretLibrary.placeId){world.v18.secretLibrary.anchorMapX=plot.x;world.v18.secretLibrary.anchorMapY=plot.y;}
      }
    }
    for(const home of members.filter(p=>p.kind==='home'||p.kind==='construction_site').sort((a,b)=>a.id.localeCompare(b.id))) {
      if(home.urbanLayoutVersion===3)continue;
      const plot=nextUrbanHomeLot(world.places,origin,town.id);
      if(plot){home.rotation=plot.rotation;move(home.id,plot);home.urbanLot=plot.lot;}
    }
    const buildings=members.filter(p=>buildingRadius(p)>0);
    const corners=buildings.flatMap(p=>buildingPolygon(p,.04));
    corners.push(...[{x:origin.x-.12,y:origin.y-.12},{x:origin.x+.12,y:origin.y+.12}]);
    town.boundaryPolygon=convexHull(corners);
    const edge=Math.max(.22,...corners.map(p=>Math.hypot(p.x-origin.x,p.y-origin.y)));
    town.radius=edge;town.centerX=origin.x;town.centerY=origin.y;
    let field=0,fringe=0;
    for(const place of members.filter(p=>p.kind==='resource_field'||p.kind==='outskirts')) {
      const isField=place.kind==='resource_field',index=isField?field++:fringe++;
      const angle=(isField?.45:1.25)+index*1.8+layoutSeed*Math.PI*1.35;
      const r=edge+(isField?.40:.07);
      let point=safe(place,{x:origin.x+Math.cos(angle)*r,y:origin.y+Math.sin(angle)*r},edge+(isField?.34:.04));
      if(point&&isField) {
        // Survey the whole agricultural plot, including its corners.
        for(let n=0;point&&n<32;n++) {
          const candidate={...place,mapX:point.x,mapY:point.y,rotation:angle},polygon=fieldPolygon(candidate);
          if(terrainParcelIsDry(world.places,polygon)&&!polygonsOverlap(polygon,town.boundaryPolygon)&&!water.some(p=>polygonsOverlap(polygon,p.waterPolygon??p.boundaryPolygon??[]))) {
            place.rotation=angle;break;
          }
          point={x:origin.x+Math.cos(angle)*(r+n*.08),y:origin.y+Math.sin(angle)*(r+n*.08)};
          if(n===31)point=undefined;
        }
      }
      if(point){move(place.id,point);if(isField)place.boundaryPolygon=fieldPolygon(place);}
    }
    town.layoutVersion=3;town.layoutSignature=signature;
  }
}
