import { describe, expect, it } from 'vitest';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import type { SensorSnapshot } from '../src/sensors/types';

function observation(overrides: Partial<SensorSnapshot['metrics']>): SensorSnapshot {
  return {
    worldId: 'world_1',
    observedAt: 10,
    metrics: {
      populationActivity: 0.4,
      averageStress: 0.3,
      socialIsolation: 0.2,
      conflictPressure: 0.1,
      resourcePressure: 0.2,
      relationshipDiversity: 0.2,
      recoveryCapacity: 0.7,
      activeSignalCount: 0,
      ...overrides,
    },
    evidenceEventIds: ['event_1'],
    limitations: [],
  };
}

describe('Cardinal Core', () => {
  it('chooses the strongest qualifying condition instead of a fixed category priority', () => {
    const evaluation = new CardinalCore().evaluate(
      'intervene',
      observation({
        resourcePressure: 0.74,
        recoveryCapacity: 0.4,
        socialIsolation: 0.95,
        populationActivity: 0.2,
      }),
    );

    expect(evaluation.proposal?.kind).toBe('open_shared_space');
  });

  it('preserves observation limitations as uncertainty notes', () => {
    const input = observation({});
    input.limitations = ['Relationship graph is sparse.'];
    const evaluation = new CardinalCore().evaluate('observer', input);

    expect(evaluation.uncertaintyNotes).toEqual(input.limitations);
  });
});
