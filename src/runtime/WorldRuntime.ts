import type {
  InputBus,
} from './inputBus/InputBus';

import {
  WorldEngine,
} from '../world/WorldEngine';

export class WorldRuntime {
  constructor(
    private readonly bus:
      InputBus,
    private readonly world:
      WorldEngine,
  ) {}

  async tick(
    now: number,
  ): Promise<void> {
    const worldId =
      this.world
        .snapshot()
        .id;

    const inputs =
      await this.bus.take(
        worldId,
        100,
      );

    for (
      const input of
      inputs
    ) {
      await this.world
        .handleInput(input);

      await this.bus
        .acknowledge(
          input.eventId,
        );
    }

    await this.world
      .step(now);
  }
}
