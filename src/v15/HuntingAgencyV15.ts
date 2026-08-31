/**
 * Hunting agency / danger assessment for Ainkrad v15.
 *
 * Core principle:
 * - the engine may estimate risk and recommend preparation;
 * - it may NOT replace the resident's decision with "always fight" or
 *   "never fight";
 * - ordinary planned hunting should use a hunting tool/weapon rather than
 *   routine bare-handed combat;
 * - emergency self-defense remains physically possible even unarmed.
 */

export type HuntingIntentV15 =
  | 'planned_hunt'
  | 'protect_others'
  | 'self_defense';

export type HuntingWeaponKindV15 =
  | 'none'
  | 'stone_knife'
  | 'stone_spear'
  | 'crude_metal_knife'
  | 'crude_metal_spear'
  | 'forged_spear';

export interface HuntingWeaponV15 {
  kind: HuntingWeaponKindV15;
  effectiveness: number;
  reach: number;
  reliability: number;
}

export const HUNTING_WEAPON_BASELINES_V15:
  Readonly<Record<HuntingWeaponKindV15, HuntingWeaponV15>> = {
    none: {
      kind: 'none',
      effectiveness: 0,
      reach: 0,
      reliability: 1,
    },
    stone_knife: {
      kind: 'stone_knife',
      effectiveness: 0.16,
      reach: 0.06,
      reliability: 0.62,
    },
    stone_spear: {
      kind: 'stone_spear',
      effectiveness: 0.30,
      reach: 0.32,
      reliability: 0.68,
    },
    crude_metal_knife: {
      kind: 'crude_metal_knife',
      effectiveness: 0.28,
      reach: 0.07,
      reliability: 0.72,
    },
    crude_metal_spear: {
      kind: 'crude_metal_spear',
      effectiveness: 0.43,
      reach: 0.38,
      reliability: 0.74,
    },
    forged_spear: {
      kind: 'forged_spear',
      effectiveness: 0.58,
      reach: 0.44,
      reliability: 0.84,
    },
  };

export interface HunterAgencyProfileV15 {
  id: string;
  ageYears: number;
  level: number;
  health: number;
  energy: number;
  stress: number;
  hungerPressure: number;
  riskTolerance: number;
  curiosity: number;
  dutyToOthers: number;
  rewardMotivation: number;
  physiology: {
    strength: number;
    endurance: number;
    mobility: number;
  };
  combatMastery: number;
  huntingSkill: number;
  weapon: HuntingWeaponV15;
  armorProtection: number;
  groupSupport: number;
  safetySupport: number;
}

export interface HuntTargetV15 {
  targetId: string;
  species: string;
  isMonster: boolean;
  threat: number;
  placeDanger: number;
  estimatedCount: number;
  foodValue: number;
  rewardValue: number;
}

export interface HuntingRiskAssessmentV15 {
  hunterId: string;
  targetId: string;
  intent: HuntingIntentV15;

  survivalCapacity: number;
  dangerPressure: number;
  estimatedLethalRisk: number;

  /**
   * This is an advisory interpretation, not an order.
   */
  recommendation:
    | 'reasonable'
    | 'caution'
    | 'prepare_weapon_or_group'
    | 'extreme_risk';

  plannedHuntNeedsWeaponPreparation: boolean;

  /** Always true by constitution. */
  residentMayOverrideRecommendation: true;
  isCommand: false;
}

export interface HuntingDecisionV15 {
  assessment: HuntingRiskAssessmentV15;

  /**
   * Voluntary decision probability remains strictly between 0 and 1.
   * Therefore the same state can yield different choices across deterministic
   * RNG draws without introducing hidden hard-coded obedience.
   */
  willingnessProbability: number;

  residentChoice:
    | 'attempt_hunt'
    | 'avoid_for_now'
    | 'seek_weapon_or_group'
    | 'fight_self_defense'
    | 'flee_self_defense';

  /**
   * Goal/choice and physical execution are separate.
   *
   * A resident may decide they want to hunt a dangerous target while unarmed,
   * but routine planned hunting will first produce preparation instead of
   * silently turning into hand-to-hand combat.
   */
  execution:
    | 'proceed_with_hunt'
    | 'prepare_before_hunt'
    | 'avoid'
    | 'fight_now'
    | 'flee_now';

