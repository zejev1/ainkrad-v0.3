import { WATER_CALIBRATION as C } from './HydrologyKnowledge';

export const WATER_DAY = 1440;
const unit = (n: number) => Math.max(0, Math.min(1, n));
export interface WaterClimate { temperatureC: number; precipitation: number; rain: boolean; snow: boolean; wind: number }
export interface WaterUnitSpec {
  id: string; x: number; y: number; elevationM: number; areaM2: number;
  kind: 'catchment' | 'plot' | 'lake' | 'river'; downstream?: string;
  riparian?: boolean;
  moisture: number; slope: number; soilCapacityMm: number;
  /** Effective open-water/floodplain area; a calibrated reservoir geometry. */
  surfaceAreaM2: number; bankfullM3: number; residenceDays: number;
}
export interface WaterStores { soilM3: number; groundwaterM3: number; snowM3: number; surfaceM3: number }
export interface WaterFlux {
  precipitationM3: number; evaporationM3: number; transpirationM3: number;
  meltM3: number; infiltrationM3: number; rechargeM3: number; capillaryM3: number;
  baseflowM3: number; outflowM3: number; inflowM3: number;
  exchangeInM3: number; exchangeOutM3: number;
}
export type WaterCondition = 'normal' | 'drought' | 'flood';
export interface WaterUnit extends WaterStores {
  spec: WaterUnitSpec; active: boolean; flux: WaterFlux; condition: WaterCondition;
  lastMinute: number;
}
export const emptyWaterFlux = (): WaterFlux => ({ precipitationM3: 0, evaporationM3: 0, transpirationM3: 0,
  meltM3: 0, infiltrationM3: 0, rechargeM3: 0, capillaryM3: 0, baseflowM3: 0, outflowM3: 0, inflowM3: 0, exchangeInM3: 0, exchangeOutM3: 0 });
export const waterVolume = (s: WaterStores) => s.soilM3 + s.groundwaterM3 + s.snowM3 + s.surfaceM3;
export const mmVolume = (s: WaterUnitSpec, mm: number) => mm * s.areaM2 / 1000;
export function initializeWater(spec: WaterUnitSpec, minute: number, water = spec.moisture, snow = 0): WaterUnit {
  return { spec, active: true, soilM3: mmVolume(spec, spec.soilCapacityMm * unit(water)),
    groundwaterM3: mmVolume(spec, C.groundwaterInitialMm * unit(spec.moisture)),
    snowM3: mmVolume(spec, C.snowIndexMm * Math.max(0, snow)),
    surfaceM3: spec.kind === 'lake' || spec.kind === 'river' ? spec.bankfullM3 * 0.65 : 0,
    flux: emptyWaterFlux(), condition: 'normal', lastMinute: minute };
}
export function waterForPlants(s: WaterUnit): { water: number; snow: number; floodDepthM: number } {
  const floodDepthM = Math.max(0, s.surfaceM3 - s.spec.bankfullM3) / s.spec.surfaceAreaM2;
  return { water: unit(s.soilM3 / mmVolume(s.spec, s.spec.soilCapacityMm) + Math.min(0.35, floodDepthM)),
    snow: unit(s.snowM3 / mmVolume(s.spec, C.snowIndexMm)), floodDepthM };
}
export function validWaterUnit(s: WaterUnit): boolean {
  return Boolean(s?.spec && [s.soilM3, s.groundwaterM3, s.snowM3, s.surfaceM3, s.lastMinute].every(n => Number.isFinite(n) && n >= 0)
    && [s.spec.areaM2, s.spec.soilCapacityMm, s.spec.surfaceAreaM2, s.spec.residenceDays].every(n => Number.isFinite(n) && n > 0)
    && Number.isFinite(s.spec.bankfullM3) && s.spec.bankfullM3 >= 0
    && typeof s.spec.id === 'string' && ['catchment','plot','lake','river'].includes(s.spec.kind)
    && [s.spec.x,s.spec.y,s.spec.elevationM,s.spec.moisture,s.spec.slope].every(Number.isFinite)
    && s.flux && Object.values(s.flux).every(n=>Number.isFinite(n)&&n>=0));
}

