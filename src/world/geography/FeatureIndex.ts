import type {WorldPoint2D} from '../types';
export interface FeatureBounds {minX:number;minY:number;maxX:number;maxY:number}
export function featureBounds(points:readonly WorldPoint2D[],margin=0):FeatureBounds {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
  return {minX:minX-margin,minY:minY-margin,maxX:maxX+margin,maxY:maxY+margin};
}
const overlap=(a:FeatureBounds,b:FeatureBounds)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minY<=b.maxY&&a.maxY>=b.minY;
/** Static uniform index: built on a terrain recipe change, never on a frame. */
export class FeatureIndex<T> {
  private buckets=new Map<string,number[]>();
  private broad:number[]=[];
  constructor(readonly items:readonly T[],private bounds:(item:T)=>FeatureBounds,private size=512) {
    items.forEach((item,id)=>{const b=bounds(item),x0=Math.floor(b.minX/size),x1=Math.floor(b.maxX/size),y0=Math.floor(b.minY/size),y1=Math.floor(b.maxY/size);
      if((x1-x0+1)*(y1-y0+1)>256){this.broad.push(id);return;}
      for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=x+':'+y,bucket=this.buckets.get(key)??[];bucket.push(id);this.buckets.set(key,bucket);}});
  }
  query(b:FeatureBounds):T[] {
    const x0=Math.floor(b.minX/this.size),x1=Math.floor(b.maxX/this.size),y0=Math.floor(b.minY/this.size),y1=Math.floor(b.maxY/this.size);
    if((x1-x0+1)*(y1-y0+1)>1024)return this.items.filter(item=>overlap(b,this.bounds(item)));
    const ids=new Set(this.broad);for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(const id of this.buckets.get(x+':'+y)??[])ids.add(id);
    return [...ids].filter(id=>overlap(b,this.bounds(this.items[id]))).map(id=>this.items[id]);
  }
}
