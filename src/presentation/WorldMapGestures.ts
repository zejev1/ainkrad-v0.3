import type { WorldMapCamera } from './WorldMapCamera';

export function installWorldMapGestures(
  element: HTMLElement,
  camera: WorldMapCamera,
  changed: (settle?: boolean) => void
): void {
  const pointers = new Map<number,{x:number;y:number}>();
  let start:{x:number;y:number}|undefined;
  let dragged=false;
  let pinch:{distance:number;scale:number;anchor:{x:number;y:number}}|undefined;

  element.style.touchAction='none';
  element.style.overscrollBehavior='contain';

  const local=(x:number,y:number)=>{
    const b=element.getBoundingClientRect();
    return {x:x-b.left,y:y-b.top};
  };

  const beginPinch=()=>{
    const [a,b]=[...pointers.values()];
    if(!a||!b)return;

    const center=local((a.x+b.x)/2,(a.y+b.y)/2);

    pinch={
      distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),
      scale:camera.pixelsPerUnit,
      anchor:camera.worldPoint(center.x,center.y)
    };
  };

  element.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;

    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});

    if(pointers.size===1){
      start={x:event.clientX,y:event.clientY};
      dragged=false;
    }

    if(pointers.size===2){
      beginPinch();
      dragged=true;
    }

    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener('pointermove',event=>{
    const prior=pointers.get(event.pointerId);
    if(!prior)return;

    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});

    if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>4)
      dragged=true;

    if(!dragged)return;

    if(pointers.size>=2&&pinch){
      const [a,b]=[...pointers.values()];
      if(!a||!b)return;

      const center=local((a.x+b.x)/2,(a.y+b.y)/2);

      camera.zoom(
        pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,
        center.x,
        center.y
      );

      camera.x=pinch.anchor.x-(center.x-camera.width/2)/camera.pixelsPerUnit;
      camera.y=pinch.anchor.y-(center.y-camera.height/2)/camera.pixelsPerUnit;
    }else{
      camera.pan(
        event.clientX-prior.x,
        event.clientY-prior.y
      );
    }

    changed(false);
  });

  for(const type of ['pointerup','pointercancel','lostpointercapture'] as const){
    element.addEventListener(type,event=>{
      pointers.delete(event.pointerId);

      if(dragged) changed(true);

      pinch=undefined;

      if(pointers.size===2) beginPinch();
      if(!pointers.size) start=undefined;
    });
  }

  element.addEventListener('click',event=>{
    if(dragged){
      event.preventDefault();
      event.stopPropagation();
      dragged=false;
    }
  },true);

  element.addEventListener('wheel',event=>{
    event.preventDefault();

    const p=local(event.clientX,event.clientY);

    camera.zoom(
      camera.pixelsPerUnit*
      Math.exp(-Math.max(-250,Math.min(250,event.deltaY))*.002),
      p.x,p.y
    );

    changed(true);
  },{passive:false});
}
