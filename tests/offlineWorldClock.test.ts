import { describe, expect, it } from 'vitest';
import {
  makeOfflineWorldClockAnchor,
  offlineWorldMinuteTarget,
  parseOfflineWorldClockAnchor,
} from '../src/runtime/OfflineWorldClock';

describe('Offline canonical world clock', () => {
  it('converts closed-tab wall time into one absolute world-minute target', () => {
    const anchor = makeOfflineWorldClockAnchor({
      worldEpoch: 4,
      worldMinutes: 12_000,
      wallClockMs: 1_000_000,
      speedId: 'day_per_minute',
      multiplier: 1,
    });
    const restored = parseOfflineWorldClockAnchor(JSON.stringify(anchor));
    expect(restored).toEqual(anchor);
    expect(
      offlineWorldMinuteTarget({
        anchor,
        currentWorldEpoch: 4,
        currentWorldMinutes: 12_050,
        nowWallClockMs: 1_120_000,
      }),
    ).toBe(14_880);
  });

  it('rejects malformed anchors and never carries time debt into a new epoch', () => {
    expect(parseOfflineWorldClockAnchor('{bad json')).toBeUndefined();
    const anchor = makeOfflineWorldClockAnchor({
      worldEpoch: 2,
      worldMinutes: 8_760,
      wallClockMs: 10_000,
      speedId: 'year_per_minute',
      multiplier: 10,
    });
    expect(
      offlineWorldMinuteTarget({
        anchor,
        currentWorldEpoch: 3,
        currentWorldMinutes: 0,
        nowWallClockMs: 70_000,
      }),
    ).toBeUndefined();
  });
});

