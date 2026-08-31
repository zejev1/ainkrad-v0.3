/**
 * Ecology / monster balance audit for Ainkrad v15.
 *
 * This module audits the world; it does NOT hard-cap nature relative to humans.
 * Physical population limits remain each population's own carrying capacity.
 */

export type WildlifeSpeciesV15 =
  | 'rabbit'
  | 'deer'
  | 'fish'
  | 'boar'
  | 'wolf'
  | 'bird'
  | 'dire_wolf'
  | 'ogre'
  | 'wraith';

export const MONSTER_SPECIES_V15: ReadonlySet<WildlifeSpeciesV15> =
  new Set(['dire_wolf', 'ogre', 'wraith']);

export const RECOVERED_SPECIES_THREAT_V15: Readonly<
  Record<WildlifeSpeciesV15, number>
> = {
  rabbit: 0.04,
  deer: 0.08,
  fish: 0.02,
  boar: 0.28,
  wolf: 0.42,
  bird: 0.02,
  dire_wolf: 0.72,
  ogre: 0.86,
  wraith: 0.94,
};

export interface WildlifePopulationAuditV15 {
  id: string;
  species: WildlifeSpeciesV15;
  habitatId: string;
  count: number;
  carryingCapacity: number;
  reproductionRate: number;
  alertness: number;
  threat: number;
  isMonster: boolean;
}

export const FOUNDING_WILDLIFE_BASELINE_V15:
  readonly WildlifePopulationAuditV15[] = [
    {
      id: 'wildlife_rabbits',
      species: 'rabbit',
      habitatId: 'meadow',
      count: 4,
      carryingCapacity: 8,
      reproductionRate: 0.16,
      alertness: 0.2,
      threat: 0.04,
      isMonster: false,
    },
    {
      id: 'wildlife_deer',
      species: 'deer',
      habitatId: 'forest',
      count: 3,
      carryingCapacity: 7,
      reproductionRate: 0.1,
      alertness: 0.32,
      threat: 0.12,
      isMonster: false,
    },
    {
      id: 'wildlife_fish',
      species: 'fish',
      habitatId: 'shore',
      count: 6,
      carryingCapacity: 12,
      reproductionRate: 0.2,
      alertness: 0.12,
      threat: 0.02,
      isMonster: false,
    },
  ] as const;

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

export interface WildlifeRecoveryInputV15 {
  population: WildlifePopulationAuditV15;
  environmentHabitatSupport: number;
  wildlifeRecoveryLaw: number;
}

/**
 * Exact recovered v0.3.13 recovery probability formula.
 *
 * Cardinal habitat support protects ordinary ecology fully, but monsters only
 * receive at most 0.3 habitat support and at most 0.35 recovery-law strength.
 */
export function recoveredWildlifeRecoveryChanceV15(
  input: WildlifeRecoveryInputV15,
): number {
  const population = input.population;

  if (
    !Number.isInteger(population.count) ||
    population.count < 0 ||
    !Number.isInteger(population.carryingCapacity) ||
    population.carryingCapacity < 1
  ) {
    throw new Error('Wildlife count/capacity must be valid integers.');
  }
  if (population.count >= population.carryingCapacity) return 0;

  const density =
    population.count / population.carryingCapacity;
  const emptyHabitatBoost = population.count === 0 ? 0.22 : 0;

  const habitatSupport = population.isMonster
    ? Math.min(0.3, clamp01(input.environmentHabitatSupport))
    : clamp01(input.environmentHabitatSupport);

  const effectiveRecoveryLaw = population.isMonster
    ? Math.min(0.35, Math.max(0, input.wildlifeRecoveryLaw))
    : Math.max(0, input.wildlifeRecoveryLaw);

  return clamp01(
    population.reproductionRate *
      effectiveRecoveryLaw *
      (0.35 + habitatSupport * 0.8) *
      (1 - density) +
      emptyHabitatBoost *
        habitatSupport *
        (population.isMonster ? 0.08 : 1),
  );
}

