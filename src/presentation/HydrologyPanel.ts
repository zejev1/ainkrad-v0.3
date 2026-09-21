import type { WorldState } from '../world/types';
import type { TruthfulInspectorSectionV16 } from '../v16/TruthfulInspectorsV16';
import { HYDROLOGY_SOURCES, HYDROLOGY_DATA_VERSION } from '../world/systems/water/HydrologyKnowledge';
import { waterForPlants, validWaterUnit } from '../world/systems/water/HydrologyModel';
import { bindWorldTerrain } from '../world/geography/WorldTerrain';
import { hydrologyTopology } from '../world/systems/water/HydrologyTopology';

const names = {normal:'обычный водный режим',drought:'почвенная засуха',flood:'переувлажнение / разлив'};
export function hydrologySections(world: Readonly<WorldState>, placeId: string): TruthfulInspectorSectionV16[] {
  const state=world.hydrologySystem, place=world.places[placeId];
  if(!state||!place)return [];
  const terrain=bindWorldTerrain(world), basin=terrain&&hydrologyTopology(terrain).basinAt(place.mapX,place.mapY);
  const s=state.units[placeId]??(basin?state.units[basin]:undefined);
  if(!s)return [];
  if(!validWaterUnit(s))return [{title:'Вода: участок изолирован',rows:[{label:'Диагностика',value:'Повреждённая запись сохранена. Запасы воды не заменены расчётными значениями.'}]}];
  const mm=(volume:number)=>(volume/s.spec.areaM2*1000).toFixed(1)+' мм';
  const p=waterForPlants(s), local=s.spec.id===placeId;
  return [{title:local?'Вода на участке':'Вода в бассейне',rows:[
    {label:'Состояние',value:names[s.condition]},
    {label:'Вода в почве / грунте',value:`${mm(s.soilM3)} / ${mm(s.groundwaterM3)}`},
    {label:'Запас воды в снеге',value:mm(s.snowM3)},
    {label:'Поверхностная вода',value:`${(s.surfaceM3/s.spec.surfaceAreaM2).toFixed(3)} м; выше ёмкости русла / участка: ${p.floodDepthM.toFixed(3)} м`},
    {label:'Последний шаг: осадки / таяние',value:`${mm(s.flux.precipitationM3)} / ${mm(s.flux.meltM3)}`},
    {label:'Последний шаг: испарение / растения',value:`${mm(s.flux.evaporationM3)} / ${mm(s.flux.transpirationM3)}`},
    {label:'Сток',value:`${s.flux.outflowM3.toFixed(1)} м³ за последний шаг → ${s.spec.downstream??'море'}`},
    {label:'Расчёт',value:`${local?'Локальный резервуар':'Усреднение по бассейну'}. Запасы и коэффициенты оценены моделью, это не измерения на Земле. Источники: USGS, FAO 56.`},
  ]}];
}
let previous='';
export function renderHydrologyStatus(world: Readonly<WorldState>): void {
  const element=document.getElementById('hydrology-agent-status');if(!element)return;
  const state=world.hydrologySystem;
  const text=!state?'Агент воды: инициализация при следующем шаге мира'
    :`Агент воды: ${state.fallback?'автономный резерв':'работает автономно'} · ${Object.values(state.units).filter(s=>s?.active).length} резервуаров · погрешность баланса активных участков ${(state.budget.relativeError*100).toExponential(1)}%`;
  if(text!==previous){previous=text;element.textContent=text;}
  element.title=state?.lastFault??`${HYDROLOGY_DATA_VERSION}. Дождь, снег, почва, грунт и сток; Кардинал не пополняет воду.`;
}
export function appendWaterSources(container: HTMLElement): void {
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Источники модели воды';details.append(summary);
  for(const source of HYDROLOGY_SOURCES){const p=document.createElement('p'),a=document.createElement('a');a.textContent=source.name;a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';p.append(a);details.append(p);}
  container.append(details);
}
