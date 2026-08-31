export type WorldLawDomain =
  | 'geography'
  | 'ecology'
  | 'climate'
  | 'resources'
  | 'demography'
  | 'cosmology';

export type WorldLawMechanism =
  | 'frontier_expansion'
  | 'wildlife_recovery'
  | 'fertility_support'
  | 'resource_regeneration'
  | 'mystic_resonance'
  | 'weather_volatility'
  | 'catastrophe_recovery'
  | 'settlement_cohesion'
  | 'habitat_integrity'
  | 'civilization_continuity';

export interface ReadableLawInput {
  id: string;
  domain: WorldLawDomain;
  mechanism: WorldLawMechanism;
  value: number;
  minimum: number;
  maximum: number;
  revision: number;
  createdBy: 'system' | 'cardinal' | 'gateway' | string;
  rationale: string;
  createdWorldMinutes?: number;
  updatedWorldMinutes?: number;
}

export interface ReadableInterventionInput {
  interventionId: string;
  kind:
    | 'resource_relief'
    | 'open_shared_space'
    | 'safety_support'
    | 'habitat_support';
  status:
    | 'proposed'
    | 'authorized'
    | 'executed'
    | 'deferred'
    | 'rejected'
    | 'completed'
    | 'failed';
  requestedBy: 'cardinal' | string;
  authorizedBy?: 'gateway' | string;
  reason: string;
  expectedOutcome: string;
  magnitude?: number;
  requestedWorldMinutes?: number;
  authorizedUntilWorldMinutes?: number;
  outcomeSummary?: string;
  deferOrFailureReason?: string;
  evidenceIds?: string[];
  metricsBefore?: Record<string, number>;
  metricsAfter?: Record<string, number>;
}

export interface HumanReadableDetailRow {
  label: string;
  value: string;
}

export interface HumanReadableCardinalReport {
  reportType: 'law' | 'intervention';
  title: string;
  status: string;
  summary: string;
  rows: HumanReadableDetailRow[];
  rawTechnical: Record<string, unknown>;
}

const DOMAIN_RU: Record<WorldLawDomain, string> = {
  geography: 'География',
  ecology: 'Экология',
  climate: 'Климат',
  resources: 'Ресурсы',
  demography: 'Демография',
  cosmology: 'Космология',
};

const MECHANISM_RU: Record<WorldLawMechanism, string> = {
  frontier_expansion: 'Темп освоения новых территорий',
  wildlife_recovery: 'Восстановление животных',
  fertility_support: 'Поддержка условий для семей и рождения детей',
  resource_regeneration: 'Восстановление возобновляемых ресурсов',
  mystic_resonance: 'Мистический резонанс мира',
  weather_volatility: 'Изменчивость погоды',
  catastrophe_recovery: 'Восстановление после катастроф',
  settlement_cohesion: 'Целостность поселений',
  habitat_integrity: 'Совместимость видов и среды',
  civilization_continuity: 'Продолжение цивилизации',
};

const INTERVENTION_RU: Record<ReadableInterventionInput['kind'], string> = {
  resource_relief: 'Временная ресурсная поддержка',
  open_shared_space: 'Открытие общего пространства',
  safety_support: 'Временная поддержка безопасности',
  habitat_support: 'Временная поддержка среды обитания',
};

const STATUS_RU: Record<ReadableInterventionInput['status'], string> = {
  proposed: 'Предложено Cardinal',
  authorized: 'Разрешено Gateway',
  executed: 'Выполнено',
  deferred: 'Отложено',
  rejected: 'Отклонено',
  completed: 'Завершено',
  failed: 'Ошибка выполнения',
};

