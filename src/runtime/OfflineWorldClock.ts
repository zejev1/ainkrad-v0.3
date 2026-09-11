import {
  isWorldSpeedId,
  isWorldSpeedMultiplier,
  worldSpeedPreset,
  type WorldSpeedId,
  type WorldSpeedMultiplier,
} from '../world/WorldClock';

export const OFFLINE_WORLD_CLOCK_ANCHOR_VERSION =
  'ainkrad-offline-world-clock-2' as const;

export interface OfflineWorldClockAnchor {
  version: typeof OFFLINE_WORLD_CLOCK_ANCHOR_VERSION | 'ainkrad-offline-world-clock-1';
  worldEpoch: number;
  worldMinutes: number;
  wallClockMs: number;
  speedId: WorldSpeedId;
  multiplier: WorldSpeedMultiplier;
  clockRevision?: number;
  targetWorldMinutes?: number;
  catchingUp?: boolean;
  cancelPending?: boolean;
  backgroundMode?: 'real_time' | 'selected';
}

export function parseOfflineWorldClockAnchor(
  raw: string | null,
): OfflineWorldClockAnchor | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return undefined;
    const candidate = value as Partial<OfflineWorldClockAnchor>;
    if (
      (candidate.version !== OFFLINE_WORLD_CLOCK_ANCHOR_VERSION && candidate.version !== 'ainkrad-offline-world-clock-1') ||
      !Number.isInteger(candidate.worldEpoch) ||
      (candidate.worldEpoch ?? 0) < 1 ||
      typeof candidate.worldMinutes !== 'number' ||
      !Number.isFinite(candidate.worldMinutes) ||
      candidate.worldMinutes < 0 ||
      typeof candidate.wallClockMs !== 'number' ||
      !Number.isFinite(candidate.wallClockMs) ||
      candidate.wallClockMs < 0 ||
      !isWorldSpeedId(candidate.speedId) ||
      !isWorldSpeedMultiplier(candidate.multiplier) ||
      !validAnchorExtras(candidate)
    ) {
      return undefined;
    }
    return candidate as OfflineWorldClockAnchor;
  } catch {
    return undefined;
  }
}

export function makeOfflineWorldClockAnchor(input: {
  worldEpoch: number;
  worldMinutes: number;
  wallClockMs: number;
  speedId: WorldSpeedId;
  multiplier: WorldSpeedMultiplier;
  clockRevision?: number;
  targetWorldMinutes?: number;
  catchingUp?: boolean;
  cancelPending?: boolean;
  backgroundMode?: 'real_time' | 'selected';
}): OfflineWorldClockAnchor {
  if (
    !Number.isInteger(input.worldEpoch) ||
    input.worldEpoch < 1 ||
    !Number.isFinite(input.worldMinutes) ||
    input.worldMinutes < 0 ||
    !Number.isFinite(input.wallClockMs) ||
    input.wallClockMs < 0 ||
    !isWorldSpeedId(input.speedId) || !isWorldSpeedMultiplier(input.multiplier) || !validAnchorExtras(input)
  ) {
    throw new Error('Offline world-clock anchor is invalid.');
  }
  return {
    version: OFFLINE_WORLD_CLOCK_ANCHOR_VERSION,
    ...input,
  };
}

/**
 * Returns an absolute canonical target, never a number of worker ticks.
 * A duplicate request from another tab therefore cannot advance the world
 * twice: WorldEngine accepts only a monotonic absolute world-minute target.
 */
export function offlineWorldMinuteTarget(input: {
  anchor: Readonly<OfflineWorldClockAnchor>;
  currentWorldEpoch: number;
  currentWorldMinutes: number;
  nowWallClockMs: number;
}): number | undefined {
  const { anchor } = input;
  if (
    anchor.worldEpoch !== input.currentWorldEpoch ||
    !Number.isFinite(input.currentWorldMinutes) ||
    input.currentWorldMinutes < 0 ||
    !Number.isFinite(input.nowWallClockMs)
  ) {
    return undefined;
  }
  // A cancellation intent survives a reload before the worker acknowledgement.
  if (anchor.cancelPending) return input.currentWorldMinutes;
  const base = Math.max(anchor.worldMinutes, anchor.targetWorldMinutes ?? 0);
  // Never add time spent calculating the same offline interval to its target.
  if (anchor.catchingUp) return Math.max(input.currentWorldMinutes, base);
  const elapsedRealMinutes = Math.max(
    0,
    (input.nowWallClockMs - anchor.wallClockMs) / 60_000,
  );
  const worldMinutesPerRealMinute =
    anchor.backgroundMode === 'real_time' ? 1 :
      worldSpeedPreset(anchor.speedId).worldMinutesPerRealMinute * anchor.multiplier;
  const target =
    base + elapsedRealMinutes * worldMinutesPerRealMinute;
  if (!Number.isFinite(target)) return undefined;
  return Math.max(input.currentWorldMinutes, target);
}


function validAnchorExtras(value: Partial<OfflineWorldClockAnchor>): boolean {
  return (value.clockRevision === undefined || (Number.isSafeInteger(value.clockRevision) && value.clockRevision >= 0)) &&
    (value.targetWorldMinutes === undefined || (Number.isFinite(value.targetWorldMinutes) && value.targetWorldMinutes >= 0)) &&
    (value.catchingUp === undefined || typeof value.catchingUp === 'boolean') &&
    (value.cancelPending === undefined || typeof value.cancelPending === 'boolean') &&
    (value.backgroundMode === undefined || value.backgroundMode === 'real_time' || value.backgroundMode === 'selected');
}
