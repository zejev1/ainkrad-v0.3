export type CanonicalDeathCauseV15 =
  | 'old_age'
  | 'illness'
  | 'deprivation'
  | 'catastrophe'
  | 'wildlife'
  | 'monster'
  | 'war';

export interface DeathThreatContextV15 {
  species?: string;
  isMonster?: boolean;
  habitatId?: string;
  populationCount?: number;
  carryingCapacity?: number;
  threat?: number;
  escaped?: boolean;
  damage?: number;
  lethalChance?: number;
  encounterReason?: 'self_defense' | 'territorial_defense' | 'dungeon';
}

export interface CatastropheDeathContextV15 {
  catastropheKind?: string;
  magnitude?: number;
  exposure?: number;
  maximumDeaths?: number;
  deathsBeforeThis?: number;
  raceFloor?: number;
}

export interface DeathContextSnapshotV15 {
  agentId: string;
  name: string;
  ageYears: number;
  lifespanYears: number;
  generation: number;
  level: number;
  experience: number;

  technicalTick: number;
  worldMinutes: number;

  locationId: string;
  placeDanger: number;
  lastAction?: string;

  healthBeforeDeath: number;
  energyBeforeDeath: number;
  resourcesBeforeDeath: number;
  stressBeforeDeath: number;

  physiology: {
    strength: number;
    endurance: number;
    mobility: number;
    recovery: number;
  };

  combatMastery: number;
  objectControlAuthority: number;

  renewableResourceBase?: number;
  storedResourcePressure?: number;
  safetySupport?: number;

  threat?: DeathThreatContextV15;
  catastrophe?: CatastropheDeathContextV15;
}

export interface DeathTelemetryRecordV15 {
  telemetryVersion: 'ainkrad-death-telemetry-v15';
  deathId: string;
  cause: CanonicalDeathCauseV15;
  context: DeathContextSnapshotV15;

  primaryMechanism:
    | 'lifespan_exhausted'
    | 'old_age_probability'
    | 'health_failure'
    | 'resource_deprivation'
    | 'authorized_catastrophe'
    | 'wildlife_encounter'
    | 'monster_encounter'
    | 'settlement_conflict';

  humanSummary: string;
  diagnosticFactors: string[];

  /**
   * Future dungeon deaths intentionally reuse `monster` plus
   * encounterReason='dungeon' instead of inventing another incompatible cause.
   */
  dungeonContext: boolean;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function validateDeathContextV15(
  context: DeathContextSnapshotV15,
): void {
  if (!context.agentId.trim()) throw new Error('agentId must not be empty.');
  if (!context.name.trim()) throw new Error('name must not be empty.');
  if (!Number.isFinite(context.ageYears) || context.ageYears < 0) {
    throw new Error('ageYears must be finite and non-negative.');
  }
  if (!Number.isFinite(context.lifespanYears) || context.lifespanYears < 1) {
    throw new Error('lifespanYears must be finite and >=1.');
  }
  if (!Number.isInteger(context.generation) || context.generation < 0) {
    throw new Error('generation must be a non-negative integer.');
  }
  if (!Number.isInteger(context.level) || context.level < 1 || context.level > 100) {
    throw new Error('level must be 1..100.');
  }
  if (!Number.isFinite(context.experience) || context.experience < 0) {
    throw new Error('experience must be finite and non-negative.');
  }
  if (!Number.isFinite(context.technicalTick)) {
    throw new Error('technicalTick must be finite.');
  }
  if (!Number.isFinite(context.worldMinutes) || context.worldMinutes < 0) {
    throw new Error('worldMinutes must be finite and non-negative.');
  }
  for (const [label, value] of [
    ['placeDanger', context.placeDanger],
    ['healthBeforeDeath', context.healthBeforeDeath],
    ['energyBeforeDeath', context.energyBeforeDeath],
    ['resourcesBeforeDeath', context.resourcesBeforeDeath],
    ['stressBeforeDeath', context.stressBeforeDeath],
    ['strength', context.physiology.strength],
    ['endurance', context.physiology.endurance],
    ['mobility', context.physiology.mobility],
    ['recovery', context.physiology.recovery],
    ['combatMastery', context.combatMastery],
    ['objectControlAuthority', context.objectControlAuthority],
    ['safetySupport', context.safetySupport],
    ['renewableResourceBase', context.renewableResourceBase],
    ['storedResourcePressure', context.storedResourcePressure],
  ] as const) {
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < 0 || value > 1)
    ) {
      throw new Error(`${label} must be between 0 and 1.`);
    }
  }
}

