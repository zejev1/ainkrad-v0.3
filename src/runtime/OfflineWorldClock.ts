import {
  isWorldSpeedId,
  isWorldSpeedMultiplier,
  worldSpeedPreset,
  type WorldSpeedId,
  type WorldSpeedMultiplier,
} from '../world/WorldClock';

export const OFFLINE_WORLD_CLOCK_ANCHOR_VERSION =
  'ainkrad-offline-world-clock-1' as const;

export interface OfflineWorldClockAnchor {
  version: typeof OFFLINE_WORLD_CLOCK_ANCHOR_VERSION;
  worldEpoch: number;
  worldMinutes: number;
  wallClockMs: number;
  speedId: WorldSpeedId;
  multiplier: WorldSpeedMultiplier;
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
      candidate.version !== OFFLINE_WORLD_CLOCK_ANCHOR_VERSION ||
      !Number.isInteger(candidate.worldEpoch) ||
      (candidate.worldEpoch ?? 0) < 1 ||
      typeof candidate.worldMinutes !== 'number' ||
      !Number.isFinite(candidate.worldMinutes) ||
      candidate.worldMinutes < 0 ||
      typeof candidate.wallClockMs !== 'number' ||
      !Number.isFinite(candidate.wallClockMs) ||
      candidate.wallClockMs < 0 ||
      !isWorldSpeedId(candidate.speedId) ||
      !isWorldSpeedMultiplier(candidate.multiplier)
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
}): OfflineWorldClockAnchor {
  if (
    !Number.isInteger(input.worldEpoch) ||
    input.worldEpoch < 1 ||
    !Number.isFinite(input.worldMinutes) ||
    input.worldMinutes < 0 ||
    !Number.isFinite(input.wallClockMs) ||
    input.wallClockMs < 0
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
  const elapsedRealMinutes = Math.max(
    0,
    (input.nowWallClockMs - anchor.wallClockMs) / 60_000,
  );
  const worldMinutesPerRealMinute =
    worldSpeedPreset(anchor.speedId).worldMinutesPerRealMinute *
    anchor.multiplier;
  const target =
    anchor.worldMinutes + elapsedRealMinutes * worldMinutesPerRealMinute;
  if (!Number.isFinite(target)) return undefined;
  return Math.max(input.currentWorldMinutes, target);
}

