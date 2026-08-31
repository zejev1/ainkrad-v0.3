import { describe, expect, it } from 'vitest';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import { deriveCardinalExperience } from '../src/cardinal/CardinalExperience';
import {
  CARDINAL_RESEARCH_VERSION,
  type CardinalResearchContext,
} from '../src/cardinal/CardinalResearch';
import type { CardinalEvaluation } from '../src/cardinal/types';
import type { SensorSnapshot } from '../src/sensors/types';

function ecosystemObservation(observedAt: number): SensorSnapshot {
  return {
    sensorVersion: 'ainkrad-world-sensors-0.3.10',
    worldId: 'learning-world',
    worldEpoch: 1,
    worldRevision: observedAt,
    observedAt,
    observedWorldMinutes: observedAt * 8_760,
    metrics: {
      populationActivity: 0.55,
      averageStress: 0.25,
      socialIsolation: 0.2,
      conflictPressure: 0.1,
      resourcePressure: 0.25,
      relationshipDiversity: 0.25,
      recoveryCapacity: 0.7,
      exploredWorldRatio: 1 / 3,
      wildlifePressure: 0.82,
      ecologicalDiversity: 1 / 3,
      activeSignalCount: 0,
    },
    evidenceEventIds: [`ecosystem-event-${observedAt}`],
    limitations: [],
  };
}

function research(
  priorEvaluations: CardinalEvaluation[],
): CardinalResearchContext {
  return {
    researchVersion: CARDINAL_RESEARCH_VERSION,
    priorEvaluations: priorEvaluations.slice(-12),
    priorInterventions: [],
    priorOutcomes: [],
    experience: deriveCardinalExperience(priorEvaluations, []),
    fingerprint: `experience-context-${priorEvaluations.length}`,
  };
}

describe('Cardinal experience', () => {
  it('learns ecosystem support from repeated observations without gaining control over residents', () => {
    const core = new CardinalCore();
    const evaluations: CardinalEvaluation[] = [];

    for (let tick = 1; tick <= 7; tick += 1) {
      evaluations.push(
        core.evaluate(
          'intervene',
          ecosystemObservation(tick),
          research(evaluations),
        ),
      );
    }

    expect(evaluations[0].decision).toBe('defer');
    expect(evaluations[0].deferReason).toBe('capability_not_ready');
    expect(evaluations[6].experience.capabilities).not.toContain(
      'habitat_support_planning',
    );

    const learned = core.evaluate(
      'intervene',
      ecosystemObservation(8),
      research(evaluations),
    );

    expect(learned.experience.level).toBeGreaterThanOrEqual(2);
    expect(learned.experience.capabilities).toContain(
      'habitat_support_planning',
    );
    expect(learned.experience.newlyUnlockedCapabilities).toContain(
      'habitat_support_planning',
    );
    expect(learned.decision).toBe('propose');
    expect(learned.proposal?.kind).toBe('habitat_support');

    const allowedCapabilities = new Set([
      'world_observation',
      'autonomy_guard',
      'trend_reasoning',
      'ecosystem_observation',
      'outcome_learning',
      'habitat_support_planning',
    ]);
    expect(
      learned.experience.capabilities.every((capability) =>
        allowedCapabilities.has(capability),
      ),
    ).toBe(true);
  });
});
