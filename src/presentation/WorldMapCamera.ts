import type { WorldPoint2D } from '../world/types';

export const MAX_MAP_VIEWPORT_WIDTH = 1280;
export const MAX_MAP_VIEWPORT_HEIGHT = 800;
export const MAX_VISIBLE_PLACES = 180;
export const MAX_VISIBLE_RESIDENTS = 120;

/** Zoom changes coordinates, never the dimensions of a DOM/GPU surface. */
export class WorldMapCamera {
  x = 50;
  y = 50;
  width = 390;
  height = 600;
  pixelsPerUnit = 300; // one world unit = 100m; initially 3 pixels per metre

  resize(width: number, height: number) {
    this.width = Math.max(1, Math.min(MAX_MAP_VIEWPORT_WIDTH, width));
    this.height = Math.max(1, Math.min(MAX_MAP_VIEWPORT_HEIGHT, height));
  }
  point(x: number, y: number): WorldPoint2D {
    return {x: 50 + (x-this.x)*this.pixelsPerUnit/this.width*100,
      y: 50 + (y-this.y)*this.pixelsPerUnit/this.height*100};
  }
  worldPoint(pixelX: number, pixelY: number): WorldPoint2D {
    return {x:this.x+(pixelX-this.width/2)/this.pixelsPerUnit,
      y:this.y+(pixelY-this.height/2)/this.pixelsPerUnit};
  }
  size(width: number, height = width) {
    return {width:width*this.pixelsPerUnit/this.width*100, height:height*this.pixelsPerUnit/this.height*100};
  }
  visible(x: number, y: number, marginPixels = 60) {
    return Math.abs(x-this.x)*this.pixelsPerUnit <= this.width/2+marginPixels &&
      Math.abs(y-this.y)*this.pixelsPerUnit <= this.height/2+marginPixels;
  }
  zoom(pixelsPerUnit: number, focalX = this.width/2, focalY = this.height/2) {
    const anchor = this.worldPoint(focalX,focalY);
    this.pixelsPerUnit = Math.max(0.0005,Math.min(1600,pixelsPerUnit));
    this.x = anchor.x-(focalX-this.width/2)/this.pixelsPerUnit;
    this.y = anchor.y-(focalY-this.height/2)/this.pixelsPerUnit;
  }
  pan(dx: number, dy: number) { this.x -= dx/this.pixelsPerUnit; this.y -= dy/this.pixelsPerUnit; }
}

/** Clip geometry before sending it to SVG/CSS: coordinates stay near the screen. */
export function clipMapSegment(a: WorldPoint2D,b: WorldPoint2D): WorldPoint2D[] | undefined {
  let lo=0,hi=1;
  const dx=b.x-a.x,dy=b.y-a.y;
  for (const [p,q] of [[-dx,a.x],[dx,100-a.x],[-dy,a.y],[dy,100-a.y]]) {
    if (Math.abs(p)<1e-12) { if(q<0)return undefined; continue; }
    const t=q/p;
    if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
    if(lo>hi)return undefined;
  }
  return [{x:a.x+lo*dx,y:a.y+lo*dy},{x:a.x+hi*dx,y:a.y+hi*dy}];
}

export function clipMapPolygon(points: WorldPoint2D[]): WorldPoint2D[] {
  let output=points;
  for (const [axis,edge,sign] of [['x',0,1],['x',100,-1],['y',0,1],['y',100,-1]] as const) {
    const input=output;output=[];
    if(!input.length)break;
    let a=input.at(-1)!;
    for(const b of input) {
      const aInside=(a[axis]-edge)*sign>=0,bInside=(b[axis]-edge)*sign>=0;
      if(aInside!==bInside) {
        const t=(edge-a[axis])/(b[axis]-a[axis]);
        output.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
      }
      if(bInside)output.push(b);
      a=b;
    }
  }
  return output;
}