function worldAgeText(worldMinutes: number): string {
  const yearMinutes = 365 * 24 * 60;
  const year = Math.floor(worldMinutes / yearMinutes) + 1;
  const day = Math.floor((worldMinutes % yearMinutes) / (24 * 60)) + 1;
  return `год ${year}, день ${day}`;
}

function threatFactors(
  threat: DeathThreatContextV15 | undefined,
): string[] {
  if (!threat) return [];
  const factors: string[] = [];
  if (threat.species) factors.push(`species=${threat.species}`);
  if (threat.habitatId) factors.push(`habitat=${threat.habitatId}`);
  if (threat.threat !== undefined) {
    factors.push(`threat=${threat.threat.toFixed(3)}`);
  }
  if (threat.damage !== undefined) {
    factors.push(`damage=${threat.damage.toFixed(3)}`);
  }
  if (threat.lethalChance !== undefined) {
    factors.push(`lethalChance=${threat.lethalChance.toFixed(3)}`);
  }
  if (threat.populationCount !== undefined) {
    factors.push(`populationCount=${threat.populationCount}`);
  }
  if (threat.carryingCapacity !== undefined) {
    factors.push(`carryingCapacity=${threat.carryingCapacity}`);
  }
  if (threat.encounterReason) {
    factors.push(`encounterReason=${threat.encounterReason}`);
  }
  return factors;
}

