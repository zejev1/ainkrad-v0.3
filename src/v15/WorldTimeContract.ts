/**
 * Ainkrad v15 recovery checkpoint.
 *
 * This module is intentionally dependency-light so the world-time contract
 * can be transplanted into the real v15 tree without mixing worker ticks
 * with canonical Ainkrad time.
 */

export const WORLD_MINUTES_PER_HOUR = 60;
export const WORLD_HOURS_PER_DAY = 24;
export const WORLD_MINUTES_PER_DAY =
  WORLD_MINUTES_PER_HOUR * WORLD_HOURS_PER_DAY;
export const WORLD_DAYS_PER_YEAR = 365;
export const WORLD_MINUTES_PER_YEAR =
  WORLD_MINUTES_PER_DAY * WORLD_DAYS_PER_YEAR; // 525_600

/**
 * One semantic decision opportunity in the v15 world. External worker calls
 * may contribute a fraction of this value or many of these values at once,
 * but they never change the quantum itself.
 */
export const CANONICAL_WORLD_QUANTUM_MINUTES =
  WORLD_MINUTES_PER_YEAR / 60; // 8_760

export const CARDINAL_AUTONOMY_WINDOW_DAYS = 90;
export const CARDINAL_AUTONOMY_WINDOW_WORLD_MINUTES =
  CARDINAL_AUTONOMY_WINDOW_DAYS * WORLD_MINUTES_PER_DAY; // 129_600

/**
 * Preserves the approximate duration of the legacy "4 logical ticks"
 * prediction window explicitly in canonical world minutes.
 *
 * Do not infer this from worker speed.
 */
export const LEGACY_CARDINAL_PREDICTION_WINDOW_WORLD_MINUTES = 35_040;

/** Tick-era constants translated once at the migration boundary. */
export const CARDINAL_RESEARCH_LOOKBACK_WORLD_MINUTES =
  12 * CANONICAL_WORLD_QUANTUM_MINUTES; // 105_120
export const DEFAULT_GATEWAY_COOLDOWN_WORLD_MINUTES =
  5 * CANONICAL_WORLD_QUANTUM_MINUTES; // 43_800
export const DEFAULT_GATEWAY_EFFECT_DURATION_WORLD_MINUTES =
  8 * CANONICAL_WORLD_QUANTUM_MINUTES; // 70_080
export const MAX_GATEWAY_EFFECT_DURATION_WORLD_MINUTES =
  32 * CANONICAL_WORLD_QUANTUM_MINUTES; // 280_320
export const MAX_CARDINAL_PREDICTION_HORIZON_WORLD_MINUTES =
  16 * CANONICAL_WORLD_QUANTUM_MINUTES; // 140_160

export const CARDINAL_INITIAL_OPPORTUNITY_WORLD_MINUTES =
  3 * CANONICAL_WORLD_QUANTUM_MINUTES;
export const CARDINAL_BASE_CYCLE_INTERVAL_WORLD_MINUTES =
  300 * CANONICAL_WORLD_QUANTUM_MINUTES;
export const CARDINAL_CRITICAL_CYCLE_INTERVAL_WORLD_MINUTES =
  10 * CANONICAL_WORLD_QUANTUM_MINUTES;
export const CARDINAL_SIGNAL_BURST_WORLD_MINUTES =
  4 * CANONICAL_WORLD_QUANTUM_MINUTES;

export interface CanonicalWorldTime {
  /** Monotonic technical/logical step. Never use as elapsed days. */
  logicalTick: number;

  /** Canonical elapsed time inside Ainkrad. */
  elapsedWorldMinutes: number;
}

export interface TimedObservationRef {
  observedAtTick: number;
  observedWorldMinutes: number;
}

export interface TimedInterventionRef {
  requestedAtTick: number;
  requestedWorldMinutes: number;
  horizonWorldMinutes: number;
}

export function worldMinutesSince(
  currentWorldMinutes: number,
  earlierWorldMinutes: number,
): number {
  if (!Number.isFinite(currentWorldMinutes) || !Number.isFinite(earlierWorldMinutes)) {
    throw new Error('World-minute values must be finite.');
  }
  return Math.max(0, currentWorldMinutes - earlierWorldMinutes);
}

export function isWithinWorldWindow(
  currentWorldMinutes: number,
  earlierWorldMinutes: number,
  windowWorldMinutes: number,
): boolean {
  if (!Number.isFinite(windowWorldMinutes) || windowWorldMinutes < 0) {
    throw new Error('World-time window must be finite and non-negative.');
  }
  return worldMinutesSince(currentWorldMinutes, earlierWorldMinutes) <= windowWorldMinutes;
}

/**
 * Legacy evidence with only a unit-ambiguous numeric `horizon` is not safe
 * for canonical v15 world-time reasoning.
 */
export function hasCanonicalPredictionHorizon(
  value: unknown,
): value is { horizonWorldMinutes: number } {
  if (!value || typeof value !== 'object') return false;
  const horizonWorldMinutes = (value as { horizonWorldMinutes?: unknown })
    .horizonWorldMinutes;
  return (
    typeof horizonWorldMinutes === 'number' &&
    Number.isFinite(horizonWorldMinutes) &&
    horizonWorldMinutes >= 0
  );
}

export function isCanonicalWorldMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function worldDurationDescription(worldMinutes: number): string {
  if (!isCanonicalWorldMinutes(worldMinutes)) {
    return 'некорректная длительность';
  }
  const days = worldMinutes / WORLD_MINUTES_PER_DAY;
  if (days >= WORLD_DAYS_PER_YEAR) {
    const years = days / WORLD_DAYS_PER_YEAR;
    return `${Number.isInteger(years) ? years : years.toFixed(1)} года Ainkrad`;
  }
  if (days >= 1) {
    return `${Number.isInteger(days) ? days : days.toFixed(1)} дня Ainkrad`;
  }
  const hours = worldMinutes / WORLD_MINUTES_PER_HOUR;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} часа Ainkrad`;
}
