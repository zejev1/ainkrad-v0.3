import type {WorldMapCamera} from './WorldMapCamera';
import type {TerrainModel} from '../world/geography/TerrainModel';
import {clamp} from '../world/geography/TerrainMath';

const TILE_PIXELS=96,MAX_TILES=64;
type Tile={canvas:HTMLCanvasElement;x:number;y:number;size:number};
/** Progressive, small map tiles. One tile per frame avoids blocking touch
 * input; the existing image remains available during gesture composition. */
export class TerrainRaster {
  readonly canvas=document.createElement('canvas');
  private cache=new Map<string,Tile>();private modelKey='';
  private scheduled=0;
  private pending:{key:string;x:number;y:number;size:number}[]=[];
  private camera:{x:number;y:number;pixelsPerUnit:number;width:number;height:number}|undefined;
  private model:TerrainModel|undefined;
  private visibleKeys=new Set<string>();
  private working:{key:string;x:number;y:number;size:number;canvas:HTMLCanvasElement;data:ImageData;row:number}|undefined;
  readonly stats={generated:0,maxTileMs:0};
  constructor(){this.canvas.className='atlas-raster';this.canvas.setAttribute('aria-hidden','true');}
  get cacheSize(){return this.cache.size;}
  render(model:TerrainModel,camera:Readonly<WorldMapCamera>):void {
    if(model.foundation.key!==this.modelKey){this.cache.clear();this.working=undefined;this.modelKey=model.foundation.key;}
    this.model=model;this.camera={x:camera.x,y:camera.y,pixelsPerUnit:camera.pixelsPerUnit,width:camera.width,height:camera.height};
    if(this.canvas.width!==camera.width||this.canvas.height!==camera.height){this.canvas.width=camera.width;this.canvas.height=camera.height;}
    const ctx=this.canvas.getContext('2d')!;ctx.imageSmoothingEnabled=true;
    ctx.fillStyle='#3e829c';ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    const size=2**Math.ceil(Math.log2(160/camera.pixelsPerUnit));
    const left=camera.x-camera.width/2/camera.pixelsPerUnit,top=camera.y-camera.height/2/camera.pixelsPerUnit;
    const right=left+camera.width/camera.pixelsPerUnit,bottom=top+camera.height/camera.pixelsPerUnit;
    this.pending=[];this.visibleKeys.clear();
    for(let x=Math.floor(left/size);x<=Math.floor(right/size);x++)for(let y=Math.floor(top/size);y<=Math.floor(bottom/size);y++) {
      const key=size+':'+x+':'+y,tile=this.cache.get(key);this.visibleKeys.add(key);
      if(tile){this.cache.delete(key);this.cache.set(key,tile);this.draw(tile);}
      else {
        // Sampled overview colour is immediate; finer shading fills in without
        // blocking a pointer handler or manufacturing huge drawing surfaces.
        const c=this.color(model,x*size+size/2,y*size+size/2);
        ctx.fillStyle=`rgb(${c.join(',')})`;ctx.fillRect((x*size-left)*camera.pixelsPerUnit,(y*size-top)*camera.pixelsPerUnit,size*camera.pixelsPerUnit+1,size*camera.pixelsPerUnit+1);
        // Keep the already drawn coarser geography while the detailed tile
        // arrives, instead of flashing a blank block during a pinch.
        const parent=[...this.cache.values()].filter(t=>t.size>size&&t.x<=x*size&&t.y<=y*size&&t.x+t.size>=(x+1)*size&&t.y+t.size>=(y+1)*size).sort((a,b)=>a.size-b.size)[0];
        if(parent){const ratio=TILE_PIXELS/parent.size;ctx.drawImage(parent.canvas,(x*size-parent.x)*ratio,(y*size-parent.y)*ratio,size*ratio,size*ratio,
          (x*size-left)*camera.pixelsPerUnit,(y*size-top)*camera.pixelsPerUnit,size*camera.pixelsPerUnit+1,size*camera.pixelsPerUnit+1);}
        if(this.working?.key!==key)this.pending.push({key,x:x*size,y:y*size,size});
      }
    }
    this.pending.sort((a,b)=>Math.hypot(a.x+a.size/2-camera.x,a.y+a.size/2-camera.y)-Math.hypot(b.x+b.size/2-camera.x,b.y+b.size/2-camera.y));
    this.schedule();
  }
  private color(model:TerrainModel,x:number,y:number):number[] {
    const s=model.sample(x,y,false);if(s.water)return [53,118,146];
    const forest=s.biome==='forest'?Math.max(.75,clamp((s.moisture-.48)/.30)):s.biome==='plains'?Math.min(.4,clamp((s.moisture-.48)/.30)):clamp((s.moisture-.48)/.30);
    const mountain=clamp((s.height-850)/1250);
    let base=[145,171,103].map((c,i)=>c+([62,118,78][i]-c)*forest);
    base=base.map((c,i)=>c+([162,150,126][i]-c)*mountain);
    if(s.height<300&&s.moisture>.78){const wet=clamp((s.moisture-.78)*4);base=base.map((c,i)=>c+([94,141,119][i]-c)*wet);}
    if(s.height>2350){const snow=clamp((s.height-2350)/650);base=base.map((c,i)=>c+([230,233,221][i]-c)*snow);}
    const gx=model.elevation(x+20,y)-model.elevation(x-20,y),gy=model.elevation(x,y+20)-model.elevation(x,y-20);
    const shade=clamp(.96-(gx+gy)/150,.65,1.19);
    return base.map(c=>Math.round(clamp(c*shade,0,255)));
  }
  private draw(tile:Tile):void {
    const c=this.camera!;const x=(tile.x-c.x)*c.pixelsPerUnit+c.width/2,y=(tile.y-c.y)*c.pixelsPerUnit+c.height/2;
    this.canvas.getContext('2d')!.drawImage(tile.canvas,x,y,tile.size*c.pixelsPerUnit+1,tile.size*c.pixelsPerUnit+1);
  }
  private schedule():void {
    if(this.scheduled||(!this.pending.length&&!this.working))return;
    this.scheduled=requestAnimationFrame(()=>{
      this.scheduled=0;if(!this.model)return;const started=performance.now();
      if(!this.working){const job=this.pending.shift();if(!job)return;
        if(this.cache.has(job.key)){this.schedule();return;}
        const canvas=document.createElement('canvas');canvas.width=TILE_PIXELS;canvas.height=TILE_PIXELS;
        this.working={...job,canvas,data:canvas.getContext('2d')!.createImageData(TILE_PIXELS,TILE_PIXELS),row:0};
      }
      const job=this.working;
      do {
        const y=job.row++;for(let x=0;x<TILE_PIXELS;x++) {
          const colors=this.color(this.model,job.x+(x+.5)/TILE_PIXELS*job.size,job.y+(y+.5)/TILE_PIXELS*job.size),i=(y*TILE_PIXELS+x)*4;
          job.data.data[i]=colors[0];job.data.data[i+1]=colors[1];job.data.data[i+2]=colors[2];job.data.data[i+3]=255;
        }
      }while(job.row<TILE_PIXELS&&performance.now()-started<5);
      if(job.row===TILE_PIXELS) {
        job.canvas.getContext('2d')!.putImageData(job.data,0,0);const tile={canvas:job.canvas,x:job.x,y:job.y,size:job.size};this.cache.set(job.key,tile);
        while(this.cache.size>MAX_TILES){const first=this.cache.keys().next().value!;const old=this.cache.get(first)!;old.canvas.width=old.canvas.height=0;this.cache.delete(first);}
        if(this.visibleKeys.has(job.key))this.draw(tile);this.stats.generated++;this.working=undefined;
      }
      this.stats.maxTileMs=Math.max(this.stats.maxTileMs,performance.now()-started);
      this.canvas.dataset.tiles=String(this.cache.size);this.canvas.dataset.pending=String(this.pending.length+Number(Boolean(this.working)));
      this.schedule();
    });
  }
}
