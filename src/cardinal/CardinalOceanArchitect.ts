import type {OceanDecision,OceanFrontierRequest,OffshoreLand} from '../world/geography/OceanExploration';
import {hash} from '../world/geography/TerrainMath';

/** A bounded geographic proposal from actual exploration evidence. This
 * component receives no mutable world, bodies, minds or resident commands. */
export class CardinalOceanArchitect {
  consider(request:Readonly<OceanFrontierRequest>):OceanDecision {
    const unit=(label:string)=>hash(`${request.seed}:${request.id}:${label}`)/4294967296;
    const choice=unit('kind');
    if(choice<.74)return {requestId:request.id};
    const kind:OffshoreLand['kind']=choice<.94?'islet':choice<.992?'island':'continent';
    const radius=kind==='islet'?2.5+unit('size')*2.5:kind==='island'?20+unit('size')*380:1500+unit('size')*1500;
    const angle=Math.atan2(request.direction.y,request.direction.x)+(unit('bearing')-.5)*.65;
    // Place the near shore beyond the already visible horizon. No teleport
    // onto new land, erased sea under a boat, or map prepopulation.
    const distance=radius+220+unit('spacing')*300;
    const center={x:request.position.x+Math.cos(angle)*distance,y:request.position.y+Math.sin(angle)*distance};
    const outline=Array.from({length:32},(_,i)=>{
      const a=i*Math.PI/16+unit('coast-rotation')*Math.PI*2,r=radius*(i===0||i===16?1:.8+unit(`coast:${i}`)*.2);
      return {x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};
    });
    return {requestId:request.id,land:{id:request.id,kind,seed:request.seed,center,radius,outline}};
  }
}
