import { evolveWater, initializeWater, waterForPlants, type WaterUnit } from '../water/HydrologyModel';
import { WATER_CALIBRATION as WATER } from '../water/HydrologyKnowledge';
import { PLANT_BY_ID, PLANT_SPECIES, type PlantSpecies } from './PlantKnowledge';

export const DAY = 1440, YEAR = 525600;
export const unit = (n: number) => Math.max(0, Math.min(1, n));
export interface PlantHabitat {
  id: string; region?: string; x: number; y: number; elevationM: number;
  moisture: number; fertility: number; slope: number; soilPh: number;
  kind: 'woodland' | 'meadow' | 'wetland' | 'field' | 'rock' | 'coast';
  marine: boolean; seedCarriers: boolean;
  watercourse?: string;
}
export interface PlantCohort {
  speciesId: string; adult: number; juvenile: number; juvenileAge: number;
  adultAge: number; seeds: number; suitability: number; limitation: PlantLimitation;
}
export type PlantLimitation = 'water' | 'flooding' | 'temperature' | 'shade' | 'soil' | 'space' | 'suitable';
export interface VegetationPatch {
  habitat: PlantHabitat; active: boolean; water: number; snow: number;
  fertility: number; litter: number; plants: PlantCohort[];
  localHydrology?: WaterUnit;
  lastMinute: number; lastGrowth: number; lastMortality: number;
}
export interface PlantWeather {
  minute: number; duration: number; temperatureC: number; precipitation: number;
  rain: boolean; snow: boolean; wind: number;
  water?: Record<string, { water: number; snow: number; floodDepthM: number }>;
  local?: Readonly<Record<string, { temperatureC: number; precipitation: number; rain: boolean; snow: boolean; wind: number }>>;
}
export interface VegetationEvent {
  minute: number; siteId: string; speciesId?: string;
  kind: 'colonized' | 'locally_extinct' | 'fault'; detail: string;
}
export interface HabitatAssessment { suitability: number; limitation: PlantLimitation }

function band(n: number, [a, b, c, d]: readonly number[]): number {
  if (n <= a || n >= d) return 0;
  return n < b ? (n - a) / (b - a) : n > c ? (d - n) / (d - c) : 1;
}
/** Numerical response curves are model assumptions; measured pH values are
 * retained in the source catalog and never represented as measured soil here. */
export function assessPlant(species: PlantSpecies, patch: VegetationPatch,
  temperatureC: number, canopy = canopyCover(patch)): HabitatAssessment {
  if (patch.habitat.marine) return { suitability: 0, limitation: 'flooding' };
  const water = band(patch.water, species.model.water);
  const light = species.facts.shadeTolerant ? 1 - canopy * 0.20 : Math.max(0.03, 1 - canopy * 0.9);
  const thermal = band(temperatureC, [-5, 8, 25, 43]);
  const ph = band(patch.habitat.soilPh, [species.model.ph[0] - 1, species.model.ph[0], species.model.ph[1], species.model.ph[1] + 1]);
  const nutrient = unit(0.4 + patch.fertility / Math.max(0.1, species.model.nutrientDemand));
  const elevation = species.facts.measured?.maximumElevationM;
  const soil = ph * nutrient * (elevation !== undefined && patch.habitat.elevationM > elevation ? 0 : 1);
  // Maintained fields are open vegetation; an ecosystem agent does not undo farming.
  const space = patch.habitat.kind === 'field' && species.facts.layer === 'canopy' ? 0 : 1;
  const factors: [PlantLimitation, number][] = [
    [patch.water > species.model.water[2] ? 'flooding' : 'water', water],
    ['temperature', thermal], ['shade', light], ['soil', soil], ['space', space],
  ];
  let limitation: PlantLimitation = 'suitable', weakest = 0.75;
  for (const [name, value] of factors) if (value < weakest) { weakest = value; limitation = name; }
  return { suitability: water * light * thermal * soil * space, limitation };
}
export function canopyCover(patch: VegetationPatch): number {
  let sum = 0;
  for (const c of patch.plants) if (PLANT_BY_ID.get(c.speciesId)?.facts.layer === 'canopy') sum += c.adult;
  return unit(sum);
}
export function plantCover(patch: VegetationPatch): number {
  let sum = 0;
  for (const c of patch.plants) sum += c.adult + c.juvenile;
  return unit(sum);
}
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}
/** Additive initial description of already-existing natural land, never a world
 * expansion or a camera-triggered change. Existing stocks/fertility are untouched. */
