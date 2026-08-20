import { describe, expect, it } from 'vitest';
import { runExperiment } from '../src/experiment/ExperimentRunner';

describe('Cardinal modes', () => {
  it('OFF creates no Cardinal evaluations', async () => {
    const result = await runExperiment('off', 'same-seed', 10);
    expect(result.evaluationCount).toBe(0);
    expect(result.interventionCount).toBe(0);
  });

  it('OBSERVER records evaluations but never interventions', async () => {
    const result = await runExperiment('observer', 'same-seed', 10);
    expect(result.evaluationCount).toBe(10);
    expect(result.interventionCount).toBe(0);
  });

  it('OFF and OBSERVER produce identical autonomous world state', async () => {
    const disturbances = [
      { tick: 4, kind: 'resource_shock' as const, magnitude: 0.4 },
      { tick: 8, kind: 'social_barrier' as const, magnitude: 0.2, duration: 4 },
    ];

    const off = await runExperiment('off', 'paired-seed', 20, disturbances);
    const observer = await runExperiment('observer', 'paired-seed', 20, disturbances);

    expect(observer.finalWorld).toEqual(off.finalWorld);
  });
});
