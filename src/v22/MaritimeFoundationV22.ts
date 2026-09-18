import type { AgentState, V15WorldBookState, WorldPlace, WorldPoint2D, WorldState } from '../world/types';
import { buildingPolygon, buildingsHaveClearance } from '../world/BuildingFootprints';
import { bindWorldTerrain, terrainParcelIsDry } from '../world/geography/WorldTerrain';
import { waterAccess } from '../v21/SailingRoutes';
import type { SwimmingSessionV22 } from './SwimmingV22';

export const RULID_TOWN = 'settlement_rulid';
export const RULID_YARD = 'rulid_shipyard';
export const RULID_BEACH = 'rulid_beach';
export const MARITIME_PRIMER = 'rulid-public-maritime-primer-v22';
export type MaritimeSubjectV22 = 'boat' | 'fishing' | 'swimming';
export interface MaritimeKnowledgeV22 {
  boat: number; fishing: number; swimming: number; swimmingPractice: number;
  readingMinutes: number; lessonsGiven: number; practiceMinutes: number; practiceAttempts: number;
  firstLearnedWorldMinute?: number; lastLearnedWorldMinute?: number;
}
export interface HarborV22 {
  settlementId: string; shorePlaceId: string; shipyardPlaceId: string; pierPlaceId: string; beachPlaceId: string;
  /** A primitive slipway and moorings occupy the same coast work site. */
  launchWater: WorldPoint2D; createdWorldMinute: number; mooringCapacity: number; largeHullCapacity: number;
  source: 'player_authorized_foundation';
}
export interface MaritimeStudyV22 {
  agentId: string; placeId: string; subject: MaritimeSubjectV22; bookId: string;
  startedWorldMinute: number; endsWorldMinute: number;
}
export interface MaritimeWorldV22 {
  version: 1; harbors: Record<string, HarborV22>; knowledge: Record<string, MaritimeKnowledgeV22>;
  studies: Record<string, MaritimeStudyV22>; swims: Record<string, SwimmingSessionV22>;
}
export const maritimePointV22 = (place: Readonly<WorldPlace>): WorldPoint2D => ({x:place.mapX,y:place.mapY});
const distance = (a: WorldPoint2D,b: WorldPoint2D) => Math.hypot(a.x-b.x,a.y-b.y);
export function maritimeStateV22(world: WorldState): MaritimeWorldV22 {
  return world.maritime ??= {version:1,harbors:{},knowledge:{},studies:{},swims:{}};
}
export function maritimeKnowledgeV22(world: WorldState, id: string): MaritimeKnowledgeV22 {
  if (!world.agents[id]) throw new Error('Maritime knowledge requires a real resident.');
  return maritimeStateV22(world).knowledge[id] ??= {boat:0,fishing:0,swimming:0,swimmingPractice:0,
    readingMinutes:0,lessonsGiven:0,practiceMinutes:0,practiceAttempts:0};
}
export function harborForPlaceV22(world: Readonly<WorldState>, id: string): HarborV22 | undefined {
  return Object.values(world.maritime?.harbors ?? {}).find(h => h.shipyardPlaceId===id || h.pierPlaceId===id || h.beachPlaceId===id);
}
export function maritimePrimerAvailableV22(world: Readonly<WorldState>, placeId: string): boolean {
  return !!world.v15?.books?.[MARITIME_PRIMER] && Object.values(world.v15.items).some(item => item.bookId===MARITIME_PRIMER && item.locationId===placeId && !item.ownerAgentId);
}
export function knownLocalMaritimeSiteV22(world: Readonly<WorldState>, agent: Readonly<AgentState>, beach=false): string | undefined {
  if (!agent.life.alive || agent.movement) return;
  return Object.values(world.maritime?.harbors ?? {}).map(h=>beach?h.beachPlaceId:h.shipyardPlaceId)
    .filter(id => (agent.knownPlaceIds??[]).includes(id) && world.places[id] &&
      world.places[id].settlementId===world.places[agent.homeId]?.settlementId &&
      distance(agent.position,maritimePointV22(world.places[id]))<=12)
    .sort((a,b)=>distance(agent.position,maritimePointV22(world.places[a]))-distance(agent.position,maritimePointV22(world.places[b])))[0];
}
const PRIMER_PAGES = [
  'Лодка — не право ходить по воде. Для корпуса нужны древесина, соединения и заделка щелей. Сначала собирают малый корпус, проверяют течь у берега и только затем выходят на воду. Чтение не заменяет труд и испытания.',
  'Верфь расположена на суше у спуска к морю. Здесь строят и чинят корпус. Примитивный причал нужен для посадки, разгрузки и привязки лодки, чтобы её не унесло. Груз и люди имеют массу; перегружать судно нельзя. Более крупный корабль требует опыта прежних плаваний, материалов и места на верфи.',
  'Рыба живёт в воде и не появляется бесконечно. С берега можно пробовать ловить удочкой или сетью; на лодке улов получают после настоящего выхода, времени на воде и возвращения. В сильный шторм маленькая лодка небезопасна.',
  'Плавать возможно, но этому учатся телом. Одно знание слова «плавание» не удерживает человека на воде. Начинай у берега, имея возможность опереться на сушу; учись дышать, держаться на воде и возвращаться. Усталость, холод и волна опасны. Без умения можно захлебнуться и погибнуть. Детям нужен рядом взрослый; умелый пловец может объяснять и показывать другим.',
  'Наставник передаёт объяснение только тому, с кем действительно находится рядом. Навык не передаётся приказом: ученик сам решает учиться и сам упражняется. Далёкий друг не узнаёт об опасности без сообщения. Никто не обязан строить лодку или входить в воду.',
];
function addPrimer(world: WorldState, yard: string, beach: string): void {
  if (!world.v15) throw new Error('A physical maritime primer requires item persistence.');
  const book: V15WorldBookState = {id:MARITIME_PRIMER,title:'Берег, лодка и безопасное знакомство с водой',
    author:'Памятка, оставленная основателем мира',language:'ru',edition:1,
    pages:PRIMER_PAGES.map((text,index)=>({pageNumber:index+1,chapter:index<3?'Малое судно':'Плавание',minimumAgeYears:13,text,
      concepts:index<3?['корпус','причал','рыболовство']:['дыхание','обучение плаванию','риск утопления']})),
    totalWords:PRIMER_PAGES.join(' ').split(/\s+/u).length};
  (world.v15.books??={})[book.id] ??= book;
  for (const placeId of [yard,beach]) {
    const id = `${MARITIME_PRIMER}:${placeId}`;
    world.v15.items[id] ??= {id,kind:'artifact',name:book.title,createdWorldMinute:world.calendar.elapsedWorldMinutes,
      locationId:placeId,bookId:book.id,quality:0.6,effectiveness:0,reliability:0.8,
      description:'Общедоступная физическая памятка. Её нужно читать на месте; она не даёт готового навыка.'};
  }
}

