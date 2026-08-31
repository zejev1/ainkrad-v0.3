import { describe, expect, it } from 'vitest';
import { runControlledComparison } from '../src/experiment/ExperimentRunner';

describe('Controlled Cardinal experiment integrity', () => {
  it('keeps OFF/OBSERVER equivalent and records outcomes for executed interventions', async () => {
    const disturbances: Array<{
      tick: number;
      kind: 'resource_shock' | 'social_barrier' | 'safety_shock';
      magnitude: number;
      duration?: number;
    }> = [];

    for (let tick = 5; tick <= 180; tick += 10) {
      disturbances.push({ tick, kind: 'resource_shock', magnitude: 0.8 });
      disturbances.push({ tick, kind: 'social_barrier', magnitude: 0.8, duration: 9 });
      disturbances.push({ tick, kind: 'safety_shock', magnitude: 0.8, duration: 9 });
    }

    const comparison = await runControlledComparison('scan', 200, disturbances);

    expect(comparison.analysis.pairedConfigurationEquivalent).toBe(true);
    expect(comparison.analysis.offObserverEquivalent).toBe(true);
    expect(comparison.observer.finalWorld).toEqual(comparison.off.finalWorld);
    expect(comparison.observer.worldHistoryFingerprint).toBe(
      comparison.off.worldHistoryFingerprint,
    );
    expect(comparison.intervene.executedInterventionCount).toBeGreaterThan(0);
    expect(comparison.intervene.outcomeCount).toBe(
      comparison.intervene.executedInterventionCount,
    );
    expect(comparison.intervene.pendingOutcomeCount).toBe(0);
  }, 60_000);
});
