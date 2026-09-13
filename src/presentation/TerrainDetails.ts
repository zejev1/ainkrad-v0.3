import {paintLocalRelief} from './TerrainRelief';
import {buildingPolygon,buildingSize,pointInPolygon} from '../world/BuildingFootprints';
import {distanceToSegment,hash,noise} from '../world/geography/TerrainMath';
import type {TerrainModel} from '../world/geography/TerrainModel';
import type {WorldPoint2D,WorldState} from '../world/types';
import type {WorldMapCamera} from './WorldMapCamera';

export interface TerrainDetail extends WorldPoint2D {id:string;kind:'tree'|'grass'|'rock';size:number;variant:number}
/** Stable metre-scale surface detail, sampled from the physical biome. LOD
 * selects a subset of the same cells; camera motion never consumes world RNG. */
export function terrainDetails(model:TerrainModel,camera:Readonly<WorldMapCamera>,world:Readonly<WorldState>):TerrainDetail[] {
  if(camera.pixelsPerUnit<45)return [];
  const cell=.12,pad=.2,left=camera.x-camera.width/2/camera.pixelsPerUnit-pad,top=camera.y-camera.height/2/camera.pixelsPerUnit-pad;
  const right=camera.x+camera.width/2/camera.pixelsPerUnit+pad,bottom=camera.y+camera.height/2/camera.pixelsPerUnit+pad;
  const count=(right-left)*(bottom-top)/(cell*cell);
  const stride=2**Math.max(0,Math.ceil(Math.log2(Math.sqrt(count/800))));
  const nearby=Object.values(world.places).filter(p=>p.mapX>left-2&&p.mapX<right+2&&p.mapY>top-2&&p.mapY<bottom+2);
  const plots=nearby.flatMap(p=>buildingSize(p).width?[buildingPolygon(p,.1)]:
    ['resource_field','cemetery'].includes(p.kind)&&p.boundaryPolygon?[p.boundaryPolygon]:[]);
  const roads=Object.values(world.routes).filter(r=>r.traversal!=='boat').flatMap(r=>r.waypoints.slice(1).flatMap((p,i)=>{
    const a=r.waypoints[i];return Math.max(a.x,p.x)>=left&&Math.min(a.x,p.x)<=right&&Math.max(a.y,p.y)>=top&&Math.min(a.y,p.y)<=bottom?[[a,p]]:[];
  }));
  const details:TerrainDetail[]=[];
  for(let ix=Math.floor(left/cell/stride)*stride;ix*cell<=right;ix+=stride)for(let iy=Math.floor(top/cell/stride)*stride;iy*cell<=bottom;iy+=stride){
    const id=`${model.foundation.seed}:${ix}:${iy}`,unit=(suffix:string)=>hash(id+suffix)/4294967296;
    const p={x:(ix+.15+unit('x')*.7)*cell,y:(iy+.15+unit('y')*.7)*cell};
    if(p.x<left||p.y<top||p.x>right||p.y>bottom)continue;
    const sample=model.sample(p.x,p.y);if(sample.water||plots.some(poly=>pointInPolygon(p,poly))||roads.some(([a,b])=>distanceToSegment(p,a,b).distance<.11))continue;
    const roll=unit('kind'),variant=unit('variant');
    const patch=noise(ix*.17,iy*.17,model.foundation.seed);
    const tree=sample.biome==='forest'?roll<.48+patch*.46:sample.biome==='swamp'?roll<.24:sample.biome==='plains'&&roll<.035;
    const kind=tree?'tree':sample.biome==='mountains'&&roll<.06+patch*.48?'rock':'grass';
    if(kind==='grass'&&camera.pixelsPerUnit<110)continue;
    // Avoid tree crowns spilling into a bank, house or cleared road.
    const size=kind==='tree'?.035+variant*.04:kind==='rock'?.018+variant*.03:.012+variant*.015;
    if(kind==='tree'&&[[size,0],[-size,0],[0,size],[0,-size]].some(([dx,dy])=>model.sample(p.x+dx,p.y+dy).water))continue;
    details.push({...p,id,kind,size,variant});
  }
  return details.sort((a,b)=>a.y-b.y).slice(0,1000);
}

/** A viewport-sized layer; existing gesture composition moves this canvas
 * together with the map. No DOM per tree and no growing zoom surface. */
export class TerrainDetails {
  readonly canvas=document.createElement('canvas');
  constructor(){this.canvas.className='atlas-details';this.canvas.setAttribute('aria-hidden','true');}
  render(model:TerrainModel,camera:Readonly<WorldMapCamera>,world:Readonly<WorldState>):void {
    const canvas=this.canvas;canvas.width=camera.width;canvas.height=camera.height;
    const ctx=canvas.getContext('2d')!,scale=camera.pixelsPerUnit;
    paintLocalRelief(ctx,model,camera);
    const details=terrainDetails(model,camera,world);
    canvas.dataset.features=String(details.length);
    for(const d of details){
      const x=(d.x-camera.x)*scale+camera.width/2,y=(d.y-camera.y)*scale+camera.height/2,r=d.size*scale;
      ctx.save();ctx.translate(x,y);
      if(d.kind==='tree'){
        ctx.fillStyle='#192e2533';ctx.beginPath();ctx.ellipse(r*.7,r*.35,r*1.15,r*.48,.3,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#66503a';ctx.lineWidth=Math.max(1,r*.22);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-r*.8);ctx.stroke();
        if(d.variant>.6){
          for(let n=0;n<3;n++){const w=r*(1-n*.22),h=-r*(.25+n*.5);ctx.fillStyle=['#284d38','#356445','#477c50'][n];ctx.beginPath();ctx.moveTo(-w,h);ctx.quadraticCurveTo(-w*.4,h-r*.5,0,h-r*1.15);ctx.quadraticCurveTo(w*.4,h-r*.5,w,h);ctx.closePath();ctx.fill();}
        }else{
          ctx.fillStyle='#2e583d';ctx.beginPath();ctx.ellipse(0,-r*.9,r,r*.82,0,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='#528557';ctx.beginPath();ctx.ellipse(-r*.23,-r*1.13,r*.72,r*.57,-.35,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='#7a9f62';ctx.beginPath();ctx.ellipse(-r*.4,-r*1.29,r*.35,r*.26,-.35,0,Math.PI*2);ctx.fill();
        }
      }else if(d.kind==='rock'){
        ctx.fillStyle='#38403530';ctx.beginPath();ctx.ellipse(r*.3,r*.15,r*1.2,r*.5,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#777e72';ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(-r*.65,-r*.8);ctx.lineTo(r*.3,-r);ctx.lineTo(r,-r*.25);ctx.lineTo(r*.6,r*.15);ctx.closePath();ctx.fill();
        ctx.fillStyle='#c0bca1';ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(-r*.65,-r*.8);ctx.lineTo(r*.3,-r);ctx.lineTo(0,-r*.12);ctx.closePath();ctx.fill();
      }else{
        ctx.strokeStyle=d.variant>.5?'#6f8e4f':'#a3b36d';ctx.lineWidth=Math.max(.7,scale*.003);
        ctx.beginPath();ctx.moveTo(-r,0);ctx.quadraticCurveTo(-r*.8,-r*.8,-r*1.4,-r);ctx.moveTo(0,0);ctx.quadraticCurveTo(r*.1,-r,r*.5,-r*1.6);ctx.moveTo(r*.5,0);ctx.lineTo(r*1.4,-r*.7);ctx.stroke();
      }
      ctx.restore();
    }
  }
}
