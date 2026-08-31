export type GenesisDomain =
  | 'agriculture'
  | 'construction'
  | 'household'
  | 'survival';

export interface GenesisTeacher {
  id: string;
  epochId: string;
  domain: GenesisDomain;
  createdWorldMinutes: number;
  activeUntilWorldMinutes: number;
  ordinaryResident: false;
  countedInPopulation: false;
  teachingHistoryIds: string[];
}

export const WORLD_MINUTES_PER_YEAR = 365 * 24 * 60;
export const GENESIS_ACTIVE_YEARS = 3;
export const GENESIS_ACTIVE_WORLD_MINUTES =
  GENESIS_ACTIVE_YEARS * WORLD_MINUTES_PER_YEAR;

export const GENESIS_DOMAINS: readonly GenesisDomain[] = [
  'agriculture',
  'construction',
  'household',
  'survival',
];

function stableTeacherId(epochId: string, domain: GenesisDomain): string {
  return `genesis:${epochId}:${domain}`;
}

export function createGenesisTeachers(
  epochId: string,
  createdWorldMinutes = 0,
): GenesisTeacher[] {
  if (!epochId.trim()) throw new Error('epochId must not be empty.');
  if (!Number.isFinite(createdWorldMinutes) || createdWorldMinutes < 0) {
    throw new Error('createdWorldMinutes must be finite and non-negative.');
  }

  return GENESIS_DOMAINS.map((domain) => ({
    id: stableTeacherId(epochId, domain),
    epochId,
    domain,
    createdWorldMinutes,
    activeUntilWorldMinutes:
      createdWorldMinutes + GENESIS_ACTIVE_WORLD_MINUTES,
    ordinaryResident: false,
    countedInPopulation: false,
    teachingHistoryIds: [],
  }));
}

export function isGenesisTeacherActive(
  teacher: GenesisTeacher,
  currentWorldMinutes: number,
): boolean {
  if (!Number.isFinite(currentWorldMinutes) || currentWorldMinutes < 0) {
    throw new Error('currentWorldMinutes must be finite and non-negative.');
  }
  return (
    currentWorldMinutes >= teacher.createdWorldMinutes &&
    currentWorldMinutes < teacher.activeUntilWorldMinutes
  );
}

export interface GenesisPopulationView {
  ordinaryResidentIds: string[];
  genesisTeachers: GenesisTeacher[];
}

export function countOrdinaryPopulation(
  view: GenesisPopulationView,
): number {
  return view.ordinaryResidentIds.length;
}

/**
 * There is deliberately no "reviveGenesisTeacher" API.
 *
 * A new world creates a new epoch and therefore a fresh set of teacher IDs
 * and fresh teaching histories. Cardinal/Gateway may observe their state but
 * the normal intervention path cannot reactivate expired teachers.
 */
export function assertGenesisEpochIsolation(
  previous: readonly GenesisTeacher[],
  next: readonly GenesisTeacher[],
): void {
  const oldIds = new Set(previous.map((teacher) => teacher.id));
  const oldHistory = new Set(
    previous.flatMap((teacher) => teacher.teachingHistoryIds),
  );

  for (const teacher of next) {
    if (oldIds.has(teacher.id)) {
      throw new Error('Genesis identity leaked across New World epoch.');
    }
    if (teacher.teachingHistoryIds.some((id) => oldHistory.has(id))) {
      throw new Error('Genesis teaching history leaked across New World epoch.');
    }
  }
}
