export const WORLD_MINUTES_PER_YEAR_V15_FAMILY = 365 * 24 * 60;

/**
 * Proven old world-level spacing between ANY births.
 * This is a throttle, never a schedule or requirement to reproduce.
 */
export const GLOBAL_MIN_WORLD_MINUTES_BETWEEN_BIRTHS_V15 =
  WORLD_MINUTES_PER_YEAR_V15_FAMILY * 0.8;

/**
 * Proven old per-parent cooldown.
 * This remains a physical/family eligibility guard beneath voluntary intent.
 */
export const PERSONAL_PARENT_BIRTH_COOLDOWN_WORLD_MINUTES_V15 =
  WORLD_MINUTES_PER_YEAR_V15_FAMILY * 1.3;

export interface FamilyVariationSourceV15 {
  /** Deterministic [0,1) draw. */
  next(): number;

  /** Deterministic draw in [minimum, maximum]. */
  between(minimum: number, maximum: number): number;
}

export interface InheritablePersonalityV15 {
  sociability: number;
  diligence: number;
  curiosity: number;
  generosity: number;
  resilience: number;
  riskTolerance: number;
}

export interface InheritableValuesV15 {
  care: number;
  freedom: number;
  knowledge: number;
  tradition: number;
  ambition: number;
}

export interface InheritableBeliefsV15 {
  worldTrust: number;
  divinePresence: number;
  fate: number;
  afterlife: number;
}

export interface InheritableSkillsV15 {
  gathering: number;
  hunting: number;
  craft: number;
  social: number;
  exploration: number;
}

export interface ParentForInheritanceV15 {
  id: string;
  sex: 'male' | 'female';
  race: string;
  generation: number;
  resources: number;
  homeId: string;
  socialDrive: number;
  personality: InheritablePersonalityV15;
  values: InheritableValuesV15;
  beliefs: InheritableBeliefsV15;
  skills: InheritableSkillsV15;
}

export interface ProtectedFamilyPersonalityV15 {
  /**
   * Protected individual inclination. It is generated independently rather
   * than copied from either parent or derived from child desire.
   */
  physicalIntimacyInclination: number;

  /**
   * Independent personal orientation toward parenthood.
   */
  childDesire: number;

  /**
   * General personal autonomy. Cardinal/Gateway may not write it.
   */
  autonomy: number;
}

export interface ChildContinuityBlueprintV15 {
  sex: 'male' | 'female';
  race: string;
  generation: number;
  homeId: string;

  energy: number;
  stress: number;
  resources: number;
  health: number;

  socialDrive: number;
  personality: InheritablePersonalityV15;
  values: InheritableValuesV15;
  beliefs: InheritableBeliefsV15;
  skills: InheritableSkillsV15;
  protectedFamilyPersonality: ProtectedFamilyPersonalityV15;

  lifespanYears: number;
  parentIds: [string, string];
}

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

function blend(
  left: number,
  right: number,
  variation: number,
  source: FamilyVariationSourceV15,
): number {
  return clamp01(
    (left + right) / 2 +
      source.between(-variation, variation),
  );
}

function finiteUnitRecord(
  record: Record<string, number>,
  label: string,
): void {
  for (const [key, value] of Object.entries(record)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`${label}.${key} must be between 0 and 1.`);
    }
  }
}

function validateParent(parent: ParentForInheritanceV15): void {
  if (!parent.id.trim()) throw new Error('Parent id must not be empty.');
  if (!parent.race.trim()) throw new Error('Parent race must not be empty.');
  if (!parent.homeId.trim()) throw new Error('Parent homeId must not be empty.');
  if (!Number.isInteger(parent.generation) || parent.generation < 0) {
    throw new Error('Parent generation must be a non-negative integer.');
  }
  if (!Number.isFinite(parent.resources) || parent.resources < 0) {
    throw new Error('Parent resources must be finite and non-negative.');
  }
  if (
    !Number.isFinite(parent.socialDrive) ||
    parent.socialDrive < 0 ||
    parent.socialDrive > 1
  ) {
    throw new Error('Parent socialDrive must be between 0 and 1.');
  }
  finiteUnitRecord(
    parent.personality as unknown as Record<string, number>,
    'personality',
  );
  finiteUnitRecord(
    parent.values as unknown as Record<string, number>,
    'values',
  );
  finiteUnitRecord(
    parent.beliefs as unknown as Record<string, number>,
    'beliefs',
  );
  finiteUnitRecord(
    parent.skills as unknown as Record<string, number>,
    'skills',
  );
}