export function initializePatch(habitat: PlantHabitat, minute: number, seed: string): VegetationPatch {
  const patch: VegetationPatch = { habitat: { ...habitat }, active: true,
    water: habitat.moisture, snow: 0, fertility: habitat.fertility, litter: 0.12,
    plants: [], lastMinute: minute, lastGrowth: 0, lastMortality: 0 };
  if (habitat.marine) return patch;
  const candidates = PLANT_SPECIES.map(species => {
    const assessment = assessPlant(species, patch, 16, 0);
    const habitatWeight = habitat.kind === 'woodland' ? (species.facts.layer === 'canopy' ? 1.8 : 0.7)
      : habitat.kind === 'field' || habitat.kind === 'meadow' ? (species.facts.layer === 'ground' ? 1.8 : 0.2) : 1;
    return { species, assessment, weight: assessment.suitability * habitatWeight * (0.65 + hash(`${seed}:${habitat.id}:${species.id}`) * 0.7) };
  }).filter(c => c.weight > 0.15).sort((a, b) => b.weight - a.weight || a.species.id.localeCompare(b.species.id)).slice(0, 5);
  const total = candidates.reduce((n, c) => n + c.weight, 0);
  const initialCover = habitat.kind === 'rock' ? 0.28 : 0.8;
  for (const { species, assessment, weight } of candidates) {
    const cover = initialCover * weight / total;
    patch.plants.push({ speciesId: species.id, adult: cover * 0.9, juvenile: cover * 0.1,
      juvenileAge: species.model.maturityYears * 0.3, adultAge: species.model.maturityYears * 2,
      seeds: cover * 0.15, ...assessment });
  }
  return patch;
}

