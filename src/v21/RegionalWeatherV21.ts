import { weatherFromConditions, type WeatherModelInput, type WorldWeatherV21 } from './WeatherModelV21';

/** Physical inputs only: no resident, discovery, camera or mutable world state. */
export interface WeatherSite {
  x: number; y: number; elevationM: number; moisture: number;
  maritime: number; upwindElevationM: number;
}
const unit = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => n * n * (3 - 2 * n);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15;
  return (h >>> 0) / 4294967295;
}

/** Calibrated continental model, not a real-Earth numerical forecast.
 * Smooth moving weather systems span hundreds of kilometres. Nearby places
 * share fronts; height, north/south position, maritime influence and rain
 * shadow produce local differences. Cache is bounded and never persisted. */
export function createRegionalWeatherProjector() {
  type Cell = number[][];
  const cells = new Map<string, Cell>();
  let worldId = '', epoch = 0, lastX = NaN, lastY = NaN, lastCell: Cell | undefined;
  let lastMinute = NaN, drift = 0, dailyAmplitude = 0;
  const field = (values: number[], u: number, v: number) => lerp(lerp(values[0], values[1], u), lerp(values[2], values[3], u), v);
  return (input: WeatherModelInput, minute: number, site: Readonly<WeatherSite>, base: Readonly<WorldWeatherV21>): Readonly<WorldWeatherV21> => {
    if (!Number.isFinite(site.x) || !Number.isFinite(site.y) || !Number.isFinite(site.elevationM)
      || !Number.isFinite(site.moisture) || !Number.isFinite(site.maritime) || !Number.isFinite(site.upwindElevationM)) throw new Error('Invalid local weather coordinates');
    if (worldId !== input.id || epoch !== input.epoch) { worldId = input.id; epoch = input.epoch; cells.clear(); lastCell = undefined; }
    if (minute !== lastMinute) { lastMinute = minute; drift = minute / 1440 * 0.12; dailyAmplitude = Math.sin((minute / 1440 - 0.3) * Math.PI * 2) * 2; }
    const x = site.x / 7000 - drift, y = site.y / 7000 + drift * 0.2;
    const ix = Math.floor(x), iy = Math.floor(y), u = smooth(x - ix), v = smooth(y - iy);
    if (!lastCell || ix !== lastX || iy !== lastY) {
      const key = `${ix}:${iy}`;
      lastCell = cells.get(key);
      if (!lastCell) {
        lastCell = ['wet', 'thermal', 'wind'].map(channel => [
          hash(`${worldId}:${epoch}:${channel}:${ix}:${iy}`), hash(`${worldId}:${epoch}:${channel}:${ix + 1}:${iy}`),
          hash(`${worldId}:${epoch}:${channel}:${ix}:${iy + 1}`), hash(`${worldId}:${epoch}:${channel}:${ix + 1}:${iy + 1}`),
        ]);
        if (cells.size >= 64) cells.delete(cells.keys().next().value!);
        cells.set(key, lastCell);
      }
      lastX = ix; lastY = iy;
    }
    const wet = field(lastCell[0], u, v), thermal = field(lastCell[1], u, v);
    const maritime = unit(site.maritime), height = Math.max(0, site.elevationM);
    const daily = dailyAmplitude * (1 - maritime * 0.65);
    const temperatureC = Math.round(Math.max(-75, Math.min(55,
      12 + (base.temperatureC - 12) * (1 - maritime * 0.3) + site.y / 56000 * 24
      - height * 0.0065 + (thermal - 0.5) * 10 + daily)));
    // Prevailing westerly flow: uphill enhancement / drying behind a range.
    const relief = Math.max(-0.24, Math.min(0.18, (height - site.upwindElevationM) / 6500));
    const precipitation = unit(base.precipitation * 0.35 + wet * 0.65 + (site.moisture - 0.5) * 0.24 + relief);
    const wind = unit(base.wind * 0.55 + field(lastCell[2], u, v) * 0.45 + height / 18000);
    return Object.freeze(weatherFromConditions(unit(input.volatility), temperatureC, precipitation, wind));
  };
}
