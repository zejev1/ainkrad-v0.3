import type { GenesisDomain } from './GenesisBootstrap';

export type ResidentLifeStageV15 =
  | 'child'
  | 'adolescent'
  | 'adult'
  | 'elder';

export const MIN_ADULT_AGE_V15 = 18;
export const ELDER_AGE_V15 = 62;

/**
 * Exact stage thresholds recovered from preserved WorldEngine.
 */
export function lifeStageForAgeV15(
  ageYears: number,
): ResidentLifeStageV15 {
  if (!Number.isFinite(ageYears) || ageYears < 0) {
    throw new Error('ageYears must be finite and non-negative.');
  }
  if (ageYears < 12) return 'child';
  if (ageYears < MIN_ADULT_AGE_V15) return 'adolescent';
  if (ageYears < ELDER_AGE_V15) return 'adult';
  return 'elder';
}

export interface LearningStagePolicyV15 {
  lifeStage: ResidentLifeStageV15;

  /**
   * Safe knowledge lessons begin at 7 in current recovery calibration.
   * This is a v15 calibration default, not claimed old-source truth.
   */
  canReceiveStructuredLesson: boolean;

  /**
   * Practice is age/stage appropriate, never a direct skill write.
   */
  canPracticeSafely: boolean;

  /**
   * Full independent strenuous practice follows preserved action limits.
   */
  mayHunt: boolean;
  mayWork: boolean;
  mayBondAsAdultPartner: boolean;

  /**
   * Teaching is an emergent social role, not a hard-coded profession.
   */
  mayTeachPeers: boolean;
  mayTeachYoungerResidents: boolean;

  teachingEfficiencyMultiplier: number;
  practiceEfficiencyMultiplier: number;
}

export function learningStagePolicyV15(
  ageYears: number,
): LearningStagePolicyV15 {
  const lifeStage = lifeStageForAgeV15(ageYears);

  if (lifeStage === 'child') {
    const olderChild = ageYears >= 7;
    return {
      lifeStage,
      canReceiveStructuredLesson: olderChild,
      canPracticeSafely: olderChild,
      mayHunt: false,
      // Older children may choose supervised household/farm/workshop chores.
      // Productive capacity remains far below an adult and hazardous hunting
      // is still forbidden.
      mayWork: olderChild,
      mayBondAsAdultPartner: false,
      mayTeachPeers: false,
      mayTeachYoungerResidents: false,
      teachingEfficiencyMultiplier: 0,
      practiceEfficiencyMultiplier: olderChild ? 0.45 : 0,
    };
  }

  if (lifeStage === 'adolescent') {
    return {
      lifeStage,
      canReceiveStructuredLesson: true,
      canPracticeSafely: true,
      mayHunt: false,
      mayWork: true,
      mayBondAsAdultPartner: false,
      mayTeachPeers: false,
      mayTeachYoungerResidents: false,
      teachingEfficiencyMultiplier: 0,
      practiceEfficiencyMultiplier: 0.72,
    };
  }

  if (lifeStage === 'adult') {
    return {
      lifeStage,
      canReceiveStructuredLesson: true,
      canPracticeSafely: true,
      mayHunt: true,
      mayWork: true,
      mayBondAsAdultPartner: true,
      mayTeachPeers: true,
      mayTeachYoungerResidents: true,
      teachingEfficiencyMultiplier: 1,
      practiceEfficiencyMultiplier: 1,
    };
  }

  // Elder residents retain knowledge/social agency. The old engine only made
  // hunting less attractive; it did not remove their autonomy.
  return {
    lifeStage,
    canReceiveStructuredLesson: true,
    canPracticeSafely: true,
    mayHunt: true,
    mayWork: true,
    mayBondAsAdultPartner: true,
    mayTeachPeers: true,
    mayTeachYoungerResidents: true,
    teachingEfficiencyMultiplier: 1.08,
    practiceEfficiencyMultiplier: 0.72,
  };
}

export interface KnowledgeCarrierV15 {
  id: string;
  ageYears: number;
  alive: boolean;
  knowledge: Record<GenesisDomain, number>;
}

export interface TeachingEligibilityV15 {
  eligible: boolean;
  reason:
    | 'eligible'
    | 'dead'
    | 'too_young'
    | 'insufficient_domain_knowledge';
  lifeStage: ResidentLifeStageV15;
  domainKnowledge: number;
  teachingEfficiencyMultiplier: number;
}

/**
 * Teaching becomes a natural result of age + lived knowledge.
 * No resident is assigned "teacher" by Cardinal.
 */
export function evaluateTeachingEligibilityV15(
  person: KnowledgeCarrierV15,
  domain: GenesisDomain,
  minimumDomainKnowledge = 0.22,
): TeachingEligibilityV15 {
  const policy = learningStagePolicyV15(person.ageYears);
  const domainKnowledge = person.knowledge[domain] ?? 0;

  if (!person.alive) {
    return {
      eligible: false,
      reason: 'dead',
      lifeStage: policy.lifeStage,
      domainKnowledge,
      teachingEfficiencyMultiplier: 0,
    };
  }

  if (!policy.mayTeachYoungerResidents) {
    return {
      eligible: false,
      reason: 'too_young',
      lifeStage: policy.lifeStage,
      domainKnowledge,
      teachingEfficiencyMultiplier: 0,
    };
  }

  if (domainKnowledge < minimumDomainKnowledge) {
    return {
      eligible: false,
      reason: 'insufficient_domain_knowledge',
      lifeStage: policy.lifeStage,
      domainKnowledge,
      teachingEfficiencyMultiplier:
        policy.teachingEfficiencyMultiplier,
    };
  }

  return {
    eligible: true,
    reason: 'eligible',
    lifeStage: policy.lifeStage,
    domainKnowledge,
    teachingEfficiencyMultiplier:
      policy.teachingEfficiencyMultiplier,
  };
}

export interface GenerationLearningContinuityV15 {
  childCanStartLearning: boolean;
  adolescentCanWorkAndPractice: boolean;
  adultCanTeach: boolean;
  elderCanTransmitExperience: boolean;
  genesisRequiredAfterYear3: false;
  directMindWriteRequired: false;
}

/**
 * Pure continuity declaration used by long-run audits.
 */
export function generationLearningContinuityV15(): GenerationLearningContinuityV15 {
  return {
    childCanStartLearning: true,
    adolescentCanWorkAndPractice: true,
    adultCanTeach: true,
    elderCanTransmitExperience: true,
    genesisRequiredAfterYear3: false,
    directMindWriteRequired: false,
  };
}