/**
 * Reconstructs the exact v0.3.13 inheritance substrate visible in the
 * preserved WorldEngine and layers v15 protected family/personhood traits on
 * top without coupling intimacy to child desire.
 *
 * Exact preserved pieces:
 * - personality parent mean ±0.08;
 * - socialDrive parent mean ±0.05;
 * - values parent mean ±0.04;
 * - beliefs parent mean ±0.035;
 * - skills parent mean ±0.03, then child multipliers:
 *   gathering .18, hunting .12, craft .18, social .24, exploration .20;
 * - generation = max(parent generations)+1;
 * - home = parent with greater/equal resources (left wins ties);
 * - race inherited from the left/a parent;
 * - sex from next()<.5;
 * - energy .86, stress .04, resources .62, health .94;
 * - lifespan = 72 + resilience*26 + variation [-2,+4].
 *
 * New v15 protected family traits are independent calibration defaults.
 * Their exact vanished v15 numeric formula is NOT claimed recovered.
 */
export function deriveChildContinuityBlueprintV15(
  a: ParentForInheritanceV15,
  b: ParentForInheritanceV15,
  source: FamilyVariationSourceV15,
): ChildContinuityBlueprintV15 {
  validateParent(a);
  validateParent(b);

  const personality: InheritablePersonalityV15 = {
    sociability: blend(
      a.personality.sociability,
      b.personality.sociability,
      0.08,
      source,
    ),
    diligence: blend(
      a.personality.diligence,
      b.personality.diligence,
      0.08,
      source,
    ),
    curiosity: blend(
      a.personality.curiosity,
      b.personality.curiosity,
      0.08,
      source,
    ),
    generosity: blend(
      a.personality.generosity,
      b.personality.generosity,
      0.08,
      source,
    ),
    resilience: blend(
      a.personality.resilience,
      b.personality.resilience,
      0.08,
      source,
    ),
    riskTolerance: blend(
      a.personality.riskTolerance,
      b.personality.riskTolerance,
      0.08,
      source,
    ),
  };

  const values: InheritableValuesV15 = {
    care: blend(a.values.care, b.values.care, 0.04, source),
    freedom: blend(a.values.freedom, b.values.freedom, 0.04, source),
    knowledge: blend(a.values.knowledge, b.values.knowledge, 0.04, source),
    tradition: blend(a.values.tradition, b.values.tradition, 0.04, source),
    ambition: blend(a.values.ambition, b.values.ambition, 0.04, source),
  };

  const beliefs: InheritableBeliefsV15 = {
    worldTrust: blend(
      a.beliefs.worldTrust,
      b.beliefs.worldTrust,
      0.035,
      source,
    ),
    divinePresence: blend(
      a.beliefs.divinePresence,
      b.beliefs.divinePresence,
      0.035,
      source,
    ),
    fate: blend(a.beliefs.fate, b.beliefs.fate, 0.035, source),
    afterlife: blend(
      a.beliefs.afterlife,
      b.beliefs.afterlife,
      0.035,
      source,
    ),
  };

  const skills: InheritableSkillsV15 = {
    gathering:
      blend(a.skills.gathering, b.skills.gathering, 0.03, source) * 0.18,
    hunting:
      blend(a.skills.hunting, b.skills.hunting, 0.03, source) * 0.12,
    craft:
      blend(a.skills.craft, b.skills.craft, 0.03, source) * 0.18,
    social:
      blend(a.skills.social, b.skills.social, 0.03, source) * 0.24,
    exploration:
      blend(a.skills.exploration, b.skills.exploration, 0.03, source) * 0.2,
  };

  /**
   * v15-specific individuality:
   * these draws are deliberately separate. There is no formula where one is
   * derived from the other, and no direct parental copy.
   *
   * Numeric ranges are recovery calibration defaults, not claimed lost-source
   * constants. The full [0,1) space remains available.
   */
  const protectedFamilyPersonality: ProtectedFamilyPersonalityV15 = {
    physicalIntimacyInclination: clamp01(source.next()),
    childDesire: clamp01(source.next()),
    autonomy: clamp01(0.72 + source.between(-0.12, 0.18)),
  };

  return {
    sex: source.next() < 0.5 ? 'male' : 'female',
    race: a.race,
    generation: Math.max(a.generation, b.generation) + 1,
    homeId: a.resources >= b.resources ? a.homeId : b.homeId,
    energy: 0.86,
    stress: 0.04,
    resources: 0.62,
    health: 0.94,
    socialDrive: blend(a.socialDrive, b.socialDrive, 0.05, source),
    personality,
    values,
    beliefs,
    skills,
    protectedFamilyPersonality,
    lifespanYears:
      72 + personality.resilience * 26 + source.between(-2, 4),
    parentIds: [a.id, b.id],
  };
}

export interface FamilyEligibilityPersonV15 {
  id: string;
  sex: 'male' | 'female';
  race: string;
  alive: boolean;
  lifeStage: 'child' | 'adult' | 'elder';
  ageYears: number;
  health: number;
  resources: number;
  stress: number;
  parentIds: string[];
  childIds: string[];
  lastChildWorldMinute?: number;
}

