export const WORLD_MINUTES_PER_YEAR = 365 * 24 * 60;

/**
 * Preserves the current 60 simulation decisions/year cadence while decoupling
 * it from worker frequency.
 *
 * 525600 / 60 = 8760 Ainkrad minutes per canonical simulation quantum.
 */
export const CANONICAL_SIMULATION_QUANTUM_WORLD_MINUTES =
  WORLD_MINUTES_PER_YEAR / 60;

export const LEGACY_BIRTH_CHECK_QUANTA = 12;
export const BIRTH_CHECK_INTERVAL_WORLD_MINUTES =
  LEGACY_BIRTH_CHECK_QUANTA * CANONICAL_SIMULATION_QUANTUM_WORLD_MINUTES;

export const LEGACY_SETTLEMENT_CHECK_QUANTA = 24;
export const SETTLEMENT_CHECK_INTERVAL_WORLD_MINUTES =
  LEGACY_SETTLEMENT_CHECK_QUANTA * CANONICAL_SIMULATION_QUANTUM_WORLD_MINUTES;

export interface CanonicalSimulationCursor {
  /**
   * Total Ainkrad time already consumed by full simulation quanta.
   */
  processedWorldMinutes: number;

  /**
   * World minutes displayed/accumulated but not yet large enough to execute
   * another full simulation quantum.
   */
  remainderWorldMinutes: number;

  /**
   * Stable physics/action sequence number. This replaces worker tick modulo
   * for scheduled world mechanics.
   */
  quantumIndex: number;
}

export interface CanonicalQuantum {
  quantumIndex: number;
  startWorldMinutes: number;
  endWorldMinutes: number;
  elapsedWorldMinutes: number;
}

export interface CanonicalAdvanceResult {
  cursor: CanonicalSimulationCursor;
  quanta: CanonicalQuantum[];
}

export function emptyCanonicalSimulationCursor(): CanonicalSimulationCursor {
  return {
    processedWorldMinutes: 0,
    remainderWorldMinutes: 0,
    quantumIndex: 0,
  };
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be finite and non-negative.`);
  }
}

/**
 * Converts arbitrary external time chunks into stable internal simulation
 * quanta. The result depends only on total elapsed Ainkrad time, not on how
 * worker calls partitioned that time.
 *
 * IMPORTANT: world dynamics/RNG should execute only for emitted full quanta.
 * UI/calendar may display the remainder continuously.
 */
export function advanceCanonicalSimulation(
  prior: CanonicalSimulationCursor,
  addedWorldMinutes: number,
): CanonicalAdvanceResult {
  assertNonNegativeFinite(prior.processedWorldMinutes, 'processedWorldMinutes');
  assertNonNegativeFinite(prior.remainderWorldMinutes, 'remainderWorldMinutes');
  assertNonNegativeFinite(addedWorldMinutes, 'addedWorldMinutes');
  if (!Number.isInteger(prior.quantumIndex) || prior.quantumIndex < 0) {
    throw new Error('quantumIndex must be a non-negative integer.');
  }
  if (
    prior.remainderWorldMinutes >=
    CANONICAL_SIMULATION_QUANTUM_WORLD_MINUTES
  ) {
    throw new Error('remainderWorldMinutes must be smaller than one quantum.');
  }

  let available = prior.remainderWorldMinutes + addedWorldMinutes;
  let processed = prior.processedWorldMinutes;
  let index = prior.quantumIndex;
  const quanta: CanonicalQuantum[] = [];

  while (available + 1e-9 >= CANONICAL_SIMULATION_QUANTUM_WORLD_MINUTES) {
    const start = processed;
    const end = start + CANONICAL_SIMULATION_QUANTUM_WORLD_MINUTES;
    index += 1;
    quanta.push({
      quantumIndex: index,
      startWorldMinutes: start,
      endWorldMinutes: end,
      elapsedWorldMinutes: CANONICAL_SIMULATION_QUANTUM_WORLD_MINUTES,
    });
    processed = end;
    available -= CANONICAL_SIMULATION_QUANTUM_WORLD_MINUTES;
  }

  // Avoid negative floating residue.
  const remainder = Math.max(0, available);

  return {
    cursor: {
      processedWorldMinutes: processed,
      remainderWorldMinutes: remainder,
      quantumIndex: index,
    },
    quanta,
  };
}

export function isBirthCheckQuantum(quantumIndex: number): boolean {
  return (
    Number.isInteger(quantumIndex) &&
    quantumIndex > 0 &&
    quantumIndex % LEGACY_BIRTH_CHECK_QUANTA === 0
  );
}

export function isSettlementCheckQuantum(quantumIndex: number): boolean {
  return (
    Number.isInteger(quantumIndex) &&
    quantumIndex > 0 &&
    quantumIndex % LEGACY_SETTLEMENT_CHECK_QUANTA === 0
  );
}

/**
 * v15 integration rule:
 *
 * Each emitted quantum should execute exactly one deterministic world-dynamics
 * pass: passive needs, movement, action choice, resource renewal, wildlife,
 * aging/mortality, births (when scheduled), settlements, resettlement,
 * sapient/ecology/cosmology progression.
 *
 * External worker ticks must NOT directly execute another world-dynamics pass.
 */
