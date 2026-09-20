import type { WorldState } from '../world/types';
import { PLANT_BY_ID, PLANT_DATA_VERSION, PLANT_SPECIES } from '../world/systems/plants/PlantKnowledge';
import { plantCover, type PlantLimitation } from '../world/systems/plants/VegetationModel';
import type { TruthfulInspectorSectionV16 } from '../v16/TruthfulInspectorsV16';

const limitations: Record<PlantLimitation, string> = { water: 'не хватает влаги', flooding: 'избыток воды',
  temperature: 'температура / сезон покоя', shade: 'не хватает света', soil: 'почва', space: 'занятое пространство', suitable: 'условия подходят' };
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
export function vegetationSections(world: Readonly<WorldState>, placeId: string): TruthfulInspectorSectionV16[] {
  const state = world.vegetationSystem, patch = state?.sites[placeId];
  if (!patch) return [{ title: 'Почва и растительность', rows: [{ label: 'Состояние', value: 'На этом участке растительность ещё не описана либо участок занят постройкой / открытой водой.' }] }];
  const rows = patch.plants.filter(c => c.adult + c.juvenile > 0.00001 || c.seeds > 0.00001)
    .sort((a, b) => b.adult + b.juvenile - a.adult - a.juvenile).map(c => {
      const s = PLANT_BY_ID.get(c.speciesId);
      return { label: s ? `${s.name} · ${s.scientificName}` : c.speciesId,
        value: `взрослые ${pct(c.adult)}, молодые ${pct(c.juvenile)}, семена/споры ${pct(c.seeds)} · ${limitations[c.limitation] ?? c.limitation}${s ? ` · ${s.facts.habitat}` : ' · вид отсутствует в текущем каталоге; данные сохранены'}` };
    });
  return [
    { title: 'Почва и растительность', rows: [
      { label: 'Покрытие живыми растениями', value: pct(plantCover(patch)) },
      { label: 'Влага / плодородие', value: `${pct(patch.water)} / ${pct(patch.fertility)}` },
      { label: 'Почва', value: `pH ≈ ${patch.habitat.soilPh.toFixed(1)} — оценка модели по местообитанию` },
      { label: 'Снег / подстилка', value: `${pct(patch.snow)} / ${pct(patch.litter)}` },
      { label: 'Изменение за шаг', value: `рост ${pct(patch.lastGrowth)}, отмирание ${pct(patch.lastMortality)}` },
      { label: 'Модель', value: `${state!.dataVersion}; покрытие и запас семян — нормированные индексы, не число отдельных растений.` },
      ...rows,
    ] },
    { title: 'Основания видового состава', rows: patch.plants.filter(c => c.adult + c.juvenile > 0.00001).flatMap(c => {
      const s = PLANT_BY_ID.get(c.speciesId);
      return s ? [{ label: s.scientificName, value: `${s.facts.range}. Источник: ${s.source}` }] : [];
    }) },
  ];
}

let display = '';
export function renderVegetationStatus(world: Readonly<WorldState>): void {
  const element = document.getElementById('vegetation-agent-status');
  if (!element) return;
  const agent = world.vegetationSystem;
  const next = !agent ? 'Агент почвы и растительности: добавится при следующем сохранении мира'
    : agent.fallback ? 'Агент почвы и растительности: резервная модель · мир продолжает жить'
    : 'Агент почвы и растительности: работает автономно';
  const title = agent?.lastFault ?? `${PLANT_SPECIES.length} видов · ${PLANT_DATA_VERSION}. Состав и причины роста — в инспекторе участка.`;
  if (display === next + title) return;
  display = next + title; element.textContent = next; element.title = title;
}

export function appendPlantSources(container: HTMLElement, world: Readonly<WorldState>, placeId: string): void {
  const patch = world.vegetationSystem?.sites[placeId];
  if (!patch) return;
  const section = document.createElement('section'); section.className = 'world-inspector__section';
  const heading = document.createElement('h3'); heading.textContent = 'Проверить источники'; section.append(heading);
  for (const c of patch.plants) {
    const s = PLANT_BY_ID.get(c.speciesId); if (!s || c.adult + c.juvenile <= 0.00001) continue;
    const link = document.createElement('a'); link.textContent = s.name; link.href = s.source;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    const row = document.createElement('p'); row.append(link); section.append(row);
  }
  container.append(section);
}