export function buildDeathTelemetryV15(
  deathId: string,
  cause: CanonicalDeathCauseV15,
  context: DeathContextSnapshotV15,
  options?: {
    oldAgeTriggeredByLifespan?: boolean;
    oldAgeChance?: number;
  },
): DeathTelemetryRecordV15 {
  if (!deathId.trim()) throw new Error('deathId must not be empty.');
  validateDeathContextV15(context);

  const commonFactors = [
    `health=${context.healthBeforeDeath.toFixed(3)}`,
    `resources=${context.resourcesBeforeDeath.toFixed(3)}`,
    `energy=${context.energyBeforeDeath.toFixed(3)}`,
    `stress=${context.stressBeforeDeath.toFixed(3)}`,
    `age=${context.ageYears.toFixed(2)}`,
    `lifespan=${context.lifespanYears.toFixed(2)}`,
    `placeDanger=${context.placeDanger.toFixed(3)}`,
    `level=${context.level}`,
  ];

  let primaryMechanism: DeathTelemetryRecordV15['primaryMechanism'];
  let humanSummary: string;
  let diagnosticFactors = [...commonFactors];

  if (cause === 'old_age') {
    const lifespanTriggered =
      options?.oldAgeTriggeredByLifespan === true ||
      context.ageYears >= context.lifespanYears;

    primaryMechanism = lifespanTriggered
      ? 'lifespan_exhausted'
      : 'old_age_probability';

    if (options?.oldAgeChance !== undefined) {
      diagnosticFactors.push(
        `oldAgeChance=${clamp01(options.oldAgeChance).toFixed(5)}`,
      );
    }

    humanSummary = lifespanTriggered
      ? `${context.name} умер(ла) от старости: возраст достиг расчётной продолжительности жизни.`
      : `${context.name} умер(ла) от старости во время возрастного риска конца жизни.`;
  } else if (cause === 'deprivation') {
    primaryMechanism = 'resource_deprivation';
    diagnosticFactors.push('canonicalRule=health<=0.015 && resources<0.08');
    if (context.renewableResourceBase !== undefined) {
      diagnosticFactors.push(
        `renewableResourceBase=${context.renewableResourceBase.toFixed(3)}`,
      );
    }
    if (context.storedResourcePressure !== undefined) {
      diagnosticFactors.push(
        `storedResourcePressure=${context.storedResourcePressure.toFixed(3)}`,
      );
    }
    humanSummary =
      `${context.name} умер(ла) от истощения/нехватки ресурсов: здоровье рухнуло до критического уровня при ресурсах ниже порога 0.08.`;
  } else if (cause === 'illness') {
    primaryMechanism = 'health_failure';
    diagnosticFactors.push('canonicalRule=health<=0.015 && resources>=0.08');
    humanSummary =
      `${context.name} умер(ла) из-за критического падения здоровья, не объясняемого прямой нехваткой личных ресурсов.`;
  } else if (cause === 'catastrophe') {
    primaryMechanism = 'authorized_catastrophe';
    if (context.catastrophe?.catastropheKind) {
      diagnosticFactors.push(
        `catastrophe=${context.catastrophe.catastropheKind}`,
      );
    }
    if (context.catastrophe?.magnitude !== undefined) {
      diagnosticFactors.push(
        `magnitude=${context.catastrophe.magnitude.toFixed(3)}`,
      );
    }
    if (context.catastrophe?.exposure !== undefined) {
      diagnosticFactors.push(
        `exposure=${context.catastrophe.exposure.toFixed(3)}`,
      );
    }
    humanSummary =
      `${context.name} погиб(ла) во время системной катастрофы; запись должна быть связана с конкретным событием катастрофы и её параметрами.`;
  } else if (cause === 'war') {
    primaryMechanism = 'settlement_conflict';
    diagnosticFactors = [
      ...diagnosticFactors,
      ...threatFactors(context.threat),
      `combatMastery=${context.combatMastery.toFixed(3)}`,
      `objectControlAuthority=${context.objectControlAuthority.toFixed(3)}`,
    ];
    humanSummary =
      `${context.name} погиб(ла) в самостоятельном конфликте поселений. ` +
      `Запись сохраняет участников, место, полученный урон и боевой опыт.`;
  } else {
    const isMonster = cause === 'monster';
    primaryMechanism = isMonster
      ? 'monster_encounter'
      : 'wildlife_encounter';
    diagnosticFactors = [
      ...diagnosticFactors,
      ...threatFactors(context.threat),
      `combatMastery=${context.combatMastery.toFixed(3)}`,
      `objectControlAuthority=${context.objectControlAuthority.toFixed(3)}`,
      `safetySupport=${(context.safetySupport ?? 0).toFixed(3)}`,
    ];

    const species = context.threat?.species ?? (
      isMonster ? 'неизвестный монстр' : 'дикое животное'
    );
    humanSummary =
      `${context.name} погиб(ла) в столкновении с ${species}. ` +
      `Диагностика сохраняет угрозу, нанесённый урон, шанс летального исхода, физическое состояние и боевой опыт.`;
  }

  return {
    telemetryVersion: 'ainkrad-death-telemetry-v15',
    deathId,
    cause,
    context: structuredClone(context),
    primaryMechanism,
    humanSummary:
      `${humanSummary} Время мира: ${worldAgeText(context.worldMinutes)}.`,
    diagnosticFactors,
    dungeonContext:
      cause === 'monster' &&
      context.threat?.encounterReason === 'dungeon',
  };
}

export interface MortalityClusterSummaryV15 {
  totalDeaths: number;
  causeCounts: Record<CanonicalDeathCauseV15, number>;
  dominantCause?: CanonicalDeathCauseV15;
  dominantShare: number;
  hostileShare: number;
  deprivationShare: number;
  youngDeathShare: number;
  generationCounts: Record<string, number>;
  warnings: string[];
}

