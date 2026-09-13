import type { AgentRace, WorldState } from './types';

export interface RaceDemography {
  living: number;
  births: number;
  deaths: number;
  lastBirthAt?: number;
  lastBirthWorldMinute?: number;
}

const RACES: readonly AgentRace[] = [
  'human',
  'elf',
  'dwarf',
  'goblin',
  'orc',
  'ogre',
];

/** Demography is derived from persisted people, not the all-race legacy
 * counters. That prevents growth of another people from masking human loss. */
export function demographyByRace(
  world: Readonly<WorldState>,
): Record<AgentRace, RaceDemography> {
  const result = Object.fromEntries(
    RACES.map((race) => [race, { living: 0, births: 0, deaths: 0 }]),
  ) as Record<AgentRace, RaceDemography>;
  for (const agent of Object.values(world.agents)) {
    const race = agent.race ?? 'human';
    const row = result[race];
    if (agent.life.alive) row.living += 1;
    else row.deaths += 1;
    if (agent.life.generation > 0) {
      row.births += 1;
      row.lastBirthAt = Math.max(row.lastBirthAt ?? -Infinity, agent.life.bornAt);
    }
  }
  for (const race of RACES) {
    const minute = world.v16?.raceFamilyOpportunityByRace[race]?.lastBirthWorldMinute;
    if (minute !== undefined) result[race].lastBirthWorldMinute = minute;
  }
  return result;
}
