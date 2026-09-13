import type {TerrainModel} from '../world/geography/TerrainModel';
import type {WorldMapCamera} from './WorldMapCamera';

/** Subtle slope contours from actual elevation, with gaps at water. They do
 * not invent decorative hills or modify movement costs. */
export function paintLocalRelief(ctx:CanvasRenderingContext2D,model:TerrainModel,camera:Readonly<WorldMapCamera>):void {
  if(camera.pixelsPerUnit<45)return;
  const step=36,cols=Math.ceil(camera.width/step)+1,rows=Math.ceil(camera.height/step)+1;
  const sample=(x:number,y:number)=>model.sample(camera.x+(x-camera.width/2)/camera.pixelsPerUnit,camera.y+(y-camera.height/2)/camera.pixelsPerUnit);
  const values=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>sample(x*step,y*step)));
  const heights=values.flat().filter(s=>!s.water).map(s=>s.height);if(!heights.length)return;
  const range=Math.max(...heights)-Math.min(...heights);if(range<.75)return;
  const interval=2**Math.max(0,Math.ceil(Math.log2(range/12)));
  ctx.strokeStyle='#655e3f24';ctx.lineWidth=1;
  for(let y=0;y<rows-1;y++)for(let x=0;x<cols-1;x++){
    const points=[[x*step,y*step],[(x+1)*step,y*step],[(x+1)*step,(y+1)*step],[x*step,(y+1)*step]];
    const samples=[values[y][x],values[y][x+1],values[y+1][x+1],values[y+1][x]];
    if(samples.some(s=>s.water))continue;
    const h=samples.map(s=>s.height),low=Math.min(...h),high=Math.max(...h);
    for(let level=Math.ceil(low/interval)*interval;level<high;level+=interval){
      const intersections:number[][]=[];
      for(let i=0;i<4;i++){const j=(i+1)%4;if((h[i]<level)===(h[j]<level))continue;
        const t=(level-h[i])/(h[j]-h[i]);intersections.push([points[i][0]+(points[j][0]-points[i][0])*t,points[i][1]+(points[j][1]-points[i][1])*t]);}
      for(let i=1;i<intersections.length;i+=2){ctx.beginPath();ctx.moveTo(...intersections[i-1] as [number,number]);ctx.lineTo(...intersections[i] as [number,number]);ctx.stroke();}
    }
  }
}
