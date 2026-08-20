import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  ClosedExternalGateway,
} from '../src/boundary/ExternalGateway';

describe(
  'External boundary',
  () => {
    it(
      'is closed by default',
      async () => {
        const gateway =
          new ClosedExternalGateway();

        const result =
          await gateway.request({
            requestId:
              'req_1',
            kind:
              'external.test',
            payload: {},
          });

        expect(
          result.authorized,
        ).toBe(false);

        expect(
          result.executed,
        ).toBe(false);
      },
    );
  },
);
