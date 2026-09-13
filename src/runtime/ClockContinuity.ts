import { makeOfflineWorldClockAnchor, offlineWorldMinuteTarget, type OfflineWorldClockAnchor } from './OfflineWorldClock';
import { normalizeWorldSpeedControl, worldMinutesPerTick, type WorldSpeedId, type WorldSpeedMultiplier } from '../world/WorldClock';

export interface ClockPosition { worldEpoch: number; currentWorldMinutes: number; }

/** Observer-side metadata only. Never holds or mutates a resident or world. */
export class ClockContinuity {
  revision: number;
  targetWorldMinutes?: number;
  backgroundMode: 'real_time' | 'selected';
  private position?: ClockPosition;
  private livePending = 0;
  private cancellationPending: boolean;
  private speed?: { speedId: WorldSpeedId; multiplier: WorldSpeedMultiplier };

  constructor(private readonly initialAnchor?: Readonly<OfflineWorldClockAnchor>) {
    const anchor = initialAnchor;
    this.revision = anchor?.clockRevision ?? 0;
    this.cancellationPending = anchor?.cancelPending ?? false;
    this.backgroundMode = anchor?.backgroundMode ?? 'real_time';
  }

  get cancelling(): boolean { return this.cancellationPending; }

  observeSpeed(speedId: WorldSpeedId, multiplier: WorldSpeedMultiplier): void {
    this.speed = normalizeWorldSpeedControl(speedId, multiplier);
  }

  observe(position: ClockPosition, pending = 0): void {
    if (this.position && this.position.worldEpoch !== position.worldEpoch) {
      this.targetWorldMinutes = undefined;
      this.livePending = 0;
    }
    if (!this.position || this.position.worldEpoch !== position.worldEpoch ||
        position.currentWorldMinutes >= this.position.currentWorldMinutes) {
      this.position = { ...position };
      this.livePending = this.cancellationPending ? 0 : pending;
    }
  }

  restore(anchor: Readonly<OfflineWorldClockAnchor> | undefined, now: number): number | undefined {
    if (!anchor || !this.position || this.cancellationPending || (anchor.clockRevision ?? 0) < this.revision) return;
    const target = offlineWorldMinuteTarget({ anchor, currentWorldEpoch: this.position.worldEpoch,
      currentWorldMinutes: this.position.currentWorldMinutes, nowWallClockMs: now });
    if (target !== undefined && target > this.position.currentWorldMinutes + 1e-7) {
      this.targetWorldMinutes = Math.max(this.targetWorldMinutes ?? 0, target);
      return this.targetWorldMinutes;
    }
  }

  command(speedId: WorldSpeedId, multiplier: WorldSpeedMultiplier, now: number, initial = false) {
    const normalized = normalizeWorldSpeedControl(speedId, multiplier);
    const lower = this.speed && worldMinutesPerTick(normalized.speedId, normalized.multiplier) <
      worldMinutesPerTick(this.speed.speedId, this.speed.multiplier);
    const discardPending = this.cancellationPending || (!initial && (Boolean(lower) || speedId === 'real_time'));
    if (!initial || this.cancellationPending) this.revision = Math.max(Math.ceil(now), this.revision + 1);
    this.speed = normalized;
    if (discardPending) {
      this.targetWorldMinutes = undefined;
      this.livePending = 0;
      this.cancellationPending = true;
    }
    return { type: 'set_speed' as const, ...normalized, clockRevision: this.revision, discardPending };
  }

  acknowledge(revision: number, position: ClockPosition, discarded: boolean): boolean {
    if (revision < this.revision) return false;
    this.revision = revision;
    if (discarded) { this.targetWorldMinutes = undefined; this.livePending = 0; }
    this.cancellationPending = false;
    this.observe(position);
    return true;
  }

  accepts(revision: number): boolean { return revision >= this.revision && !this.cancellationPending; }

  anchor(now: number, speedId: WorldSpeedId, multiplier: WorldSpeedMultiplier): OfflineWorldClockAnchor | undefined {
    const normalized = normalizeWorldSpeedControl(speedId, multiplier);
    if (!this.position) {
      if (!this.cancellationPending) return;
      return makeOfflineWorldClockAnchor({ worldEpoch: this.initialAnchor?.worldEpoch ?? 1,
        worldMinutes: 0, wallClockMs: now, ...normalized, clockRevision: this.revision,
        cancelPending: true, backgroundMode: this.backgroundMode });
    }
    const target = this.cancellationPending ? undefined : Math.max(
      this.position.currentWorldMinutes + this.livePending, this.targetWorldMinutes ?? 0);
    return makeOfflineWorldClockAnchor({ worldEpoch: this.position.worldEpoch,
      worldMinutes: this.position.currentWorldMinutes, wallClockMs: now, ...normalized,
      clockRevision: this.revision, backgroundMode: this.backgroundMode,
      cancelPending: this.cancellationPending,
      catchingUp: !this.cancellationPending && this.targetWorldMinutes !== undefined,
      ...(target !== undefined && target > this.position.currentWorldMinutes ? { targetWorldMinutes: target } : {}) });
  }
}
