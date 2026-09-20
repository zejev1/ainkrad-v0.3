export interface WeatherModelInput { id: string; epoch: number; volatility: number; }
import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';

export type WorldWeatherKindV21 =
  | 'clear'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'storm'
  | 'snow';

export interface WorldWeatherV21 {
  kind: WorldWeatherKindV21;
  label: string;
  temperatureC: number;
  precipitation: number;
  wind: number;
  severity: number;
  comfort: number;
  comfortLabel: 'комфортно' | 'прохладно' | 'холодно' | 'жарко' | 'некомфортно';
  outdoorDecisionPenalty: number;
  walkingScale: number;
  safetyModifier: number;
  habitatModifier: number;
}

const DAY = 1_440;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function unit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

type WeatherRolls = { wet: number; windRoll: number; temperatureRoll: number };
function rollsFor(world: Readonly<WeatherModelInput>, period: number): WeatherRolls {
  const prefix = `${world.id}:${world.epoch ?? 1}:weather:${period}`;
  return { wet: unit(`${prefix}:wet`), windRoll: unit(`${prefix}:wind`), temperatureRoll: unit(`${prefix}:temp`) };
}

/** The three random rolls only depend on world, epoch and a two-day period.
 * Season/temperature still use the exact requested minute, never rounded time. */
export function createCachedWeatherModelV21() {
  let id: string | undefined, epoch: number | undefined, period: number | undefined;
  let rolls: WeatherRolls | undefined;
  return (world: Readonly<WeatherModelInput>, minute: number): WorldWeatherV21 => {
    const nextPeriod = Math.floor(Math.max(0, Math.floor(minute / DAY)) / 2);
    if (!rolls || id !== world.id || epoch !== world.epoch || period !== nextPeriod) {
      id = world.id; epoch = world.epoch; period = nextPeriod;
      rolls = rollsFor(world, period);
    }
    return weatherFromRolls(world, minute, rolls);
  };
}

/** Deterministic physical weather: replayable, but changing every few days. */
export function calculateWeatherV21(
  world: Readonly<WeatherModelInput>,
  atWorldMinute: number,
): WorldWeatherV21 {
  const day = Math.max(0, Math.floor(atWorldMinute / DAY));
  const period = Math.floor(day / 2);
  return weatherFromRolls(world, atWorldMinute, rollsFor(world, period));
}

function weatherFromRolls(world: Readonly<WeatherModelInput>, atWorldMinute: number,
  { wet, windRoll, temperatureRoll }: WeatherRolls): WorldWeatherV21 {
  const volatility = clamp01(
    world.volatility,
  );
  const yearPhase =
    (atWorldMinute % WORLD_MINUTES_PER_YEAR) / WORLD_MINUTES_PER_YEAR;
  const seasonal = Math.sin((yearPhase - 0.25) * Math.PI * 2);
  const temperatureC = Math.round(
    12 + seasonal * 13 + (temperatureRoll - 0.5) * (7 + volatility * 8),
  );
  const precipitation = clamp01(wet * (0.9 + volatility * 0.35));
  const wind = clamp01(windRoll * (0.78 + volatility * 0.5));

  let kind: WorldWeatherKindV21;
  if (precipitation > 0.79 - volatility * 0.12 && wind > 0.62) {
    kind = temperatureC <= 1 ? 'snow' : 'storm';
  } else if (precipitation > 0.62 - volatility * 0.08) {
    kind = temperatureC <= 0 ? 'snow' : 'rain';
  } else if (precipitation > 0.43) {
    kind = 'cloudy';
  } else if (wind < 0.18 && temperatureC < 12 && precipitation > 0.25) {
    kind = 'fog';
  } else {
    kind = 'clear';
  }

  const baseSeverity =
    kind === 'storm' ? 0.74 :
      kind === 'snow' ? 0.62 :
        kind === 'rain' ? 0.38 :
          kind === 'fog' ? 0.27 :
            kind === 'cloudy' ? 0.12 : 0.02;
  const cold = clamp01((4 - temperatureC) / 18);
  const severity = clamp01(baseSeverity + wind * 0.16 + cold * 0.18);
  const thermalDiscomfort = clamp01(
    temperatureC < 16
      ? (16 - temperatureC) / 28
      : (temperatureC - 24) / 22,
  );
  const wetDiscomfort =
    (kind === 'rain' || kind === 'snow' || kind === 'storm')
      ? precipitation * 0.34 + wind * 0.18
      : 0;
  const comfort = clamp01(1 - thermalDiscomfort - wetDiscomfort);
  const comfortLabel = temperatureC >= 30
    ? 'жарко' as const
    : temperatureC <= 2
      ? 'холодно' as const
      : temperatureC < 13
        ? 'прохладно' as const
        : comfort < 0.55
          ? 'некомфортно' as const
          : 'комфортно' as const;
  const labels: Record<WorldWeatherKindV21, string> = {
    clear: 'Ясно', cloudy: 'Облачно', fog: 'Туман', rain: 'Дождь',
    storm: 'Гроза', snow: 'Снег',
  };
  return {
    kind,
    label: labels[kind],
    temperatureC,
    precipitation,
    wind,
    severity,
    comfort,
    comfortLabel,
    outdoorDecisionPenalty: severity * 0.72,
    walkingScale: Math.max(0.48, 1 - severity * 0.46),
    safetyModifier: -severity * 0.24,
    habitatModifier: kind === 'rain' || kind === 'snow'
      ? 0.025 * precipitation
      : kind === 'storm'
        ? -0.03 * severity
        : 0,
  };
}
