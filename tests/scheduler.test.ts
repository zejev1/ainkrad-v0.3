import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  assertSmallScheduledOperation,
} from '../src/runtime/scheduler/types';

describe(
  'Scheduler payload rule',
  () => {
    it(
      'accepts identifier-sized operations',
      () => {
        expect(
          () =>
            assertSmallScheduledOperation({
              operationId:
                'op_1',
              worldId:
                'world_1',
              actorId:
                'agent_1',
              kind:
                'agent.think',
              payload: {
                reason:
                  'tick',
              },
            }),
        ).not.toThrow();
      },
    );

    it(
      'rejects giant serialized context',
      () => {
        expect(
          () =>
            assertSmallScheduledOperation({
              operationId:
                'op_2',
              worldId:
                'world_1',
              kind:
                'bad.operation',
              payload: {
                giant:
                  'x'.repeat(
                    9000,
                  ),
              },
            }),
        ).toThrow();
      },
    );
  },
);