/** One conservative daily-or-shorter integration step. No residents, RNG or I/O. */
export function evolvePatch(patch: VegetationPatch, weather: PlantWeather): void {
  const days = weather.duration / DAY, years = weather.duration / YEAR;
  const local = weather.local?.[patch.habitat.id];
  const conditions = local ?? weather;
  const temperature = local ? local.temperatureC : weather.temperatureC - patch.habitat.elevationM * 0.0065;
  const precipitation = conditions.rain || conditions.snow ? conditions.precipitation * 0.09 * days : 0;
  const supplied = weather.water?.[patch.habitat.id];
  if (supplied) { patch.water = supplied.water; patch.snow = supplied.snow; }
  else if (!weather.water) {
    // Standalone ecological experiments use the same finite-water physics.
    // Production always supplies the world-owned reservoir projection.
    const h = patch.habitat;
    patch.localHydrology ??= initializeWater({ id: h.id, x: h.x, y: h.y, elevationM: h.elevationM,
      kind: 'plot', areaM2: WATER.plotAreaM2, moisture: h.moisture, slope: h.slope,
      soilCapacityMm: WATER.soilCapacityMm, surfaceAreaM2: WATER.plotAreaM2,
      bankfullM3: WATER.plotAreaM2 * 0.005, residenceDays: 0.7 }, weather.minute, patch.water, patch.snow);
    evolveWater(patch.localHydrology, { ...conditions, temperatureC: temperature }, weather.duration, plantCover(patch));
    const actual = waterForPlants(patch.localHydrology); patch.water = actual.water; patch.snow = actual.snow;
  }
  const canopy = canopyCover(patch), cover = plantCover(patch), space = Math.max(0, 1 - cover);
  let grown = 0, lost = 0, nitrogen = 0;
  for (const c of patch.plants) {
    const s = PLANT_BY_ID.get(c.speciesId);
    if (!s) continue; // Future catalog entries remain in saves; never delete them.
    const assessment = assessPlant(s, patch, temperature, canopy);
    c.suitability = assessment.suitability; c.limitation = assessment.limitation;
    const waterStress = 1 - band(patch.water, s.model.water);
    // Ordinary winter dormancy is not a fault or lethal stress.
    const coldStress = Math.max(0, s.model.coldLimitC - temperature) / 15 * (1 - patch.snow * 0.75);
    const heatStress = Math.max(0, temperature - 34) / 14;
    const senescence = Math.pow(c.adultAge / Math.max(1, s.model.lifespanYears), 3) / s.model.lifespanYears;
    const windDamage = s.facts.layer === 'canopy' && conditions.rain
      ? Math.max(0, conditions.wind - 0.7) * (s.id === 'picea_abies' ? 0.7 : 0.25) : 0;
    const mortality = 1 - Math.exp(-(waterStress * 0.65 + coldStress * 2 + heatStress * 1.2 + windDamage + senescence + 0.004) * years);
    const died = c.adult * mortality + c.juvenile * Math.min(1, mortality * 1.8);
    c.adult *= 1 - mortality; c.juvenile *= 1 - Math.min(1, mortality * 1.8);
    c.adultAge += years; c.juvenileAge += years;
    const growth = (c.adult + c.juvenile) * s.model.growthPerYear * assessment.suitability * space * years;
    const adultShare = c.adult / Math.max(1e-12, c.adult + c.juvenile);
    c.adult += growth * adultShare; c.juvenile += growth * (1 - adultShare);
    const establishment = Math.min(c.seeds, c.seeds * assessment.suitability * space * 1.5 * years);
    c.seeds -= establishment;
    if (establishment > 0) {
      c.juvenileAge *= c.juvenile / (c.juvenile + establishment);
      c.juvenile += establishment;
    }
    if (c.juvenileAge >= s.model.maturityYears && c.juvenile > 0) {
      c.adultAge = (c.adultAge * c.adult + c.juvenileAge * c.juvenile) / (c.adult + c.juvenile);
      c.adult += c.juvenile; c.juvenile = 0; c.juvenileAge = 0;
    }
    // Only reproductive adults produce seed; local clonal growth is separate.
    const season = ((weather.minute % YEAR) + YEAR) % YEAR / YEAR;
    const reproductive = season >= 0.32 && season <= 0.82 && temperature > 7;
    if (reproductive) c.seeds = unit(c.seeds + c.adult * assessment.suitability * years * (s.facts.layer === 'ground' ? 2 : 0.7));
    c.seeds *= Math.exp(-0.3 * years);
    const clonalGrowth = s.facts.clonal ? c.adult * assessment.suitability * space * years * 0.15 : 0;
    c.juvenile += clonalGrowth;
    if (s.facts.nitrogenFixer) nitrogen += c.adult * assessment.suitability * years * 0.012;
    grown += growth + establishment + clonalGrowth; lost += died;
  }
  // Light/space competition cannot manufacture multiple hectares in one hectare.
  const total = patch.plants.reduce((n, c) => n + c.adult + c.juvenile, 0);
  if (total > 1) for (const c of patch.plants) { c.adult /= total; c.juvenile /= total; }
  patch.litter = unit(patch.litter + lost);
  const decomposed = patch.litter * (1 - Math.exp(-0.7 * years * patch.water * unit((temperature + 2) / 18)));
  patch.litter -= decomposed;
  const erosion = (1 - cover) * patch.habitat.slope * precipitation * 0.002;
  patch.fertility = unit(patch.fertility + decomposed * 0.05 + nitrogen - grown * 0.002 - erosion);
  patch.lastGrowth += grown; patch.lastMortality += lost;
  patch.lastMinute = weather.minute + weather.duration;
}