export function formatAinkradWorldTime(worldMinutes: number | undefined): string {
  if (worldMinutes === undefined) return 'Нет данных';
  if (!Number.isFinite(worldMinutes) || worldMinutes < 0) return 'Некорректное время';

  const totalDays = worldMinutes / (24 * 60);
  const years = Math.floor(totalDays / 365);
  const dayOfYear = Math.floor(totalDays - years * 365) + 1;
  const minutesOfDay = Math.floor(worldMinutes % (24 * 60));
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;

  return `Год ${years + 1}, день ${dayOfYear}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function number(value: number | undefined, digits = 3): string {
  return value === undefined || !Number.isFinite(value)
    ? 'Нет данных'
    : value.toFixed(digits);
}

function metricChanges(
  before: Record<string, number> | undefined,
  after: Record<string, number> | undefined,
): string {
  if (!before || !after) return 'Нет полного сравнения';

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes = keys
    .filter(
      (key) =>
        Number.isFinite(before[key]) &&
        Number.isFinite(after[key]) &&
        before[key] !== after[key],
    )
    .map((key) => {
      const delta = after[key] - before[key];
      const sign = delta > 0 ? '+' : '';
      return `${key}: ${before[key].toFixed(3)} → ${after[key].toFixed(3)} (${sign}${delta.toFixed(3)})`;
    });
  return changes.length ? changes.join('; ') : 'Измеримые показатели не изменились';
}

export function buildReadableLawReport(
  law: ReadableLawInput,
): HumanReadableCardinalReport {
  const range =
    law.maximum > law.minimum
      ? (law.value - law.minimum) / (law.maximum - law.minimum)
      : 0;
  const position =
    range < 0.34 ? 'низкое' : range > 0.66 ? 'высокое' : 'среднее';

  return {
    reportType: 'law',
    title: MECHANISM_RU[law.mechanism],
    status: `Активный закон, ревизия ${law.revision}`,
    summary:
      `${DOMAIN_RU[law.domain]}. Текущее значение ${number(law.value)} — ${position} внутри разрешённого диапазона. ${law.rationale}`,
    rows: [
      { label: 'ID закона', value: law.id },
      { label: 'Область', value: DOMAIN_RU[law.domain] },
      { label: 'Механизм', value: MECHANISM_RU[law.mechanism] },
      { label: 'Текущее значение', value: number(law.value) },
      {
        label: 'Разрешённый диапазон',
        value: `${number(law.minimum)} … ${number(law.maximum)}`,
      },
      { label: 'Кто создал', value: law.createdBy },
      { label: 'Причина / смысл', value: law.rationale },
      {
        label: 'Создан',
        value: formatAinkradWorldTime(law.createdWorldMinutes),
      },
      {
        label: 'Последнее изменение',
        value: formatAinkradWorldTime(law.updatedWorldMinutes),
      },
    ],
    rawTechnical: { ...law },
  };
}

export function buildReadableInterventionReport(
  item: ReadableInterventionInput,
): HumanReadableCardinalReport {
  const authorization =
    item.authorizedBy === undefined
      ? 'Gateway ещё не разрешал выполнение'
      : `Разрешение выдал ${item.authorizedBy}`;

  return {
    reportType: 'intervention',
    title: INTERVENTION_RU[item.kind],
    status: STATUS_RU[item.status],
    summary:
      `${item.reason} Ожидаемый результат: ${item.expectedOutcome}` +
      (item.outcomeSummary ? ` Фактический результат: ${item.outcomeSummary}` : ''),
    rows: [
      { label: 'ID вмешательства', value: item.interventionId },
      { label: 'Тип', value: INTERVENTION_RU[item.kind] },
      { label: 'Статус', value: STATUS_RU[item.status] },
      { label: 'Запросил', value: item.requestedBy },
      { label: 'Авторизация', value: authorization },
      { label: 'Почему', value: item.reason },
      { label: 'Что ожидалось', value: item.expectedOutcome },
      { label: 'Сила воздействия', value: number(item.magnitude) },
      {
        label: 'Запрошено',
        value: formatAinkradWorldTime(item.requestedWorldMinutes),
      },
      {
        label: 'Действие до',
        value: formatAinkradWorldTime(item.authorizedUntilWorldMinutes),
      },
      {
        label: 'Результат',
        value: item.outcomeSummary ?? 'Итог ещё не зафиксирован',
      },
      {
        label: 'Почему отложено / ошибка',
        value: item.deferOrFailureReason ?? '—',
      },
      {
        label: 'Изменение показателей',
        value: metricChanges(item.metricsBefore, item.metricsAfter),
      },
      {
        label: 'Доказательства',
        value: item.evidenceIds?.length
          ? item.evidenceIds.join(', ')
          : 'Нет связанных записей',
      },
    ],
    rawTechnical: { ...item },
  };
}
