import {
  DEFAULT_WORLD_SPEED_ID,
  DEFAULT_WORLD_SPEED_MULTIPLIER,
  isWorldSpeedId,
  isWorldSpeedMultiplier,
  worldMinutesPerTick,
  type WorldSpeedId,
  type WorldSpeedMultiplier,
} from '../world/WorldClock';

export interface WorldClockControl {
  speedId: WorldSpeedId;
  multiplier: WorldSpeedMultiplier;
  worldMinutesPerTick: number;
}

/**
 * An external FLA-like clock boundary. It intentionally has no Cardinal
 * dependency: neither observations nor intervention proposals can reach it.
 */
export class IndependentWorldClockGateway {
  private control: WorldClockControl;

  constructor(
    speedId: WorldSpeedId = DEFAULT_WORLD_SPEED_ID,
    multiplier: WorldSpeedMultiplier = DEFAULT_WORLD_SPEED_MULTIPLIER,
  ) {
    this.control = this.validate(speedId, multiplier);
  }

  current(): WorldClockControl {
    return { ...this.control };
  }

  set(speedId: unknown, multiplier: unknown): WorldClockControl {
    this.control = this.validate(speedId, multiplier);
    return this.current();
  }

  private validate(speedId: unknown, multiplier: unknown): WorldClockControl {
    if (!isWorldSpeedId(speedId)) {
      throw new Error('Unknown external world-speed preset.');
    }
    if (!isWorldSpeedMultiplier(multiplier)) {
      throw new Error('World-speed multiplier must be 1 or 10.');
    }
    return {
      speedId,
      multiplier,
      worldMinutesPerTick: worldMinutesPerTick(speedId, multiplier),
    };
  }
}
