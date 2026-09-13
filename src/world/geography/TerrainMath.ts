import type {WorldPoint2D} from '../types';
export const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export function hash(value:string):number {let h=2166136261;for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function lattice(x:number,y:number,seed:number):number {
  let h=Math.imul(x,374761393)^Math.imul(y,668265263)^seed;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;
}
export function noise(x:number,y:number,seed:number):number {
  const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,s=u*u*(3-2*u),t=v*v*(3-2*v);
  return lerp(lerp(lattice(ix,iy,seed),lattice(ix+1,iy,seed),s),lerp(lattice(ix,iy+1,seed),lattice(ix+1,iy+1,seed),s),t);
}
export function distanceToSegment(p:WorldPoint2D,a:WorldPoint2D,b:WorldPoint2D) {
  const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(1e-12,dx*dx+dy*dy));
  return {distance:Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t),t,point:{x:a.x+dx*t,y:a.y+dy*t}};
}
export class MinHeap {
  private values:{id:number;cost:number}[]=[];
  get size(){return this.values.length;}
  push(id:number,cost:number){const value={id,cost};let i=this.values.length;this.values.push(value);
    while(i>0){const p=(i-1)>>1;if(this.values[p].cost<=cost)break;this.values[i]=this.values[p];i=p;}this.values[i]=value;}
  pop(){const first=this.values[0],last=this.values.pop()!;if(this.values.length){let i=0;
    while(i*2+1<this.values.length){let c=i*2+1;if(c+1<this.values.length&&this.values[c+1].cost<this.values[c].cost)c++;
      if(this.values[c].cost>=last.cost)break;this.values[i]=this.values[c];i=c;}this.values[i]=last;}return first;}
}
