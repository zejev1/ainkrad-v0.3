import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  InMemoryInputBus,
} from '../src/runtime/inputBus/InMemoryInputBus';

import {
  createInputEnvelope,
} from '../src/runtime/inputBus/createEnvelope';

describe(
  'InputBus',
  () => {
    it(
      'deduplicates without a shared global sequence counter',
      async () => {
        const bus =
          new InMemoryInputBus();

        const event =
          createInputEnvelope({
            eventId:
              'evt_1',
            worldId:
              'world_1',
            source:
              'agent',
            type:
              'agent.intent',
            deduplicationKey:
              'intent_1',
          });

        const first =
          await bus.publish(
            event,
          );

        const second =
          await bus.publish(
            event,
          );

        expect(
          first.accepted,
        ).toBe(true);

        expect(
          second.duplicate,
        ).toBe(true);

        expect(
          (
            await bus.take(
              'world_1',
              10,
            )
          ).length,
        ).toBe(1);
      },
    );
  },
);
