import type {
  SensorSnapshot,
} from '../sensors/types';

import {
  WorldSensors,
} from '../sensors/WorldSensors';

import type {
  WorldState,
} from '../world/types';
import { cloneWorldState } from '../world/cloneWorldState';

export class CardinalObserver {
  constructor(
    private readonly sensors:
      WorldSensors,
  ) {}

  async observe(
    world:
      Readonly<WorldState>,
    now: number,
  ): Promise<SensorSnapshot> {
    // The Observer receives a snapshot.
    // It has no reference to WorldEngine
    // and therefore cannot mutate the world.
    return await this.sensors
      .observe(
        cloneWorldState(
          world,
        ),
        now,
      );
  }
}
