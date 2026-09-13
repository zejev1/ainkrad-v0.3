import type { WorldPoint2D, WorldState } from '../world/types';
import { bindWorldTerrain } from '../world/geography/WorldTerrain';
import { localTerrainBiome } from '../world/geography/LocalExploration';

export const pointDistance = (a: WorldPoint2D, b: WorldPoint2D) => Math.hypot(a.x-b.x,a.y-b.y);
export const courseLength = (p: readonly WorldPoint2D[]) => p.slice(1).reduce((n,b,i)=>n+pointDistance(p[i],b),0);

export function waterSegment(world: Readonly<WorldState>, a: WorldPoint2D, b: WorldPoint2D): boolean {
  const terrain=bindWorldTerrain(world); if(!terrain) return false;
  const steps=Math.max(1,Math.ceil(pointDistance(a,b)/.04));
  for(let i=0;i<=steps;i++) if(!terrain.sample(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps).water) return false;
  return true;
}

/** A short dry launching approach is separate from the water course. */
export function waterAccess(world: Readonly<WorldState>, bank: WorldPoint2D): WorldPoint2D | undefined {
  const terrain=bindWorldTerrain(world); if(!terrain || terrain.sample(bank.x,bank.y).water) return;
  for(const radius of [.03,.08,.16,.3,.6]) for(let i=0;i<32;i++) {
    const angle=i*Math.PI/16,p={x:bank.x+Math.cos(angle)*radius,y:bank.y+Math.sin(angle)*radius};
    if(!terrain.sample(p.x,p.y).water) continue;
    // The approach crosses the bank once, not an island and another channel.
    let wet=false,valid=true;
    for(let s=0;s<=20;s++) {
      const water=terrain.sample(bank.x+(p.x-bank.x)*s/20,bank.y+(p.y-bank.y)*s/20).water;
      if(wet&&!water){valid=false;break;} wet ||= water;
    }
    if(valid) return p;
  }
}

/** Bounded water-only A*: no dry-land shortcuts and no arbitrary ocean hop. */
export function sailingCourse(world: Readonly<WorldState>, from: WorldPoint2D, to: WorldPoint2D): WorldPoint2D[] | undefined {
  const a=waterAccess(world,from), b=waterAccess(world,to);
  if(!a||!b||pointDistance(a,b)>40) return;
  if(waterSegment(world,a,b)) return [from,a,b,to];
  const step=Math.max(.08,Math.min(.4,pointDistance(a,b)/48));
  type Node={x:number;y:number;p:WorldPoint2D;g:number;f:number;parent?:Node};
  const first:Node={x:0,y:0,p:a,g:0,f:pointDistance(a,b)};
  const open=[first], best=new Map<string,number>([['0,0',0]]),closed=new Set<string>();
  for(let visits=0;open.length&&visits<1800;visits++) {
    let at=0;for(let i=1;i<open.length;i++)if(open[i].f<open[at].f)at=i;
    const node=open.splice(at,1)[0], key=`${node.x},${node.y}`;
    if(closed.has(key))continue;closed.add(key);
    if(pointDistance(node.p,b)<step*2 && waterSegment(world,node.p,b)) {
      const path:WorldPoint2D[]=[b,to];let n:Node|undefined=node;
      while(n){path.unshift(n.p);n=n.parent;}
      path.unshift(from);return path;
    }
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const x=node.x+dx,y=node.y+dy,k=`${x},${y}`,p={x:a.x+x*step,y:a.y+y*step};
      const g=node.g+Math.hypot(dx,dy)*step;
      if(closed.has(k)||g>60||g>=(best.get(k)??Infinity)||!waterSegment(world,node.p,p))continue;
      best.set(k,g);open.push({x,y,p,g,f:g+pointDistance(p,b),parent:node});
    }
  }
}

export function fishingCourse(world: Readonly<WorldState>, from: WorldPoint2D, roll: number): WorldPoint2D[] | undefined {
  const water=waterAccess(world,from);if(!water)return;
  for(let i=0;i<16;i++) {
    const angle=(roll+i/16)*Math.PI*2;
    for(const distance of [1.2,.6,.2]) {
      const p={x:water.x+Math.cos(angle)*distance,y:water.y+Math.sin(angle)*distance};
      if(waterSegment(world,water,p))return [from,water,p,water,from];
    }
  }
}

/** Survey a bearing selected by the resident. The site is not exposed to
 * their knowledge, the map or other residents until the vessel arrives. */
export function surveyLanding(world: Readonly<WorldState>, from: WorldPoint2D, roll: number) {
  const water=waterAccess(world,from), terrain=bindWorldTerrain(world);if(!water||!terrain)return;
  const existing=Object.values(world.places).filter(p=>p.surface!=='water');
  for(let i=0;i<24;i++) {
    const angle=(roll+i/24)*Math.PI*2;let previous=water;
    for(let step=1;step<=80;step++) {
      const p={x:water.x+Math.cos(angle)*step*.15,y:water.y+Math.sin(angle)*step*.15};
      if(terrain.sample(p.x,p.y).water) {previous=p;continue;}
      if(pointDistance(p,from)<1||existing.some(site=>pointDistance(p,{x:site.mapX,y:site.mapY})<.8))break;
      if(!waterSegment(world,water,previous))break;
      const biome=localTerrainBiome(world,p);
      if(biome)return {point:p,biome,course:[from,water,previous,p]};
      break;
    }
  }
}
