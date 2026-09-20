import type { WorldState } from '../world/types';
import { weatherRuntimeFor } from '../world/systems/WeatherSystemAgent';
export type { WorldWeatherKindV21, WorldWeatherV21 } from './WeatherModelV21';

/** All existing consumers use the same autonomous world-owned weather agent. */
export function worldWeatherV21(world: Readonly<WorldState>, atWorldMinute = world.calendar.elapsedWorldMinutes) {
  return weatherRuntimeFor(world).weather.sample({
    id: world.id, epoch: world.epoch ?? 1,
    volatility: world.governance.laws.weather_volatility?.value ?? 0.2,
  }, atWorldMinute);
}
