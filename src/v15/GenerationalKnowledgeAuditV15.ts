import {
  GENESIS_ACTIVE_WORLD_MINUTES,
} from './GenesisBootstrap';
import {
  evaluateTeachingEligibilityV15,
  learningStagePolicyV15,
} from './LifeStageLearningV15';

export const WORLD_MINUTES_PER_YEAR_GENERATION_AUDIT = 365 * 24 * 60;

export interface GenerationResidentAuditV15 {
  id: string;
  generation: number;
  bornWorldMinutes: number;
  alive: boolean;
  knowledge: {
    agriculture: number;
    construction: number;
    household: number;
    survival: number;
  };

  /**
   * IDs of ordinary-resident instructors who actually taught this resident.
   * Genesis teacher IDs must not appear here after the bootstrap window.
   */
  ordinaryInstructorIds: string[];

  /**
   * Real, verified learning/practice events completed by this resident.
   */
  verifiedLearningSessionCount: number;
  verifiedPracticeSessionCount: number;
}

export interface GenerationWorldAuditV15 {
  currentWorldMinutes: number;
  genesisActiveCount: number;
  residents: readonly GenerationResidentAuditV15[];
}

export interface GenerationContinuityFindingV15 {
  severity: 'info' | 'warning' | 'critical';
  code: string;
  message: string;
  residentIds: string[];
}

function ageYearsAt(
  resident: GenerationResidentAuditV15,
  worldMinutes: number,
): number {
  return Math.max(
    0,
    (worldMinutes - resident.bornWorldMinutes) /
      WORLD_MINUTES_PER_YEAR_GENERATION_AUDIT,
  );
}

function totalKnowledge(
  resident: GenerationResidentAuditV15,
): number {
  return (
    resident.knowledge.agriculture +
    resident.knowledge.construction +
    resident.knowledge.household +
    resident.knowledge.survival
  );
}

/**
 * 8-12 year civilization audit:
 * Genesis is gone, but second-generation residents who are old enough to
 * learn must have a viable ordinary-resident knowledge path.
 */
export function auditPostGenesisSecondGenerationV15(
  world: GenerationWorldAuditV15,
): GenerationContinuityFindingV15[] {
  const findings: GenerationContinuityFindingV15[] = [];

  if (
    world.currentWorldMinutes > GENESIS_ACTIVE_WORLD_MINUTES &&
    world.genesisActiveCount > 0
  ) {
    findings.push({
      severity: 'critical',
      code: 'genesis_still_active',
      message:
        'Genesis Teachers remain active after the three-year bootstrap window.',
      residentIds: [],
    });
  }

  const secondGeneration = world.residents.filter(
    (resident) => resident.alive && resident.generation >= 1,
  );

  const learningAgeSecondGeneration = secondGeneration.filter((resident) => {
    const age = ageYearsAt(resident, world.currentWorldMinutes);
    return learningStagePolicyV15(age).canReceiveStructuredLesson;
  });

  if (
    world.currentWorldMinutes >=
      8 * WORLD_MINUTES_PER_YEAR_GENERATION_AUDIT &&
    secondGeneration.length === 0
  ) {
    findings.push({
      severity: 'warning',
      code: 'no_second_generation_by_year_8',
      message:
        'No living second-generation residents exist by year 8. This may be an emergent demographic outcome, but continuity should be reviewed.',
      residentIds: [],
    });
  }

  for (const resident of learningAgeSecondGeneration) {
    const age = ageYearsAt(resident, world.currentWorldMinutes);
    // Structured learning becomes physically possible at seven, but reaching
    // the threshold does not guarantee an immediate lesson in the same sample.
    // Give autonomous family/peer/practice opportunities one Ainkrad year to
    // occur before classifying the absence as a stalled learning path.
    const hadLearningOpportunityWindow = age >= 8;
    if (
      hadLearningOpportunityWindow &&
      resident.verifiedLearningSessionCount <= 0 &&
      resident.verifiedPracticeSessionCount <= 0
    ) {
      findings.push({
        severity: 'critical',
        code: 'second_generation_learning_stalled',
        message:
          'A second-generation resident has spent at least one year at learning age but has no verified lesson or practice path.',
        residentIds: [resident.id],
      });
    }

    if (
      hadLearningOpportunityWindow &&
      resident.ordinaryInstructorIds.length === 0 &&
      totalKnowledge(resident) <= 0
    ) {
      findings.push({
        severity: 'critical',
        code: 'no_post_genesis_knowledge_carrier',
        message:
          'A second-generation resident has spent at least one year at learning age with no ordinary instructor and no independently acquired knowledge.',
        residentIds: [resident.id],
      });
    }
  }

  if (
    learningAgeSecondGeneration.length > 0 &&
    !findings.some(
      (finding) =>
        finding.code === 'second_generation_learning_stalled' ||
        finding.code === 'no_post_genesis_knowledge_carrier',
    )
  ) {
    findings.push({
      severity: 'info',
      code: 'second_generation_learning_alive',
      message:
        'Second-generation learning continues after Genesis departure through ordinary teaching and/or practice.',
      residentIds: learningAgeSecondGeneration.map(
        (resident) => resident.id,
      ),
    });
  }

  return findings;
}

