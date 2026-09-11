import type { WorldPlace, WorldPoint2D } from './types';

const TAU=Math.PI*2, RING_STEP=.32, FIRST_RING=.36;
function phase(center:WorldPoint2D):number { return Math.sin(center.x*.17+center.y*.113)*.25; }
function radius(ring:number):number { return FIRST_RING+ring*RING_STEP; }
function axisAngle(center:WorldPoint2D,sector:number):number { return phase(center)+sector*Math.PI/2; }
export function organicLanePoint(center:WorldPoint2D,ring:number,angle:number):WorldPoint2D {
  const r=radius(ring)*(1+.065*Math.sin(angle*3+phase(center))+.035*Math.sin(angle*5+.9));
  return {x:center.x+r*Math.cos(angle),y:center.y+r*Math.sin(angle)};
}
function slots(ring:number):number[] {
  const r=radius(ring),count=Math.max(8,Math.floor(TAU*(r-.09)/.18));
  const result:number[]=[];
  for(let n=0;n<count;n++) {
    const a=TAU*(n+.5)/count;
    const d=Math.abs(((a+Math.PI/4)%(Math.PI/2))-Math.PI/4)*r;
    if(d>.12)result.push(a);
  }
  return result;
}
export function organicLotAddress(center:WorldPoint2D,lot:number) {
  let pair=Math.floor(lot/2),ring=0,angles=slots(0);
  while(pair>=angles.length) {pair-=angles.length;angles=slots(++ring);}
  // Opposite parcels face the same winding street across a 4.5–5m gap.
  const angle=angles[pair]+phase(center),side=lot%2?1:-1;
  const lane=organicLanePoint(center,ring,angle);
  const p=organicLanePoint(center,ring,angle-.001),q=organicLanePoint(center,ring,angle+.001);
  const rotation=Math.atan2(q.y-p.y,q.x-p.x),width=.045+.005*(1+Math.sin(lot*.9))/2;
  const offset=.05+width/2;
  return {ring,angle,lane,rotation,width,x:lane.x-Math.sin(rotation)*side*offset,y:lane.y+Math.cos(rotation)*side*offset};
}
export function organicHomeLot(center:WorldPoint2D,lot:number):WorldPoint2D {
  const p=organicLotAddress(center,lot);return {x:p.x,y:p.y};
}
function arc(center:WorldPoint2D,ring:number,from:number,to:number):WorldPoint2D[] {
  const steps=Math.max(1,Math.ceil(Math.abs(to-from)*radius(ring)/.06));
  return Array.from({length:steps+1},(_,i)=>organicLanePoint(center,ring,from+(to-from)*i/steps));
}
function radial(center:WorldPoint2D,ring:number,angle:number):WorldPoint2D[] {
  const points=[center];
  for(let n=0;n<=ring;n++)points.push(organicLanePoint(center,n,angle));
  return points;
}
export function organicStreetPath(from:Readonly<WorldPlace>,to:Readonly<WorldPlace>,
  places:Readonly<Record<string,WorldPlace>>):WorldPoint2D[]|undefined {
  const townId=(p:Readonly<WorldPlace>)=>p.settlementId??(p.id==='secret_library_v18'?places.commons?.settlementId:undefined);
  const town=townId(from);if(!town||town!==townId(to))return undefined;
  const cp=Object.values(places).find(p=>p.settlementId===town&&['commons','city','village'].includes(p.kind));if(!cp)return undefined;
  const center={x:cp.mapX,y:cp.mapY};
  const approach=(p:Readonly<WorldPlace>):WorldPoint2D[]=>{
    const endpoint={x:p.mapX,y:p.mapY};
    if(p.urbanLayoutVersion!==3||p.urbanLot===undefined) {
      const dx=endpoint.x-center.x,dy=endpoint.y-center.y,len=Math.hypot(dx,dy),bend=Math.min(.025,len*.04);
      return [center,{x:center.x+dx*.5-dy/Math.max(1e-8,len)*bend,y:center.y+dy*.5+dx/Math.max(1e-8,len)*bend},endpoint];
    }
    const a=organicLotAddress(center,p.urbanLot);
    const sector=Math.round((a.angle-phase(center))/(Math.PI/2));
    const axis=axisAngle(center,sector);
    return [...radial(center,a.ring,axis),...arc(center,a.ring,axis,a.angle).slice(1),endpoint];
  };
  let a=approach(from),b=approach(to),shared=0;
  while(shared<Math.min(a.length,b.length)-1&&Math.hypot(a[shared+1].x-b[shared+1].x,a[shared+1].y-b[shared+1].y)<1e-8)shared++;
  a=a.slice(shared).reverse();b=b.slice(shared+1);
  return [...a,...b].filter((p,i,all)=>!i||Math.hypot(p.x-all[i-1].x,p.y-all[i-1].y)>1e-8);
}
