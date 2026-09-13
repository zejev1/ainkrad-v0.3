import { CANONICAL_WORLD_QUANTUM_MINUTES } from '../v15/WorldTimeContract';

// Live acceleration is a requested rate, not a promise to calculate decades
// later. This is outside canonical world state and never consumes world RNG.
export const MAX_LIVE_PENDING_MINUTES = 8 * CANONICAL_WORLD_QUANTUM_MINUTES;

// Offline restoration starts conservatively, then grows only after a durable
// commit succeeds. One hundred and twenty quanta are two world-years: large
// enough to amortize full-world cloning, while the worker can still stop after
// any individual six-day quantum and fall back after an IndexedDB abort.
export const INITIAL_RAPID_CATCH_UP_BATCH_QUANTA = 24;
export const MAX_RAPID_CATCH_UP_BATCH_QUANTA = 120;

export class LiveAccelerationBudget {
  private queued = 0;
  private coveredThrough = 0;
  private generation = 0;
  limited = false;

  constructor(private readonly maximum = MAX_LIVE_PENDING_MINUTES) {}

  get pending(): number { return this.queued; }
  get token(): number { return this.generation; }

  enqueue(minutes: number): void {
    if (!Number.isFinite(minutes) || minutes < 0) throw new Error('Invalid live-clock minutes.');
    this.limited = this.queued + minutes > this.maximum;
    this.queued = Math.min(this.maximum, this.queued + minutes);
  }

  cover(target: number, current: number): void {
    const covered = Math.max(0, target - Math.max(current, this.coveredThrough));
    this.queued = Math.max(0, this.queued - covered);
    this.coveredThrough = Math.max(this.coveredThrough, target);
  }

  consume(from: number, through: number, token: number): void {
    if (token !== this.generation) return;
    const consumed = Math.max(0, through - Math.max(from, this.coveredThrough));
    this.queued = Math.max(0, this.queued - consumed);
  }

  cancel(current: number): void {
    this.queued = 0;
    this.coveredThrough = current;
    this.limited = false;
    this.generation += 1;
  }
}

/** Grow successful restoration transactions instead of mistaking slow device
 * I/O for a reason to serialize the same mature world even more often. A real
 * storage failure is handled separately by halving the batch. No semantic
 * quantum is skipped and Cardinal boundaries may still end a batch early. */
export function nextCatchUpBatchSize(
  currentBatchQuanta: number,
  processedQuanta: number,
  workMs: number,
  ceiling = MAX_RAPID_CATCH_UP_BATCH_QUANTA,
): number {
  if (!Number.isFinite(workMs) || workMs < 0 || !Number.isInteger(ceiling) || ceiling < 1) {
    throw new Error('Invalid rapid catch-up budget.');
  }
  const current = Math.max(1, Math.min(ceiling, Math.floor(currentBatchQuanta)));
  if (processedQuanta <= 0) return current;
  if (current < 60) return Math.min(ceiling, 60);
  // On fast devices, two-year commits remove almost all snapshot overhead.
  // On a slow console, keep one-year commits so progress remains observable.
  return workMs <= 4_000 ? Math.min(ceiling, Math.max(current, current * 2)) : current;
}
