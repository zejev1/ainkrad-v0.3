import { describe, expect, it } from 'vitest';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import { InMemoryCardinalJournal } from '../src/cardinal/InMemoryCardinalJournal';
import {
  createPortableCardinalExperienceSeed,
  exportPortableCardinalExperience,
} from '../src/cardinal/portable/CardinalExperienceTransfer';
import { PortableCardinalRuntime } from '../src/cardinal/portable/PortableCardinalRuntime';
import type { CardinalObservationPort } from '../src/cardinal/portable/types';
import type { CardinalMetrics, SensorSnapshot } from '../src/sensors/types';

interface TestHostSnapshot {
  id: string;
  epoch: number;
  revision: number;
  worldMinutes: number;
}

const healthyMetrics: CardinalMetrics = {
  livingPopulation: 20,
  sapientPopulation: 20,
  raceDiversity: 1,
  reproductiveAdultMales: 6,
  reproductiveAdultFemales: 6,
  reproductivePairPotential: 6,
  reproductiveContinuity: 0.9,
  civilizationPressure: 0.1,
  civilizationCriticality: 0.1,
  recentDeathPressure: 0,
  wildlifeAttackDeathShare: 0,
  monsterDeathShare: 0,
  wildlifeDangerPressure: 0.1,
  monsterPressure: 0,
  populationActivity: 0.8,
  averageStress: 0.1,
  socialIsolation: 0.1,
  conflictPressure: 0.1,
  safetyPressure: 0.1,
  resourcePressure: 0.1,
  relationshipDiversity: 0.8,
  recoveryCapacity: 0.9,
  exploredWorldRatio: 0.4,
  wildlifePressure: 0.1,
  ecologicalDiversity: 0.7,
  activeSignalCount: 2,
};

class TestObservationAdapter
  implements CardinalObservationPort<TestHostSnapshot>
{
  readonly adapterId = 'test-host-adapter-1';

  async observe(
    snapshot: Readonly<TestHostSnapshot>,
    technicalOrder: number,
  ): Promise<SensorSnapshot> {
    return {
      sensorVersion: 'test-host-sensors-1',
      worldId: snapshot.id,
      worldEpoch: snapshot.epoch,
      worldRevision: snapshot.revision,
      observedAt: technicalOrder,
      observedWorldMinutes: snapshot.worldMinutes,
      metrics: structuredClone(healthyMetrics),
      evidenceEventIds: [],
      limitations: [],
    };
  }
}

describe('portable Cardinal boundary', () => {
  it('runs against a non-Ainkrad host without receiving a mutation gateway', async () => {
    const journal = new InMemoryCardinalJournal();
    const runtime = new PortableCardinalRuntime(
      new TestObservationAdapter(),
      new CardinalCore(),
      journal,
    );
    const evaluation = await runtime.cycle(
      'observer',
      { id: 'other-world', epoch: 1, revision: 0, worldMinutes: 8_760 },
      1,
    );

    expect(evaluation?.worldId).toBe('other-world');
    expect(evaluation?.evaluatedWorldMinutes).toBe(8_760);
    expect(evaluation?.hypotheticalOnly).toBe(true);
    expect((await journal.evaluations('other-world')).length).toBe(1);
    expect('gateway' in runtime).toBe(false);
  });

  it('inherits learned capability but not old timed autonomy evidence', async () => {
    const seed = createPortableCardinalExperienceSeed('trained-world', 900, {
      observationCycles: 64,
      ecologyObservationCycles: 12,
      evaluatedOutcomes: 4,
      successfulPredictions: 2,
    });
    const journal = new InMemoryCardinalJournal();
    const runtime = new PortableCardinalRuntime(
      new TestObservationAdapter(),
      new CardinalCore(),
      journal,
      { inheritedExperience: seed },
    );
    const evaluation = await runtime.cycle(
      'observer',
      { id: 'fresh-host', epoch: 1, revision: 0, worldMinutes: 1_000 },
      1,
    );

    expect(evaluation?.experience.observationCycles).toBe(65);
    expect(evaluation?.experience.ecologyObservationCycles).toBe(13);
    expect(evaluation?.experience.evaluatedOutcomes).toBe(4);
    expect(evaluation?.experience.capabilities).toContain('world_rule_design');
    expect(evaluation?.detectedProblem).toBeUndefined();
    expect(evaluation?.autonomyAssessment).toBeUndefined();

    const archive = await exportPortableCardinalExperience(
      journal,
      'fresh-host',
      2,
    );
    expect(archive.evaluations).toHaveLength(1);
    expect(archive.interventions).toHaveLength(0);
    expect(archive.outcomes).toHaveLength(0);
    expect(archive.seed.observationCycles).toBe(1);
  });
});

