import type { WorldState } from '../world/types';
import type { WorldClockControl } from '../boundary/WorldClockGateway';
import { bindWorldTerrain } from '../world/geography/WorldTerrain';
import { TERRAIN_BOUNDS } from '../world/geography/TerrainTypes';
import { worldWeatherAtPointV21 } from '../v21/WeatherV21';
import type { WorldWeatherV21 } from '../v21/WeatherModelV21';

export const WEATHER_MAP_COLUMNS = 48, WEATHER_MAP_ROWS = 40;
export function weatherMapAllowed(clock: Readonly<WorldClockControl>, busy = false): boolean {
  return clock.speedId === 'real_time' && clock.multiplier === 1 && !busy;
}
export interface WeatherMapSnapshot {
  minute: number; columns: number; rows: number; bounds: typeof TERRAIN_BOUNDS;
  cells: { column: number; row: number; weather: Readonly<WorldWeatherV21> }[];
  outline: { x: number; y: number }[];
  places: { name: string; x: number; y: number; weather: Readonly<WorldWeatherV21> }[];
}
/** Invoked only on explicit open; never subscribed to the simulation clock. */
export function createWeatherMapSnapshot(world: Readonly<WorldState>): WeatherMapSnapshot {
  const terrain = bindWorldTerrain(world), bounds = TERRAIN_BOUNDS;
  const cells: WeatherMapSnapshot['cells'] = [];
  for (let row = 0; row < WEATHER_MAP_ROWS; row++) for (let column = 0; column < WEATHER_MAP_COLUMNS; column++) {
    const x = bounds.minX + (column + 0.5) / WEATHER_MAP_COLUMNS * (bounds.maxX - bounds.minX);
    const y = bounds.minY + (row + 0.5) / WEATHER_MAP_ROWS * (bounds.maxY - bounds.minY);
    if (terrain && !terrain.isLand({ x, y })) continue;
    cells.push({ column, row, weather: worldWeatherAtPointV21(world, x, y) });
  }
  const places = Object.values(world.places).filter(p => ['commons', 'village', 'city'].includes(p.kind)).slice(0, 12)
    .map(p => ({ name: p.name, x: p.mapX, y: p.mapY, weather: worldWeatherAtPointV21(world, p.mapX, p.mapY) }));
  return { minute: world.calendar.elapsedWorldMinutes, columns: WEATHER_MAP_COLUMNS, rows: WEATHER_MAP_ROWS,
    bounds, cells, outline: terrain?.outline.map(p => ({ ...p })) ?? [], places };
}

/** At most one disposable snapshot. Repeated frames do zero sampling work. */
export class WeatherMapSession {
  snapshot?: WeatherMapSnapshot;
  constructor(private readonly sample = createWeatherMapSnapshot) {}
  open(world: Readonly<WorldState>, clock: Readonly<WorldClockControl>, busy = false): WeatherMapSnapshot | undefined {
    if (!weatherMapAllowed(clock, busy)) { this.close(); return; }
    return this.snapshot ??= this.sample(world);
  }
  synchronize(clock: Readonly<WorldClockControl>, busy = false): void {
    if (!weatherMapAllowed(clock, busy)) this.close();
  }
  close(): void { this.snapshot = undefined; }
}
