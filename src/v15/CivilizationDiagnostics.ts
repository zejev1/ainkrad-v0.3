export type CivilizationDeathCause =
  | 'old_age'
  | 'hunger'
  | 'resource_collapse'
  | 'monster'
  | 'wildlife'
  | 'conflict'
  | 'disease'
  | 'exposure'
  | 'accident'
  | 'unknown';

export interface CivilizationDeathRecord {
  residentId: string;
  generation: number;
  cause: CivilizationDeathCause;
  worldMinutes: number;
}

export interface CivilizationDiagnosticSnapshot {
  worldMinutes: number;
  livingPopulation: number;
  birthsTotal: number;
  deathsTotal: number;
  reproductivePairPotential?: number;
  renewableResourceBase?: number;
  storedResourcePressure?: number;
  monsterPressure?: number;
  wildlifeDangerPressure?: number;
  recentDeaths: CivilizationDeathRecord[];
}

export interface CivilizationDiagnosticFinding {
  severity: 'info' | 'warning' | 'critical';
  code: string;
  title: string;
  explanation: string;
  evidence: string[];
}

function countByCause(records: readonly CivilizationDeathRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const record of records) {
    out[record.cause] = (out[record.cause] ?? 0) + 1;
  }
  return out;
}

export function diagnoseCivilization(
  snapshot: CivilizationDiagnosticSnapshot,
): CivilizationDiagnosticFinding[] {
  const findings: CivilizationDiagnosticFinding[] = [];
  const causes = countByCause(snapshot.recentDeaths);
  const recentCount = snapshot.recentDeaths.length;
  const share = (cause: CivilizationDeathCause) =>
    recentCount > 0 ? (causes[cause] ?? 0) / recentCount : 0;

  if (snapshot.livingPopulation <= 4) {
    findings.push({
      severity: 'critical',
      code: 'population_near_extinction',
      title: 'Цивилизация близка к исчезновению',
      explanation:
        'Число живых обычных жителей упало до уровня, при котором случайные смерти и отсутствие совместимых семей могут сделать восстановление невозможным.',
      evidence: [`livingPopulation=${snapshot.livingPopulation}`],
    });
  } else if (snapshot.livingPopulation <= 7) {
    findings.push({
      severity: 'warning',
      code: 'population_continuity_risk',
      title: 'Опасно малая популяция',
      explanation:
        'Население ниже устойчивого стартового сообщества и требует наблюдения за причинами смертности и воспроизводством.',
      evidence: [`livingPopulation=${snapshot.livingPopulation}`],
    });
  }

  if (
    snapshot.reproductivePairPotential !== undefined &&
    snapshot.reproductivePairPotential < 1 &&
    snapshot.livingPopulation > 0
  ) {
    findings.push({
      severity: 'critical',
      code: 'reproductive_bottleneck',
      title: 'Нет жизнеспособной демографической цепочки',
      explanation:
        'Жители ещё живы, но сейчас нет достаточного потенциала добровольных совместимых семей для следующего поколения.',
      evidence: [
        `reproductivePairPotential=${snapshot.reproductivePairPotential.toFixed(3)}`,
      ],
    });
  }

  const hostileShare = share('monster') + share('wildlife');
  if (recentCount >= 2 && hostileShare >= 0.4) {
    findings.push({
      severity: 'critical',
      code: 'hostile_ecology_mortality',
      title: 'Хищники/монстры вытесняют жителей',
      explanation:
        'Слишком большая доля недавних смертей связана с враждебной экологией. Нужно сравнить плотность существ, опасность биомов и возможность жителей избегать столкновений.',
      evidence: [
        `hostileDeathShare=${hostileShare.toFixed(3)}`,
        `monsterDeaths=${causes.monster ?? 0}`,
        `wildlifeDeaths=${causes.wildlife ?? 0}`,
        `monsterPressure=${snapshot.monsterPressure ?? 'unknown'}`,
        `wildlifeDangerPressure=${snapshot.wildlifeDangerPressure ?? 'unknown'}`,
      ],
    });
  }

  const resourceShare =
    share('hunger') + share('resource_collapse') + share('exposure');
  if (
    (snapshot.renewableResourceBase !== undefined &&
      snapshot.renewableResourceBase < 0.12) ||
    (recentCount >= 2 && resourceShare >= 0.4)
  ) {
    findings.push({
      severity: 'critical',
      code: 'resource_system_failure',
      title: 'Ресурсная система не поддерживает население',
      explanation:
        'Либо возобновляемая база почти исчерпана, либо значительная часть смертей напрямую связана с нехваткой ресурсов/условий жизни.',
      evidence: [
        `renewableResourceBase=${snapshot.renewableResourceBase ?? 'unknown'}`,
        `resourceRelatedDeathShare=${resourceShare.toFixed(3)}`,
      ],
    });
  }

  if (
    snapshot.birthsTotal === 0 &&
    snapshot.worldMinutes >= 3 * 365 * 24 * 60 &&
    snapshot.livingPopulation >= 2
  ) {
    findings.push({
      severity: 'warning',
      code: 'no_births_after_three_years',
      title: 'За первые три года не появилось детей',
      explanation:
        'Это не автоматически ошибка — жители могут добровольно не хотеть детей. Но для тестового мира нужно проверить возраст, отношения, желание ребёнка, здоровье и ресурсные ограничения, чтобы исключить сломанную демографическую механику.',
      evidence: [
        `birthsTotal=${snapshot.birthsTotal}`,
        `livingPopulation=${snapshot.livingPopulation}`,
      ],
    });
  }

  if (recentCount > 0) {
    findings.push({
      severity: 'info',
      code: 'death_cause_summary',
      title: 'Распределение недавних смертей',
      explanation: Object.entries(causes)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([cause, count]) => `${cause}: ${count}`)
        .join(', '),
      evidence: [`recentDeaths=${recentCount}`],
    });
  }

  return findings;
}
