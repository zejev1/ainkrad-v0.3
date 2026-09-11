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
  // Leave the browser and CPU idle between committed chunks, including catch-up.
  return pendingWorldMinutes > 1e-7 ? Math.max(16, Math.min(1000, workMilliseconds * 0.6)) : Math.max(0, 1000 - workMilliseconds);
}
