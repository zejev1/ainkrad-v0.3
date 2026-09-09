/** Sample before awaiting simulation: computation time belongs to the next sample. */
export class LiveWallClock {
  constructor(private sampledAt: number) {}

  sample(now: number): number {
    const elapsed = Math.max(0, now - this.sampledAt);
    this.sampledAt = Math.max(now, this.sampledAt);
    return elapsed;
  }

  /** A paused audience or completed offline catch-up starts a new live interval. */
  reset(now: number): void {
    this.sampledAt = now;
  }
}

export function liveLoopDelay(workMilliseconds: number, pendingWorldMinutes: number): number {
  return pendingWorldMinutes > 1e-7 ? 0 : Math.max(0, 1000 - workMilliseconds);
}
