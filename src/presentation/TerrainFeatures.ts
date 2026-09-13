import type {TerrainModel} from '../world/geography/TerrainModel';
import type {WorldMapCamera} from './WorldMapCamera';
import {clipMapSegment} from './WorldMapCamera';
import {featureBounds} from '../world/geography/FeatureIndex';

const SVG='http://www.w3.org/2000/svg';
/** Named ridges and connected streams refer to the physical terrain model.
 * Small-scale symbols may have a minimum readable stroke, as in an atlas. */
export function paintRegionalFeatures(model:TerrainModel,camera:Readonly<WorldMapCamera>,parent:SVGGElement):void {
  const a=camera.worldPoint(0,0),b=camera.worldPoint(camera.width,camera.height),bounds=featureBounds([a,b]);
  const rivers=model.rivers.query(bounds),groups=new Map<number,string[]>();
  for(const r of rivers) {
    if(camera.pixelsPerUnit<.04&&r.flow<45)continue;
    const course=r.points??[r.from,r.to];
    const step=camera.pixelsPerUnit<.02?4:camera.pixelsPerUnit<.2?2:1;
    const width=Math.max(camera.pixelsPerUnit<6?.7:1.1,r.width*2*camera.pixelsPerUnit),bucket=Math.round(width*4)/4;
    const paths=groups.get(bucket)??[];
    for(let i=0;i<course.length-1;i+=step){const q=course[Math.min(course.length-1,i+step)],segment=clipMapSegment(camera.point(course[i].x,course[i].y),camera.point(q.x,q.y));
      if(segment)paths.push(`M${segment[0].x} ${segment[0].y}L${segment[1].x} ${segment[1].y}`);}
    groups.set(bucket,paths);
  }
  for(const [width,paths]of groups) {
    const p=document.createElementNS(SVG,'path');p.setAttribute('d',paths.join(' '));p.setAttribute('fill','none');p.setAttribute('stroke','#4a98b4');
    p.setAttribute('vector-effect','non-scaling-stroke');p.style.strokeWidth=width+'px';p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');p.dataset.terrain='river';parent.append(p);
  }
  const labels:{x:number;y:number;width:number}[]=[];
  if(camera.pixelsPerUnit<.06)for(const range of model.ranges) {
    const middle=range.points[Math.floor(range.points.length/2)],p=camera.point(middle.x,middle.y);
    if(p.x<8||p.x>92||p.y<5||p.y>95)continue;
    const x=p.x*camera.width/100,y=p.y*camera.height/100,width=range.name.length*6.5;
    if(labels.some(l=>Math.abs(l.x-x)<(l.width+width)/2+6&&Math.abs(l.y-y)<18))continue;
    labels.push({x,y,width});
    const text=document.createElementNS(SVG,'text');text.setAttribute('x','0');text.setAttribute('y','0');
    // The map SVG has a non-square viewBox scale. Compensate horizontally so
    // type stays readable on tall phone viewports rather than being squeezed.
    text.setAttribute('transform',`translate(${p.x} ${p.y}) scale(${camera.height/camera.width} 1)`);
    text.setAttribute('text-anchor','middle');text.setAttribute('fill','#3d4a3c');text.style.fontSize=(12/camera.height*100)+'px';text.textContent=range.name;
    parent.append(text);
  }
}
