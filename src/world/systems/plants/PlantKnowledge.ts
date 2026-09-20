/** Source observations are deliberately separate from simulation calibration.
 * Temperate Eurasian assemblage; these are not geographic coordinates on Earth.
 * Sources were read on 2026-09-20. See data/plant-source-audit.json and the release audit.
 */
export const PLANT_DATA_VERSION = 'temperate-eurasia-2026-09-20';
export type PlantLayer = 'canopy' | 'ground';
export type MoisturePreference = 'dry-tolerant' | 'mesic' | 'wet';
export type Dispersal = 'wind' | 'animal' | 'water' | 'local';
export interface PlantSpecies {
  id: string; name: string; scientificName: string; source: string;
  facts: {
    habitat: string; range: string; layer: PlantLayer;
    moisture: MoisturePreference; shadeTolerant: boolean;
    nitrogenFixer: boolean; clonal: boolean; dispersal: readonly Dispersal[];
    /** Only numeric values explicitly present in the linked source. */
    measured?: { soilPh?: readonly [number, number]; maximumElevationM?: number; maximumLifespanYears?: number };
  };
  /** Numerical approximations for this simulation, NOT field measurements. */
  model: { water: readonly [number, number, number, number]; ph: readonly [number, number];
    growthPerYear: number; maturityYears: number; lifespanYears: number;
    dispersalMeters: number; coldLimitC: number; nutrientDemand: number; evergreen: boolean };
}
const euforgen = (name: string) => `https://www.euforgen.org/species/${name}`;
const usda = (id: string) => `https://plants.usda.gov/DocumentLibrary/plantguide/pdf/pg_${id}.pdf`;
function plant(id: string, name: string, scientificName: string, source: string,
  facts: PlantSpecies['facts'], model: PlantSpecies['model']): PlantSpecies {
  return Object.freeze({ id, name, scientificName, source,
    facts: Object.freeze({ ...facts, dispersal: Object.freeze([...facts.dispersal]),
      ...(facts.measured ? { measured: Object.freeze(facts.measured) } : {}) }),
    model: Object.freeze({ ...model, water: Object.freeze(model.water), ph: Object.freeze(model.ph) }) });
}
const tree = { layer: 'canopy' as const, nitrogenFixer: false, clonal: false };
const herb = { layer: 'ground' as const, nitrogenFixer: false, clonal: true };
export const PLANT_SPECIES: readonly PlantSpecies[] = Object.freeze([
  plant('pinus_sylvestris', 'Сосна обыкновенная', 'Pinus sylvestris', euforgen('pinus-sylvestris'),
    { ...tree, habitat: 'Светолюбивый пионер; сухие и бедные участки, широкий диапазон высот.', range: 'Европа и Азия', moisture: 'dry-tolerant', shadeTolerant: false, dispersal: ['wind'] },
    { water: [0.04, 0.25, 0.65, 0.94], ph: [3.5, 8], growthPerYear: 0.20, maturityYears: 15, lifespanYears: 250, dispersalMeters: 300, coldLimitC: -40, nutrientDemand: 0.15, evergreen: true }),
  plant('betula_pendula', 'Берёза повислая', 'Betula pendula', euforgen('betula-pendula'),
    { ...tree, habitat: 'Открытые дренированные участки; пионер, чувствительна к засухе; семена переносит ветер.', range: 'Европа — Центральная Сибирь', moisture: 'mesic', shadeTolerant: false, dispersal: ['wind'], measured: { maximumLifespanYears: 150 } },
    { water: [0.13, 0.4, 0.73, 0.96], ph: [4, 7.8], growthPerYear: 0.35, maturityYears: 10, lifespanYears: 150, dispersalMeters: 1000, coldLimitC: -38, nutrientDemand: 0.25, evergreen: false }),
  plant('quercus_robur', 'Дуб черешчатый', 'Quercus robur', euforgen('quercus-robur'),
    { ...tree, habitat: 'Плодородные влажные почвы равнин, смешанные леса и поймы; жёлуди служат кормом птицам и млекопитающим.', range: 'Европа и запад Азии', moisture: 'mesic', shadeTolerant: false, dispersal: ['animal', 'local'] },
    { water: [0.12, 0.42, 0.78, 1], ph: [4.5, 8], growthPerYear: 0.16, maturityYears: 30, lifespanYears: 400, dispersalMeters: 800, coldLimitC: -30, nutrientDemand: 0.55, evergreen: false }),
  plant('picea_abies', 'Ель европейская', 'Picea abies', euforgen('picea-abies'),
    { ...tree, habitat: 'Прохладные влажные дренированные леса; теневынослива, уязвима к засухе и сильному ветру.', range: 'Европа от Балкан до Скандинавии и России', moisture: 'mesic', shadeTolerant: true, dispersal: ['wind'] },
    { water: [0.2, 0.48, 0.78, 0.97], ph: [3.5, 7.5], growthPerYear: 0.22, maturityYears: 25, lifespanYears: 300, dispersalMeters: 300, coldLimitC: -40, nutrientDemand: 0.35, evergreen: true }),
  plant('alnus_glutinosa', 'Ольха чёрная', 'Alnus glutinosa', euforgen('alnus-glutinosa'),
    { ...tree, nitrogenFixer: true, habitat: 'Влажные берега и заболоченные леса; светолюбива, фиксирует азот; семена переносит вода.', range: 'Европа, запад Азии, север Африки', moisture: 'wet', shadeTolerant: false, dispersal: ['water', 'wind'] },
    { water: [0.3, 0.68, 0.98, 1.01], ph: [4, 8], growthPerYear: 0.35, maturityYears: 12, lifespanYears: 100, dispersalMeters: 700, coldLimitC: -30, nutrientDemand: 0.2, evergreen: false }),
  plant('fagus_sylvatica', 'Бук европейский', 'Fagus sylvatica', euforgen('fagus-sylvatica'),
    { ...tree, habitat: 'Умеренный климат, дренированные почвы; теневынослив и образует плотный полог.', range: 'Европа от Скандинавии до Средиземноморья', moisture: 'mesic', shadeTolerant: true, dispersal: ['animal', 'local'] },
    { water: [0.23, 0.47, 0.76, 0.93], ph: [4.5, 8], growthPerYear: 0.17, maturityYears: 40, lifespanYears: 300, dispersalMeters: 600, coldLimitC: -28, nutrientDemand: 0.5, evergreen: false }),
  plant('salix_alba', 'Ива белая', 'Salix alba', euforgen('salix-alba'),
    { ...tree, clonal: true, habitat: 'Влажные берега; быстрый рост и отрастание, укрепляет почву у воды.', range: 'Умеренная Евразия', moisture: 'wet', shadeTolerant: false, dispersal: ['wind', 'water'] },
    { water: [0.32, 0.66, 0.98, 1.01], ph: [4.5, 8.5], growthPerYear: 0.42, maturityYears: 8, lifespanYears: 90, dispersalMeters: 800, coldLimitC: -28, nutrientDemand: 0.4, evergreen: false }),
  plant('poa_pratensis', 'Мятлик луговой', 'Poa pratensis', usda('popr'),
    { ...herb, habitat: 'Прохладные влажные луга, гумусные дренированные почвы; плохо переносит засуху и затопление.', range: 'Умеренные области; натурализован в Северной Америке', moisture: 'mesic', shadeTolerant: false, dispersal: ['wind', 'local'], measured: { soilPh: [5.8, 8.2] } },
    { water: [0.14, 0.38, 0.72, 0.94], ph: [5.8, 8.2], growthPerYear: 1.8, maturityYears: 0.5, lifespanYears: 8, dispersalMeters: 80, coldLimitC: -28, nutrientDemand: 0.6, evergreen: false }),
  plant('trifolium_repens', 'Клевер белый', 'Trifolium repens', usda('trre3'),
    { ...herb, nitrogenFixer: true, habitat: 'Прохладные влажные плодородные луга; ползучие столоны; засуха ограничивает приживаемость.', range: 'Происходит из Европы; широко распространён в умеренных областях', moisture: 'mesic', shadeTolerant: false, dispersal: ['local'] },
    { water: [0.19, 0.43, 0.76, 0.95], ph: [5.5, 8], growthPerYear: 1.5, maturityYears: 0.4, lifespanYears: 6, dispersalMeters: 3, coldLimitC: -18, nutrientDemand: 0.35, evergreen: false }),
  plant('phragmites_australis', 'Тростник обыкновенный', 'Phragmites australis', usda('phau7'),
    { ...herb, habitat: 'Влажные и затопляемые почвы; плотные корневища, расселение семенами и вегетативно. Каталог моделирует евразийский тип.', range: 'Широко распространён; происхождение популяций различается', moisture: 'wet', shadeTolerant: false, dispersal: ['wind', 'water'], measured: { soilPh: [3.7, 8.7] } },
    { water: [0.4, 0.76, 1, 1.01], ph: [3.7, 8.7], growthPerYear: 2, maturityYears: 1, lifespanYears: 12, dispersalMeters: 500, coldLimitC: -28, nutrientDemand: 0.35, evergreen: false }),
  plant('typha_latifolia', 'Рогоз широколистный', 'Typha latifolia', usda('tyla'),
    { ...herb, habitat: 'Обязательный обитатель водно-болотных мест; мелководье, семенное и корневищное размножение.', range: 'Умеренные и тропические области Земли', moisture: 'wet', shadeTolerant: false, dispersal: ['wind', 'water'], measured: { maximumElevationM: 2000 } },
    { water: [0.55, 0.82, 1, 1.01], ph: [4.5, 8.5], growthPerYear: 1.9, maturityYears: 1, lifespanYears: 10, dispersalMeters: 600, coldLimitC: -25, nutrientDemand: 0.45, evergreen: false }),
  plant('fragaria_vesca', 'Земляника лесная', 'Fragaria vesca', 'https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/plants/wild-flowers/wild-strawberry/',
    { ...herb, habitat: 'Опушки, луга и затенённые леса; предпочитает известковые почвы, плоды поедают птицы и мелкие животные.', range: 'В источнике описана флора Великобритании', moisture: 'mesic', shadeTolerant: true, dispersal: ['animal', 'local'] },
    { water: [0.15, 0.38, 0.73, 0.93], ph: [5.5, 8], growthPerYear: 1, maturityYears: 0.7, lifespanYears: 6, dispersalMeters: 500, coldLimitC: -23, nutrientDemand: 0.3, evergreen: false }),
  plant('pteridium_aquilinum', 'Орляк обыкновенный', 'Pteridium aquilinum', 'https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/plants/ferns/bracken/',
    { ...herb, habitat: 'Леса и пустоши на дренированной почве; не болота. Корневища и переносимые ветром споры.', range: 'Широко распространён на Земле', moisture: 'dry-tolerant', shadeTolerant: true, dispersal: ['wind'] },
    { water: [0.08, 0.3, 0.67, 0.9], ph: [3.8, 7.8], growthPerYear: 1.3, maturityYears: 1, lifespanYears: 15, dispersalMeters: 1000, coldLimitC: -24, nutrientDemand: 0.2, evergreen: false }),
]);
export const PLANT_BY_ID: ReadonlyMap<string, PlantSpecies> = new Map(PLANT_SPECIES.map(s => [s.id, s]));