/**
 * 25-35 year generation audit:
 * verifies that generation 1 can mature into ordinary teachers for generation
 * 2 (third biological generation counting founders as generation 0).
 */
export function auditThirdGenerationTeachingChainV15(
  world: GenerationWorldAuditV15,
  minimumDomainKnowledge = 0.22,
): GenerationContinuityFindingV15[] {
  const findings: GenerationContinuityFindingV15[] = [];

  const generationOne = world.residents.filter(
    (resident) => resident.alive && resident.generation === 1,
  );
  const generationTwo = world.residents.filter(
    (resident) => resident.alive && resident.generation >= 2,
  );
  const learningAgeGenerationTwo = generationTwo.filter((resident) =>
    learningStagePolicyV15(
      ageYearsAt(resident, world.currentWorldMinutes),
    ).canReceiveStructuredLesson,
  );

  const generationOneTeacherIds = new Set<string>();
  for (const resident of generationOne) {
    const age = ageYearsAt(resident, world.currentWorldMinutes);
    for (const domain of [
      'agriculture',
      'construction',
      'household',
      'survival',
    ] as const) {
      if (
        evaluateTeachingEligibilityV15(
          {
            id: resident.id,
            ageYears: age,
            alive: resident.alive,
            knowledge: resident.knowledge,
          },
          domain,
          minimumDomainKnowledge,
        ).eligible
      ) {
        generationOneTeacherIds.add(resident.id);
        break;
      }
    }
  }

  if (
    world.currentWorldMinutes >=
      25 * WORLD_MINUTES_PER_YEAR_GENERATION_AUDIT &&
    generationOne.length > 0 &&
    generationOneTeacherIds.size === 0
  ) {
    findings.push({
      severity: 'critical',
      code: 'generation_one_never_became_teacher',
      message:
        'By the long-generation audit window, no living generation-one resident has become knowledgeable enough to teach.',
      residentIds: generationOne.map((resident) => resident.id),
    });
  }

  const taughtThirdGeneration = learningAgeGenerationTwo.filter((resident) =>
    resident.ordinaryInstructorIds.some((instructorId) =>
      generationOneTeacherIds.has(instructorId),
    ),
  );

  if (
    learningAgeGenerationTwo.length > 0 &&
    taughtThirdGeneration.length === 0
  ) {
    findings.push({
      severity: 'critical',
      code: 'third_generation_not_taught_by_second',
      message:
        'Third-generation residents exist, but none has a verified ordinary instructor from generation one.',
      residentIds: learningAgeGenerationTwo.map((resident) => resident.id),
    });
  }

  if (
    generationTwo.length > 0 &&
    learningAgeGenerationTwo.length === 0
  ) {
    findings.push({
      severity: 'info',
      code: 'third_generation_not_yet_learning_age',
      message:
        'Third-generation residents exist, but none is old enough for a structured lesson yet.',
      residentIds: generationTwo.map((resident) => resident.id),
    });
  }

  if (
    generationOneTeacherIds.size > 0 &&
    taughtThirdGeneration.length > 0
  ) {
    findings.push({
      severity: 'info',
      code: 'three_generation_knowledge_chain_alive',
      message:
        'Knowledge successfully crossed founders -> generation one -> generation two without Genesis dependency.',
      residentIds: [
        ...generationOneTeacherIds,
        ...taughtThirdGeneration.map((resident) => resident.id),
      ],
    });
  }

  return findings;
}
