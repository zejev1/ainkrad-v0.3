import { buildingSize } from '../world/BuildingFootprints';
import { geographySeed } from '../world/WorldGeography';
import type { WorldPlace } from '../world/types';
import type { WorldMapCamera } from './WorldMapCamera';
import { atlasLevel } from './WorldAtlasIndex';
import { placeDrawing } from './WorldMapVisuals';

export function isPersistentMapLandmark(place:Readonly<WorldPlace>):boolean {
  return place.id === 'rulid_shore';
}

export function physicalPlaceDrawing(place:Readonly<WorldPlace>,close:boolean):string {
  if (place.id === 'rulid_shore') {
    return '<svg class="place-art rulid-harbor-art" viewBox="0 0 60 50" aria-hidden="true">' +
      '<path d="M0 0H27L23 50H0Z" fill="#c7bc8a"/>' +
      '<path d="M27 0H60V50H23Z" fill="#4b8598"/>' +
      '<path d="M7 29H39V34H7Z" fill="#765a3c" stroke="#4d3d2f" stroke-width="1"/>' +
      '<path d="M15 25V40M25 25V40M35 29V42" stroke="#4d3d2f" stroke-width="2"/>' +
      '<path d="M41 18L55 18L52 26H44Z" fill="#d6d1b2" stroke="#3f5055" stroke-width="1"/>' +
      '<path d="M48 7V18M48 8L55 14H48Z" fill="#e6e1c8" stroke="#53666b" stroke-width="1"/>' +
      '<path d="M32 42Q40 38 48 42T60 42" fill="none" stroke="#a8d3d1" stroke-width="2"/>' +
      '</svg>';
  }
  if(place.kind!=='home')return placeDrawing(place.kind);
  const roof=['#a65c43','#b57750','#945a48','#856c50'][Math.floor(geographySeed(place.id)*4)];
  const tiles=close?'<path d="M0 2H12M0 4H12M0 6H12M0 8H12M2 0V10M5 0V10M8 0V10M11 0V10" stroke="#d49a74" stroke-width=".12"/><rect x="8" y="1" width="1.5" height="2" fill="#655d50"/><path d="M4.8 10V9.3H6.4V10" fill="#5f4735"/>':'';
  return '<svg class="place-art" viewBox="0 0 12 10" aria-hidden="true"><rect width="12" height="10" fill="'+roof+'" stroke="#574737" stroke-width=".18"/>'+tiles+'<path d="M0 5H12" stroke="#743f31" stroke-width=".35"/></svg>';
}
export function applyPhysicalPlaceStyle(element:HTMLElement,place:Readonly<WorldPlace>,camera:Readonly<WorldMapCamera>):void {
  const size=buildingSize(place),town=['commons','city','village'].includes(place.kind),level=atlasLevel(camera.pixelsPerUnit);
  const pin=town&&(level==='world'||level==='region');
  const width=pin?18:size.width?size.width*camera.pixelsPerUnit:town ? .22*camera.pixelsPerUnit : 16;
  const height=pin?18:size.height?size.height*camera.pixelsPerUnit:town ? .22*camera.pixelsPerUnit : 16;
  element.style.setProperty('--physical-width',width+'px');element.style.setProperty('--physical-height',height+'px');
  element.style.setProperty('--building-angle',(place.rotation??0)+'rad');
  element.classList.toggle('is-town-pin',pin);element.classList.toggle('is-natural-marker',!size.width&&!town);
}
export interface MapLabelPlacement { offsetX:number;offsetY:number;width:number }
/** Declutter and keep names within the visible map, including edge settlements. */
export function visibleMapLabels(places:readonly WorldPlace[],camera:Readonly<WorldMapCamera>,highlighted:ReadonlySet<string>,
  names:ReadonlyMap<string,string>=new Map()):Map<string,MapLabelPlacement> {
  const occupied:{x:number;y:number;width:number;height:number}[]=[],result=new Map<string,MapLabelPlacement>();
  const sorted=[...places].sort((a,b)=>Number(highlighted.has(b.id))-Number(highlighted.has(a.id))||
    Number(['commons','village','city'].includes(b.kind))-Number(['commons','village','city'].includes(a.kind)));
  for(const p of sorted) {
    if(p.kind==='home'&&!highlighted.has(p.id))continue;
    const point=camera.point(p.mapX,p.mapY),cx=point.x*camera.width/100,cy=point.y*camera.height/100;
    if(cx<0||cx>camera.width||cy<0||cy>camera.height)continue;
    const width=Math.min(180,Math.max(72,16+(names.get(p.id)??p.name).length*8)),height=23;
    const size=buildingSize(p),offset=Math.max(16,size.height*camera.pixelsPerUnit/2+4);
    const x=Math.max(4,Math.min(camera.width-width-4,cx-width/2)),y=Math.max(4,Math.min(camera.height-height-4,cy+offset));
    if(occupied.some(r=>x<r.x+r.width+8&&x+width+8>r.x&&y<r.y+r.height+5&&y+height+5>r.y))continue;
    result.set(p.id,{offsetX:x+width/2-cx,offsetY:y-cy,width});occupied.push({x,y,width,height});
    if(result.size>=24)break;
  }
  return result;
}
