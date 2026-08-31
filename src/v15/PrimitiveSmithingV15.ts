/**
 * Primitive smithing / weaponcraft bootstrap for Ainkrad v15.
 *
 * IMPORTANT:
 * - this is NOT a fifth Genesis Teacher;
 * - exactly one of the 10 ordinary founders receives an initial artisan seed;
 * - the smith is mortal, counts as ordinary population and has ordinary agency;
 * - teaching requires a real workshop session;
 * - later innovation is probabilistic and practice-driven, not a hard tech tree.
 */

export const ORDINARY_FOUNDER_COUNT_V15 = 10;
export const GENESIS_TEACHER_COUNT_V15 = 4;

export interface SmithingKnowledgeV15 {
  stoneToolmaking: number;
  primitiveSmithing: number;
  weaponcraft: number;
  heatWorking: number;
  materialKnowledge: number;
}

export interface SmithingFounderSeedV15 {
  founderId: string;
  ordinaryResident: true;
  countedInPopulation: true;
  genesisTeacher: false;
  immortal: false;
  knowledge: SmithingKnowledgeV15;
  craftSkill: number;
  curiosity: number;
}

/**
 * Recovery calibration defaults.
 * The existence/role is canonical; exact vanished v15 numeric tuning is not
 * claimed recovered.
 */
export const DEFAULT_FOUNDER_SMITHING_SEED_V15 = {
  knowledge: {
    stoneToolmaking: 0.46,
    primitiveSmithing: 0.34,
    weaponcraft: 0.30,
    heatWorking: 0.22,
    materialKnowledge: 0.38,
  },
  craftSkill: 0.42,
  curiosity: 0.58,
} as const;

