import type { WorldMapCamera } from './WorldMapCamera';

export type WorldMapGesturePhase='start'|'move'|'end';

/** Continuous camera gestures; no world or resident data enters this module. */
export function installWorldMapGestures(
  element:HTMLElement,
  camera:WorldMapCamera,
  changed:(phase:WorldMapGesturePhase)=>void,
):void {
  const pointers=new Map<number,{x:number;y:number}>();
  let start:{x:number;y:number}|undefined;
  let dragged=false;
  let tapTarget:HTMLButtonElement|null=null;
  let pinch:{distance:number;scale:number;anchor:{x:number;y:number}}|undefined;
  let bounds=element.getBoundingClientRect();

  element.style.touchAction='none';
  element.style.overscrollBehavior='contain';
  element.tabIndex=0;
  element.setAttribute('aria-label','Карта мира. Перемещение стрелками, масштаб плюс и минус.');

  const local=(x:number,y:number)=>({
    x:(x-bounds.left)*camera.width/Math.max(1,bounds.width),
    y:(y-bounds.top)*camera.height/Math.max(1,bounds.height),
  });
  const beginPinch=()=>{
    const [a,b]=[...pointers.values()];
    if(!a||!b)return;
    const center=local((a.x+b.x)/2,(a.y+b.y)/2);
    pinch={
      distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),
      scale:camera.pixelsPerUnit,
      anchor:camera.worldPoint(center.x,center.y),
    };
  };

  element.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    if(pointers.size===0){
      bounds=element.getBoundingClientRect();
      start={x:event.clientX,y:event.clientY};
      dragged=false;
      const target=event.target as Element|null;
      tapTarget=typeof target?.closest==='function'?target.closest<HTMLButtonElement>('button'):null;
      if(tapTarget&&!element.contains(tapTarget))tapTarget=null;
      changed('start');
    }
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    // Capture immediately, as in the user's main fix, so Android keeps
    // delivering the gesture when it starts on a building or label.
    if(!element.hasPointerCapture(event.pointerId))element.setPointerCapture(event.pointerId);
    if(pointers.size===2){beginPinch();dragged=true;tapTarget=null;}
  });

  element.addEventListener('pointermove',event=>{
    const prior=pointers.get(event.pointerId);
    if(!prior)return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>4)dragged=true;
    if(!dragged)return;
    if(pointers.size>=2&&pinch){
      const [a,b]=[...pointers.values()];
      if(!a||!b)return;
      const center=local((a.x+b.x)/2,(a.y+b.y)/2);
      camera.zoom(
        pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,
        center.x,
        center.y,
      );
      camera.x=pinch.anchor.x-(center.x-camera.width/2)/camera.pixelsPerUnit;
      camera.y=pinch.anchor.y-(center.y-camera.height/2)/camera.pixelsPerUnit;
    }else{
      camera.pan(
        (event.clientX-prior.x)*camera.width/Math.max(1,bounds.width),
        (event.clientY-prior.y)*camera.height/Math.max(1,bounds.height),
      );
    }
    changed('move');
  });

  const finish=(type:'pointerup'|'pointercancel'|'lostpointercapture',event:PointerEvent)=>{
    // Transferring Android's implicit child capture to the viewport emits a
    // bubbled loss on the child. It must not terminate the live gesture.
    if(type==='lostpointercapture'&&(event.target!==element||element.hasPointerCapture(event.pointerId)))return;
    if(!pointers.delete(event.pointerId))return;
    if(type==='pointercancel')tapTarget=null;
    pinch=undefined;
    if(pointers.size>=2)beginPinch();
    if(pointers.size===1)start=[...pointers.values()][0];
    if(!pointers.size){start=undefined;changed('end');}
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture'] as const){
    element.addEventListener(type,event=>finish(type,event));
  }

  element.addEventListener('click',event=>{
    // Keyboard activation does not belong to the previous pointer gesture.
    if(event.detail===0)return;
    const target=tapTarget;tapTarget=null;
    if(dragged){event.preventDefault();event.stopPropagation();dragged=false;return;}
    // Pointer capture retargets Chrome/Android's native click to the viewport.
    // Forward a real tap once to its original button, keeping immediate capture
    // for dragging from buildings and labels.
    if(event.target===element&&target&&target.isConnected){
      event.preventDefault();event.stopPropagation();target.click();
    }
  },true);
  element.addEventListener('wheel',event=>{
    event.preventDefault();bounds=element.getBoundingClientRect();
    const p=local(event.clientX,event.clientY);
    camera.zoom(camera.pixelsPerUnit*Math.exp(-Math.max(-250,Math.min(250,event.deltaY))*.002),p.x,p.y);
    changed('move');
  },{passive:false});
  element.addEventListener('dblclick',event=>{
    if((event.target as Element).closest('button'))return;
    event.preventDefault();bounds=element.getBoundingClientRect();
    const p=local(event.clientX,event.clientY);
    camera.zoom(camera.pixelsPerUnit*2,p.x,p.y);changed('end');
  });
  element.addEventListener('keydown',event=>{
    if(event.target!==element)return;
    const pan:Record<string,[number,number]>={ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,80],ArrowDown:[0,-80]};
    if(pan[event.key])camera.pan(...pan[event.key]);
    else if(event.key==='+'||event.key==='=')camera.zoom(camera.pixelsPerUnit*1.22);
    else if(event.key==='-')camera.zoom(camera.pixelsPerUnit/1.22);
    else return;
    event.preventDefault();changed('end');
  });
}