export interface SeedEdge { from: string; to: string; meters: number; waterConnected: boolean }
/** Sparse spatial hash, world coordinates are 100 metres per unit. */
export function buildSeedEdges(habitats: readonly PlantHabitat[], landPassage: (a: PlantHabitat, b: PlantHabitat) => boolean): SeedEdge[] {
  const bins = new Map<string, PlantHabitat[]>(), edges: SeedEdge[] = [];
  const size = 10; // largest catalog kernel: 1000 m
  for (const p of habitats) {
    if (p.marine) continue;
    const key = `${Math.floor(p.x / size)},${Math.floor(p.y / size)}`;
    const bucket = bins.get(key); if (bucket) bucket.push(p); else bins.set(key, [p]);
  }
  for (const a of habitats) {
    if (a.marine) continue;
    const x = Math.floor(a.x / size), y = Math.floor(a.y / size);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const b of bins.get(`${x + dx},${y + dy}`) ?? []) {
        if (a.id === b.id) continue;
        const meters = Math.hypot(a.x - b.x, a.y - b.y) * 100;
        if (meters > 1000 || !landPassage(a, b)) continue;
        // Water dispersal requires an explicit host-provided shared watercourse;
        // mere proximity of wet sites is not enough. Wind/local vectors still work.
        edges.push({ from: a.id, to: b.id, meters,
          waterConnected: Boolean(a.watercourse && a.watercourse === b.watercourse && a.elevationM >= b.elevationM) });
      }
    }
  }
  return edges;
}
/** Simultaneous arrivals: iteration order cannot create a multi-hop seed teleport. */
export function disperseSeeds(patches: Record<string, VegetationPatch>, edges: readonly SeedEdge[], weather: PlantWeather): void {
  const arrivals: { patch: VegetationPatch; source: PlantCohort; speciesId: string; amount: number }[] = [];
  const outgoing = new Map<PlantCohort, number>();
  const years = weather.duration / YEAR;
  for (const edge of edges) {
    const from = patches[edge.from], to = patches[edge.to];
    if (!from?.active || !to?.active || to.habitat.marine) continue;
    for (const c of from.plants) {
      const s = PLANT_BY_ID.get(c.speciesId);
      if (!s || c.adult < 0.00001 || c.seeds < 0.00001 || edge.meters > s.model.dispersalMeters) continue;
      const vectors = s.facts.dispersal;
      const conditions = weather.local?.[from.habitat.id] ?? weather;
      const wind = vectors.includes('wind') ? conditions.wind : 0;
      const animal = vectors.includes('animal') && from.habitat.seedCarriers ? 0.4 : 0;
      const water = vectors.includes('water') && edge.waterConnected && conditions.rain ? 0.6 : 0;
      const local = vectors.includes('local') && edge.meters <= 3 ? 0.3 : 0;
      const amount = c.seeds * Math.max(wind, animal, water, local) * Math.exp(-3 * edge.meters / s.model.dispersalMeters) * years * 0.2;
      if (amount > 0) {
        arrivals.push({ patch: to, source: c, speciesId: s.id, amount });
        outgoing.set(c, (outgoing.get(c) ?? 0) + amount);
      }
    }
  }
  const scales = new Map<PlantCohort, number>();
  for (const [c, amount] of outgoing) {
    const exported = Math.min(c.seeds, amount);
    scales.set(c, exported / amount); c.seeds -= exported;
  }
  for (const { patch, source, speciesId, amount } of arrivals) {
    let c = patch.plants.find(p => p.speciesId === speciesId);
    if (!c) { c = { speciesId, adult: 0, juvenile: 0, seeds: 0, adultAge: 0, juvenileAge: 0, suitability: 0, limitation: 'suitable' }; patch.plants.push(c); }
    c.seeds = unit(c.seeds + amount * scales.get(source)!);
  }
}
