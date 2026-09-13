import type {
  AgentRace,
  CenturyHumpbackState,
  WorldState,
} from './types';
import { WORLD_MINUTES_PER_YEAR } from './WorldClock';

export const CENTURY_HUMPBACK_SPECIES = 'century_humpback' as const;
export const CENTURY_HUMPBACK_STRENGTH_THRESHOLD = 0.85;
export const CENTURY_HUMPBACK_INTERVAL = WORLD_MINUTES_PER_YEAR * 100;
export const CENTURY_HUMPBACK_LARVA_KILLED_INTERVAL =
  WORLD_MINUTES_PER_YEAR * 200;
export const CENTURY_HUMPBACK_INCUBATION = 60 * 24 * 5;
// A crawling phase lasts long enough to cross more than one canonical
// simulation quantum, so residents have a real opportunity to notice it.
export const CENTURY_HUMPBACK_CRAWL = 60 * 24 * 14;

export const CENTURY_HUMPBACK_KNOWLEDGE: Readonly<
  Record<AgentRace, readonly string[]>
> = {
  human: [
    'Столетний горбатник откладывает яйцо внутрь живого хозяина.',
    'Поникшая голова после нескольких дней — признак выхода личинки: хозяина изолируют и не касаются шеи без защиты.',
    'Взрослую особь способен убить только добровольный боец с физической силой не ниже 85%.',
    'Вышедшую личинку можно уничтожить по дороге к пещерному логову; тогда новый цикл не начнётся 200 лет.',
  ],
  elf: [
    'Столетний горбатник откладывает яйцо внутрь живого хозяина.',
    'Поникшая голова после нескольких дней — признак выхода личинки: хозяина изолируют и не касаются шеи без защиты.',
    'Взрослую особь способен убить только добровольный боец с физической силой не ниже 85%.',
    'Вышедшую личинку можно уничтожить по дороге к пещерному логову; тогда новый цикл не начнётся 200 лет.',
  ],
  dwarf: ['Раз в столетие в пещерах или пустошах появляется огромный внутренний паразит; заражённый некоторое время выглядит обычным, но погибает.'],
  goblin: ['Раз в столетие в пещерах или пустошах появляется огромный внутренний паразит; заражённый некоторое время выглядит обычным, но погибает.'],
  orc: ['Раз в столетие в пещерах или пустошах появляется огромный внутренний паразит; заражённый некоторое время выглядит обычным, но погибает.'],
  ogre: ['Раз в столетие в пещерах или пустошах появляется огромный внутренний паразит; заражённый некоторое время выглядит обычным, но погибает.'],
};

export function createCenturyHumpbackState(): CenturyHumpbackState {
  return {
    version: 1,
    phase: 'dormant',
    cycle: 0,
    nextEmergenceWorldMinute: CENTURY_HUMPBACK_INTERVAL,
    knowledgeByRace: {
      human: 'countermeasures',
      elf: 'countermeasures',
      dwarf: 'warning',
      goblin: 'warning',
      orc: 'warning',
      ogre: 'warning',
    },
  };
}

/** Additive migration: old worlds retain their clock and get the missed first
 * century occurrence on the next semantic quantum. */
export function ensureCenturyHumpbackState(
  world: WorldState,
): CenturyHumpbackState {
  world.centuryHumpback ??= createCenturyHumpbackState();
  return world.centuryHumpback;
}

export function centuryHumpbackKnowledgeForRace(
  race: AgentRace,
): readonly string[] {
  return CENTURY_HUMPBACK_KNOWLEDGE[race];
}

export function canDefeatAdultCenturyHumpback(strength: number): boolean {
  return Number.isFinite(strength) &&
    strength >= CENTURY_HUMPBACK_STRENGTH_THRESHOLD;
}