/** Finite reservoirs. Every transfer is limited by its donor; no moisture-restoring
 * source term. Atmospheric forcing and river discharge are explicit boundaries. */
export function evolveWater(s: WaterUnit, weather: WaterClimate, duration: number, cover: number): WaterFlux {
  const d = duration / WATER_DAY, spec = s.spec, flux = s.flux;
  // A reservoir stores its latest slice only; history is recorded separately.
  // Reuse this owned record instead of allocating one per reservoir per day.
  flux.inflowM3=0;flux.exchangeInM3=0;flux.exchangeOutM3=0;
  const vol = (mm: number) => mmVolume(spec, mm);
  const frozen = weather.temperatureC <= 0;
  flux.precipitationM3 = vol((weather.rain || weather.snow ? unit(weather.precipitation) : 0) * C.precipitationMmPerIndexDay * d);
  if (frozen || weather.snow) s.snowM3 += flux.precipitationM3;
  else s.surfaceM3 += flux.precipitationM3;
  flux.meltM3 = Math.min(s.snowM3, vol(Math.max(0, weather.temperatureC) * C.meltMmPerDegreeDay * d));
  s.snowM3 -= flux.meltM3; s.surfaceM3 += flux.meltM3;
  const capacity = vol(spec.soilCapacityMm), field = capacity * C.fieldCapacityFraction;
  const infiltrationCapacity = vol((4 + 30 * (1 - unit(spec.slope))) * (frozen ? 0.03 : 1) * d);
  flux.infiltrationM3 = Math.min(s.surfaceM3, Math.max(0, capacity - s.soilM3), infiltrationCapacity);
  s.surfaceM3 -= flux.infiltrationM3; s.soilM3 += flux.infiltrationM3;
  flux.rechargeM3 = Math.max(0, s.soilM3 - field) * (1 - Math.exp(-0.35 * d));
  s.soilM3 -= flux.rechargeM3; s.groundwaterM3 += flux.rechargeM3;
  flux.capillaryM3 = frozen ? 0 : Math.min(s.groundwaterM3, Math.max(0, field - s.soilM3),
    vol((spec.moisture > 0.8 ? 1.6 : 0.3) * d));
  s.groundwaterM3 -= flux.capillaryM3; s.soilM3 += flux.capillaryM3;
  // Temperature/wind demand is a transparent proxy, not FAO reference ET.
  const demand = Math.max(0, weather.temperatureC + 3) * 0.09 * (0.7 + unit(weather.wind) * 0.6) * d;
  const openEvap = Math.min(s.surfaceM3, demand * spec.surfaceAreaM2 / 1000);
  s.surfaceM3 -= openEvap;
  const soilEvap = Math.min(s.soilM3, vol(demand * (1 - unit(cover)) * 0.55));
  s.soilM3 -= soilEvap; flux.evaporationM3 = openEvap + soilEvap;
  const accessible = Math.max(0, s.soilM3 - capacity * C.wiltingFraction);
  const stress = unit(accessible / Math.max(1e-12, field * 0.5));
  flux.transpirationM3 = Math.min(accessible, vol(demand * unit(cover) * stress));
  s.soilM3 -= flux.transpirationM3;
  flux.baseflowM3 = s.groundwaterM3 * (1 - Math.exp(-d / 65));
  flux.baseflowM3 += Math.max(0, s.groundwaterM3 - flux.baseflowM3 - vol(C.groundwaterCapacityMm));
  s.groundwaterM3 -= flux.baseflowM3; s.surfaceM3 += flux.baseflowM3;
  // Lakes retain water below the outlet. Rivers/plots drain continuously.
  const retained = spec.kind === 'lake' ? spec.bankfullM3 * 0.3 : 0;
  flux.outflowM3 = Math.max(0, s.surfaceM3 - retained) * (1 - Math.exp(-d / spec.residenceDays));
  s.surfaceM3 -= flux.outflowM3;
  s.flux = flux;
  return flux;
}