export interface FamilyEligibilityV15 {
  eligible: boolean;
  blockers: string[];
}

/**
 * Physical/lineage eligibility only.
 *
 * Passing this function NEVER means the residents will form a couple, have
 * sex or choose a child. v15 FamilyAgency makes those independent voluntary
 * decisions after this substrate-level guard.
 */
export function evaluateFamilyEligibilityV15(
  a: FamilyEligibilityPersonV15,
  b: FamilyEligibilityPersonV15,
  currentWorldMinutes: number,
): FamilyEligibilityV15 {
  if (!Number.isFinite(currentWorldMinutes) || currentWorldMinutes < 0) {
    throw new Error('currentWorldMinutes must be finite and non-negative.');
  }

  const blockers: string[] = [];

  if (!a.alive || !b.alive) blockers.push('not_alive');
  if (a.lifeStage !== 'adult' || b.lifeStage !== 'adult') {
    blockers.push('not_adult');
  }
  if (a.sex === b.sex) blockers.push('same_sex_reproductive_pair');
  if ((a.race || 'human') !== (b.race || 'human')) {
    blockers.push('different_race_reproductive_pair');
  }
  if (a.ageYears > 55 || b.ageYears > 55) {
    blockers.push('age_over_55');
  }
  if (a.health < 0.58 || b.health < 0.58) {
    blockers.push('health_too_low');
  }
  if (a.resources < 0.42 || b.resources < 0.42) {
    blockers.push('resources_too_low');
  }
  if (a.stress > 0.72 || b.stress > 0.72) {
    blockers.push('stress_too_high');
  }

  for (const person of [a, b]) {
    if (
      person.lastChildWorldMinute !== undefined &&
      currentWorldMinutes - person.lastChildWorldMinute <
        PERSONAL_PARENT_BIRTH_COOLDOWN_WORLD_MINUTES_V15
    ) {
      blockers.push('parent_birth_cooldown');
      break;
    }
  }

  const aCloseRelatives = new Set([
    ...a.parentIds,
    ...a.childIds,
  ]);
  if (aCloseRelatives.has(b.id)) {
    blockers.push('parent_child_relation');
  }

  if (
    a.parentIds.some((parentId) =>
      b.parentIds.includes(parentId),
    )
  ) {
    blockers.push('shared_parent_relation');
  }

  return {
    eligible: blockers.length === 0,
    blockers: [...new Set(blockers)],
  };
}

export interface BirthThrottleStateV15 {
  lastBirthWorldMinute?: number;
}

/**
 * Global world-level anti-burst throttle from the preserved engine.
 * False only means "too soon"; true does NOT force a birth.
 */
export function globalBirthThrottleAllowsV15(
  state: BirthThrottleStateV15,
  currentWorldMinutes: number,
): boolean {
  if (!Number.isFinite(currentWorldMinutes) || currentWorldMinutes < 0) {
    throw new Error('currentWorldMinutes must be finite and non-negative.');
  }
  if (state.lastBirthWorldMinute === undefined) return true;
  return (
    currentWorldMinutes - state.lastBirthWorldMinute >=
    GLOBAL_MIN_WORLD_MINUTES_BETWEEN_BIRTHS_V15
  );
}

export interface LineagePersonV15 {
  id: string;
  parentIds: string[];
  childIds: string[];
}

/**
 * Adds a child into a lineage projection while preserving the old reciprocal
 * parent<->child invariant.
 */
export function linkChildReciprocallyV15(
  people: Record<string, LineagePersonV15>,
  childId: string,
  parentIds: readonly [string, string],
): void {
  const child = people[childId];
  if (!child) throw new Error(`Missing child ${childId}.`);

  for (const parentId of parentIds) {
    const parent = people[parentId];
    if (!parent) throw new Error(`Missing parent ${parentId}.`);
    if (!child.parentIds.includes(parentId)) {
      child.parentIds.push(parentId);
    }
    if (!parent.childIds.includes(childId)) {
      parent.childIds.push(childId);
    }
  }
}

export function validateReciprocalLineageV15(
  people: Readonly<Record<string, LineagePersonV15>>,
): void {
  for (const person of Object.values(people)) {
    for (const parentId of person.parentIds) {
      const parent = people[parentId];
      if (!parent) {
        throw new Error(
          `Person ${person.id} references missing parent ${parentId}.`,
        );
      }
      if (!parent.childIds.includes(person.id)) {
        throw new Error(
          `Person ${person.id} lineage is not reciprocal.`,
        );
      }
    }
    for (const childId of person.childIds) {
      const child = people[childId];
      if (!child) {
        throw new Error(
          `Person ${person.id} references missing child ${childId}.`,
        );
      }
      if (!child.parentIds.includes(person.id)) {
        throw new Error(
          `Person ${person.id} lineage is not reciprocal.`,
        );
      }
    }
  }
}