export interface EcologyBalanceSnapshotV15 {
  worldMinutes: number;
  livingHumanPopulation: number;
  populations: readonly WildlifePopulationAuditV15[];

  /**
   * Optional mortality evidence from the same recent window.
   * This is diagnostic only.
   */
  recentDeathsTotal?: number;
  recentMonsterDeaths?: number;
  recentWildlifeDeaths?: number;
}

export type EcologyBalanceSeverityV15 =
  | 'info'
  | 'warning'
  | 'critical';

export interface EcologyBalanceFindingV15 {
  severity: EcologyBalanceSeverityV15;
  code: string;
  message: string;
  evidence: string[];
}

export interface EcologyBalanceSummaryV15 {
  ordinaryWildlifeTotal: number;
  monsterTotal: number;
  dangerousOrdinaryWildlifeTotal: number;
  totalFauna: number;
  monsterToHumanRatio: number;
  dangerousFaunaToHumanRatio: number;
  hostileDeathShare: number;
  findings: EcologyBalanceFindingV15[];
}

const WORLD_MINUTES_PER_YEAR = 365 * 24 * 60;

function validatePopulation(
  population: WildlifePopulationAuditV15,
): EcologyBalanceFindingV15[] {
  const findings: EcologyBalanceFindingV15[] = [];

  if (
    !Number.isInteger(population.count) ||
    population.count < 0
  ) {
    findings.push({
      severity: 'critical',
      code: 'invalid_population_count',
      message: `Population ${population.id} has invalid count.`,
      evidence: [`count=${population.count}`],
    });
  }

  if (
    !Number.isInteger(population.carryingCapacity) ||
    population.carryingCapacity < 1
  ) {
    findings.push({
      severity: 'critical',
      code: 'invalid_carrying_capacity',
      message: `Population ${population.id} has invalid carrying capacity.`,
      evidence: [
        `carryingCapacity=${population.carryingCapacity}`,
      ],
    });
  } else if (population.count > population.carryingCapacity) {
    findings.push({
      severity: 'critical',
      code: 'population_above_carrying_capacity',
      message:
        `Population ${population.id} exceeds its own habitat carrying capacity.`,
      evidence: [
        `count=${population.count}`,
        `carryingCapacity=${population.carryingCapacity}`,
      ],
    });
  }

  const expectedMonster = MONSTER_SPECIES_V15.has(
    population.species,
  );
  if (expectedMonster !== population.isMonster) {
    findings.push({
      severity: 'critical',
      code: 'monster_flag_mismatch',
      message:
        `Population ${population.id} has a monster flag inconsistent with its species.`,
      evidence: [
        `species=${population.species}`,
        `isMonster=${population.isMonster}`,
      ],
    });
  }

  const foundingMatch = FOUNDING_WILDLIFE_BASELINE_V15.find(
    (item) => item.id === population.id,
  );
  const recoveredThreat = foundingMatch
    ? foundingMatch.threat
    : RECOVERED_SPECIES_THREAT_V15[population.species];

  if (
    !Number.isFinite(population.threat) ||
    Math.abs(population.threat - recoveredThreat) > 1e-9
  ) {
    findings.push({
      severity: 'warning',
      code: 'species_threat_drift',
      message:
        `Population ${population.id} threat differs from its recovered context-specific baseline.`,
      evidence: [
        `species=${population.species}`,
        `threat=${population.threat}`,
        `recoveredThreat=${recoveredThreat}`,
        `baseline=${foundingMatch ? 'founding_fixed_population' : 'dynamic_species'}`,
      ],
    });
  }

  return findings;
}

/**
 * Diagnostic ratios are warnings, not physics.
 *
 * A real ecosystem may contain many more animals than residents. The audit
 * focuses on DANGEROUS fauna and especially monsters relative to a small
 * civilization, not total rabbits/fish/deer.
 */
