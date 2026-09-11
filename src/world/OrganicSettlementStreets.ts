import type { WorldPlace, WorldPoint2D } from './types';

function branchOf(lot: number): number { return Math.floor(lot / 16); }
function branchX(branch: number): number {
  return branch === 0 ? 0 : Math.ceil(branch / 2) * (branch % 2 ? 1 : -1) * 0.38;
}
function trunkY(x: number): number { return Math.sin(x * 3) * 0.035; }
function lanePoint(center: WorldPoint2D, branch: number, step: number): WorldPoint2D {
  const x = branchX(branch), direction = branch % 4 < 2 ? 1 : -1;
  return { x: center.x + x + Math.sin(step * 0.62 + branch * 0.8) * 0.018 - Math.sin(branch * 0.8) * 0.018,
    y: center.y + trunkY(x) + direction * step * 0.15 };
}
export function organicHomeLot(center: WorldPoint2D, lot: number): WorldPoint2D {
  const branch = branchOf(lot), row = Math.floor((lot % 16) / 2), side = lot % 2 ? 1 : -1;
  const point = lanePoint(center, branch, row + 2);
  // 12 x 10m houses: ordinary lane 4–4.6m, central lane 8–8.6m.
  return { x: point.x + side * ((branch === 0 ? 0.10 : 0.08) + 0.003 * (1 + Math.sin(lot * 1.7)) / 2),
    y: point.y + Math.sin(lot * 1.3) * 0.004 };
}
export function organicStreetPath(from: Readonly<WorldPlace>, to: Readonly<WorldPlace>,
  places: Readonly<Record<string, WorldPlace>>): WorldPoint2D[] | undefined {
  const townId = (p: Readonly<WorldPlace>) => p.settlementId ?? (p.id === 'secret_library_v18' ? places.commons?.settlementId : undefined);
  if (!townId(from) || townId(from) !== townId(to)) return undefined;
  const centerPlace = Object.values(places).find(p => p.settlementId === townId(from) && ['commons','city','village'].includes(p.kind));
  if (!centerPlace) return undefined;
  const center = {x: centerPlace.mapX,y: centerPlace.mapY};
  const approach = (p: Readonly<WorldPlace>): WorldPoint2D[] => {
    const start = {x:p.mapX,y:p.mapY};
    if (p.urbanLot === undefined || p.urbanLayoutVersion !== 2) {
      const dx=center.x-start.x,dy=center.y-start.y;
      const bend=Math.min(0.025, Math.hypot(dx,dy)*0.06), length=Math.max(1e-8,Math.hypot(dx,dy));
      return [start,{x:start.x+dx*.33-dy/length*bend,y:start.y+dy*.33+dx/length*bend},
        {x:start.x+dx*.67-dy/length*bend,y:start.y+dy*.67+dx/length*bend},center];
    }
    const branch=branchOf(p.urbanLot), row=Math.floor((p.urbanLot%16)/2);
    const points=[start];
    for(let step=row+2;step>=0;step--) points.push(lanePoint(center,branch,step));
    const x=branchX(branch), steps=Math.ceil(Math.abs(x)/0.095);
    for(let n=steps-1;n>=0;n--) {
      const offset=steps ? x*n/steps : 0;
      points.push({x:center.x+offset,y:center.y+trunkY(offset)});
    }
    if (!steps) points.push(center);
    return points;
  };
  const a=approach(from),b=approach(to);
  while(a.length>1&&b.length>1&&Math.hypot(a.at(-2)!.x-b.at(-2)!.x,a.at(-2)!.y-b.at(-2)!.y)<1e-8) {a.pop();b.pop();}
  return [...a,...b.reverse().slice(1)].filter((p,i,all)=>!i||Math.hypot(p.x-all[i-1].x,p.y-all[i-1].y)>1e-8);
}
