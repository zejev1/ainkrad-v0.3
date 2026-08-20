import type { InputBus } from './inputBus/InputBus';
import { WorldEngine } from '../world/WorldEngine';

export interface WorldRuntimeOptions {
  consumerId?: string;
  maxInputsPerTick?: number;
  claimLeaseMs?: number;
}

export class WorldRuntime {
  private readonly consumerId: string;
  private readonly maxInputsPerTick: number;
  private readonly claimLeaseMs: number;

  constructor(
    private readonly bus: InputBus,
    private readonly world: WorldEngine,
    options: WorldRuntimeOptions = {},
  ) {
    const worldId = world.snapshot().id;
    this.consumerId = options.consumerId ?? `world-runtime:${worldId}`;
    this.maxInputsPerTick = options.maxInputsPerTick ?? 100;
    this.claimLeaseMs = options.claimLeaseMs ?? 30_000;
  }

  async tick(now: number): Promise<void> {
    const worldId = this.world.snapshot().id;
    const transportNow = Date.now();
    const claimed = await this.bus.claim(
      worldId,
      this.consumerId,
      this.maxInputsPerTick,
      transportNow,
      this.claimLeaseMs,
    );

    for (let index = 0; index < claimed.length; index += 1) {
      const item = claimed[index];

      try {
        // World handling is idempotent by input eventId. A retry after a crash
        // between world commit and acknowledgement will not duplicate history.
        await this.world.handleInput(item.event);
        await this.bus.acknowledge(
          worldId,
          item.event.eventId,
          this.consumerId,
          item.claimToken,
          Date.now(),
        );
      } catch (error) {
        // Release the failed item and the rest of this batch. Otherwise a
        // single bad item would leave unrelated inputs locked until lease expiry.
        for (let releaseIndex = index; releaseIndex < claimed.length; releaseIndex += 1) {
          const pending = claimed[releaseIndex];
          await this.bus.release(
            worldId,
            pending.event.eventId,
            this.consumerId,
            pending.claimToken,
          );
        }
        throw error;
      }
    }

    await this.world.step(now);
  }
}