export function auditEcologyBalanceV15(
  snapshot: EcologyBalanceSnapshotV15,
): EcologyBalanceSummaryV15 {
  if (
    !Number.isFinite(snapshot.worldMinutes) ||
    snapshot.worldMinutes < 0
  ) {
    throw new Error('worldMinutes must be finite and non-negative.');
  }
  if (
    !Number.isInteger(snapshot.livingHumanPopulation) ||
    snapshot.livingHumanPopulation < 0
  ) {
    throw new Error(
      'livingHumanPopulation must be a non-negative integer.',
    );
  }

  const findings: EcologyBalanceFindingV15[] = [];
  for (const population of snapshot.populations) {
    findings.push(...validatePopulation(population));
  }

  const ordinary = snapshot.populations.filter(
    (population) => !population.isMonster,
  );
  const monsters = snapshot.populations.filter(
    (population) => population.isMonster,
  );
  const dangerousOrdinary = ordinary.filter(
    (population) => population.threat >= 0.25,
  );

  const sum = (
    populations: readonly WildlifePopulationAuditV15[],
  ) =>
    populations.reduce(
      (total, population) => total + population.count,
      0,
    );

  const ordinaryWildlifeTotal = sum(ordinary);
  const monsterTotal = sum(monsters);
  const dangerousOrdinaryWildlifeTotal = sum(dangerousOrdinary);
  const totalFauna = ordinaryWildlifeTotal + monsterTotal;

  const denominator = Math.max(
    1,
    snapshot.livingHumanPopulation,
  );
  const monsterToHumanRatio = monsterTotal / denominator;
  const dangerousFaunaToHumanRatio =
    (monsterTotal + dangerousOrdinaryWildlifeTotal) /
    denominator;

  const deathsTotal = snapshot.recentDeathsTotal ?? 0;
  const hostileDeaths =
    (snapshot.recentMonsterDeaths ?? 0) +
    (snapshot.recentWildlifeDeaths ?? 0);
  const hostileDeathShare =
    deathsTotal > 0 ? hostileDeaths / deathsTotal : 0;

  const worldAgeYears =
    snapshot.worldMinutes / WORLD_MINUTES_PER_YEAR;
  const earlyWorld = worldAgeYears <= 12;

  if (
    snapshot.livingHumanPopulation > 0 &&
    earlyWorld &&
    monsterToHumanRatio > 1
  ) {
    findings.push({
      severity: 'warning',
      code: 'early_monsters_outnumber_humans',
      message:
        'In the first 12 Ainkrad years, living monsters outnumber living humans. This is not automatically invalid, but it is a strong regression signal for a young civilization.',
      evidence: [
        `monsterTotal=${monsterTotal}`,
        `livingHumans=${snapshot.livingHumanPopulation}`,
        `ratio=${monsterToHumanRatio.toFixed(3)}`,
      ],
    });
  }

  if (
    snapshot.livingHumanPopulation > 0 &&
    earlyWorld &&
    dangerousFaunaToHumanRatio > 3
  ) {
    findings.push({
      severity: 'warning',
      code: 'dangerous_fauna_pressure_extreme',
      message:
        'Dangerous fauna exceeds three times the living human population in the early world. Review frontier pace, habitat placement and encounter frequency.',
      evidence: [
        `dangerousFauna=${
          monsterTotal + dangerousOrdinaryWildlifeTotal
        }`,
        `livingHumans=${snapshot.livingHumanPopulation}`,
        `ratio=${dangerousFaunaToHumanRatio.toFixed(3)}`,
      ],
    });
  }

  if (deathsTotal >= 3 && hostileDeathShare >= 0.4) {
    findings.push({
      severity: 'critical',
      code: 'hostile_ecology_driving_mortality',
      message:
        'At least 40% of recent deaths came from monsters or wildlife. Hostile ecology is materially driving civilization loss.',
      evidence: [
        `hostileDeaths=${hostileDeaths}`,
        `recentDeaths=${deathsTotal}`,
        `share=${hostileDeathShare.toFixed(3)}`,
      ],
    });
  }

  if (
    snapshot.livingHumanPopulation > 0 &&
    snapshot.livingHumanPopulation <= 7 &&
    monsterTotal >= snapshot.livingHumanPopulation
  ) {
    findings.push({
      severity: 'critical',
      code: 'monster_pressure_during_demographic_crisis',
      message:
        'Human civilization is already below the continuity floor while monsters are at least as numerous as humans.',
      evidence: [
        `livingHumans=${snapshot.livingHumanPopulation}`,
        `monsterTotal=${monsterTotal}`,
      ],
    });
  }

  const foundingSpecies = new Set(['rabbit', 'deer', 'fish']);
  const presentFoundingSpecies = new Set(
    snapshot.populations
      .filter(
        (population) =>
          foundingSpecies.has(population.species) &&
          population.count > 0,
      )
      .map((population) => population.species),
  );

  if (
    earlyWorld &&
    presentFoundingSpecies.size === 0
  ) {
    findings.push({
      severity: 'warning',
      code: 'founding_ecology_disappeared',
      message:
        'Rabbits, deer and fish are all absent in the early world. The founding ordinary ecology has collapsed.',
      evidence: [],
    });
  }

  return {
    ordinaryWildlifeTotal,
    monsterTotal,
    dangerousOrdinaryWildlifeTotal,
    totalFauna,
    monsterToHumanRatio,
    dangerousFaunaToHumanRatio,
    hostileDeathShare,
    findings,
  };
}

