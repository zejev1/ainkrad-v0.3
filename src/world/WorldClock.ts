export const LIVE_TICK_DELAY_MS = 1_000;
export const LIVE_TICKS_PER_REAL_MINUTE = 60;
// Compatibility name for the default 1 real minute = 1 world year mode.
export const WORLD_TICKS_PER_YEAR = LIVE_TICKS_PER_REAL_MINUTE;
export const WORLD_MINUTES_PER_HOUR = 60;
export const WORLD_HOURS_PER_DAY = 24;
export const WORLD_DAYS_PER_YEAR = 365;
export const WORLD_MINUTES_PER_DAY =
  WORLD_MINUTES_PER_HOUR * WORLD_HOURS_PER_DAY;
export const WORLD_MINUTES_PER_YEAR =
  WORLD_MINUTES_PER_DAY * WORLD_DAYS_PER_YEAR;

export type WorldSpeedId =
  | 'real_time'
  | 'hour_per_minute'
  | 'day_per_minute'
  | 'month_per_minute'
  | 'year_per_minute';

export type WorldSpeedMultiplier = 1 | 10 | 100;

export interface WorldSpeedPreset {
  id: WorldSpeedId;
  worldMinutesPerRealMinute: number;
  shortLabel: string;
  description: string;
}

export const WORLD_SPEED_PRESETS: readonly WorldSpeedPreset[] = [
  {
    id: 'real_time',
    worldMinutesPerRealMinute: 1,
    shortLabel: '1м = 1м',
    description: 'Обычное человеческое время',
  },
  {
    id: 'hour_per_minute',
    worldMinutesPerRealMinute: WORLD_MINUTES_PER_HOUR,
    shortLabel: '1м = 1ч',
    description: 'Одна минута снаружи равна часу мира',
  },
  {
    id: 'day_per_minute',
    worldMinutesPerRealMinute: WORLD_MINUTES_PER_DAY,
    shortLabel: '1м = 1д',
    description: 'Одна минута снаружи равна дню мира',
  },
  {
    id: 'month_per_minute',
    worldMinutesPerRealMinute: WORLD_MINUTES_PER_DAY * 30,
    shortLabel: '1м = 1мес',
    description: 'Одна минута снаружи равна тридцати дням мира',
  },
  {
    id: 'year_per_minute',
    worldMinutesPerRealMinute: WORLD_MINUTES_PER_YEAR,
    shortLabel: '1м = 1г',
    description: 'Одна минута снаружи равна году мира',
  },
] as const;

export const DEFAULT_WORLD_SPEED_ID: WorldSpeedId = 'year_per_minute';
export const DEFAULT_WORLD_SPEED_MULTIPLIER: WorldSpeedMultiplier = 1;

export type WorldDayPhase = 'dawn' | 'day' | 'evening' | 'night';
export type WorldSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export interface WorldCalendarDate {
  year: number;
  dayOfYear: number;
  hour: number;
  minute: number;
  totalDays: number;
  phase: WorldDayPhase;
  season: WorldSeason;
}

const SEASONS: readonly WorldSeason[] = [
  'spring',
  'summer',
  'autumn',
  'winter',
];

export function isWorldSpeedId(value: unknown): value is WorldSpeedId {
  return WORLD_SPEED_PRESETS.some((preset) => preset.id === value);
}

export function isWorldSpeedMultiplier(
  value: unknown,
): value is WorldSpeedMultiplier {
  return value === 1 || value === 10 || value === 100;
}

export function worldSpeedPreset(id: WorldSpeedId): WorldSpeedPreset {
  return (
    WORLD_SPEED_PRESETS.find((preset) => preset.id === id) ??
    WORLD_SPEED_PRESETS.at(-1)!
  );
}

export function worldMinutesPerTick(
  speedId: WorldSpeedId,
  multiplier: WorldSpeedMultiplier,
): number {
  return (
    (worldSpeedPreset(speedId).worldMinutesPerRealMinute * multiplier) /
    LIVE_TICKS_PER_REAL_MINUTE
  );
}

export const DEFAULT_WORLD_MINUTES_PER_TICK = worldMinutesPerTick(
  DEFAULT_WORLD_SPEED_ID,
  DEFAULT_WORLD_SPEED_MULTIPLIER,
);

/** The calendar and biological age consume the same persisted elapsed time. */
export function worldCalendarAtMinutes(
  elapsedWorldMinutes: number,
): WorldCalendarDate {
  const safeMinutes = Math.max(0, elapsedWorldMinutes);
  const elapsedDays = safeMinutes / WORLD_MINUTES_PER_DAY;
  const wholeDay = Math.floor(elapsedDays);
  const minuteOfDay = Math.floor(safeMinutes % WORLD_MINUTES_PER_DAY);
  const dayOfYear = (wholeDay % WORLD_DAYS_PER_YEAR) + 1;
  const hour = Math.floor(minuteOfDay / WORLD_MINUTES_PER_HOUR);
  const minute = minuteOfDay % WORLD_MINUTES_PER_HOUR;
  const phase: WorldDayPhase =
    hour < 6
      ? 'night'
      : hour < 10
        ? 'dawn'
        : hour < 18
          ? 'day'
          : hour < 22
            ? 'evening'
            : 'night';
  const seasonIndex = Math.min(
    SEASONS.length - 1,
    Math.floor(((dayOfYear - 1) / WORLD_DAYS_PER_YEAR) * SEASONS.length),
  );

  return {
    year: Math.floor(wholeDay / WORLD_DAYS_PER_YEAR) + 1,
    dayOfYear,
    hour,
    minute,
    totalDays: wholeDay,
    phase,
    season: SEASONS[seasonIndex],
  };
}

export function ageParts(ageYears: number): {
  years: number;
  months: number;
} {
  const safeAge = Math.max(0, ageYears);
  const years = Math.floor(safeAge);
  const months = Math.min(11, Math.floor((safeAge - years) * 12));
  return { years, months };
}
