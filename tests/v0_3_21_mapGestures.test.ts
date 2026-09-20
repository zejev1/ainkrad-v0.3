import {describe,it,expect} from 'vitest';
import {WorldMapCamera} from '../src/presentation/WorldMapCamera';
import {installWorldMapGestures} from '../src/presentation/WorldMapGestures';
import {mapInteractionTransform} from '../src/presentation/MapInteraction';

class TouchSurface {
  tabIndex=0;reads=0;child={};captures=new Set<number>();style:Record<string,string>={};
  listeners=new Map<string,((event:any)=>void)[]>();
  getBoundingClientRect(){this.reads++;return {left:0,top:0,width:390,height:600};}
  setAttribute(){}
  contains(){return true;}
  addEventListener(type:string,fn:(event:any)=>void){this.listeners.set(type,[...(this.listeners.get(type)??[]),fn]);}
  hasPointerCapture(id:number){return this.captures.has(id);}
  setPointerCapture(id:number){this.captures.add(id);this.event('lostpointercapture',id,0,0,this.child);}
  event(type:string,id:number,x:number,y:number,target:unknown=this){
    for(const fn of this.listeners.get(type)??[])fn({pointerId:id,clientX:x,clientY:y,button:0,target,preventDefault(){},stopPropagation(){}});
  }
}
describe('mobile camera input',()=>{
  it('forwards a captured tap once to the original button, but never a drag or cancelled touch',()=>{
    const surface=new TouchSurface(),camera=new WorldMapCamera();let activated=0;
    const button={isConnected:true,click(){activated++;}},label={closest:()=>button};
    installWorldMapGestures(surface as unknown as HTMLElement,camera,()=>{});
    surface.event('pointerdown',1,100,200,label);surface.event('pointerup',1,100,200);
    surface.event('click',1,100,200);surface.event('click',1,100,200);expect(activated).toBe(1);
    surface.event('pointerdown',2,100,200,label);surface.event('pointermove',2,160,200);
    surface.event('pointerup',2,160,200);surface.event('click',2,160,200);expect(activated).toBe(1);
    surface.event('pointerdown',3,100,200,label);surface.event('pointercancel',3,100,200);
    surface.event('click',3,100,200);expect(activated).toBe(1);
  });
  it('keeps dragging after Android implicit child capture is transferred to the map',()=>{
    const surface=new TouchSurface(),camera=new WorldMapCamera(),phases:string[]=[];
    installWorldMapGestures(surface as unknown as HTMLElement,camera,p=>phases.push(p));
    surface.event('pointerdown',1,100,200,surface.child);
    for(let x=110;x<=200;x+=10)surface.event('pointermove',1,x,200);
    expect(camera.x).toBeCloseTo(50-100/300);expect(phases.filter(p=>p==='move')).toHaveLength(10);
    expect(surface.reads).toBe(2); // no layout measurement per movement
    surface.event('pointerup',1,200,200);expect(phases.at(-1)).toBe('end');
    const x=camera.x;surface.event('pointermove',1,250,200);expect(camera.x).toBe(x);
  });
  it('continues with the remaining finger after a pinch and terminates cancellation',()=>{
    const surface=new TouchSurface(),camera=new WorldMapCamera();
    installWorldMapGestures(surface as unknown as HTMLElement,camera,()=>{});
    surface.event('pointerdown',1,100,200);surface.event('pointerdown',2,200,200);
    surface.event('pointermove',2,300,200);expect(camera.pixelsPerUnit).toBe(600);
    surface.event('pointerup',2,300,200);const prior=camera.x;
    surface.event('pointermove',1,130,200);expect(camera.x).toBeCloseTo(prior-.05);
    surface.event('pointercancel',1,130,200);const ended=camera.x;
    surface.event('pointermove',1,180,200);expect(camera.x).toBe(ended);
  });
  it('composed gestures match actual projected geography at every zoom',()=>{
    const camera=new WorldMapCamera(),painted={x:camera.x,y:camera.y,pixelsPerUnit:camera.pixelsPerUnit};
    const point={x:50.1,y:50.2},old=camera.point(point.x,point.y);
    camera.zoom(720,80,100);camera.pan(-40,35);
    const actual=camera.point(point.x,point.y),t=mapInteractionTransform(painted,camera);
    expect((old.x-50)*t.scale+50+t.x/camera.width*100).toBeCloseTo(actual.x);
    expect((old.y-50)*t.scale+50+t.y/camera.height*100).toBeCloseTo(actual.y);
  });
});

// The reported regression is both lost capture and repainting the whole world
// at pointer frequency. Exercise a long gesture with incoming world frames.
import {vi,afterEach} from 'vitest';
import {MapInteraction} from '../src/presentation/MapInteraction';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();});
it('composes 80 input frames, retains only the latest world update, then paints the final camera',()=>{
 vi.useFakeTimers();let now=0,raf:FrameRequestCallback|undefined,painted=0,applied=0;
 vi.spyOn(performance,'now').mockImplementation(()=>now);
 vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{raf=fn;return 1;});
 const layer={className:'',style:{transform:''},classList:{add(){},remove(){}},append(){}};
 vi.stubGlobal('document',{createElement:()=>layer});
 const root={querySelector:()=>undefined,prepend(){},dataset:{}},camera=new WorldMapCamera();
 const interaction=new MapInteraction(root as unknown as HTMLElement,camera,()=>painted++);
 const frame=()=>{now+=16;const fn=raf;raf=undefined;fn?.(now);};
 interaction.paintedFrame();interaction.gesture('start');
 for(let i=1;i<=80;i++){camera.pan(2,1);interaction.gesture('move');interaction.defer(()=>applied=i);frame();}
 expect(applied).toBe(0);expect(interaction.stats.transforms).toBe(80);expect(painted).toBeLessThan(5);
 interaction.gesture('end');frame();expect(applied).toBe(80);expect(layer.style.transform).toBe('');
 expect(interaction.active).toBe(false);expect(interaction.defer(()=>{})).toBe(false);
});
