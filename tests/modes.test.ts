import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  runExperiment,
} from '../src/experiment/ExperimentRunner';

describe(
  'Cardinal modes',
  () => {
    it(
      'OFF creates no Cardinal evaluations',
      async () => {
        const result =
          await runExperiment(
            'off',
            'same-seed',
            10,
          );

        expect(
          result.evaluationCount,
        ).toBe(0);

        expect(
          result.interventionCount,
        ).toBe(0);
      },
    );

    it(
      'OBSERVER records evaluations but never interventions',
      async () => {
        const result =
          await runExperiment(
            'observer',
            'same-seed',
            10,
          );

        expect(
          result.evaluationCount,
        ).toBe(10);

        expect(
          result.interventionCount,
        ).toBe(0);
      },
    );
  },
);
