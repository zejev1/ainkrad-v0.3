import {
  CANONICAL_SIMULATION_QUANTUM_WORLD_MINUTES,
  type CanonicalSimulationCursor,
} from './CanonicalSimulationClock';

export interface LegacyClockProjection {
  elapsedWorldMinutes: number;
  legacyLogicalTick: number;
}

/**
 * Derives a v15 canonical simulation cursor for a legacy world without
 * changing its calendar or pretending that technical ticks are dates.
 *
 * The existing world has already consumed whatever dynamics its old engine
 * executed, so all elapsed time up to migration is marked processed.
 * Remainder is intentionally zero at the migration boundary.
 *
 * The quantumIndex is used only for future scheduling. It is derived from
 * elapsed world time, not from the legacy technical tick.
 */
export function migrateLegacySimulationCursor(
  legacy: LegacyClockProjection,
): CanonicalSimulationCursor {
  if (
    !Number.isFinite(legacy.elapsedWorldMinutes) ||
    legacy.elapsedWorldMinutes < 0
  ) {
    throw new Error('Legacy elapsedWorldMinutes must be finite and non-negative.');
  }
  if (
    !Number.isFinite(legacy.legacyLogicalTick) ||
    legacy.legacyLogicalTick < 0
  ) {
    throw new Error('Legacy logical tick must be finite and non-negative.');
  }

  return {
    processedWorldMinutes: legacy.elapsedWorldMinutes,
    remainderWorldMinutes: 0,
    quantumIndex: Math.floor(
      legacy.elapsedWorldMinutes /
        CANONICAL_SIMULATION_QUANTUM_WORLD_MINUTES,
    ),
  };
}
