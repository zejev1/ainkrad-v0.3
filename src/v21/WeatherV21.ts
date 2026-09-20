import type { WorldState } from '../world/types';
import { weatherRuntimeFor } from '../world/systems/WeatherSystemAgent';
import { bindWorldTerrain } from '../world/geography/WorldTerrain';
import type { TerrainModel } from '../world/geography/TerrainModel';
import type { WeatherSite } from './RegionalWeatherV21';
export type { WorldWeatherKindV21, WorldWeatherV21 } from './WeatherModelV21';

/** All existing consumers use the same autonomous world-owned weather agent. */
export function worldWeatherV21(world: Readonly<WorldState>, atWorldMinute = world.calendar.elapsedWorldMinutes) {
  return weatherRuntimeFor(world).weather.sample({
    id: world.id, epoch: world.epoch ?? 1,
    volatility: world.governance.laws.weather_volatility?.value ?? 0.2,
  }, atWorldMinute);
}

const sites = new WeakMap<TerrainModel, Map<string, Readonly<WeatherSite>>>();
export function weatherSiteAt(world: Readonly<WorldState>, x: number, y: number): Readonly<WeatherSite> {
  const terrain = bindWorldTerrain(world);
  if (!terrain) return { x, y, elevationM: 0, moisture: 0.5, maritime: 0, upwindElevationM: 0 };
  let cache = sites.get(terrain); if (!cache) { cache = new Map(); sites.set(terrain, cache); }
  const key = `${x}:${y}`, existing = cache.get(key); if (existing) return existing;
  const physical = terrain.sample(x, y, false);
  const maritime = physical.biome === 'ocean' ? 1 :
    [[-1000, 0], [1000, 0], [0, -1000], [0, 1000]].some(([dx, dy]) => !terrain.isLand({ x: x + dx, y: y + dy })) ? 0.7 : 0;
  const site = Object.freeze({ x, y, elevationM: Math.max(0, physical.height), moisture: physical.moisture,
    maritime, upwindElevationM: Math.max(0, terrain.elevation(x - 1200, y)) });
  if (cache.size >= 512) cache.delete(cache.keys().next().value!);
  cache.set(key, site); return site;
}

export function worldWeatherAtPointV21(world: Readonly<WorldState>, x: number, y: number,
  minute = world.calendar.elapsedWorldMinutes) {
  return weatherRuntimeFor(world).weather.sampleAt({ id: world.id, epoch: world.epoch ?? 1,
    volatility: world.governance.laws.weather_volatility?.value ?? 0.2 }, minute, weatherSiteAt(world, x, y));
}

export function worldWeatherAtPlaceV21(world: Readonly<WorldState>, placeId: string,
  minute = world.calendar.elapsedWorldMinutes) {
  const place = world.places[placeId];
  return place ? worldWeatherAtPointV21(world, place.mapX, place.mapY, minute) : worldWeatherV21(world, minute);
}
