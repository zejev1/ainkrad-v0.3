import { buildingPolygon, buildingSize } from '../world/BuildingFootprints';
import type { WorldPlace,WorldPoint2D,WorldState } from '../world/types';
import { MapSpatialIndex,MapTileCache,boundsOf,type SpatialItem } from './MapSpatialIndex';
import type { WorldMapCamera } from './WorldMapCamera';
import { coastalLandmark } from './CoastalLandmark';

export type AtlasLevel='world'|'region'|'settlement'|'street'|'building';
export const atlasLevel=(scale:number):AtlasLevel=>scale<.04?'world':scale<6?'region':scale<90?'settlement':scale<650?'street':'building';
export interface AtlasArea extends SpatialItem {kind:string;polygon:WorldPoint2D[]}
interface AtlasPlace extends SpatialItem {placeId:string}
export class WorldAtlasIndex {
  private key='';
  private areas=new MapSpatialIndex<AtlasArea>([]);
  private places=new MapSpatialIndex<AtlasPlace>([]);
  private roads=new MapSpatialIndex<SpatialItem>([]);
  readonly tiles=new MapTileCache<AtlasArea[]>(64);
  revision=0;
  update(world:Readonly<WorldState>):void {
    const key=world.id+':'+(world.epoch??1)+':'+(world.geography?.revision??JSON.stringify(Object.values(world.places).map(p=>[p.id,p.mapX,p.mapY])));
    if(key===this.key)return;this.key=key;this.revision++;this.tiles.clear();
    const areas:AtlasArea[]=[],places:AtlasPlace[]=[],coast=coastalLandmark(world);
    for(const p of Object.values(world.places)) {
      const polygon=buildingSize(p).width?buildingPolygon(p):[{x:p.mapX,y:p.mapY}];
      places.push({id:p.id,placeId:p.id,...(p.id==='rulid_shore'&&coast?coast.bounds:boundsOf(polygon))});
      if(p.boundaryPolygon?.length)areas.push({id:p.id+':land',kind:p.surface==='water'?'water':p.kind,polygon:p.boundaryPolygon,...boundsOf(p.boundaryPolygon)});
      if(p.waterPolygon?.length)areas.push({id:p.id+':water',kind:'water',polygon:p.waterPolygon,...boundsOf(p.waterPolygon)});
    }
    for(const town of Object.values(world.settlements))if(town.boundaryPolygon?.length)
      areas.push({id:town.id+':town',kind:'settlement',polygon:town.boundaryPolygon,...boundsOf(town.boundaryPolygon)});
    this.areas=new MapSpatialIndex(areas);this.places=new MapSpatialIndex(places);
    this.roads=new MapSpatialIndex(Object.values(world.routes).map(r=>({id:r.id,...boundsOf(r.waypoints)})));
  }
  view(camera:Readonly<WorldMapCamera>,margin=0) {
    const a=camera.worldPoint(-margin,-margin),b=camera.worldPoint(camera.width+margin,camera.height+margin);
    return {minX:a.x,minY:a.y,maxX:b.x,maxY:b.y};
  }
  visibleAreas(camera:Readonly<WorldMapCamera>):AtlasArea[] {
    const size=2**Math.ceil(Math.log2(256/camera.pixelsPerUnit)),box=this.view(camera),result=new Map<string,AtlasArea>();
    const x0=Math.floor(box.minX/size),x1=Math.floor(box.maxX/size),y0=Math.floor(box.minY/size),y1=Math.floor(box.maxY/size);
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++) {
      const key=size+':'+x+':'+y;
      for(const area of this.tiles.get(key,()=>this.areas.query({minX:x*size,minY:y*size,maxX:(x+1)*size,maxY:(y+1)*size},300)))result.set(area.id,area);
    }
    return [...result.values()].slice(0,300);
  }
  visiblePlaces(world:Readonly<WorldState>,camera:Readonly<WorldMapCamera>,highlighted:ReadonlySet<string>):WorldPlace[] {
    const level=atlasLevel(camera.pixelsPerUnit);
    return this.places.query(this.view(camera,80)).map(x=>world.places[x.placeId]).filter(p=>{
      if(!p)return false;if(highlighted.has(p.id))return true;
      if(level==='world'||level==='region')return ['commons','city','village'].includes(p.kind);
      if(level==='settlement')return !['home','outskirts'].includes(p.kind)||camera.pixelsPerUnit>=20;
      return true;
    }).sort((a,b)=>Number(highlighted.has(b.id))-Number(highlighted.has(a.id))||
      Math.hypot(a.mapX-camera.x,a.mapY-camera.y)-Math.hypot(b.mapX-camera.x,b.mapY-camera.y)).slice(0,180);
  }
  visibleRoads(world:Readonly<WorldState>,camera:Readonly<WorldMapCamera>) {
    return this.roads.query(this.view(camera)).map(r=>world.routes[r.id]).filter(r=>r&&r.traversal!=='boat'&&(r.completedTraversals??0)>0).slice(0,500);
  }
}
