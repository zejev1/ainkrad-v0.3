import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  InMemoryEventStore,
} from '../src/world/InMemoryEventStore';

describe(
  'Experiment history',
  () => {
    it(
      'keeps expired signals in history while removing them from active influence',
      async () => {
        const store =
          new InMemoryEventStore();

        await store.append({
          eventId:
            'signal_1',
          worldId:
            'world_1',
          kind:
            'test.signal',
          source:
            'world',
          occurredAt:
            1,
          activeUntil:
            5,
          payload: {},
        });

        expect(
          (
            await store.active(
              'world_1',
              3,
            )
          ).length,
        ).toBe(1);

        expect(
          (
            await store.active(
              'world_1',
              6,
            )
          ).length,
        ).toBe(0);

        expect(
          (
            await store.history(
              'world_1',
            )
          ).length,
        ).toBe(1);
      },
    );
  },
);
