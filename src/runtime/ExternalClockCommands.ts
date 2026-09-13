import { isWorldSpeedId, isWorldSpeedMultiplier, normalizeWorldSpeedControl, worldMinutesPerTick,
  type WorldSpeedId, type WorldSpeedMultiplier } from '../world/WorldClock';

export interface ExternalClockCommand {
  type: 'set_speed';
  speedId: WorldSpeedId;
  multiplier: WorldSpeedMultiplier;
  clockRevision: number;
  discardPending?: boolean;
}

/** Only the external worker console owns this mailbox. Commands are applied
 * between durable batches, so cancellation cannot interrupt an atomic save. */
export class ExternalClockCommands {
  private pending?: ExternalClockCommand;
  private latestRevision = -1;
  private appliedRate?: number;

  get revision(): number { return Math.max(0, this.latestRevision); }

  enqueue(command: ExternalClockCommand): boolean {
    if (!isWorldSpeedId(command.speedId) || !isWorldSpeedMultiplier(command.multiplier) ||
        !Number.isSafeInteger(command.clockRevision) || command.clockRevision < 0 ||
        (command.discardPending !== undefined && typeof command.discardPending !== 'boolean')) {
      throw new Error('Rejected malformed external clock control.');
    }
    if (command.clockRevision <= this.latestRevision) return false;
    const normalized = normalizeWorldSpeedControl(command.speedId, command.multiplier);
    const rate = worldMinutesPerTick(normalized.speedId, normalized.multiplier);
    const priorRate = this.pending
      ? worldMinutesPerTick(this.pending.speedId, this.pending.multiplier) : this.appliedRate;
    this.pending = { ...command, ...normalized, discardPending: Boolean(command.discardPending ||
      this.pending?.discardPending || (priorRate !== undefined && rate < priorRate)) };
    this.latestRevision = command.clockRevision;
    return true;
  }

  take(): ExternalClockCommand | undefined {
    const command = this.pending;
    this.pending = undefined;
    if (command) this.appliedRate = worldMinutesPerTick(command.speedId, command.multiplier);
    return command;
  }

  acceptsTarget(revision: number): boolean {
    return Number.isSafeInteger(revision) && revision === this.revision && !this.pending?.discardPending;
  }
}