export function assignOrdinaryFounderSmithV15(
  founderIds: readonly string[],
  selectedIndex: number,
): SmithingFounderSeedV15 {
  if (founderIds.length !== ORDINARY_FOUNDER_COUNT_V15) {
    throw new Error(
      'New World must provide exactly 10 ordinary founders.',
    );
  }
  if (
    !Number.isInteger(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= founderIds.length
  ) {
    throw new Error('selectedIndex is outside founder list.');
  }
  const founderId = founderIds[selectedIndex];
  if (!founderId?.trim()) {
    throw new Error('Selected founder id must not be empty.');
  }

  return {
    founderId,
    ordinaryResident: true,
    countedInPopulation: true,
    genesisTeacher: false,
    immortal: false,
    knowledge: {
      ...DEFAULT_FOUNDER_SMITHING_SEED_V15.knowledge,
    },
    craftSkill: DEFAULT_FOUNDER_SMITHING_SEED_V15.craftSkill,
    curiosity: DEFAULT_FOUNDER_SMITHING_SEED_V15.curiosity,
  };
}

export type PrimitiveWeaponKindV15 =
  | 'stone_knife'
  | 'stone_spear'
  | 'crude_metal_knife'
  | 'crude_metal_spear'
  | 'forged_spear';

export interface WeaponRecipeV15 {
  kind: PrimitiveWeaponKindV15;
  requiredKnowledge: Partial<SmithingKnowledgeV15>;
  resourceCost: {
    wood: number;
    stone: number;
    metal: number;
    fuel: number;
  };
  minimumCraftSkill: number;
  weaponEffectiveness: number;
  reliability: number;
}

export const PRIMITIVE_WEAPON_RECIPES_V15:
  Readonly<Record<PrimitiveWeaponKindV15, WeaponRecipeV15>> = {
    stone_knife: {
      kind: 'stone_knife',
      requiredKnowledge: {
        stoneToolmaking: 0.18,
        weaponcraft: 0.08,
      },
      resourceCost: {wood: 0.02, stone: 0.08, metal: 0, fuel: 0},
      minimumCraftSkill: 0.12,
      weaponEffectiveness: 0.16,
      reliability: 0.62,
    },
    stone_spear: {
      kind: 'stone_spear',
      requiredKnowledge: {
        stoneToolmaking: 0.28,
        weaponcraft: 0.18,
      },
      resourceCost: {wood: 0.12, stone: 0.08, metal: 0, fuel: 0},
      minimumCraftSkill: 0.20,
      weaponEffectiveness: 0.30,
      reliability: 0.68,
    },
    crude_metal_knife: {
      kind: 'crude_metal_knife',
      requiredKnowledge: {
        primitiveSmithing: 0.24,
        weaponcraft: 0.18,
        heatWorking: 0.16,
        materialKnowledge: 0.22,
      },
      resourceCost: {wood: 0.02, stone: 0, metal: 0.08, fuel: 0.05},
      minimumCraftSkill: 0.28,
      weaponEffectiveness: 0.28,
      reliability: 0.72,
    },
    crude_metal_spear: {
      kind: 'crude_metal_spear',
      requiredKnowledge: {
        primitiveSmithing: 0.32,
        weaponcraft: 0.28,
        heatWorking: 0.20,
        materialKnowledge: 0.28,
      },
      resourceCost: {wood: 0.12, stone: 0, metal: 0.10, fuel: 0.06},
      minimumCraftSkill: 0.34,
      weaponEffectiveness: 0.43,
      reliability: 0.74,
    },
    forged_spear: {
      kind: 'forged_spear',
      requiredKnowledge: {
        primitiveSmithing: 0.52,
        weaponcraft: 0.50,
        heatWorking: 0.46,
        materialKnowledge: 0.48,
      },
      resourceCost: {wood: 0.14, stone: 0, metal: 0.16, fuel: 0.10},
      minimumCraftSkill: 0.54,
      weaponEffectiveness: 0.58,
      reliability: 0.84,
    },
  };

export interface WorkshopPersonV15 {
  id: string;
  ageYears: number;
  alive: boolean;
  craftSkill: number;
  curiosity: number;
  knowledge: SmithingKnowledgeV15;
}

export interface SmithingWorkshopSessionV15 {
  sessionId: string;
  instructorId: string;
  learnerId: string;
  worldMinutes: number;
  durationWorldMinutes: number;
  activityVerified: true;
  demonstratedWeapon?: PrimitiveWeaponKindV15;
}

export interface SmithingLessonResultV15 {
  before: SmithingKnowledgeV15;
  after: SmithingKnowledgeV15;
  gainedTotal: number;
}

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

function cloneKnowledge(
  value: SmithingKnowledgeV15,
): SmithingKnowledgeV15 {
  return {...value};
}

function assertWorkshopPerson(person: WorkshopPersonV15): void {
  if (!person.id.trim()) throw new Error('person id must not be empty.');
  if (!Number.isFinite(person.ageYears) || person.ageYears < 0) {
    throw new Error('ageYears must be finite and non-negative.');
  }
}

/**
 * Smithing uses fire, sharp edges and impact.
 * Recovery calibration allows workshop learning from adolescence (12+).
 */
export function applySmithingWorkshopLessonV15(
  instructor: WorkshopPersonV15,
  learner: WorkshopPersonV15,
  session: SmithingWorkshopSessionV15,
): SmithingLessonResultV15 {
  assertWorkshopPerson(instructor);
  assertWorkshopPerson(learner);

  if (!instructor.alive || !learner.alive) {
    throw new Error('Workshop participants must be alive.');
  }
  if (
    session.instructorId !== instructor.id ||
    session.learnerId !== learner.id
  ) {
    throw new Error('Workshop session participants do not match.');
  }
  if (session.activityVerified !== true) {
    throw new Error('Smithing knowledge requires a real workshop activity.');
  }
  if (learner.ageYears < 12) {
    throw new Error('Learner is too young for forge/workshop practice.');
  }
  if (
    !Number.isFinite(session.durationWorldMinutes) ||
    session.durationWorldMinutes <= 0
  ) {
    throw new Error('Workshop duration must be positive world minutes.');
  }

  const before = cloneKnowledge(learner.knowledge);
  const durationScale = Math.min(
    2,
    session.durationWorldMinutes / 240,
  );

  const keys = [
    'stoneToolmaking',
    'primitiveSmithing',
    'weaponcraft',
    'heatWorking',
    'materialKnowledge',
  ] as const;

  let gainedTotal = 0;
  for (const key of keys) {
    const teacherLevel = instructor.knowledge[key];
    const current = learner.knowledge[key];
    const gap = Math.max(0, teacherLevel - current);
    if (gap <= 0) continue;

    const relevanceBoost =
      session.demonstratedWeapon !== undefined
        ? (
            key === 'weaponcraft' ||
            key === 'materialKnowledge'
              ? 1.16
              : 1
          )
        : 1;

    const gain = Math.min(
      gap,
      0.012 *
        durationScale *
        (0.55 + learner.curiosity * 0.45) *
        (0.55 + instructor.craftSkill * 0.45) *
        relevanceBoost,
    );

    learner.knowledge[key] = clamp01(current + gain);
    gainedTotal += gain;
  }

  learner.craftSkill = clamp01(
    learner.craftSkill +
      Math.min(0.008, 0.0035 * durationScale),
  );

  return {
    before,
    after: cloneKnowledge(learner.knowledge),
    gainedTotal,
  };
}

export interface CraftResourcesV15 {
  wood: number;
  stone: number;
  metal: number;
  fuel: number;
}

export interface CraftedWeaponV15 {
  itemId: string;
  kind: PrimitiveWeaponKindV15;
  crafterId: string;
  worldMinutes: number;
  quality: number;
  effectiveness: number;
  reliability: number;
}

export interface WeaponCraftResultV15 {
  success: boolean;
  reason:
    | 'crafted'
    | 'knowledge_insufficient'
    | 'craft_skill_insufficient'
    | 'resources_insufficient'
    | 'craft_failure';
  weapon?: CraftedWeaponV15;
  resourcesAfter: CraftResourcesV15;
}

function hasResources(
  resources: CraftResourcesV15,
  cost: WeaponRecipeV15['resourceCost'],
): boolean {
  return (
    resources.wood >= cost.wood &&
    resources.stone >= cost.stone &&
    resources.metal >= cost.metal &&
    resources.fuel >= cost.fuel
  );
}

function hasKnowledge(
  person: WorkshopPersonV15,
  required: Partial<SmithingKnowledgeV15>,
): boolean {
  return Object.entries(required).every(
    ([key, threshold]) =>
      person.knowledge[
        key as keyof SmithingKnowledgeV15
      ] >= (threshold ?? 0),
  );
}

export function attemptWeaponCraftV15(
  crafter: WorkshopPersonV15,
  recipe: WeaponRecipeV15,
  resources: CraftResourcesV15,
  worldMinutes: number,
  random01: number,
  itemId: string,
): WeaponCraftResultV15 {
  assertWorkshopPerson(crafter);
  if (!crafter.alive) {
    throw new Error('Dead resident cannot craft.');
  }
  if (!Number.isFinite(random01) || random01 < 0 || random01 >= 1) {
    throw new Error('random01 must be in [0,1).');
  }
  if (!itemId.trim()) throw new Error('itemId must not be empty.');

  if (!hasKnowledge(crafter, recipe.requiredKnowledge)) {
    return {
      success: false,
      reason: 'knowledge_insufficient',
      resourcesAfter: {...resources},
    };
  }
  if (crafter.craftSkill < recipe.minimumCraftSkill) {
    return {
      success: false,
      reason: 'craft_skill_insufficient',
      resourcesAfter: {...resources},
    };
  }
  if (!hasResources(resources, recipe.resourceCost)) {
    return {
      success: false,
      reason: 'resources_insufficient',
      resourcesAfter: {...resources},
    };
  }

  const knowledgeAverage =
    Object.keys(recipe.requiredKnowledge).reduce(
      (sum, key) =>
        sum +
        crafter.knowledge[
          key as keyof SmithingKnowledgeV15
        ],
      0,
    ) /
    Math.max(1, Object.keys(recipe.requiredKnowledge).length);

  const successProbability = Math.max(
    0.18,
    Math.min(
      0.94,
      0.30 +
        crafter.craftSkill * 0.34 +
        knowledgeAverage * 0.28,
    ),
  );

  const resourcesAfter = {
    wood: Math.max(0, resources.wood - recipe.resourceCost.wood),
    stone: Math.max(0, resources.stone - recipe.resourceCost.stone),
    metal: Math.max(0, resources.metal - recipe.resourceCost.metal),
    fuel: Math.max(0, resources.fuel - recipe.resourceCost.fuel),
  };

  if (random01 >= successProbability) {
    return {
      success: false,
      reason: 'craft_failure',
      resourcesAfter,
    };
  }

  const quality = clamp01(
    0.36 +
      crafter.craftSkill * 0.36 +
      knowledgeAverage * 0.24,
  );

  return {
    success: true,
    reason: 'crafted',
    weapon: {
      itemId,
      kind: recipe.kind,
      crafterId: crafter.id,
      worldMinutes,
      quality,
      effectiveness: clamp01(
        recipe.weaponEffectiveness *
          (0.78 + quality * 0.32),
      ),
      reliability: clamp01(
        recipe.reliability *
          (0.82 + quality * 0.24),
      ),
    },
    resourcesAfter,
  };
}

export interface SmithingInnovationContextV15 {
  resident: WorkshopPersonV15;
  verifiedWorkshopSessions: number;
  failedCraftAttempts: number;
  successfulCraftAttempts: number;
  observedWeaponProblems: number;
  worldMinutes: number;
}

export interface SmithingInnovationResultV15 {
  attempted: boolean;
  succeeded: boolean;
  probability: number;
  reason:
    | 'not_ready'
    | 'idea_failed'
    | 'innovation_created';
  idea?: {
    ideaId: string;
    name: string;
    parentWeaponKind: PrimitiveWeaponKindV15;
    effectivenessDelta: number;
    reliabilityDelta: number;
    description: string;
  };
}

/**
 * Innovation is emergent and fallible.
 * There is no "year X unlocks sword" tech tree.
 */
export function attemptSmithingInnovationV15(
  context: SmithingInnovationContextV15,
  parentWeaponKind: PrimitiveWeaponKindV15,
  random01: number,
  ideaId: string,
): SmithingInnovationResultV15 {
  if (!Number.isFinite(random01) || random01 < 0 || random01 >= 1) {
    throw new Error('random01 must be in [0,1).');
  }

  const person = context.resident;
  const knowledgeCore =
    (
      person.knowledge.primitiveSmithing +
      person.knowledge.weaponcraft +
      person.knowledge.materialKnowledge
    ) / 3;

  const ready =
    person.alive &&
    person.ageYears >= 18 &&
    context.verifiedWorkshopSessions >= 24 &&
    knowledgeCore >= 0.34 &&
    person.craftSkill >= 0.34 &&
    context.observedWeaponProblems >= 2;

  if (!ready) {
    return {
      attempted: false,
      succeeded: false,
      probability: 0,
      reason: 'not_ready',
    };
  }

  const learningFromFailure = Math.min(
    0.12,
    context.failedCraftAttempts * 0.012,
  );
  const experienceBonus = Math.min(
    0.12,
    context.successfulCraftAttempts * 0.006,
  );

  const probability = Math.max(
    0.04,
    Math.min(
      0.72,
      0.05 +
        person.curiosity * 0.18 +
        person.craftSkill * 0.18 +
        knowledgeCore * 0.18 +
        learningFromFailure +
        experienceBonus,
    ),
  );

  if (random01 >= probability) {
    return {
      attempted: true,
      succeeded: false,
      probability,
      reason: 'idea_failed',
    };
  }

  const effectivenessDelta = Math.min(
    0.08,
    0.02 + person.craftSkill * 0.045,
  );
  const reliabilityDelta = Math.min(
    0.07,
    0.015 + knowledgeCore * 0.04,
  );

  return {
    attempted: true,
    succeeded: true,
    probability,
    reason: 'innovation_created',
    idea: {
      ideaId,
      name: `Улучшение ${parentWeaponKind}`,
      parentWeaponKind,
      effectivenessDelta,
      reliabilityDelta,
      description:
        'Житель сам предложил изменение формы/крепления/обработки после практики, ошибок и наблюдения проблем оружия.',
    },
  };
}

export const SMITHING_AGENCY_CONSTITUTION_V15 = {
  fifthGenesisTeacherCreated: false,
  founderSmithIsOrdinaryResident: true,
  founderSmithCanDie: true,
  teachingCompulsory: false,
  learnerCompulsory: false,
  realWorkshopRequired: true,
  innovationGuaranteed: false,
  cardinalMayAssignInventedTechnology: false,
  directKnowledgeWriteAllowed: false,
} as const;
