import {
  createGenesisTeachers,
  GENESIS_ACTIVE_WORLD_MINUTES,
} from './GenesisBootstrap';
import {
  applyGenesisLesson,
  applyIndependentPractice,
  applyOrdinaryLesson,
  type LearningPerson,
  type OrdinaryInstructor,
} from './KnowledgeTransfer';
import {
  decideChildVoluntarily,
  evaluateFamilyAgency,
  type FamilyPerson,
} from './FamilyAgency';
import {
  harvestRenewably,
  recoverRenewableBase,
  consumeStoredResources,
  type RenewableResourceState,
} from './RenewableAgriculture';
import { auditV15LongRun } from './V15LongRunAudit';

const WORLD_MINUTES_PER_YEAR = 365 * 24 * 60;

export interface V15CoreIntegrationResult {
  genesisCount: number;
  genesisInactiveAfterYear3: boolean;
  founderAgricultureKnowledge: number;
  secondGenerationAgricultureKnowledge: number;
  practiceCanExceedGenesis: boolean;
  intimacyWithoutChildDecisionPossible: boolean;
  voluntaryNoChildPossible: boolean;
  renewableBaseAfterFourYears: number;
  longRunAlertCodes: string[];
}

/**
 * Cross-module acceptance story.
 *
 * This is NOT the final WorldEngine simulation and must not be used as a
 * population/ecology forecast. It exists to prove that recovered v15
 * contracts can coexist without violating one another.
 */