export interface EcologyTimeSampleV15 {
  worldMinutes: number;
  populations: readonly WildlifePopulationAuditV15[];
}

export interface EcologyPersistenceFindingV15 {
  severity: 'warning' | 'critical';
  code: string;
  populationId: string;
  message: string;
}

/**
 * Time-series audit detects persistent extinctions/saturation patterns without
 * changing population dynamics.
 */
export function auditEcologyPersistenceV15(
  samples: readonly EcologyTimeSampleV15[],
): EcologyPersistenceFindingV15[] {
  const ordered = [...samples].sort(
    (a, b) => a.worldMinutes - b.worldMinutes,
  );
  if (ordered.length < 2) return [];

  const findings: EcologyPersistenceFindingV15[] = [];
  const byPopulation = new Map<
    string,
    Array<{
      worldMinutes: number;
      count: number;
      capacity: number;
      isMonster: boolean;
    }>
  >();

  for (const sample of ordered) {
    for (const population of sample.populations) {
      const list = byPopulation.get(population.id) ?? [];
      list.push({
        worldMinutes: sample.worldMinutes,
        count: population.count,
        capacity: population.carryingCapacity,
        isMonster: population.isMonster,
      });
      byPopulation.set(population.id, list);
    }
  }

  for (const [populationId, values] of byPopulation) {
    const firstZero = values.find((value) => value.count === 0);
    if (firstZero) {
      const oneYearLater = values.find(
        (value) =>
          value.worldMinutes >=
          firstZero.worldMinutes + WORLD_MINUTES_PER_YEAR,
      );
      if (oneYearLater && oneYearLater.count === 0) {
        findings.push({
          severity: 'warning',
          code: 'population_zero_for_year',
          populationId,
          message:
            `${populationId} remained extinct for approximately one Ainkrad year. Review habitat/recovery conditions.`,
        });
      }
    }

    const monsterValues = values.filter((value) => value.isMonster);
    if (
      monsterValues.length >= 4 &&
      monsterValues.every(
        (value) => value.count === value.capacity,
      )
    ) {
      findings.push({
        severity: 'warning',
        code: 'monster_population_persistently_saturated',
        populationId,
        message:
          `${populationId} remained at carrying capacity across all observed samples. Review whether monster recovery is too strong for this habitat.`,
      });
    }
  }

  return findings;
}
