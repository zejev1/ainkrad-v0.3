import type { WorldMapCamera } from './WorldMapCamera';

export interface PaintedCamera { x:number; y:number; pixelsPerUnit:number }
export function mapInteractionTransform(painted:PaintedCamera,current:PaintedCamera) {
  return {x:(painted.x-current.x)*current.pixelsPerUnit,y:(painted.y-current.y)*current.pixelsPerUnit,
    scale:current.pixelsPerUnit/painted.pixelsPerUnit};
}
/** Move a viewport-sized composed layer while fingers move. Rebuild geometry
 * only when the cached image needs new edges/detail, and once on release.
 * Deferred snapshots replace one another; simulation and saving continue. */
export class MapInteraction {
  active=false;
  private layer:HTMLDivElement;
  private painted:PaintedCamera;
  private scheduled=0;
  private lastPaint=0;
  private pendingUpdate:(()=>void)|undefined;
  private idleTimer:ReturnType<typeof setTimeout>|undefined;
  readonly stats={transforms:0,paints:0,maxPaintMs:0};
  constructor(private root:HTMLElement,private camera:WorldMapCamera,private paint:()=>void) {
    this.painted=this.snapshot();
    this.layer=document.createElement('div');this.layer.className='map-motion-layer';
    for(const id of ['biomes-layer','roads-layer','settlements-layer','places-layer','wildlife-layer','agents-layer']) {
      const element=root.querySelector('#'+id);if(element)this.layer.append(element);
    }
    root.prepend(this.layer);
  }
  private snapshot():PaintedCamera{return {x:this.camera.x,y:this.camera.y,pixelsPerUnit:this.camera.pixelsPerUnit};}
  defer(update:()=>void):boolean {if(!this.active)return false;this.pendingUpdate=update;return true;}
  paintedFrame():void {
    this.painted=this.snapshot();this.layer.style.transform='';this.lastPaint=performance.now();
    this.root.dataset.camera=[this.painted.x,this.painted.y,this.painted.pixelsPerUnit].join(',');
  }
  gesture(phase:'start'|'move'|'end'):void {
    if(phase==='start'){this.active=true;this.layer.classList.add('is-moving');return;}
    if(phase==='end') {
      this.active=false;this.layer.classList.remove('is-moving');
      if(this.idleTimer)clearTimeout(this.idleTimer);
      this.invalidate();return;
    }
    this.active=true;
    this.layer.classList.add('is-moving');
    if(this.idleTimer)clearTimeout(this.idleTimer);
    this.idleTimer=setTimeout(()=>this.gesture('end'),180);
    this.invalidate();
  }
  invalidate():void {
    if(this.scheduled)return;
    this.scheduled=requestAnimationFrame(()=>{
      this.scheduled=0;
      const t=mapInteractionTransform(this.painted,this.camera);
      if(this.active) {
        this.layer.style.transform=`translate(${t.x}px,${t.y}px) scale(${t.scale})`;this.stats.transforms++;
        this.root.dataset.gestureFrames=String(this.stats.transforms);
        const edge=Math.abs(t.x)>this.camera.width*.28||Math.abs(t.y)>this.camera.height*.28;
        const detail=t.scale<.65||t.scale>1.55;
        if(!(edge||detail)||performance.now()-this.lastPaint<100)return;
      }
      const start=performance.now(),update=this.pendingUpdate;
      if(!this.active&&update){this.pendingUpdate=undefined;update();}else this.paint();
      this.paintedFrame();this.stats.paints++;this.stats.maxPaintMs=Math.max(this.stats.maxPaintMs,performance.now()-start);
      this.root.dataset.gesturePaints=String(this.stats.paints);
    });
  }
}
