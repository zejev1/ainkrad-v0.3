import type { WorldState } from '../world/types';

export interface SettlementOption { id: string; name: string; population: number }
/** Observer projection only: no discoveries, route writes, or Cardinal inputs. */
export function settlementOptions(world: Readonly<WorldState>): SettlementOption[] {
  const population = new Map<string,number>();
  for (const agent of Object.values(world.agents)) {
    if (!agent.life.alive) continue;
    const id=world.places[agent.homeId]?.settlementId;
    if(id)population.set(id,(population.get(id)??0)+1);
  }
  return Object.values(world.settlements).filter(s=>world.places[s.centerPlaceId])
    .map(s=>({id:s.id,name:s.name,population:population.get(s.id)??0}))
    .sort((a,b)=>a.name.localeCompare(b.name,'ru')||a.id.localeCompare(b.id));
}
export function createSettlementPicker(host: HTMLElement, selectTown: (id:string)=>void): { update(world: Readonly<WorldState>): void } {
  const label=document.createElement('label');label.textContent='Поселение ';
  const select=document.createElement('select');select.setAttribute('aria-label','Выбрать город или поселение');
  select.style.maxWidth='min(70vw, 280px)';
  const empty=document.createElement('option');empty.value='';empty.textContent='Выбрать поселение';select.append(empty);
  label.append(select);host.append(label);
  select.addEventListener('change',()=>{if(select.value)selectTown(select.value);});
  let signature='';
  return {update(world) {
    const options=settlementOptions(world),next=JSON.stringify(options);
    if(next===signature)return;signature=next;
    const selected=select.value;
    select.replaceChildren(empty);
    for(const town of options) {
      const option=document.createElement('option');option.value=town.id;
      option.textContent=`${town.name} · ${town.population} жителей`;select.append(option);
    }
    select.value=options.some(s=>s.id===selected)?selected:'';
  }};
}
