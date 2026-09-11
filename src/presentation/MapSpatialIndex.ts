import type { WorldPoint2D } from '../world/types';
export interface MapBounds {minX:number;minY:number;maxX:number;maxY:number}
export interface SpatialItem extends MapBounds {id:string}
export const boundsOf=(points:readonly WorldPoint2D[]):MapBounds=>({
  minX:Math.min(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),
  maxX:Math.max(...points.map(p=>p.x)),maxY:Math.max(...points.map(p=>p.y)),
});
export const intersects=(a:MapBounds,b:MapBounds)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minY<=b.maxY&&a.maxY>=b.minY;
interface Node<T> extends MapBounds {items?:T[];left?:Node<T>;right?:Node<T>}
export class MapSpatialIndex<T extends SpatialItem> {
  private root?:Node<T>;
  constructor(items:T[]) {if(items.length)this.root=this.build(items);}
  private build(items:T[],depth=0):Node<T> {
    const box={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
    for(const item of items){box.minX=Math.min(box.minX,item.minX);box.minY=Math.min(box.minY,item.minY);box.maxX=Math.max(box.maxX,item.maxX);box.maxY=Math.max(box.maxY,item.maxY);}
    if(items.length<=12)return {...box,items};
    const key=depth%2?'minY':'minX',ordered=[...items].sort((a,b)=>a[key]-b[key]||a.id.localeCompare(b.id)),middle=Math.floor(ordered.length/2);
    return {...box,left:this.build(ordered.slice(0,middle),depth+1),right:this.build(ordered.slice(middle),depth+1)};
  }
  query(box:MapBounds,limit=Infinity):T[] {
    const result:T[]=[],stack=this.root?[this.root]:[];
    while(stack.length&&result.length<limit) {
      const node=stack.pop()!;if(!intersects(node,box))continue;
      if(node.items){for(const item of node.items)if(intersects(item,box)){result.push(item);if(result.length>=limit)break;}}
      else {if(node.right)stack.push(node.right);if(node.left)stack.push(node.left);}
    }
    return result;
  }
}
/** Geometry tiles are bounded by count, independent of zoom history. */
export class MapTileCache<T> {
  private entries=new Map<string,T>();
  constructor(readonly capacity=64){}
  get size(){return this.entries.size;}
  get(key:string,create:()=>T):T {
    let value=this.entries.get(key);
    if(value!==undefined){this.entries.delete(key);this.entries.set(key,value);return value;}
    value=create();this.entries.set(key,value);
    while(this.entries.size>this.capacity)this.entries.delete(this.entries.keys().next().value!);
    return value;
  }
  clear(){this.entries.clear();}
}
