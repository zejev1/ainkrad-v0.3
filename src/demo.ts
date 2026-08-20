import {
  runExperiment,
} from './experiment/ExperimentRunner';

const seed =
  'ainkrad-demo-seed';

const ticks =
  30;

const off =
  await runExperiment(
    'off',
    seed,
    ticks,
  );

const observer =
  await runExperiment(
    'observer',
    seed,
    ticks,
  );

const intervene =
  await runExperiment(
    'intervene',
    seed,
    ticks,
  );

console.log(
  JSON.stringify(
    {
      off: {
        evaluations:
          off.evaluationCount,
        interventions:
          off.interventionCount,
      },
      observer: {
        evaluations:
          observer.evaluationCount,
        interventions:
          observer.interventionCount,
      },
      intervene: {
        evaluations:
          intervene.evaluationCount,
        interventions:
          intervene.interventionCount,
      },
    },
    null,
    2,
  ),
);
