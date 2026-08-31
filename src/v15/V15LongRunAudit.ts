export interface V15LongRunSnapshot {
  worldMinutes: number;
  ordinaryLivingPopulation: number;
  genesisActiveCount: number;
  genesisCountedInPopulation: boolean;
  births: number;
  deaths: number;
  renewableResourceBase: number;
  discoveredRegionCount: number;
  ordinaryWildlifeCount: number;
  ordinaryWildlifeCapacity: number;
  monsterCount: number;
  monsterCapacity: number;
  brokenLineageLinks: number;
  secondGenerationLiving: number;
  secondGenerationLearners: number;
  ordinaryTeachersActive: number;
}

export type V15AuditSeverity = 'info' | 'warning' | 'critical';

export interface V15LongRunAlert {
  severity: V15AuditSeverity;
  code: string;
  worldMinutes: number;
  message: string;
}

const WORLD_MINUTES_PER_DAY = 24 * 60;
const WORLD_MINUTES_PER_YEAR = 365 * WORLD_MINUTES_PER_DAY;
const GENESIS_END_WORLD_MINUTES = 3 * WORLD_MINUTES_PER_YEAR;

export function auditV15LongRun(
  samples: readonly V15LongRunSnapshot[],
): V15LongRunAlert[] {
  const alerts: V15LongRunAlert[] = [];
  const ordered = [...samples].sort((a, b) => a.worldMinutes - b.worldMinutes);

  for (const sample of ordered) {
    if (sample.ordinaryLivingPopulation <= 0) {
      alerts.push({
        severity: 'critical',
        code: 'civilization_extinct',
        worldMinutes: sample.worldMinutes,
        message: 'Ordinary resident population reached zero.',
      });
    }

    if (sample.genesisCountedInPopulation) {
      alerts.push({
        severity: 'critical',
        code: 'genesis_counted_as_population',
        worldMinutes: sample.worldMinutes,
        message: 'Genesis Teachers are being counted as ordinary population.',
      });
    }

    if (
      sample.worldMinutes > GENESIS_END_WORLD_MINUTES &&
      sample.genesisActiveCount > 0
    ) {
      alerts.push({
        severity: 'critical',
        code: 'genesis_active_after_year_3',
        worldMinutes: sample.worldMinutes,
        message: 'Genesis Teachers remain active after their three-year bootstrap period.',
      });
    }

    if (sample.brokenLineageLinks > 0) {
      alerts.push({
        severity: 'critical',
        code: 'broken_lineage',
        worldMinutes: sample.worldMinutes,
        message: `Detected ${sample.brokenLineageLinks} non-reciprocal parent/child links.`,
      });
    }

    if (
      sample.ordinaryWildlifeCount > sample.ordinaryWildlifeCapacity ||
      sample.monsterCount > sample.monsterCapacity
    ) {
      alerts.push({
        severity: 'critical',
        code: 'ecology_over_capacity',
        worldMinutes: sample.worldMinutes,
        message: 'Wildlife/monster count exceeded declared carrying capacity.',
      });
    }

    if (
      sample.worldMinutes >= 4 * WORLD_MINUTES_PER_YEAR &&
      sample.secondGenerationLiving > 0 &&
      sample.secondGenerationLearners === 0 &&
      sample.ordinaryTeachersActive === 0
    ) {
      alerts.push({
        severity: 'warning',
        code: 'knowledge_chain_stalled',
        worldMinutes: sample.worldMinutes,
        message:
          'Second generation exists after Genesis departure but no second-generation learner or ordinary teacher is active.',
      });
    }

    if (sample.renewableResourceBase < 0.08) {
      alerts.push({
        severity: 'warning',
        code: 'resource_base_near_exhaustion',
        worldMinutes: sample.worldMinutes,
        message: 'Renewable resource base fell below 8%.',
      });
    }
  }

  // Detect prolonged resource collapse rather than a single short shock.
  for (let i = 0; i < ordered.length; i += 1) {
    const start = ordered[i];
    if (start.renewableResourceBase >= 0.12) continue;
    const oneYearLater = start.worldMinutes + WORLD_MINUTES_PER_YEAR;
    const later = ordered.find(
      (sample) => sample.worldMinutes >= oneYearLater,
    );
    if (later && later.renewableResourceBase < 0.12) {
      alerts.push({
        severity: 'critical',
        code: 'resource_base_chronic_collapse',
        worldMinutes: later.worldMinutes,
        message:
          'Renewable resource base remained below 12% for approximately one Ainkrad year.',
      });
      break;
    }
  }

  // Pacing baseline is advisory, not a hard law.
  const aroundYear4 = [...ordered]
    .reverse()
    .find((sample) => sample.worldMinutes <= 4 * WORLD_MINUTES_PER_YEAR);
  if (aroundYear4 && aroundYear4.discoveredRegionCount > 4) {
    alerts.push({
      severity: 'warning',
      code: 'frontier_pace_regression',
      worldMinutes: aroundYear4.worldMinutes,
      message:
        `By about year 4 the world has ${aroundYear4.discoveredRegionCount} discovered regions; v15 control behavior was approximately one new distant area, so review exploration pacing.`,
    });
  }

  return alerts.sort(
    (a, b) =>
      a.worldMinutes - b.worldMinutes ||
      a.code.localeCompare(b.code),
  );
}

export const V15_LONG_RUN_TARGET_YEARS = [8, 10, 12] as const;
export const V15_AUDIT_SAMPLE_INTERVAL_WORLD_MINUTES =
  90 * WORLD_MINUTES_PER_DAY;
