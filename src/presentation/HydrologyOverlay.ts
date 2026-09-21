import type { WorldState } from '../world/types';
import { waterForPlants } from '../world/systems/water/HydrologyModel';
import { clipMapPolygon, type WorldMapCamera } from './WorldMapCamera';
const SVG='http://www.w3.org/2000/svg';
/** A bounded projection of committed local inundation. No water is simulated
 * by opening a map; basin-average water never paints an entire region blue. */
export function paintHydrologyOverlay(world:Readonly<WorldState>,camera:Readonly<WorldMapCamera>,parent:SVGGElement):void {
  parent.replaceChildren();
  if(camera.pixelsPerUnit<1)return;
  for(const s of Object.values(world.hydrologySystem?.units??{})) {
    if(!s?.active||s.spec?.kind!=='plot'||waterForPlants(s).floodDepthM<=0.02)continue;
    const r=Math.sqrt(s.spec.areaM2)/200;
    const points=clipMapPolygon([[-r,-r],[r,-r],[r,r],[-r,r]].map(([dx,dy])=>camera.point(s.spec.x+dx,s.spec.y+dy)));
    if(points.length<3)continue;
    const path=document.createElementNS(SVG,'path');path.setAttribute('d','M'+points.map(p=>`${p.x} ${p.y}`).join('L')+'Z');
    path.setAttribute('fill','#4d9db466');path.dataset.waterSite=s.spec.id;path.style.pointerEvents='none';
    const title=document.createElementNS(SVG,'title');title.textContent=`Разлив: ${waterForPlants(s).floodDepthM.toFixed(2)} м`;path.append(title);parent.append(path);
  }
}
