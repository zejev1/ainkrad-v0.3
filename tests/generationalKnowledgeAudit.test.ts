import { describe, expect, it } from 'vitest';
import {
  auditThirdGenerationTeachingChainV15,
  type GenerationResidentAuditV15,
} from '../src/v15/GenerationalKnowledgeAuditV15';
import { WORLD_MINUTES_PER_YEAR } from '../src/v15/WorldTimeContract';

function resident(
  id: string,
  generation: number,
  ageYears: number,
  ordinaryInstructorIds: string[] = [],
): GenerationResidentAuditV15 {
  const currentWorldMinutes = 30 * WORLD_MINUTES_PER_YEAR;
  return {
    id,
    generation,
    bornWorldMinutes: currentWorldMinutes - ageYears * WORLD_MINUTES_PER_YEAR,
    alive: true,
    knowledge: {
      agriculture: generation === 1 ? 0.4 : 0.12,
      construction: 0.12,
      household: 0.12,
      survival: 0.12,
    },
    ordinaryInstructorIds,
    verifiedLearningSessionCount: ordinaryInstructorIds.length,
    verifiedPracticeSessionCount: 1,
  };
}

describe('v15 three-generation knowledge audit', () => {
  it('does not label a generation-two baby as a failed teaching chain', () => {
    const findings = auditThirdGenerationTeachingChainV15({
      currentWorldMinutes: 30 * WORLD_MINUTES_PER_YEAR,
      genesisActiveCount: 0,
      residents: [
        resident('generation-one-teacher', 1, 20),
        resident('generation-two-baby', 2, 2),
      ],
    });

    expect(findings).toContainEqual(
      expect.objectContaining({
        severity: 'info',
        code: 'third_generation_not_yet_learning_age',
      }),
    );
    expect(findings).not.toContainEqual(
      expect.objectContaining({ code: 'third_generation_not_taught_by_second' }),
    );
  });

  it('accepts a verified generation-one to generation-two lesson', () => {
    const findings = auditThirdGenerationTeachingChainV15({
      currentWorldMinutes: 30 * WORLD_MINUTES_PER_YEAR,
      genesisActiveCount: 0,
      residents: [
        resident('generation-one-teacher', 1, 22),
        resident(
          'generation-two-learner',
          2,
          9,
          ['generation-one-teacher'],
        ),
      ],
    });

    expect(findings).toContainEqual(
      expect.objectContaining({
        severity: 'info',
        code: 'three_generation_knowledge_chain_alive',
      }),
    );
    expect(findings.some((finding) => finding.severity === 'critical')).toBe(
      false,
    );
  });
});
