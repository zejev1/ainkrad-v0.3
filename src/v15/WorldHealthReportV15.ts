import type {
  EcologyBalanceSummaryV15,
  EcologyBalanceFindingV15,
} from './EcologyBalanceAuditV15';
import type {
  MortalityClusterSummaryV15,
} from './DeathTelemetryV15';
import type {
  GenerationContinuityFindingV15,
} from './GenerationalKnowledgeAuditV15';

export type WorldHealthStatusV15 =
  | 'healthy'
  | 'watch'
  | 'danger'
  | 'critical';

export interface WorldHealthInputV15 {
  worldMinutes: number;

  population: {
    livingHumans: number;
    births: number;
    deaths: number;
    secondGenerationLiving: number;
    reproductivePairPotential?: number;
  };

  resources: {
    renewableBase: number;
    storedResourcePressure?: number;
  };

  genesis: {
    activeCount: number;
    countedAsPopulation: boolean;
  };

  exploration: {
    discoveredRegionCount: number;
  };

  ecology: EcologyBalanceSummaryV15;
  mortality?: MortalityClusterSummaryV15;
  knowledgeFindings?: readonly GenerationContinuityFindingV15[];

  cardinal: {
    currentEpochTimedEvidenceHealthy: boolean;
    autonomyBudgetStatus?: 'open' | 'caution' | 'exhausted';
    activeInterventionCount?: number;
  };

  resetIntegrity?: {
    epochIsolationHealthy: boolean;
  };
}

export interface WorldHealthSectionV15 {
  id:
    | 'population'
    | 'resources'
    | 'ecology'
    | 'knowledge'
    | 'genesis'
    | 'cardinal'
    | 'exploration'
    | 'reset';
  status: WorldHealthStatusV15;
  title: string;
  summary: string;
  evidence: string[];
}

export interface WorldHealthReportV15 {
  status: WorldHealthStatusV15;
  score: number;
  worldAgeYears: number;
  title: string;
  summary: string;
  sections: WorldHealthSectionV15[];
  criticalCodes: string[];
  warningCodes: string[];
}

const YEAR_MINUTES = 365 * 24 * 60;

const severityRank: Record<WorldHealthStatusV15, number> = {
  healthy: 0,
  watch: 1,
  danger: 2,
  critical: 3,
};

function worst(
  ...statuses: WorldHealthStatusV15[]
): WorldHealthStatusV15 {
  return statuses.reduce(
    (current, candidate) =>
      severityRank[candidate] > severityRank[current]
        ? candidate
        : current,
    'healthy',
  );
}

function ecologyStatus(
  findings: readonly EcologyBalanceFindingV15[],
): WorldHealthStatusV15 {
  if (findings.some((finding) => finding.severity === 'critical')) {
    return 'critical';
  }
  if (
    findings.some(
      (finding) =>
        finding.code === 'early_monsters_outnumber_humans' ||
        finding.code === 'dangerous_fauna_pressure_extreme',
    )
  ) {
    return 'danger';
  }
  if (findings.some((finding) => finding.severity === 'warning')) {
    return 'watch';
  }
  return 'healthy';
}

function knowledgeStatus(
  findings: readonly GenerationContinuityFindingV15[],
): WorldHealthStatusV15 {
  if (findings.some((finding) => finding.severity === 'critical')) {
    return 'critical';
  }
  if (findings.some((finding) => finding.severity === 'warning')) {
    return 'watch';
  }
  return 'healthy';
}

