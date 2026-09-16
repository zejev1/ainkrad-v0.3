import type { AgentRace } from '../world/types';

export type BirthMultiplicityV22 = 1 | 2 | 3 | 4;

export interface MultipleBirthProbabilitiesV22 {
  singleton: number;
  twins: number;
  triplets: number;
  quadruplets: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Human multiple births are deliberately rare. The fertility gift may improve
 * the chance of conception and gently raise the chance of twins/triplets, but
 * even at full strength it must never become a repeated-litter mechanic.
 *
 * `fertilityGiftLevel` is the resident's lived 0..1 gift mastery. It can
 * gently change probabilities, but hard caps keep multiples exceptional.
 */
export function humanMultipleBirthProbabilitiesV22(
  fertilityGiftLevel = 0,
): MultipleBirthProbabilitiesV22 {
  const level = clamp01(fertilityGiftLevel);
  const twins = 0.014 + 0.035 * level;
  const triplets = 0.00035 + 0.003 * Math.pow(level, 1.5);
  const quadruplets = 0.00001 + 0.0004 * level * level;
  const singleton = Math.max(0, 1 - twins - triplets - quadruplets);
  return { singleton, twins, triplets, quadruplets };
}

/** One deterministic draw at conception; no per-tick multiplicity work. */
export function choosePregnancyMultiplicityV22(
  race: AgentRace,
  fertilityGiftLevel: number,
  roll: number,
): BirthMultiplicityV22 {
  // Only human physiology is defined here. Other peoples remain singleton
  // until their own reproductive physiology is explicitly designed.
  if (race !== 'human') return 1;
  const p = humanMultipleBirthProbabilitiesV22(fertilityGiftLevel);
  const r = clamp01(roll);
  if (r < p.quadruplets) return 4;
  if (r < p.quadruplets + p.triplets) return 3;
  if (r < p.quadruplets + p.triplets + p.twins) return 2;
  return 1;
}

/** Base delivery risk from multiplicity itself. Quadruplets are intentionally severe. */
export function maternalChildbirthMortalityRiskV22(
  childCount: BirthMultiplicityV22,
): number {
  switch (childCount) {
    case 4:
      return 0.5;
    case 3:
      return 0.06;
    case 2:
      return 0.005;
    default:
      return 0;
  }
}

/** Surviving multiple birth still has a physical cost without forcing death. */
export function maternalPostpartumHealthLossV22(
  childCount: BirthMultiplicityV22,
  roll: number,
): number {
  const r = clamp01(roll);
  switch (childCount) {
    case 4:
      return 0.15 + 0.15 * r;
    case 3:
      return 0.07 + 0.08 * r;
    case 2:
      return 0.02 + 0.04 * r;
    default:
      return 0;
  }
}

/** Multiples begin somewhat more physically vulnerable, but remain distinct people. */
export function newbornMultipleHealthPenaltyV22(
  childCount: BirthMultiplicityV22,
): number {
  switch (childCount) {
    case 4:
      return 0.075;
    case 3:
      return 0.04;
    case 2:
      return 0.015;
    default:
      return 0;
  }
}
