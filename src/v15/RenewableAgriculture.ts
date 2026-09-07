export interface RenewableResourceState {
  /**
   * Immediately accessible stored/harvested food/material stock.
   */
  storedResources: number;

  /**
   * Renewable ecological/agricultural production base. This is NOT the same
   * bucket as storedResources.
   */
  renewableBase: number;

  fertility: number;
}

export interface AgricultureWorker {
  id: string;
  agricultureKnowledge: number;
  diligence: number;
}

export interface HarvestEvent {
  eventId: string;
  worldMinutes: number;
  effort: number;
}

export interface AgricultureCalibration {
  baseHarvestYield: number;
  unskilledBaseDamage: number;
  skilledDamageReduction: number;
  baseRecoveryPerYear: number;
  unskilledFertilityDamage: number;
  skilledFertilityDamageReduction: number;
  fertilityRecoveryPerYear: number;
}

export const DEFAULT_AGRICULTURE_CALIBRATION: AgricultureCalibration = {
  baseHarvestYield: 0.14,
  unskilledBaseDamage: 0.0065,
  skilledDamageReduction: 0.82,
  baseRecoveryPerYear: 0.18,
  // Topsoil changes over decades. Renewable biomass may fluctuate quickly,
  // but one ordinary harvest must not destroy a settlement within a decade.
  unskilledFertilityDamage: 0.00006,
  skilledFertilityDamageReduction: 0.76,
  fertilityRecoveryPerYear: 0.018,
};

const WORLD_MINUTES_PER_YEAR = 365 * 24 * 60;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export interface HarvestResult {
  harvested: number;
  renewableBaseDamage: number;
  fertilityDamage: number;
  next: RenewableResourceState;
}

export function harvestRenewably(
  state: RenewableResourceState,
  worker: AgricultureWorker,
  event: HarvestEvent,
  calibration: AgricultureCalibration = DEFAULT_AGRICULTURE_CALIBRATION,
): HarvestResult {
  const knowledge = clamp01(worker.agricultureKnowledge);
  const effort = clamp01(event.effort);
  const diligence = clamp01(worker.diligence);
  const fertility = clamp01(state.fertility);
  const base = clamp01(state.renewableBase);

  const harvested = Math.min(
    base,
    calibration.baseHarvestYield *
      effort *
      (0.45 + fertility * 0.35 + knowledge * 0.2) *
      (0.65 + diligence * 0.35),
  );

  // Knowledge reduces destructive extraction from the renewable base.
  const damageMultiplier = Math.max(
    0.08,
    1 - knowledge * calibration.skilledDamageReduction,
  );
  const renewableBaseDamage = Math.min(
    base,
    calibration.unskilledBaseDamage *
      effort *
      damageMultiplier *
      (1.08 - fertility * 0.3),
  );
  const fertilityDamage = Math.min(
    fertility,
    calibration.unskilledFertilityDamage *
      effort *
      Math.max(
        0.1,
        1 - knowledge * calibration.skilledFertilityDamageReduction,
      ) *
      (1 + Math.max(0, 0.45 - base) * 0.7),
  );

  return {
    harvested,
    renewableBaseDamage,
    fertilityDamage,
    next: {
      storedResources: Math.max(0, state.storedResources) + harvested,
      renewableBase: clamp01(base - renewableBaseDamage),
      fertility: clamp01(fertility - fertilityDamage),
    },
  };
}

export function recoverRenewableBase(
  state: RenewableResourceState,
  elapsedWorldMinutes: number,
  meanAgricultureKnowledge: number,
  calibration: AgricultureCalibration = DEFAULT_AGRICULTURE_CALIBRATION,
): RenewableResourceState {
  if (!Number.isFinite(elapsedWorldMinutes) || elapsedWorldMinutes < 0) {
    throw new Error('elapsedWorldMinutes must be finite and non-negative.');
  }

  const years = elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR;
  const base = clamp01(state.renewableBase);
  const fertility = clamp01(state.fertility);
  const knowledge = clamp01(meanAgricultureKnowledge);

  // Skilled agriculture supports restoration/soil stewardship instead of
  // creating resources ex nihilo.
  const stewardship = 0.65 + knowledge * 0.55;
  const recovery =
    calibration.baseRecoveryPerYear *
    years *
    fertility *
    stewardship *
    (1 - base);
  // Soil is slower than annual biomass. Repeated cultivation can therefore
  // exhaust a crowded city's land, while fallow years and skilled stewardship
  // restore it over years rather than in the next simulation quantum.
  const fertilityRecovery =
    calibration.fertilityRecoveryPerYear *
    years *
    (0.55 + knowledge * 0.65) *
    (0.35 + base * 0.65) *
    (1 - fertility);

  return {
    storedResources: Math.max(0, state.storedResources),
    renewableBase: clamp01(base + recovery),
    fertility: clamp01(fertility + fertilityRecovery),
  };
}

/**
 * Consumption drains stored stock only. It must never directly subtract the
 * same amount from renewableBase — that was the old "one bucket" failure mode.
 */
export function consumeStoredResources(
  state: RenewableResourceState,
  amount: number,
): RenewableResourceState {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('amount must be finite and non-negative.');
  }
  return {
    ...state,
    storedResources: Math.max(0, state.storedResources - amount),
  };
}