export function buildWorldHealthReportV15(
  input: WorldHealthInputV15,
): WorldHealthReportV15 {
  if (!Number.isFinite(input.worldMinutes) || input.worldMinutes < 0) {
    throw new Error('worldMinutes must be finite and non-negative.');
  }

  const worldAgeYears = input.worldMinutes / YEAR_MINUTES;
  const sections: WorldHealthSectionV15[] = [];
  const criticalCodes: string[] = [];
  const warningCodes: string[] = [];

  // Population
  let populationStatus: WorldHealthStatusV15 = 'healthy';
  if (input.population.livingHumans <= 4) {
    populationStatus = 'critical';
    criticalCodes.push('population_near_extinction');
  } else if (input.population.livingHumans <= 7) {
    populationStatus = 'danger';
    warningCodes.push('population_below_continuity_floor');
  } else if (
    input.population.reproductivePairPotential !== undefined &&
    input.population.reproductivePairPotential < 1 &&
    worldAgeYears >= 3
  ) {
    populationStatus = 'danger';
    warningCodes.push('reproductive_bottleneck');
  }

  sections.push({
    id: 'population',
    status: populationStatus,
    title: 'Население и продолжение цивилизации',
    summary:
      `Живых людей: ${input.population.livingHumans}; рождений: ${input.population.births}; смертей: ${input.population.deaths}; второе поколение: ${input.population.secondGenerationLiving}.`,
    evidence: [
      `livingHumans=${input.population.livingHumans}`,
      `births=${input.population.births}`,
      `deaths=${input.population.deaths}`,
      `secondGeneration=${input.population.secondGenerationLiving}`,
      `reproductivePairPotential=${
        input.population.reproductivePairPotential ?? 'unknown'
      }`,
    ],
  });

  // Resources
  let resourceStatus: WorldHealthStatusV15 = 'healthy';
  if (input.resources.renewableBase < 0.08) {
    resourceStatus = 'critical';
    criticalCodes.push('renewable_base_critical');
  } else if (input.resources.renewableBase < 0.18) {
    resourceStatus = 'danger';
    warningCodes.push('renewable_base_low');
  } else if (input.resources.renewableBase < 0.35) {
    resourceStatus = 'watch';
    warningCodes.push('renewable_base_declining');
  }

  sections.push({
    id: 'resources',
    status: resourceStatus,
    title: 'Ресурсы и хозяйство',
    summary:
      `Возобновляемая база: ${(input.resources.renewableBase * 100).toFixed(1)}%.`,
    evidence: [
      `renewableBase=${input.resources.renewableBase.toFixed(3)}`,
      `storedResourcePressure=${
        input.resources.storedResourcePressure ?? 'unknown'
      }`,
    ],
  });

  // Ecology
  const eStatus = ecologyStatus(input.ecology.findings);
  for (const finding of input.ecology.findings) {
    if (finding.severity === 'critical') {
      criticalCodes.push(finding.code);
    } else if (finding.severity === 'warning') {
      warningCodes.push(finding.code);
    }
  }
  sections.push({
    id: 'ecology',
    status: eStatus,
    title: 'Экология и монстры',
    summary:
      `Обычная фауна: ${input.ecology.ordinaryWildlifeTotal}; монстры: ${input.ecology.monsterTotal}; опасная фауна/люди: ${input.ecology.dangerousFaunaToHumanRatio.toFixed(2)}; доля смертей от враждебной экологии: ${(input.ecology.hostileDeathShare * 100).toFixed(0)}%.`,
    evidence: input.ecology.findings.flatMap(
      (finding) => [
        `${finding.code}:${finding.severity}`,
        ...finding.evidence,
      ],
    ),
  });

  // Mortality details improve severity even if current ecology snapshot looks quiet.
  if (input.mortality) {
    for (const warning of input.mortality.warnings) {
      if (
        warning === 'hostile_ecology_dominates_mortality' ||
        warning === 'resource_deprivation_dominates_mortality'
      ) {
        if (!criticalCodes.includes(warning)) criticalCodes.push(warning);
      } else if (!warningCodes.includes(warning)) {
        warningCodes.push(warning);
      }
    }
  }

  // Knowledge
  const kFindings = input.knowledgeFindings ?? [];
  const kStatus = knowledgeStatus(kFindings);
  for (const finding of kFindings) {
    if (finding.severity === 'critical') {
      criticalCodes.push(finding.code);
    } else if (finding.severity === 'warning') {
      warningCodes.push(finding.code);
    }
  }
  sections.push({
    id: 'knowledge',
    status: kStatus,
    title: 'Знания и поколения',
    summary:
      kFindings.length === 0
        ? 'Критических нарушений цепочки знаний не обнаружено в переданных данных.'
        : kFindings.map((finding) => finding.message).join(' '),
    evidence: kFindings.flatMap((finding) => [
      `${finding.code}:${finding.severity}`,
      ...finding.residentIds.map((id) => `resident=${id}`),
    ]),
  });

  // Genesis
  let genesisStatus: WorldHealthStatusV15 = 'healthy';
  if (input.genesis.countedAsPopulation) {
    genesisStatus = 'critical';
    criticalCodes.push('genesis_counted_as_population');
  }
  if (worldAgeYears > 3 && input.genesis.activeCount > 0) {
    genesisStatus = 'critical';
    criticalCodes.push('genesis_active_after_year_3');
  }
  sections.push({
    id: 'genesis',
    status: genesisStatus,
    title: 'Genesis-наставники',
    summary:
      `Активных Genesis: ${input.genesis.activeCount}; учитываются как население: ${input.genesis.countedAsPopulation ? 'да — ошибка' : 'нет'}.`,
    evidence: [
      `activeCount=${input.genesis.activeCount}`,
      `countedAsPopulation=${input.genesis.countedAsPopulation}`,
    ],
  });

  // Cardinal
  let cardinalStatus: WorldHealthStatusV15 = 'healthy';
  if (!input.cardinal.currentEpochTimedEvidenceHealthy) {
    cardinalStatus = 'critical';
    criticalCodes.push('cardinal_timed_evidence_contaminated');
  } else if (input.cardinal.autonomyBudgetStatus === 'exhausted') {
    cardinalStatus = 'watch';
    warningCodes.push('cardinal_autonomy_budget_exhausted');
  }
  sections.push({
    id: 'cardinal',
    status: cardinalStatus,
    title: 'Cardinal / Auditor / Gateway',
    summary:
      `Текущий временной контекст: ${input.cardinal.currentEpochTimedEvidenceHealthy ? 'чистый' : 'ошибка эпохи/времени'}; автономный бюджет: ${input.cardinal.autonomyBudgetStatus ?? 'нет данных'}; активных вмешательств: ${input.cardinal.activeInterventionCount ?? 0}.`,
    evidence: [
      `currentEpochTimedEvidenceHealthy=${input.cardinal.currentEpochTimedEvidenceHealthy}`,
      `autonomyBudget=${input.cardinal.autonomyBudgetStatus ?? 'unknown'}`,
    ],
  });

  // Exploration is deliberately advisory, not a target.
  let explorationStatus: WorldHealthStatusV15 = 'healthy';
  if (
    worldAgeYears <= 4 &&
    input.exploration.discoveredRegionCount > 4
  ) {
    explorationStatus = 'watch';
    warningCodes.push('frontier_pace_fast');
  }
  sections.push({
    id: 'exploration',
    status: explorationStatus,
    title: 'Освоение мира',
    summary:
      `Открытых дальних регионов: ${input.exploration.discoveredRegionCount}.`,
    evidence: [
      `worldAgeYears=${worldAgeYears.toFixed(2)}`,
      `discoveredRegions=${input.exploration.discoveredRegionCount}`,
    ],
  });

  if (input.resetIntegrity) {
    const resetStatus: WorldHealthStatusV15 =
      input.resetIntegrity.epochIsolationHealthy
        ? 'healthy'
        : 'critical';
    if (!input.resetIntegrity.epochIsolationHealthy) {
      criticalCodes.push('epoch_reset_leak');
    }
    sections.push({
      id: 'reset',
      status: resetStatus,
      title: 'Изоляция эпохи / New World',
      summary:
        input.resetIntegrity.epochIsolationHealthy
          ? 'Состояние текущего мира не содержит утечек прошлой эпохи.'
          : 'Обнаружена утечка состояния предыдущего мира.',
      evidence: [
        `epochIsolationHealthy=${input.resetIntegrity.epochIsolationHealthy}`,
      ],
    });
  }

  const worstSectionStatus = sections.reduce(
    (status, section) => worst(status, section.status),
    'healthy' as WorldHealthStatusV15,
  );

  const reportStatus: WorldHealthStatusV15 =
    criticalCodes.length > 0
      ? 'critical'
      : worstSectionStatus;

  const penalty =
    sections.reduce((total, section) => {
      const value =
        section.status === 'critical'
          ? 22
          : section.status === 'danger'
            ? 13
            : section.status === 'watch'
              ? 5
              : 0;
      return total + value;
    }, 0);

  const score = Math.max(0, Math.min(100, 100 - penalty));

  const statusRu: Record<WorldHealthStatusV15, string> = {
    healthy: 'стабилен',
    watch: 'требует наблюдения',
    danger: 'в опасной зоне',
    critical: 'в критическом состоянии',
  };

  const worstSections = sections
    .filter(
      (section) =>
        severityRank[section.status] >=
        severityRank['danger'],
    )
    .map((section) => section.title);

  return {
    status: reportStatus,
    score,
    worldAgeYears,
    title: 'Состояние мира Ainkrad',
    summary:
      `Мир ${statusRu[reportStatus]}. Индекс состояния: ${score}/100.` +
      (worstSections.length
        ? ` Основные проблемные области: ${worstSections.join(', ')}.`
        : ' Системных угроз в переданных данных не обнаружено.'),
    sections,
    criticalCodes: [...new Set(criticalCodes)].sort(),
    warningCodes: [...new Set(warningCodes)].sort(),
  };
}