  choiceWasRiskyOverride: boolean;
  forcedByEngine: false;
}

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

function assertUnit(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1.`);
  }
}

function validateHunter(hunter: HunterAgencyProfileV15): void {
  if (!hunter.id.trim()) throw new Error('hunter id must not be empty.');
  if (!Number.isFinite(hunter.ageYears) || hunter.ageYears < 0) {
    throw new Error('ageYears must be finite and non-negative.');
  }
  if (!Number.isInteger(hunter.level) || hunter.level < 1 || hunter.level > 100) {
    throw new Error('level must be 1..100.');
  }
  for (const [label, value] of [
    ['health', hunter.health],
    ['energy', hunter.energy],
    ['stress', hunter.stress],
    ['hungerPressure', hunter.hungerPressure],
    ['riskTolerance', hunter.riskTolerance],
    ['curiosity', hunter.curiosity],
    ['dutyToOthers', hunter.dutyToOthers],
    ['rewardMotivation', hunter.rewardMotivation],
    ['strength', hunter.physiology.strength],
    ['endurance', hunter.physiology.endurance],
    ['mobility', hunter.physiology.mobility],
    ['combatMastery', hunter.combatMastery],
    ['huntingSkill', hunter.huntingSkill],
    ['weapon.effectiveness', hunter.weapon.effectiveness],
    ['weapon.reach', hunter.weapon.reach],
    ['weapon.reliability', hunter.weapon.reliability],
    ['armorProtection', hunter.armorProtection],
    ['groupSupport', hunter.groupSupport],
    ['safetySupport', hunter.safetySupport],
  ] as const) {
    assertUnit(value, label);
  }
}

function validateTarget(target: HuntTargetV15): void {
  if (!target.targetId.trim()) throw new Error('target id must not be empty.');
  if (!target.species.trim()) throw new Error('species must not be empty.');
  for (const [label, value] of [
    ['threat', target.threat],
    ['placeDanger', target.placeDanger],
    ['foodValue', target.foodValue],
    ['rewardValue', target.rewardValue],
  ] as const) {
    assertUnit(value, label);
  }
  if (!Number.isInteger(target.estimatedCount) || target.estimatedCount < 1) {
    throw new Error('estimatedCount must be an integer >=1.');
  }
}

export function assessHuntingRiskV15(
  hunter: HunterAgencyProfileV15,
  target: HuntTargetV15,
  intent: HuntingIntentV15,
): HuntingRiskAssessmentV15 {
  validateHunter(hunter);
  validateTarget(target);

  const levelFactor = clamp01((hunter.level - 1) / 99);

  const physicalCapacity =
    hunter.health * 0.12 +
    hunter.energy * 0.08 +
    hunter.physiology.strength * 0.08 +
    hunter.physiology.endurance * 0.08 +
    hunter.physiology.mobility * 0.08;

  const learnedCapacity =
    hunter.combatMastery * 0.17 +
    hunter.huntingSkill * 0.14 +
    levelFactor * 0.08;

  const equipmentCapacity =
    hunter.weapon.effectiveness * 0.075 +
    hunter.weapon.reach * 0.045 +
    hunter.weapon.reliability * 0.025 +
    hunter.armorProtection * 0.035;

  const socialCapacity =
    hunter.groupSupport * 0.035 +
    hunter.safetySupport * 0.025;

  const stressPenalty = hunter.stress * 0.08;

  const survivalCapacity = clamp01(
    physicalCapacity +
    learnedCapacity +
    equipmentCapacity +
    socialCapacity -
    stressPenalty,
  );

  const numberPressure = clamp01(
    (target.estimatedCount - 1) / 5,
  );

  const dangerPressure = clamp01(
    target.threat * 0.58 +
    target.placeDanger * 0.15 +
    numberPressure * 0.12 +
    (target.isMonster ? 0.11 : 0) +
    (hunter.weapon.kind === 'none' ? 0.08 : 0),
  );

  /**
   * The risk estimate is intentionally smooth, never a binary "allowed".
   * Weapon/group support lowers risk but cannot make any target safe with 0%.
   */
  const mismatch = Math.max(0, dangerPressure - survivalCapacity);
  const estimatedLethalRisk = Math.max(
    0.01,
    clamp01(
      0.03 +
      dangerPressure * 0.84 -
      survivalCapacity * 0.38 +
      mismatch * 0.14,
    ),
  );

  const dangerousTarget =
    target.threat >= 0.20 || target.isMonster;

  const plannedHuntNeedsWeaponPreparation =
    intent === 'planned_hunt' &&
    dangerousTarget &&
    hunter.weapon.kind === 'none';

  let recommendation: HuntingRiskAssessmentV15['recommendation'];
  if (
    plannedHuntNeedsWeaponPreparation ||
    estimatedLethalRisk >= 0.56
  ) {
    recommendation = estimatedLethalRisk >= 0.62
      ? 'extreme_risk'
      : 'prepare_weapon_or_group';
  } else if (estimatedLethalRisk >= 0.42) {
    recommendation = 'caution';
  } else {
    recommendation = 'reasonable';
  }

  return {
    hunterId: hunter.id,
    targetId: target.targetId,
    intent,
    survivalCapacity,
    dangerPressure,
    estimatedLethalRisk,
    recommendation,
    plannedHuntNeedsWeaponPreparation,
    residentMayOverrideRecommendation: true,
    isCommand: false,
  };
}

export function decideHuntingAgencyV15(
  hunter: HunterAgencyProfileV15,
  target: HuntTargetV15,
  intent: HuntingIntentV15,
  random01: number,
): HuntingDecisionV15 {
  if (!Number.isFinite(random01) || random01 < 0 || random01 >= 1) {
    throw new Error('random01 must be in [0,1).');
  }

  const assessment = assessHuntingRiskV15(
    hunter,
    target,
    intent,
  );

  const needDrive =
    hunter.hungerPressure * 0.20 +
    hunter.dutyToOthers * (
      intent === 'protect_others' ? 0.24 : 0.08
    ) +
    target.foodValue * 0.08;

  const personalityDrive =
    hunter.riskTolerance * 0.24 +
    hunter.curiosity * 0.06 +
    hunter.rewardMotivation * target.rewardValue * 0.10;

  const competenceConfidence =
    clamp01(
      hunter.huntingSkill * 0.10 +
      hunter.combatMastery * 0.10 +
      hunter.weapon.effectiveness * 0.08 +
      hunter.groupSupport * 0.07,
    );

  const riskPenalty =
    assessment.estimatedLethalRisk * (
      0.62 - hunter.riskTolerance * 0.24
    );

  const selfDefenseDrive =
    intent === 'self_defense'
      ? 0.35 + hunter.dutyToOthers * 0.08
      : 0;

  let willingnessProbability = clamp01(
    0.06 +
    needDrive +
    personalityDrive +
    competenceConfidence +
    selfDefenseDrive -
    riskPenalty,
  );

  /**
   * Free-will guard:
   * never collapse to 0 or 1. The resident retains a stochastic choice
   * unless a physical situation (already attacked) requires choosing between
   * fight/flee rather than "ignore encounter".
   */
  willingnessProbability = Math.max(
    0.015,
    Math.min(0.965, willingnessProbability),
  );

  if (intent === 'self_defense') {
    const fight = random01 < willingnessProbability;
    return {
      assessment,
      willingnessProbability,
      residentChoice: fight
        ? 'fight_self_defense'
        : 'flee_self_defense',
      execution: fight ? 'fight_now' : 'flee_now',
      choiceWasRiskyOverride:
        fight && assessment.estimatedLethalRisk >= 0.6,
      forcedByEngine: false,
    };
  }

  const choseToAttempt =
    random01 < willingnessProbability;

  if (!choseToAttempt) {
    return {
      assessment,
      willingnessProbability,
      residentChoice: 'avoid_for_now',
      execution: 'avoid',
      choiceWasRiskyOverride: false,
      forcedByEngine: false,
    };
  }

  if (assessment.plannedHuntNeedsWeaponPreparation) {
    return {
      assessment,
      willingnessProbability,
      residentChoice: 'seek_weapon_or_group',
      execution: 'prepare_before_hunt',
      choiceWasRiskyOverride:
        assessment.estimatedLethalRisk >= 0.6,
      forcedByEngine: false,
    };
  }

  return {
    assessment,
    willingnessProbability,
    residentChoice: 'attempt_hunt',
    execution: 'proceed_with_hunt',
    choiceWasRiskyOverride:
      assessment.estimatedLethalRisk >= 0.6,
    forcedByEngine: false,
  };
}
