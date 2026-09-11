import { buildingSize } from '../world/BuildingFootprints';
import { geographySeed } from '../world/WorldGeography';
import type { WorldPlace } from '../world/types';
import type { WorldMapCamera } from './WorldMapCamera';
import { atlasLevel } from './WorldAtlasIndex';
import { placeDrawing } from './WorldMapVisuals';

export function physicalPlaceDrawing(place:Readonly<WorldPlace>,close:boolean):string {
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
/** Declutter labels in screen space, without changing resident place knowledge. */
export function visibleMapLabels(places:readonly WorldPlace[],camera:Readonly<WorldMapCamera>,highlighted:ReadonlySet<string>):Set<string> {
  const occupied:{x:number;y:number;width:number;height:number}[]=[],result=new Set<string>();
  const sorted=[...places].sort((a,b)=>Number(highlighted.has(b.id))-Number(highlighted.has(a.id))||
    Number(['commons','village','city'].includes(b.kind))-Number(['commons','village','city'].includes(a.kind)));
  for(const p of sorted) {
    if(p.kind==='home'&&!highlighted.has(p.id))continue;
    const center=camera.point(p.mapX,p.mapY),width=Math.min(180,Math.max(60,p.name.length*6.3)),height=20;
    const x=center.x*camera.width/100-width/2,y=center.y*camera.height/100+12;
    if(x<0||x+width>camera.width||y<0||y+height>camera.height)continue;
    if(occupied.some(r=>x<r.x+r.width+8&&x+width+8>r.x&&y<r.y+r.height+5&&y+height+5>r.y))continue;
    result.add(p.id);occupied.push({x,y,width,height});if(result.size>=24)break;
  }
  return result;
}