/** Once per real world epoch. No calendar==0 relocation rule: even a paused
 * zero-minute save owns its coordinates. Old towns, residents and terrain are
 * never moved to make room. The caller commits a logged additive migration. */
export function ensureRulidHarborV22(world: WorldState): {changed:boolean; blocked?:string} {
  const town=world.settlements[RULID_TOWN], shore=world.places.rulid_shore;
  if (!town || !shore || !world.terrain || !world.v15) return {changed:false};
  if (world.maritime?.harbors[RULID_TOWN]) return {changed:false};
  const center=world.places[town.centerPlaceId], terrain=bindWorldTerrain(world)!;
  const wet=waterAccess(world,maritimePointV22(shore));
  if (!center || !wet || terrain.isLand(wet) || distance(maritimePointV22(center),maritimePointV22(shore))>12) {
    return {changed:false,blocked:'Rulid has no verified local sea bank; existing coordinates were preserved.'};
  }
  const dx=wet.x-shore.mapX,dy=wet.y-shore.mapY,len=Math.hypot(dx,dy);
  const normal={x:dx/len,y:dy/len},tangent={x:-normal.y,y:normal.x};
  const specs = [
    {id:RULID_YARD,name:'Верфь и примитивный причал Рулида',kind:'workshop' as const,side:1,capacity:18},
    {id:RULID_BEACH,name:'Учебный пляж Рулида',kind:'shore' as const,side:-1,capacity:28},
  ];
  const proposed: WorldPlace[]=[];
  for (const spec of specs) {
    const existing=world.places[spec.id];
    if (existing) {
      if (existing.settlementId!==RULID_TOWN || terrain.sample(existing.mapX,existing.mapY).water || !waterAccess(world,maritimePointV22(existing))) {
        return {changed:false,blocked:`Existing ${spec.id} is not a verified dry coastal site; refusing relocation.`};
      }
      proposed.push(existing);continue;
    }
    let selected: WorldPlace|undefined;
    for (const along of [0.3,0.45,0.6,0.8,1,1.2]) {
      for (const inland of [0.03,0.07,0.12,0.18]) {
        const place: WorldPlace={id:spec.id,name:spec.name,kind:spec.kind,capacity:spec.capacity,biome:'coast',surface:'shore',
          mapX:shore.mapX+tangent.x*spec.side*along-normal.x*inland,
          mapY:shore.mapY+tangent.y*spec.side*along-normal.y*inland,
          connectedPlaceIds:[],fertility:0.2,danger:0.08,settlementId:RULID_TOWN,
          urbanLayoutVersion:3,geographyVersion:1,discoveredAt:world.now};
        const footprint=buildingPolygon(place,0.04);
        if (!terrainParcelIsDry(world.places,footprint) || !waterAccess(world,maritimePointV22(place))) continue;
        if ([...Object.values(world.places),...proposed].some(other=>other.id!==place.id&&!buildingsHaveClearance(place,other,0.06))) continue;
        if (spec.kind==='shore') place.boundaryPolygon=footprint;
        selected=place;break;
      }
      if (selected) break;
    }
    if (!selected) return {changed:false,blocked:`No dry unoccupied plot for ${spec.id}; no overlapping fallback was created.`};
    proposed.push(selected);
  }
  for (const place of proposed) {
    world.places[place.id] ??= place;
    if (!town.memberPlaceIds.includes(place.id)) town.memberPlaceIds.push(place.id);
    for (const otherId of [town.centerPlaceId,shore.id,'ocean_ainkrad']) {
      const other=world.places[otherId];if(!other)continue;
      if (!place.connectedPlaceIds.includes(otherId)) place.connectedPlaceIds.push(otherId);
      if (!other.connectedPlaceIds.includes(place.id)) other.connectedPlaceIds.push(place.id);
    }
  }
  const harbor: HarborV22={settlementId:RULID_TOWN,shorePlaceId:shore.id,shipyardPlaceId:RULID_YARD,pierPlaceId:RULID_YARD,
    beachPlaceId:RULID_BEACH,launchWater:waterAccess(world,maritimePointV22(world.places[RULID_YARD]))!,
    createdWorldMinute:world.calendar.elapsedWorldMinutes,mooringCapacity:8,largeHullCapacity:1,source:'player_authorized_foundation'};
  maritimeStateV22(world).harbors[RULID_TOWN]=harbor;
  addPrimer(world,RULID_YARD,RULID_BEACH);
  const fishId='wildlife_rulid_coastal_fish';
  world.wildlife[fishId] ??= {id:fishId,species:'fish',habitatId:RULID_YARD,count:14,carryingCapacity:30,
    reproductionRate:0.18,alertness:0.12,threat:0.02,isMonster:false,lastChangedAt:world.now};
  // Keep existing urban plots fixed. New beach/yard records are already
  // validated, and natural facilities do not require replanning old streets.
  town.layoutSignature=Object.values(world.places).filter(p=>p.settlementId===RULID_TOWN).map(p=>p.id+':'+p.kind).sort().join('|');
  return {changed:true};
}