const CANONICAL_CAUSES: readonly CanonicalDeathCauseV15[] = [
  'old_age',
  'illness',
  'deprivation',
  'catastrophe',
  'wildlife',
  'monster',
  'war',
];

export function summarizeMortalityClusterV15(
  records: readonly DeathTelemetryRecordV15[],
): MortalityClusterSummaryV15 {
  const causeCounts = Object.fromEntries(
    CANONICAL_CAUSES.map((cause) => [cause, 0]),
  ) as Record<CanonicalDeathCauseV15, number>;

  const generationCounts: Record<string, number> = {};
  for (const record of records) {
    causeCounts[record.cause] += 1;
    const key = String(record.context.generation);
    generationCounts[key] = (generationCounts[key] ?? 0) + 1;
  }

  const totalDeaths = records.length;
  let dominantCause: CanonicalDeathCauseV15 | undefined;
  let dominantCount = 0;
  for (const cause of CANONICAL_CAUSES) {
    if (causeCounts[cause] > dominantCount) {
      dominantCause = cause;
      dominantCount = causeCounts[cause];
    }
  }

  const share = (count: number) =>
    totalDeaths > 0 ? count / totalDeaths : 0;

  const hostileShare = share(
    causeCounts.monster + causeCounts.wildlife + causeCounts.war,
  );
  const deprivationShare = share(causeCounts.deprivation);
  const youngDeathShare = share(
    records.filter(
      (record) =>
        record.context.ageYears <
        Math.min(40, record.context.lifespanYears * 0.55),
    ).length,
  );

  const warnings: string[] = [];
  if (totalDeaths >= 3 && hostileShare >= 0.4) {
    warnings.push('hostile_ecology_dominates_mortality');
  }
  if (totalDeaths >= 3 && deprivationShare >= 0.35) {
    warnings.push('resource_deprivation_dominates_mortality');
  }
  if (totalDeaths >= 4 && youngDeathShare >= 0.5) {
    warnings.push('premature_mortality_cluster');
  }
  if (
    totalDeaths >= 3 &&
    causeCounts.old_age === 0 &&
    dominantCause !== undefined
  ) {
    warnings.push('mortality_not_explained_by_natural_aging');
  }

  return {
    totalDeaths,
    causeCounts,
    dominantCause,
    dominantShare: share(dominantCount),
    hostileShare,
    deprivationShare,
    youngDeathShare,
    generationCounts,
    warnings,
  };
}

export interface PopulationMortalityReportV15 {
  title: string;
  summary: string;
  lines: string[];
  cluster: MortalityClusterSummaryV15;
}

const CAUSE_RU: Record<CanonicalDeathCauseV15, string> = {
  old_age: 'старость',
  illness: 'критическое ухудшение здоровья',
  deprivation: 'истощение / нехватка ресурсов',
  catastrophe: 'катастрофа',
  wildlife: 'дикое животное',
  monster: 'монстр',
  war: 'война поселений',
};

export function buildPopulationMortalityReportV15(
  records: readonly DeathTelemetryRecordV15[],
): PopulationMortalityReportV15 {
  const cluster = summarizeMortalityClusterV15(records);

  const lines = CANONICAL_CAUSES
    .filter((cause) => cluster.causeCounts[cause] > 0)
    .map(
      (cause) =>
        `${CAUSE_RU[cause]}: ${cluster.causeCounts[cause]}`,
    );

  const dominant = cluster.dominantCause
    ? `${CAUSE_RU[cluster.dominantCause]} (${Math.round(cluster.dominantShare * 100)}%)`
    : 'нет смертей';

  return {
    title: 'Сводка смертности цивилизации',
    summary:
      `Всего смертей: ${cluster.totalDeaths}. Главная причина: ${dominant}. ` +
      `Враждебная экология: ${Math.round(cluster.hostileShare * 100)}%; ` +
      `истощение: ${Math.round(cluster.deprivationShare * 100)}%; ` +
      `преждевременные смерти: ${Math.round(cluster.youngDeathShare * 100)}%.`,
    lines,
    cluster,
  };
}
