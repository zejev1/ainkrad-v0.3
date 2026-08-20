import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  CardinalAuditor,
} from '../src/cardinal/CardinalAuditor';

import {
  CardinalCore,
} from '../src/cardinal/CardinalCore';

import {
  InMemoryCardinalJournal,
} from '../src/cardinal/InMemoryCardinalJournal';

import {
  CardinalObserver,
} from '../src/cardinal/CardinalObserver';

import {
  CardinalRuntime,
} from '../src/cardinal/CardinalRuntime';

import {
  IndependentInterventionGateway,
} from '../src/cardinal/InterventionGateway';

import {
  WorldSensors,
} from '../src/sensors/WorldSensors';

import {
  InMemoryEventStore,
} from '../src/world/InMemoryEventStore';

import {
  WorldEngine,
} from '../src/world/WorldEngine';

describe(
  'Cardinal Observer',
  () => {
    it(
      'does not mutate the autonomous world',
      async () => {
        const eventStore =
          new InMemoryEventStore();

        const world =
          new WorldEngine({
            worldId:
              'world_1',
            seed:
              'observer-test',
            eventStore,
            startTime:
              0,
          });

        await world.step(1);

        const before =
          world.snapshot();

        const runtime =
          new CardinalRuntime(
            new CardinalObserver(
              new WorldSensors(
                eventStore,
              ),
            ),
            new CardinalCore(),
            new IndependentInterventionGateway(),
            new CardinalAuditor(),
            new InMemoryCardinalJournal(),
          );

        await runtime.cycle(
          'observer',
          world,
          1,
        );

        const after =
          world.snapshot();

        expect(after)
          .toEqual(before);
      },
    );
  },
);
