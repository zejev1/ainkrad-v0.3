import {
  DEFAULT_WORLD_SPEED_ID,
  DEFAULT_WORLD_SPEED_MULTIPLIER,
  isWorldSpeedId,
  isWorldSpeedMultiplier,
  normalizeWorldSpeedControl,
  worldMinutesPerTick,
  type WorldSpeedId,
  type WorldSpeedMultiplier,
} from '../world/WorldClock';

export interface WorldClockControl {
  paused?: boolean;
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
    const paused = this.control.paused;
    this.control = this.validate(speedId, multiplier);
    if (paused) this.setPaused(true);
    return this.current();
  }

  setPaused(paused: boolean): WorldClockControl {
    if (typeof paused !== 'boolean') throw new Error('Invalid external pause control.');
    this.control = this.validate(this.control.speedId, this.control.multiplier);
    if (paused) this.control = { ...this.control, paused: true, worldMinutesPerTick: 0 };
    return this.current();
  }

  private validate(speedId: unknown, multiplier: unknown): WorldClockControl {
    if (!isWorldSpeedId(speedId)) {
      throw new Error('Unknown external world-speed preset.');
    }
    if (!isWorldSpeedMultiplier(multiplier)) {
      throw new Error('World-speed multiplier must be 1, 10 or 100.');
    }
    const normalized = normalizeWorldSpeedControl(speedId, multiplier);
    return {
      ...normalized,
      worldMinutesPerTick: worldMinutesPerTick(
        normalized.speedId,
        normalized.multiplier,
      ),
    };
  }
}