export function runV15CoreIntegrationContract(): V15CoreIntegrationResult {
  const teachers = createGenesisTeachers('integration-epoch');
  const agricultureTeacher = teachers.find(
    (teacher) => teacher.domain === 'agriculture',
  );
  if (!agricultureTeacher) throw new Error('Agriculture Genesis Teacher missing.');

  const founder: LearningPerson = {
    id: 'founder-farmer',
    generation: 0,
    ageYears: 24,
    aptitude: {
      agriculture: 0.82,
      construction: 0.45,
      household: 0.6,
      survival: 0.65,
    },
    knowledge: {
      agriculture: 0.08,
      construction: 0.05,
      household: 0.12,
      survival: 0.1,
    },
  };

  // A founder receives many real lessons during the bootstrap years.
  for (let index = 0; index < 36; index += 1) {
    applyGenesisLesson(
      agricultureTeacher,
      founder,
      0.78,
      {
        lessonId: `genesis-agri-${index}`,
        domain: 'agriculture',
        instructorId: agricultureTeacher.id,
        learnerId: founder.id,
        worldMinutes: index * 14 * 24 * 60,
        durationWorldMinutes: 240,
        activityVerified: true,
      },
    );
  }

  const ordinaryInstructor: OrdinaryInstructor = {
    ...founder,
    ordinaryResident: true,
    knowledge: { ...founder.knowledge },
  };

  // Second-generation learner starts after Genesis is already gone.
  const secondGeneration: LearningPerson = {
    id: 'second-generation-child',
    generation: 1,
    ageYears: 10,
    aptitude: {
      agriculture: 0.9,
      construction: 0.55,
      household: 0.7,
      survival: 0.8,
    },
    knowledge: {
      agriculture: 0.02,
      construction: 0.03,
      household: 0.05,
      survival: 0.04,
    },
  };

  const afterGenesis = GENESIS_ACTIVE_WORLD_MINUTES + WORLD_MINUTES_PER_YEAR;
  for (let index = 0; index < 24; index += 1) {
    applyOrdinaryLesson(
      ordinaryInstructor,
      secondGeneration,
      {
        lessonId: `peer-agri-${index}`,
        domain: 'agriculture',
        instructorId: ordinaryInstructor.id,
        learnerId: secondGeneration.id,
        worldMinutes: afterGenesis + index * 10 * 24 * 60,
        durationWorldMinutes: 240,
        activityVerified: true,
      },
    );
  }

  // Practice is not capped by the Genesis reference.
  const practitioner: LearningPerson = {
    ...secondGeneration,
    id: 'experienced-farmer',
    ageYears: 31,
    knowledge: {
      ...secondGeneration.knowledge,
      agriculture: 0.765,
    },
  };
  for (let index = 0; index < 80; index += 1) {
    applyIndependentPractice(
      practitioner,
      {
        practiceId: `advanced-practice-${index}`,
        personId: practitioner.id,
        domain: 'agriculture',
        worldMinutes: afterGenesis + index * 240,
        durationWorldMinutes: 240,
        activityVerified: true,
        challenge: 0.92,
      },
    );
  }

  const makeFamilyPerson = (
    id: string,
    sex: 'male' | 'female',
    intimacy: number,
    childDesire: number,
  ): FamilyPerson => ({
    id,
    sex,
    ageYears: 28,
    alive: true,
    health: 0.92,
    stress: 0.08,
    resources: 0.82,
    personality: {
      physicalIntimacyInclination: intimacy,
      childDesire,
      autonomy: 0.9,
    },
    parentIds: [],
    childIds: [],
  });

  const relationship = {
    trust: 0.9,
    affinity: 0.9,
    respect: 0.86,
    conflict: 0.02,
    attachment: 0.9,
  };

  const intimacyPairA = makeFamilyPerson('intimacy-a', 'male', 0.92, 0.02);
  const intimacyPairB = makeFamilyPerson('intimacy-b', 'female', 0.88, 0.03);
  const separatedSignals = evaluateFamilyAgency(
    intimacyPairA,
    intimacyPairB,
    {
      worldMinutes: 2 * WORLD_MINUTES_PER_YEAR,
      relationship,
      householdResourceSecurity: 0.9,
    },
  );

  const readyA = makeFamilyPerson('ready-a', 'male', 0.85, 0.9);
  const readyB = makeFamilyPerson('ready-b', 'female', 0.82, 0.88);
  const voluntaryNo = decideChildVoluntarily(
    readyA,
    readyB,
    {
      worldMinutes: 2 * WORLD_MINUTES_PER_YEAR,
      relationship,
      householdResourceSecurity: 0.9,
    },
    0.99,
    Math.round(WORLD_MINUTES_PER_YEAR * 1.3),
  );

  // Controlled agriculture continuity check; not a full world forecast.
  let resources: RenewableResourceState = {
    storedResources: 0.28,
    renewableBase: 0.82,
    fertility: 0.8,
  };
  for (let yearIndex = 0; yearIndex < 4; yearIndex += 1) {
    for (let harvestIndex = 0; harvestIndex < 8; harvestIndex += 1) {
      const harvested = harvestRenewably(
        resources,
        {
          id: practitioner.id,
          agricultureKnowledge: Math.min(
            1,
            practitioner.knowledge.agriculture,
          ),
          diligence: 0.8,
        },
        {
          eventId: `harvest-${yearIndex}-${harvestIndex}`,
          worldMinutes:
            yearIndex * WORLD_MINUTES_PER_YEAR +
            harvestIndex * 30 * 24 * 60,
          effort: 0.58,
        },
      );
      resources = consumeStoredResources(
        harvested.next,
        harvested.harvested * 0.72,
      );
    }
    resources = recoverRenewableBase(
      resources,
      WORLD_MINUTES_PER_YEAR,
      Math.min(1, practitioner.knowledge.agriculture),
    );
  }

  const audit = auditV15LongRun([
    {
      worldMinutes: 4 * WORLD_MINUTES_PER_YEAR,
      ordinaryLivingPopulation: 14,
      genesisActiveCount: 0,
      genesisCountedInPopulation: false,
      births: 4,
      deaths: 0,
      renewableResourceBase: resources.renewableBase,
      discoveredRegionCount: 1,
      ordinaryWildlifeCount: 18,
      ordinaryWildlifeCapacity: 30,
      monsterCount: 2,
      monsterCapacity: 6,
      brokenLineageLinks: 0,
      secondGenerationLiving: 4,
      secondGenerationLearners: 1,
      ordinaryTeachersActive: 1,
    },
  ]);

  return {
    genesisCount: teachers.length,
    genesisInactiveAfterYear3: !teachers.some(
      (teacher) =>
        teacher.activeUntilWorldMinutes >
        GENESIS_ACTIVE_WORLD_MINUTES,
    ),
    founderAgricultureKnowledge: founder.knowledge.agriculture,
    secondGenerationAgricultureKnowledge:
      secondGeneration.knowledge.agriculture,
    practiceCanExceedGenesis: practitioner.knowledge.agriculture > 0.78,
    intimacyWithoutChildDecisionPossible:
      separatedSignals.intimacyPossible &&
      !separatedSignals.childDecisionPossible,
    voluntaryNoChildPossible:
      voluntaryNo.reason === 'voluntary_no' && !voluntaryNo.chosen,
    renewableBaseAfterFourYears: resources.renewableBase,
    longRunAlertCodes: audit.map((alert) => alert.code),
  };
}
