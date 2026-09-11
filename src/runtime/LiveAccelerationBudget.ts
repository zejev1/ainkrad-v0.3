import { CANONICAL_WORLD_QUANTUM_MINUTES } from '../v15/WorldTimeContract';

// Live acceleration is a requested rate, not a promise to calculate decades
// later. This is outside canonical world state and never consumes world RNG.
export const MAX_LIVE_PENDING_MINUTES = 8 * CANONICAL_WORLD_QUANTUM_MINUTES;

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

/** Avoid the old feedback trap: snapshot I/O made every slow batch shrink to
 * one quantum, which multiplied the same full-world serialization cost.
 * Four to eight ordered quanta amortize that cost; failure recovery may still
 * explicitly retry a single quantum. No quantum is skipped. */
export function nextCatchUpBatchSize(processedQuanta: number, workMs: number): number {
  return Math.max(4, Math.min(8, Math.ceil(Math.max(1, processedQuanta) * 250 / Math.max(1, workMs))));
}
