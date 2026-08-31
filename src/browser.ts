import './browser.css';
import type {
  AuditRecord,
  CardinalCapability,
  CardinalDeferReason,
  CardinalEvaluation,
  CardinalPredictionMetric,
  CardinalProblemKind,
  InterventionKind,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './cardinal/types';
import type {
  CardinalConsoleSnapshot,
  LiveWorldFrame,
} from './runtime/LiveWorldRuntime';
import {
  makeOfflineWorldClockAnchor,
  offlineWorldMinuteTarget,
  parseOfflineWorldClockAnchor,
  type OfflineWorldClockAnchor,
} from './runtime/OfflineWorldClock';
import type { WorldEvent } from './world/events';
import {
  ageParts,
  DEFAULT_WORLD_SPEED_ID,
  DEFAULT_WORLD_SPEED_MULTIPLIER,
  isWorldSpeedId,
  isWorldSpeedMultiplier,
  WORLD_MINUTES_PER_YEAR,
  WORLD_SPEED_PRESETS,
  worldCalendarAtMinutes,
  worldSpeedPreset,
  type WorldSpeedId,
  type WorldSpeedMultiplier,
} from './world/WorldClock';
import type {
  AgentActionKind,
  AgentState,
  RelationshipState,
  WildlifeSpecies,
  WorldPlaceKind,
  WorldState,
} from './world/types';
import { projectedResidentPosition } from './presentation/ResidentMotionProjection';
import {
  inspectPlaceV16,
  inspectResidentV16,
  inspectWildlifeV16,
  type TruthfulInspectorReportV16,
} from './v16/TruthfulInspectorsV16';
import { formatAinkradWorldTime } from './v15/CardinalReadableReport';
import { worldDurationDescription } from './v15/WorldTimeContract';
import type {
  V18LivelihoodKind,
  V18LivelihoodStage,
} from './v18/types';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Ainkrad browser root not found.');
}

const actionLabels: Record<AgentActionKind, string> = {
  rest: 'отдыхает',
  relax: 'отдыхает на природе',
  walk: 'гуляет',
  gather: 'собирает ресурсы',
  hunt: 'охотится',
  work: 'работает',
  socialize: 'общается',
  help: 'помогает',
  explore: 'исследует мир',
  reflect: 'размышляет',
  bond: 'строит близость',
  pray: 'ищет высший смысл',
};

const actionIcons: Record<AgentActionKind, string> = {
  rest: '☾',
  relax: '☀',
  walk: '↝',
  gather: '✦',
  hunt: '➶',
  work: '⚒',
  socialize: '●●',
  help: '♥',
  explore: '⌁',
  reflect: '…',
  bond: '∞',
  pray: '✧',
};

const livelihoodLabels: Readonly<Record<V18LivelihoodKind, string>> = {
  undecided: 'дело жизни ещё не выбрано',
  farmer: 'земледелец',
  forager: 'собиратель',
  woodcutter: 'лесоруб',
  miner: 'рудокоп',
  fisher: 'рыбак',
  hunter: 'охотник',
  artisan: 'ремесленник',
  smith: 'кузнец',
  builder: 'строитель',
  caregiver: 'попечитель',
  scout: 'разведчик',
  teacher: 'наставник',
  scribe: 'писец',
  guard: 'страж',
  spiritual_keeper: 'хранитель традиций',
};

const livelihoodStageLabels: Readonly<Record<V18LivelihoodStage, string>> = {
  observing: 'наблюдает',
  apprentice: 'ученик',
  practitioner: 'опытный',
  master: 'мастер',
};

const goalLabels: Record<AgentState['goal']['kind'], string> = {
  recover: 'восстановиться',
  secure_resources: 'обеспечить себя',
  connect: 'найти общение',
  contribute: 'быть полезным',
  explore: 'узнать новое',
  reflect: 'разобраться в себе',
  build_family: 'создать семью',
  seek_truth: 'понять тайны мира',
};

const traitLabels: Record<keyof AgentState['personality'], string> = {
  sociability: 'общительный',
  diligence: 'деятельный',
  curiosity: 'любознательный',
  generosity: 'отзывчивый',
  resilience: 'стойкий',
  riskTolerance: 'смелый',
};

const skillLabels: Record<keyof AgentState['skills'], string> = {
  gathering: 'сбор',
  hunting: 'охота',
  craft: 'ремесло',
  social: 'общение',
  exploration: 'исследование',
};

const raceLabels: Record<NonNullable<AgentState['race']>, string> = {
  human: 'человек',
  goblin: 'гоблин',
  orc: 'орк',
  ogre: 'огр',
};

interface MapPoint {
  x: number;
  y: number;
  label: string;
  symbol: string;
}

const publicPlacePoints: Record<string, MapPoint> = {
  commons: { x: 50, y: 48, label: 'Общая площадь', symbol: '◆' },
  resource_field: { x: 16, y: 23, label: 'Ресурсное поле', symbol: '✦' },
  workshop: { x: 83, y: 25, label: 'Мастерская', symbol: '⚒' },
  quiet_space: { x: 18, y: 75, label: 'Тихий сад', symbol: '♣' },
  outskirts: { x: 82, y: 76, label: 'Окраина', symbol: '▲' },
  meadow: { x: 8, y: 13, label: 'Дикий луг', symbol: '❀' },
  forest: { x: 50, y: 12, label: 'Северный лес', symbol: '♠' },
  shore: { x: 92, y: 88, label: 'Берег моря', symbol: '≈' },
};

const wildlifeLabels: Record<WildlifeSpecies, string> = {
  rabbit: 'Кролики',
  deer: 'Олени',
  fish: 'Рыба',
  boar: 'Кабаны',
  wolf: 'Волки',
  bird: 'Птицы',
  dire_wolf: 'Лютоволки',
  ogre: 'Огры',
  wraith: 'Тени',
};

const wildlifeIcons: Record<WildlifeSpecies, string> = {
  rabbit: '🐇',
  deer: '🦌',
  fish: '🐟',
  boar: '🐗',
  wolf: '🐺',
  bird: '🐦',
  dire_wolf: '🐺',
  ogre: '👹',
  wraith: '👻',
};

const emotionLabels: Record<keyof AgentState['mind']['emotions'], string> = {
  joy: 'радость',
  fear: 'страх',
  grief: 'горе',
  awe: 'трепет',
  hope: 'надежда',
};

const cardinalCapabilityLabels: Record<CardinalCapability, string> = {
  world_observation: 'наблюдение мира',
  autonomy_guard: 'защита автономии',
  trend_reasoning: 'анализ тенденций',
  ecosystem_observation: 'наблюдение экосистемы',
  outcome_learning: 'обучение на последствиях',
  habitat_support_planning: 'планирование поддержки среды',
  world_rule_design: 'проектирование законов мира',
  demographic_stewardship: 'наблюдение поколений',
  catastrophe_modeling: 'моделирование катастроф',
};

const cardinalDeferLabels: Record<CardinalDeferReason, string> = {
  insufficient_persistence:
    'Cardinal видит риск, но ждёт подтверждения ещё несколькими циклами.',
  experiment_in_progress:
    'Предыдущее вмешательство ещё проверяется; накладывать второе нельзя.',
  autonomy_budget:
    'Лимит вмешательств исчерпан — миру оставлено время решить проблему самому.',
  failed_prediction_caution:
    'Два прошлых прогноза не подтвердились; Cardinal временно воздерживается.',
  capability_not_ready:
    'Cardinal ещё не накопил достаточно опыта для такого вмешательства.',
};

const cardinalProblemLabels: Record<CardinalProblemKind, string> = {
  civilization_collapse: 'угроза краха человеческой цивилизации',
  resource_fragility: 'нехватка общих и личных ресурсов',
  social_fragmentation: 'одиночество и распад социальных связей',
  safety_instability: 'опасная среда и угроза жизни',
  conflict_overload: 'слишком высокий уровень конфликтов',
  ecosystem_fragility: 'истощение животных и среды обитания',
};

const interventionLabels: Record<InterventionKind, string> = {
  resource_relief: 'временная ресурсная помощь',
  open_shared_space: 'временное открытие общего пространства',
  safety_support: 'временная поддержка безопасности',
  habitat_support: 'временная поддержка среды обитания',
};

const predictionMetricLabels: Record<CardinalPredictionMetric, string> = {
  civilizationCriticality: 'критичность состояния цивилизации',
  resourcePressure: 'ресурсное давление',
  socialIsolation: 'социальная изоляция',
  safetyPressure: 'давление опасности',
  averageStress: 'средний стресс',
  wildlifePressure: 'давление на экосистему',
};

const worldLawMechanismLabels: Record<WorldState['governance']['laws'][string]['mechanism'], string> = {
  frontier_expansion: 'скорость открытия новых земель',
  wildlife_recovery: 'восстановление животных',
  fertility_support: 'условия для рождения детей',
  resource_regeneration: 'естественное восстановление ресурсов',
  mystic_resonance: 'сила знамений и мистических явлений',
  weather_volatility: 'изменчивость погоды',
  catastrophe_recovery: 'восстановление после катастроф',
  settlement_cohesion: 'целостность поселений',
  habitat_integrity: 'совместимость видов и среды',
  civilization_continuity: 'приоритет продолжения цивилизации',
};

const phaseLabels = {
  dawn: 'Рассвет',
  day: 'День',
  evening: 'Вечер',
  night: 'Ночь',
} as const;

const seasonLabels = {
  spring: 'Весна',
  summer: 'Лето',
  autumn: 'Осень',
  winter: 'Зима',
} as const;

const homePoints: readonly MapPoint[] = [
  { x: 7, y: 49, label: 'Дом Alex', symbol: '⌂' },
  { x: 30, y: 8, label: 'Дом Mira', symbol: '⌂' },
  { x: 69, y: 8, label: 'Дом Kai', symbol: '⌂' },
  { x: 93, y: 49, label: 'Дом Noa', symbol: '⌂' },
  { x: 70, y: 92, label: 'Дом Ilan', symbol: '⌂' },
  { x: 30, y: 92, label: 'Дом Rin', symbol: '⌂' },
];

app.innerHTML = `
  <div class="ainkrad-app">
    <header class="world-header">
      <div>
        <p class="eyebrow">AINKRAD v0.3.18 · путь к Underworld</p>
        <h1 id="world-title">Мир · уровень 1</h1>
        <p class="world-subtitle">Время регулируется снаружи. Жители сами расширяют карту и проживают поколения.</p>
      </div>

      <div class="live-indicator" id="live-indicator">
        <span class="live-dot" aria-hidden="true"></span>
        <span id="live-label">ВОССТАНОВЛЕНИЕ</span>
      </div>
    </header>

    <div class="status-strip" aria-label="Состояние мира">
      <span>Возраст <strong id="tick-value">0 дней</strong></span>
      <span>Календарь <strong id="time-value">Год 1 · день 1</strong></span>
      <span>Мир <strong id="world-level-value">ур. 1</strong></span>
      <span>Жителей <strong id="population-value">10</strong></span>
      <span>Карта <strong id="growth-value">5 мест</strong></span>
      <span>Cardinal <strong id="cardinal-status-level">ур. 1</strong></span>
      <span>Животные <strong id="wildlife-value">0</strong></span>
      <span>Монстры <strong id="monster-value">0</strong></span>
      <span>Ресурсы <strong id="resource-value">—</strong></span>
      <span class="save-state">Состояние <strong id="save-value">Загрузка…</strong></span>
    </div>

    <section class="external-clock" aria-label="Внешнее управление скоростью мира">
      <div>
        <span class="external-clock__label">ВНЕШНИЙ FLA-КОНТУР</span>
        <strong id="clock-rate-value">1 мин = 1 год</strong>
      </div>
      <label>
        <span class="sr-only">Базовая скорость мира</span>
        <select id="world-speed-select">
          ${WORLD_SPEED_PRESETS.map(
            (preset) =>
              `<option value="${preset.id}"${preset.id === DEFAULT_WORLD_SPEED_ID ? ' selected' : ''}>${preset.shortLabel}</option>`,
          ).join('')}
        </select>
      </label>
      <button id="speed-multiplier" type="button" aria-label="Переключить ускорение в десять раз">×1</button>
      <button id="reset-world" type="button" aria-label="Создать новый мир с сохранением опыта Cardinal">Новый мир</button>
      <small id="offline-clock-status">После закрытия мир продолжит время при следующем открытии · Cardinal не имеет доступа</small>
    </section>

    <section class="catch-up-overlay" id="catch-up-overlay" aria-live="assertive" hidden>
      <div class="catch-up-overlay__heading">
        <div>
          <span>ВОССТАНОВЛЕНИЕ ЖИВОГО МИРА</span>
          <strong id="catch-up-title">Подготавливаем быстрый догон…</strong>
        </div>
        <b id="catch-up-percent">0%</b>
      </div>
      <div class="catch-up-track"><span id="catch-up-bar"></span></div>
      <p id="catch-up-detail">Жители, поколения и события будут рассчитаны; календарь не перепрыгивается.</p>
    </section>

    <main class="world-layout">
      <section class="world-map-shell" aria-label="Растущая карта Ainkrad">
        <div class="map-toolbar">
          <strong id="map-scale-value">Уровень мира 1 · 11 локаций</strong>
          <div class="map-toolbar__controls">
            <span id="map-time-value">Рассвет · Весна</span>
            <button id="map-zoom-out" type="button" aria-label="Уменьшить карту">−</button>
            <button id="map-zoom-fit" type="button" aria-label="Показать всю карту">100%</button>
            <button id="map-zoom-in" type="button" aria-label="Увеличить карту">+</button>
            <button id="text-scale" type="button" aria-label="Увеличить размер текста">Текст 115%</button>
          </div>
        </div>
        <div class="world-map-viewport" id="world-map-viewport">
          <div class="world-map-stage" id="world-map-stage">
          <section class="world-map" id="world-map" aria-label="Карта Ainkrad">
            <div class="map-sky" aria-hidden="true"></div>
            <div class="map-grid" aria-hidden="true"></div>
            <div class="terrain terrain--water growth-terrain growth-terrain--3" aria-hidden="true"></div>
            <div class="terrain terrain--grove-one growth-terrain growth-terrain--2" aria-hidden="true"></div>
            <div class="terrain terrain--grove-two growth-terrain growth-terrain--1" aria-hidden="true"></div>
            <div id="biomes-layer" class="biomes-layer" aria-hidden="true"></div>

            <svg
              class="roads"
              id="roads-layer"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            ></svg>

            <div id="settlements-layer" class="settlements-layer"></div>
            <div id="places-layer" class="places-layer"></div>
            <div id="wildlife-layer" class="wildlife-layer"></div>
            <div id="agents-layer" class="agents-layer"></div>

            <div class="map-hint" id="map-hint">Проведите по карте</div>

            <div
              class="disturbance-banner"
              id="disturbance-banner"
              aria-live="polite"
            ></div>
          </section>
          </div>
        </div>
      </section>

      <aside class="world-sidebar">
        <section class="resident-panel" aria-live="polite">
          <div class="panel-heading-row">
            <p class="panel-label">Выбранный житель</p>
            <span class="autonomy-mark">САМ РЕШАЕТ</span>
          </div>

          <label class="resident-picker-label" for="resident-picker">
            <span>Найти конкретного жителя</span>
            <select id="resident-picker" aria-label="Выбрать жителя"></select>
          </label>

          <div class="resident-title-row">
            <div class="resident-portrait" id="resident-portrait" aria-hidden="true">A</div>
            <div>
              <h2 id="resident-name">Мир запускается…</h2>
              <p id="resident-activity" class="resident-activity">Подготавливаем жителей</p>
            </div>
          </div>

          <dl class="resident-facts">
            <div><dt>Место</dt><dd id="resident-place">—</dd></div>
            <div><dt>Цель</dt><dd id="resident-goal">—</dd></div>
            <div><dt>Жизнь</dt><dd id="resident-life">—</dd></div>
            <div><dt>Чувства</dt><dd id="resident-emotion">—</dd></div>
            <div><dt>Тело</dt><dd id="resident-physiology">—</dd></div>
            <div><dt>Характер</dt><dd id="resident-traits">—</dd></div>
            <div><dt>Дело жизни</dt><dd id="resident-profession">—</dd></div>
            <div><dt>Сильный навык</dt><dd id="resident-skill">—</dd></div>
            <div><dt>Выбор</dt><dd id="resident-choice">—</dd></div>
          </dl>

          <div class="need-row">
            <span>Энергия</span><span id="energy-value">—</span>
            <div class="need-track"><span id="energy-bar"></span></div>
          </div>
          <div class="need-row">
            <span>Стресс</span><span id="stress-value">—</span>
            <div class="need-track need-track--stress"><span id="stress-bar"></span></div>
          </div>
          <div class="need-row">
            <span>Личные ресурсы</span><span id="personal-resource-value">—</span>
            <div class="need-track need-track--resources"><span id="personal-resource-bar"></span></div>
          </div>
          <div class="need-row need-row--compact">
            <span>Сытость</span><span id="satiety-value">—</span>
            <div class="need-track need-track--satiety"><span id="satiety-bar"></span></div>
          </div>
          <div class="need-row need-row--compact">
            <span>Принадлежность</span><span id="belonging-value">—</span>
            <div class="need-track need-track--belonging"><span id="belonging-bar"></span></div>
          </div>
          <div class="need-row need-row--compact">
            <span>Смысл</span><span id="purpose-value">—</span>
            <div class="need-track need-track--purpose"><span id="purpose-bar"></span></div>
          </div>

          <p class="relationship-note" id="relationship-note">Связи ещё формируются.</p>
          <button class="resident-details-open" id="resident-details-open" type="button">
            Родословная, навыки и реальная жизнь
          </button>
        </section>

        <section class="event-panel">
          <div class="panel-heading-row">
            <p class="panel-label">Жизнь мира</p>
            <span class="event-live">СЕЙЧАС</span>
          </div>
          <ol class="event-feed" id="event-feed">
            <li>Мир вспоминает свою историю…</li>
          </ol>
          <div class="conversation-window" aria-live="polite">
            <strong>Подслушано в мире</strong>
            <div id="conversation-feed">Пока рядом не слышно разговора.</div>
          </div>
        </section>

        <section class="cardinal-panel">
          <div class="panel-heading-row">
            <p class="panel-label">Cardinal наблюдает</p>
            <span class="gateway-mark">GATEWAY</span>
          </div>

          <div class="cardinal-numbers">
            <button type="button" data-cardinal-tab="evaluations"><strong id="evaluation-value">0</strong>оценок</button>
            <button type="button" data-cardinal-tab="proposals"><strong id="proposal-value">0</strong>предложений</button>
            <button type="button" data-cardinal-tab="interventions"><strong id="intervention-value">0</strong>вмешательств</button>
            <button type="button" data-cardinal-tab="laws"><strong id="world-change-value">0</strong>законов мира</button>
            <button type="button" data-cardinal-tab="evaluations"><strong id="cardinal-level-value">1</strong>уровень</button>
            <button type="button" data-cardinal-tab="evaluations"><strong id="cardinal-xp-value">0</strong>опыт</button>
          </div>

          <p class="cardinal-capabilities" id="cardinal-capabilities">
            Наблюдение мира · защита автономии
          </p>

          <p id="cardinal-message">
            Cardinal не управляет жителями. Любое изменение мира проходит
            только через независимый gateway.
          </p>
          <p class="cardinal-last-action" id="cardinal-last-action">
            Последнее действие: пока ни одного вмешательства.
          </p>
          <button class="cardinal-open" id="cardinal-open" type="button">Открыть журнал Cardinal</button>
        </section>
      </aside>
    </main>
    <div class="cardinal-console" id="cardinal-console" hidden>
      <section class="cardinal-console__sheet" role="dialog" aria-modal="true" aria-labelledby="cardinal-console-title">
        <header>
          <div>
            <p class="panel-label">ПРОВЕРЯЕМЫЙ ЖУРНАЛ</p>
            <h2 id="cardinal-console-title">Что сделал Cardinal</h2>
          </div>
          <button id="cardinal-console-close" type="button" aria-label="Закрыть журнал">×</button>
        </header>
        <nav class="cardinal-console__tabs" aria-label="Разделы журнала">
          <button type="button" data-console-tab="laws">Законы</button>
          <button type="button" data-console-tab="interventions">Вмешательства</button>
          <button type="button" data-console-tab="proposals">Предложения</button>
          <button type="button" data-console-tab="evaluations">Оценки</button>
          <button type="button" data-console-tab="diagnostics">Диагностика</button>
        </nav>
        <p class="cardinal-console__note">Данные загружаются только при открытии: длинная история не копируется в каждый кадр мира.</p>
        <div class="cardinal-console__content" id="cardinal-console-content">Загрузка журнала…</div>
      </section>
    </div>
    <div class="world-inspector" id="world-inspector" hidden>
      <section class="world-inspector__sheet" role="dialog" aria-modal="true" aria-labelledby="world-inspector-title">
        <header>
          <div>
            <p class="world-inspector__badge" id="world-inspector-badge">ОБЪЕКТ МИРА</p>
            <h2 id="world-inspector-title">Подробности</h2>
            <p id="world-inspector-subtitle"></p>
          </div>
          <button id="world-inspector-close" type="button" aria-label="Закрыть подробности">×</button>
        </header>
        <div class="world-inspector__content" id="world-inspector-content"></div>
        <p class="world-inspector__evidence" id="world-inspector-evidence"></p>
      </section>
    </div>
  </div>
`;

const requiredElement = <T extends Element>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing browser element #${id}.`);
  return element as unknown as T;
};

const worldMap = requiredElement<HTMLElement>('world-map');
const worldMapStage = requiredElement<HTMLElement>('world-map-stage');
const worldMapViewport = requiredElement<HTMLElement>('world-map-viewport');
const roadsLayer = requiredElement<SVGSVGElement>('roads-layer');
const settlementsLayer = requiredElement<HTMLDivElement>('settlements-layer');
const mapZoomOut = requiredElement<HTMLButtonElement>('map-zoom-out');
const mapZoomFit = requiredElement<HTMLButtonElement>('map-zoom-fit');
const mapZoomIn = requiredElement<HTMLButtonElement>('map-zoom-in');
const textScaleButton = requiredElement<HTMLButtonElement>('text-scale');
const worldTitle = requiredElement<HTMLElement>('world-title');
const worldLevelValue = requiredElement<HTMLElement>('world-level-value');
const cardinalStatusLevel = requiredElement<HTMLElement>('cardinal-status-level');
const mapScaleValue = requiredElement<HTMLElement>('map-scale-value');
const mapTimeValue = requiredElement<HTMLElement>('map-time-value');
const mapHint = requiredElement<HTMLElement>('map-hint');
const placesLayer = requiredElement<HTMLDivElement>('places-layer');
const biomesLayer = requiredElement<HTMLDivElement>('biomes-layer');
const wildlifeLayer = requiredElement<HTMLDivElement>('wildlife-layer');
const agentsLayer = requiredElement<HTMLDivElement>('agents-layer');
const tickValue = requiredElement<HTMLElement>('tick-value');
const timeValue = requiredElement<HTMLElement>('time-value');
const populationValue = requiredElement<HTMLElement>('population-value');
const growthValue = requiredElement<HTMLElement>('growth-value');
const wildlifeValue = requiredElement<HTMLElement>('wildlife-value');
const monsterValue = requiredElement<HTMLElement>('monster-value');
const resourceValue = requiredElement<HTMLElement>('resource-value');
const saveValue = requiredElement<HTMLElement>('save-value');
const worldSpeedSelect = requiredElement<HTMLSelectElement>('world-speed-select');
const speedMultiplierButton = requiredElement<HTMLButtonElement>('speed-multiplier');
const resetWorldButton = requiredElement<HTMLButtonElement>('reset-world');
const clockRateValue = requiredElement<HTMLElement>('clock-rate-value');
const offlineClockStatus = requiredElement<HTMLElement>('offline-clock-status');
const catchUpOverlay = requiredElement<HTMLElement>('catch-up-overlay');
const catchUpTitle = requiredElement<HTMLElement>('catch-up-title');
const catchUpPercent = requiredElement<HTMLElement>('catch-up-percent');
const catchUpBar = requiredElement<HTMLElement>('catch-up-bar');
const catchUpDetail = requiredElement<HTMLElement>('catch-up-detail');
const evaluationValue = requiredElement<HTMLElement>('evaluation-value');
const interventionValue = requiredElement<HTMLElement>('intervention-value');
const proposalValue = requiredElement<HTMLElement>('proposal-value');
const worldChangeValue = requiredElement<HTMLElement>('world-change-value');
const cardinalLevelValue = requiredElement<HTMLElement>('cardinal-level-value');
const cardinalXpValue = requiredElement<HTMLElement>('cardinal-xp-value');
const cardinalCapabilities = requiredElement<HTMLElement>('cardinal-capabilities');
const liveIndicator = requiredElement<HTMLElement>('live-indicator');
const liveLabel = requiredElement<HTMLElement>('live-label');
const disturbanceBanner = requiredElement<HTMLElement>('disturbance-banner');
const residentPortrait = requiredElement<HTMLElement>('resident-portrait');
const residentPicker = requiredElement<HTMLSelectElement>('resident-picker');
const residentName = requiredElement<HTMLElement>('resident-name');
const residentActivity = requiredElement<HTMLElement>('resident-activity');
const residentPlace = requiredElement<HTMLElement>('resident-place');
const residentGoal = requiredElement<HTMLElement>('resident-goal');
const residentLife = requiredElement<HTMLElement>('resident-life');
const residentEmotion = requiredElement<HTMLElement>('resident-emotion');
const residentPhysiology = requiredElement<HTMLElement>('resident-physiology');
const residentTraits = requiredElement<HTMLElement>('resident-traits');
const residentProfession = requiredElement<HTMLElement>('resident-profession');
const residentSkill = requiredElement<HTMLElement>('resident-skill');
const residentChoice = requiredElement<HTMLElement>('resident-choice');
const relationshipNote = requiredElement<HTMLElement>('relationship-note');
const residentDetailsOpen = requiredElement<HTMLButtonElement>('resident-details-open');
const eventFeed = requiredElement<HTMLOListElement>('event-feed');
const conversationFeed = requiredElement<HTMLElement>('conversation-feed');
const energyValue = requiredElement<HTMLElement>('energy-value');
const energyBar = requiredElement<HTMLElement>('energy-bar');
const stressValue = requiredElement<HTMLElement>('stress-value');
const stressBar = requiredElement<HTMLElement>('stress-bar');
const personalResourceValue = requiredElement<HTMLElement>('personal-resource-value');
const personalResourceBar = requiredElement<HTMLElement>('personal-resource-bar');
const satietyValue = requiredElement<HTMLElement>('satiety-value');
const satietyBar = requiredElement<HTMLElement>('satiety-bar');
const belongingValue = requiredElement<HTMLElement>('belonging-value');
const belongingBar = requiredElement<HTMLElement>('belonging-bar');
const purposeValue = requiredElement<HTMLElement>('purpose-value');
const purposeBar = requiredElement<HTMLElement>('purpose-bar');
const cardinalMessage = requiredElement<HTMLElement>('cardinal-message');
const cardinalLastAction = requiredElement<HTMLElement>('cardinal-last-action');
const cardinalOpen = requiredElement<HTMLButtonElement>('cardinal-open');
const cardinalConsole = requiredElement<HTMLElement>('cardinal-console');
const cardinalConsoleClose = requiredElement<HTMLButtonElement>(
  'cardinal-console-close',
);
const cardinalConsoleContent = requiredElement<HTMLElement>(
  'cardinal-console-content',
);
const worldInspector = requiredElement<HTMLElement>('world-inspector');
const worldInspectorClose = requiredElement<HTMLButtonElement>('world-inspector-close');
const worldInspectorBadge = requiredElement<HTMLElement>('world-inspector-badge');
const worldInspectorTitle = requiredElement<HTMLElement>('world-inspector-title');
const worldInspectorSubtitle = requiredElement<HTMLElement>('world-inspector-subtitle');
const worldInspectorContent = requiredElement<HTMLElement>('world-inspector-content');
const worldInspectorEvidence = requiredElement<HTMLElement>('world-inspector-evidence');

const avatarElements = new Map<string, HTMLButtonElement>();
const placeElements = new Map<string, HTMLElement>();
const biomeElements = new Map<string, HTMLElement>();
const wildlifeElements = new Map<string, HTMLElement>();
const settlementElements = new Map<string, HTMLElement>();

let selectedAgentId: string | undefined;
let residentPickerSignature = '';
let lastFrame: LiveWorldFrame | undefined;
let continuityAnnounced = false;
let renderedGrowthStage = -1;
let mapZoom = 1;
let mapBaseWidth = 820;
let mapBaseHeight = 650;
let activeConsoleTab: CardinalConsoleTab = 'laws';
let cardinalConsoleSnapshot: CardinalConsoleSnapshot | undefined;
let highlightedPlaceIds = new Set<string>();
let inspectedEntity:
  | { kind: 'resident' | 'wildlife' | 'place'; id: string }
  | undefined;

type CardinalConsoleTab =
  | 'laws'
  | 'interventions'
  | 'proposals'
  | 'evaluations'
  | 'diagnostics';

const CLOCK_PREFERENCE_KEY = 'ainkrad-v0.3.external-clock';
const OFFLINE_CLOCK_ANCHOR_KEY = 'ainkrad-v0.3.offline-clock-anchor';
const TEXT_SCALE_KEY = 'ainkrad-v0.3.text-scale';
const TEXT_SCALE_STEPS = [1, 1.15, 1.3] as const;
let preferredSpeedId: WorldSpeedId = DEFAULT_WORLD_SPEED_ID;
let preferredSpeedMultiplier: WorldSpeedMultiplier =
  DEFAULT_WORLD_SPEED_MULTIPLIER;
let pendingOfflineClockAnchor: OfflineWorldClockAnchor | undefined;
let offlineClockAnchorChecked = false;
let offlineCatchUpTargetWorldMinutes: number | undefined;
let offlineClockStorageAvailable = true;
let textScale: (typeof TEXT_SCALE_STEPS)[number] = 1.15;

try {
  const stored = JSON.parse(
    localStorage.getItem(CLOCK_PREFERENCE_KEY) ?? 'null',
  ) as { speedId?: unknown; multiplier?: unknown } | null;
  if (stored && isWorldSpeedId(stored.speedId)) {
    preferredSpeedId = stored.speedId;
  }
  if (stored && isWorldSpeedMultiplier(stored.multiplier)) {
    preferredSpeedMultiplier = stored.multiplier;
  }
} catch {
  // A blocked localStorage only means the external speed resets on next visit.
}

try {
  pendingOfflineClockAnchor = parseOfflineWorldClockAnchor(
    localStorage.getItem(OFFLINE_CLOCK_ANCHOR_KEY),
  );
} catch {
  offlineClockStorageAvailable = false;
}

try {
  const storedTextScale = Number(localStorage.getItem(TEXT_SCALE_KEY));
  if (
    TEXT_SCALE_STEPS.includes(
      storedTextScale as (typeof TEXT_SCALE_STEPS)[number],
    )
  ) {
    textScale = storedTextScale as (typeof TEXT_SCALE_STEPS)[number];
  }
} catch {
  // Readability still has a useful mobile-first default without storage.
}

function applyTextScale(): void {
  document.documentElement.style.fontSize = `${16 * textScale}px`;
  textScaleButton.textContent = `Текст ${Math.round(textScale * 100)}%`;
}

applyTextScale();

function clockRateLabel(
  speedId: WorldSpeedId,
  multiplier: WorldSpeedMultiplier,
): string {
  const minutes =
    worldSpeedPreset(speedId).worldMinutesPerRealMinute * multiplier;
  if (minutes >= WORLD_MINUTES_PER_YEAR) {
    const years = minutes / WORLD_MINUTES_PER_YEAR;
    return `1 мин = ${Number.isInteger(years) ? years : years.toFixed(1)} ${years === 1 ? 'год' : 'лет'}`;
  }
  if (minutes >= 43_200) return `1 мин = ${Math.round(minutes / 43_200)} мес`;
  if (minutes >= 1_440) return `1 мин = ${Math.round(minutes / 1_440)} дн`;
  if (minutes >= 60) return `1 мин = ${Math.round(minutes / 60)} ч`;
  return `1 мин = ${Math.round(minutes)} мин`;
}

function showClockControl(
  speedId: WorldSpeedId,
  multiplier: WorldSpeedMultiplier,
): void {
  worldSpeedSelect.value = speedId;
  speedMultiplierButton.textContent = `×${multiplier}`;
  speedMultiplierButton.classList.toggle('is-accelerated', multiplier === 10);
  clockRateValue.textContent = clockRateLabel(speedId, multiplier);
}

showClockControl(preferredSpeedId, preferredSpeedMultiplier);

const regionNameTranslations: Record<string, string> = {
  Northern: 'Северные',
  Silver: 'Серебряные',
  Quiet: 'Тихие',
  Ancient: 'Древние',
  Eastern: 'Восточные',
  Hidden: 'Скрытые',
  Windward: 'Ветреные',
  Amber: 'Янтарные',
  Village: 'Поселения',
  Crossroads: 'Перекрёстки',
  Fields: 'Поля',
  Steppe: 'Степи',
  Meadow: 'Луга',
  Forest: 'Леса',
  Grove: 'Рощи',
  Woods: 'Чащи',
  Coast: 'Берега',
  Bay: 'Бухты',
  Shore: 'Побережья',
  Heights: 'Высоты',
  Ridge: 'Хребты',
  Pass: 'Перевалы',
  Lake: 'Озёра',
  Waters: 'Воды',
  Riverlands: 'Речные земли',
  Ford: 'Броды',
  Marsh: 'Болота',
  Wetlands: 'Топи',
  Ruins: 'Руины',
  Sanctuary: 'Святилища',
};

function localizedPlaceName(name: string): string {
  if (name.endsWith("'s Home")) {
    return `${name.slice(0, -7)} — дом`;
  }
  return name
    .split(' ')
    .map((part) => regionNameTranslations[part] ?? part)
    .join(' ');
}

const clampMapCoordinate = (value: number) =>
  Math.max(4.5, Math.min(95.5, value));

function normalizeWorldCoordinates(
  world: Readonly<WorldState>,
  mapX: number,
  mapY: number,
): Pick<MapPoint, 'x' | 'y'> {
  const places = Object.values(world.places);
  const minX = Math.min(...places.map((place) => place.mapX));
  const maxX = Math.max(...places.map((place) => place.mapX));
  const minY = Math.min(...places.map((place) => place.mapY));
  const maxY = Math.max(...places.map((place) => place.mapY));
  const spanX = Math.max(12, maxX - minX);
  const spanY = Math.max(12, maxY - minY);
  const paddingX = spanX * 0.08;
  const paddingY = spanY * 0.08;

  return {
    x: clampMapCoordinate(
      5 + ((mapX - minX + paddingX) / (spanX + paddingX * 2)) * 90,
    ),
    y: clampMapCoordinate(
      5 + ((mapY - minY + paddingY) / (spanY + paddingY * 2)) * 90,
    ),
  };
}

const clampMapZoom = (value: number) => Math.max(0.42, Math.min(2.6, value));

function applyMapZoom(): void {
  worldMap.style.width = `${mapBaseWidth}px`;
  worldMap.style.height = `${mapBaseHeight}px`;
  worldMap.style.minHeight = `${mapBaseHeight}px`;
  worldMap.style.transform = `scale(${mapZoom})`;
  worldMapStage.style.width = `${Math.round(mapBaseWidth * mapZoom)}px`;
  worldMapStage.style.height = `${Math.round(mapBaseHeight * mapZoom)}px`;
  mapZoomFit.textContent = `${Math.round(mapZoom * 100)}%`;
}

function setMapZoom(
  nextZoom: number,
  focalX = worldMapViewport.clientWidth / 2,
  focalY = worldMapViewport.clientHeight / 2,
): void {
  const previousZoom = mapZoom;
  const worldX = (worldMapViewport.scrollLeft + focalX) / previousZoom;
  const worldY = (worldMapViewport.scrollTop + focalY) / previousZoom;
  mapZoom = clampMapZoom(nextZoom);
  applyMapZoom();
  worldMapViewport.scrollLeft = worldX * mapZoom - focalX;
  worldMapViewport.scrollTop = worldY * mapZoom - focalY;
}

function fitMapToViewport(): void {
  const widthZoom = worldMapViewport.clientWidth / mapBaseWidth;
  const heightZoom = worldMapViewport.clientHeight / mapBaseHeight;
  setMapZoom(Math.min(widthZoom, heightZoom) * 0.96, 0, 0);
  worldMapViewport.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
}

function updateWorldMapScale(world: Readonly<WorldState>): void {
  const places = Object.values(world.places);
  const minX = Math.min(...places.map((place) => place.mapX));
  const maxX = Math.max(...places.map((place) => place.mapX));
  const minY = Math.min(...places.map((place) => place.mapY));
  const maxY = Math.max(...places.map((place) => place.mapY));
  // Persisted map coordinates are compact spatial units. Treating every unit
  // as a whole kilometre made the founding village appear 100 km wide and
  // contradicted its physical travel time. One unit is 100 metres on the
  // readable map; canvas pixels remain independent from that honest scale.
  const physicalSpanUnitsX = Math.max(12, maxX - minX + 8);
  const physicalSpanUnitsY = Math.max(12, maxY - minY + 8);
  const canvasSpanX = Math.max(100, physicalSpanUnitsX + 16);
  const canvasSpanY = Math.max(100, physicalSpanUnitsY + 16);
  const growthScale = Math.sqrt(Math.max(0, world.growth.stage));
  const width = Math.round(Math.max(820 + growthScale * 360, canvasSpanX * 8.2));
  const height = Math.round(Math.max(650 + growthScale * 260, canvasSpanY * 6.5));
  const worldLevel = world.growth.stage + 1;

  mapBaseWidth = width;
  mapBaseHeight = height;
  applyMapZoom();
  worldTitle.textContent = `Мир · уровень ${worldLevel}`;
  worldLevelValue.textContent = `ур. ${worldLevel}`;
  mapScaleValue.textContent =
    `Уровень мира ${worldLevel} · ${places.length} локаций · территория ~${(physicalSpanUnitsX / 10).toFixed(1)}×${(physicalSpanUnitsY / 10).toFixed(1)} км`;

  if (renderedGrowthStage === world.growth.stage) return;
  const previousStage = renderedGrowthStage;
  renderedGrowthStage = world.growth.stage;
  mapHint.textContent =
    previousStage < 0
      ? 'Проведите по карте · она больше экрана'
      : `Открыта новая область · уровень мира ${worldLevel}`;

  const newestRegionId = world.growth.discoveredRegionIds.at(-1) ?? 'commons';
  const target = pointForPlace(newestRegionId, 0, world);
  requestAnimationFrame(() => {
    worldMapViewport.scrollTo({
      left: Math.max(
        0,
        (target.x / 100) * worldMapStage.scrollWidth -
          worldMapViewport.clientWidth / 2,
      ),
      top: Math.max(
        0,
        (target.y / 100) * worldMapStage.scrollHeight -
          worldMapViewport.clientHeight / 2,
      ),
      behavior: previousStage < 0 ? 'auto' : 'smooth',
    });
  });
}

function pointForPlace(
  placeId: string,
  agentIndex = 0,
  world?: Readonly<WorldState>,
): MapPoint {
  const publicPoint = publicPlacePoints[placeId];
  const place = world?.places[placeId];
  if (place && world) {
    const symbolByKind: Partial<Record<WorldPlaceKind, string>> = {
      home: '⌂',
      commons: '◆',
      resource_field: '✦',
      workshop: '⚒',
      quiet_space: '♣',
      outskirts: '▲',
      mountains: '△',
      lake: '◉',
      river: '≈',
      swamp: '♨',
      ruins: '⌘',
      cemetery: '✝',
      village: '⌂',
      city: '▦',
      meadow: '❀',
      forest: '♠',
      shore: '≈',
    };
    const normalized = normalizeWorldCoordinates(
      world,
      place.mapX,
      place.mapY,
    );
    return {
      ...normalized,
      label: publicPoint?.label ?? localizedPlaceName(place.name),
      symbol: publicPoint?.symbol ?? symbolByKind[place.kind] ?? '•',
    };
  }
  if (publicPoint) return publicPoint;
  if (placeId.startsWith('home_')) {
    return homePoints[agentIndex % homePoints.length];
  }
  return { x: 50, y: 48, label: placeId, symbol: '•' };
}

function displayPlaceName(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
): string {
  const publicName = publicPlacePoints[agent.locationId]?.label;
  if (publicName) return publicName;
  const storedName = world.places[agent.locationId]?.name ?? agent.locationId;
  return localizedPlaceName(storedName);
}

function inspectorReportForEntity(
  world: Readonly<WorldState>,
  entity: NonNullable<typeof inspectedEntity>,
): TruthfulInspectorReportV16 | undefined {
  if (entity.kind === 'resident') return inspectResidentV16(world, entity.id);
  if (entity.kind === 'wildlife') return inspectWildlifeV16(world, entity.id);
  return inspectPlaceV16(world, entity.id);
}

function renderInspectorReport(report: TruthfulInspectorReportV16): void {
  worldInspectorBadge.textContent = report.badge;
  worldInspectorTitle.textContent =
    report.kind === 'place' ? localizedPlaceName(report.title) : report.title;
  worldInspectorSubtitle.textContent = report.subtitle;
  worldInspectorEvidence.textContent = report.evidenceNote;
  worldInspectorContent.replaceChildren();

  for (const section of report.sections) {
    const sectionElement = document.createElement('section');
    sectionElement.className = 'world-inspector__section';
    const heading = document.createElement('h3');
    heading.textContent = section.title;
    const rows = document.createElement('dl');
    for (const row of section.rows) {
      const item = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = row.label;
      description.textContent = row.value;
      item.append(term, description);
      rows.append(item);
    }
    sectionElement.append(heading, rows);
    worldInspectorContent.append(sectionElement);
  }
}

function openWorldInspector(
  kind: NonNullable<typeof inspectedEntity>['kind'],
  id: string,
): void {
  if (!lastFrame) return;
  const entity = { kind, id } as const;
  const report = inspectorReportForEntity(lastFrame.world, entity);
  if (!report) return;
  inspectedEntity = entity;
  renderInspectorReport(report);
  worldInspector.hidden = false;
  worldInspectorClose.focus();
}

function refreshWorldInspector(world: Readonly<WorldState>): void {
  if (!inspectedEntity || worldInspector.hidden) return;
  const report = inspectorReportForEntity(world, inspectedEntity);
  if (!report) {
    worldInspector.hidden = true;
    inspectedEntity = undefined;
    return;
  }
  renderInspectorReport(report);
}

function closeWorldInspector(): void {
  worldInspector.hidden = true;
}

function renderRoads(world: Readonly<WorldState>): void {
  roadsLayer.replaceChildren();

  for (const route of Object.values(world.routes)) {
    const points = route.waypoints.map((point) =>
      normalizeWorldCoordinates(world, point.x, point.y),
    );
    if (points.length < 2) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const drawing =
      points.length === 3
        ? `M${points[0].x} ${points[0].y} Q${points[1].x} ${points[1].y} ${points[2].x} ${points[2].y}`
        : `M${points.map((point) => `${point.x} ${point.y}`).join(' L')}`;
    path.setAttribute('d', drawing);
    path.classList.toggle(
      'road-main',
      route.fromPlaceId === 'commons' || route.toPlaceId === 'commons',
    );
    path.classList.toggle('road-bridge', route.traversal === 'bridge');
    path.classList.toggle(
      'is-highlighted',
      highlightedPlaceIds.has(route.fromPlaceId) ||
        highlightedPlaceIds.has(route.toPlaceId),
    );
    roadsLayer.append(path);
  }
}

function renderBiomes(world: Readonly<WorldState>): void {
  const liveIds = new Set(Object.keys(world.places));
  for (const [placeId, element] of biomeElements) {
    if (liveIds.has(placeId)) continue;
    element.remove();
    biomeElements.delete(placeId);
  }
  for (const place of Object.values(world.places)) {
    const point = normalizeWorldCoordinates(world, place.mapX, place.mapY);
    let element = biomeElements.get(place.id);
    if (!element) {
      element = document.createElement('div');
      biomesLayer.append(element);
      biomeElements.set(place.id, element);
    }
    const scale =
      place.biome === 'settlement'
        ? 0.72
        : place.kind === 'forest' || place.kind === 'mountains'
          ? 1.18
          : 1;
    element.className = `biome-patch biome-patch--${place.biome}`;
    element.style.left = `${point.x}%`;
    element.style.top = `${point.y}%`;
    element.style.setProperty('--biome-scale', String(scale));
  }
}

function renderSettlements(world: Readonly<WorldState>): void {
  const liveIds = new Set(Object.keys(world.settlements));
  for (const [id, element] of settlementElements) {
    if (liveIds.has(id)) continue;
    element.remove();
    settlementElements.delete(id);
  }
  for (const settlement of Object.values(world.settlements)) {
    const center = normalizeWorldCoordinates(
      world,
      settlement.centerX,
      settlement.centerY,
    );
    const edge = normalizeWorldCoordinates(
      world,
      settlement.centerX + settlement.radius,
      settlement.centerY,
    );
    let element = settlementElements.get(settlement.id);
    if (!element) {
      element = document.createElement('div');
      element.innerHTML = `<span></span>`;
      settlementsLayer.append(element);
      settlementElements.set(settlement.id, element);
    }
    const diameter = Math.max(9, Math.abs(edge.x - center.x) * 2);
    element.className = `settlement-boundary settlement-boundary--${settlement.kind}`;
    element.style.left = `${center.x}%`;
    element.style.top = `${center.y}%`;
    element.style.width = `${diameter}%`;
    element.style.aspectRatio = '1';
    const label = element.querySelector<HTMLElement>('span');
    if (label) {
      label.textContent = `${settlement.kind === 'city' ? 'Город' : 'Поселение'} ${settlement.name}`;
    }
  }
}

function renderPlaces(world: Readonly<WorldState>): void {
  const liveIds = new Set(Object.keys(world.places));
  for (const [placeId, element] of placeElements) {
    if (liveIds.has(placeId)) continue;
    element.remove();
    placeElements.delete(placeId);
  }
  const agentIds = Object.keys(world.agents);
  for (const [placeId, place] of Object.entries(world.places)) {
    const homeAgentIndex = agentIds.findIndex(
      (agentId) => world.agents[agentId]?.homeId === placeId,
    );
    const point = pointForPlace(
      placeId,
      Math.max(0, homeAgentIndex),
      world,
    );
    let placeElement = placeElements.get(placeId);
    if (!placeElement) {
      placeElement = document.createElement('button');
      placeElement.setAttribute('type', 'button');
      placeElement.className = `map-place map-place--${place.kind}`;
      placeElement.innerHTML = `
        <span class="place-building" aria-hidden="true">
          <span class="place-symbol"></span>
        </span>
        <span class="place-label"></span>
        <span class="place-count">0</span>
      `;
      placeElement.addEventListener('click', () => {
        openWorldInspector('place', placeId);
      });
      placesLayer.append(placeElement);
      placeElements.set(placeId, placeElement);
    }
    placeElement.className = `map-place map-place--${place.kind} map-place--surface-${place.surface}`;
    placeElement.classList.toggle(
      'is-territory-claimed',
      place.claimedBySettlementId !== undefined,
    );
    placeElement.dataset.claimedBy = place.claimedBySettlementId ?? '';
    placeElement.classList.toggle('is-highlighted', highlightedPlaceIds.has(placeId));
    placeElement.style.left = `${point.x}%`;
    placeElement.style.top = `${point.y}%`;
    placeElement.setAttribute('aria-label', point.label);
    const symbol = placeElement.querySelector<HTMLElement>('.place-symbol');
    const label = placeElement.querySelector<HTMLElement>('.place-label');
    if (symbol) symbol.textContent = point.symbol;
    if (label) label.textContent = point.label;
  }
}

function renderWildlife(world: Readonly<WorldState>): void {
  const liveIds = new Set(Object.keys(world.wildlife));
  for (const [populationId, element] of wildlifeElements) {
    if (liveIds.has(populationId)) continue;
    element.remove();
    wildlifeElements.delete(populationId);
  }
  for (const [populationId, population] of Object.entries(world.wildlife)) {
    const habitat = pointForPlace(population.habitatId, 0, world);
    const offsets: Record<WildlifeSpecies, { x: number; y: number }> = {
      rabbit: { x: 6, y: 4 },
      deer: { x: 7, y: 5 },
      fish: { x: 4, y: 5 },
      boar: { x: 5, y: 5 },
      wolf: { x: -5, y: 4 },
      bird: { x: 3, y: -5 },
      dire_wolf: { x: -7, y: 6 },
      ogre: { x: 7, y: -6 },
      wraith: { x: -6, y: -6 },
    };
    const offset = offsets[population.species];
    let element = wildlifeElements.get(populationId);
    if (!element) {
      element = document.createElement('button');
      element.setAttribute('type', 'button');
      element.className = `wildlife-population wildlife-population--${population.species}`;
      element.innerHTML = `
        <span class="wildlife-icon" aria-hidden="true">${wildlifeIcons[population.species]}</span>
        <span class="wildlife-count"></span>
      `;
      element.addEventListener('click', () => {
        openWorldInspector('wildlife', populationId);
      });
      wildlifeLayer.append(element);
      wildlifeElements.set(populationId, element);
    }

    element.style.left = `${clampMapCoordinate(habitat.x + offset.x)}%`;
    element.style.top = `${clampMapCoordinate(habitat.y + offset.y)}%`;

    const label = wildlifeLabels[population.species];
    const count = element.querySelector<HTMLElement>('.wildlife-count');
    if (count) count.textContent = String(population.count);
    element.setAttribute(
      'aria-label',
      `${label}: ${population.count} из ${population.carryingCapacity}`,
    );
    element.classList.toggle('is-depleted', population.count === 0);
    element.classList.toggle('is-monster', population.isMonster === true);
  }
}

function ensureAvatar(
  agent: Readonly<AgentState>,
  index: number,
): HTMLButtonElement {
  const existing = avatarElements.get(agent.id);
  if (existing) return existing;

  const avatar = document.createElement('button');
  avatar.type = 'button';
  avatar.className = 'resident-avatar';
  avatar.style.setProperty('--resident-index', String(index));
  avatar.innerHTML = `
    <span class="action-bubble" aria-hidden="true">•</span>
    <span class="resident-figure" aria-hidden="true">
      <span class="resident-shadow"></span>
      <span class="resident-head"><span class="resident-hair"></span></span>
      <span class="resident-arm resident-arm--left"></span>
      <span class="resident-arm resident-arm--right"></span>
      <span class="resident-body"></span>
      <span class="resident-leg resident-leg--left"></span>
      <span class="resident-leg resident-leg--right"></span>
    </span>
    <span class="resident-nameplate"></span>
  `;

  const nameplate = avatar.querySelector<HTMLElement>('.resident-nameplate');
  if (!nameplate) throw new Error('Resident nameplate was not created.');
  nameplate.textContent = agent.name;

  avatar.addEventListener('click', () => {
    selectedAgentId = agent.id;
    updateSelection();
    openWorldInspector('resident', agent.id);
  });

  agentsLayer.append(avatar);
  avatarElements.set(agent.id, avatar);
  return avatar;
}

function strongestTraits(agent: Readonly<AgentState>): string {
  return (Object.entries(agent.personality) as Array<
    [keyof AgentState['personality'], number]
  >)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([trait]) => traitLabels[trait])
    .join(' · ');
}

function strongestSkill(agent: Readonly<AgentState>): string {
  const strongest = (Object.entries(agent.skills) as Array<
    [keyof AgentState['skills'], number]
  >).sort((a, b) => b[1] - a[1])[0];
  const progression = agent.progression;
  const level = progression?.level ?? 1;
  const control = Math.round((progression?.objectControlAuthority ?? 0) * 100);
  const system = Math.round((progression?.systemControlAuthority ?? 0) * 100);
  return `ур. ${level} · ${skillLabels[strongest[0]]} ${Math.round(strongest[1] * 100)}% · OC ${control}% · SC ${system}%`;
}

function emotionalSummary(agent: Readonly<AgentState>): string {
  return (Object.entries(agent.mind.emotions) as Array<
    [keyof AgentState['mind']['emotions'], number]
  >)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([emotion, value]) => `${emotionLabels[emotion]} ${Math.round(value * 100)}%`)
    .join(' · ');
}

function physiologySummary(agent: Readonly<AgentState>): string {
  const physiology = (
    agent.life as AgentState['life'] & {
      physiology?: AgentState['life']['physiology'];
    }
  ).physiology ?? {
    strength: agent.life.stage === 'elder' ? 0.45 : 0.75,
    endurance: agent.life.stage === 'elder' ? 0.42 : 0.72,
    mobility: agent.life.stage === 'elder' ? 0.4 : 0.76,
    recovery: agent.life.stage === 'elder' ? 0.35 : 0.74,
  };
  const bodyState =
    physiology.strength >= 0.82
      ? 'сильный'
      : physiology.mobility < 0.36
        ? 'немощный'
        : physiology.endurance < 0.52
          ? 'быстро устаёт'
          : 'в норме';
  return `${bodyState} · сила ${Math.round(physiology.strength * 100)}% · выносливость ${Math.round(physiology.endurance * 100)}%`;
}

function closestRelationship(
  world: Readonly<WorldState>,
  agentId: string,
): RelationshipState | undefined {
  return Object.values(world.relationships)
    .filter(
      (relationship) =>
        relationship.agentA === agentId || relationship.agentB === agentId,
    )
    .sort(
      (a, b) =>
        b.trust + b.affinity + b.respect - b.conflict -
        (a.trust + a.affinity + a.respect - a.conflict),
    )[0];
}

function syncResidentPicker(
  world: Readonly<WorldState>,
  agents: readonly AgentState[],
): void {
  const sorted = [...agents].sort(
    (left, right) => left.name.localeCompare(right.name, 'ru') || left.id.localeCompare(right.id),
  );
  const signature = sorted
    .map((agent) => {
      const livelihood = world.v18?.livelihoodByAgentId[agent.id];
      return `${agent.id}:${agent.name}:${livelihood?.primary ?? 'undecided'}`;
    })
    .join('|');
  if (signature !== residentPickerSignature) {
    residentPickerSignature = signature;
    const options = sorted.map((agent) => {
      const option = document.createElement('option');
      option.value = agent.id;
      const livelihood = world.v18?.livelihoodByAgentId[agent.id];
      option.textContent = `${agent.name} · ${livelihoodLabels[livelihood?.primary ?? 'undecided']}`;
      return option;
    });
    residentPicker.replaceChildren(...options);
  }
  if (selectedAgentId) residentPicker.value = selectedAgentId;
}

function updateSelection(): void {
  if (!lastFrame) return;

  const agents = Object.values(lastFrame.world.agents).filter(
    (agent) => agent.life.alive,
  );
  const selected =
    agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];
  if (!selected) return;
  selectedAgentId = selected.id;
  residentPicker.value = selected.id;

  for (const [agentId, avatar] of avatarElements) {
    const isSelected = agentId === selected.id;
    avatar.classList.toggle('is-selected', isSelected);
    avatar.setAttribute('aria-pressed', String(isSelected));
  }

  residentPortrait.textContent = selected.name.slice(0, 1).toUpperCase();
  residentPortrait.style.setProperty(
    '--portrait-index',
    String(agents.findIndex((agent) => agent.id === selected.id)),
  );
  residentName.textContent = selected.name;
  residentActivity.textContent = selected.movement
    ? `в пути · ${actionLabels[selected.movement.purpose]}`
    : selected.lastAction
      ? actionLabels[selected.lastAction]
      : 'осматривается';
  residentPlace.textContent = displayPlaceName(lastFrame.world, selected);
  residentGoal.textContent = goalLabels[selected.goal.kind];
  const age = ageParts(selected.life.ageYears);
  residentLife.textContent = `${age.years} лет ${age.months} мес · ${raceLabels[selected.race ?? 'human']} · поколение ${selected.life.generation} · ${
    selected.origin === 'native' ? 'рождён здесь' : 'вошёл извне'
  }`;
  residentEmotion.textContent = emotionalSummary(selected);
  residentPhysiology.textContent = physiologySummary(selected);
  residentTraits.textContent = strongestTraits(selected);
  const livelihood = lastFrame.world.v18?.livelihoodByAgentId[selected.id];
  residentProfession.textContent = livelihood
    ? `${livelihoodLabels[livelihood.primary]} · ${livelihoodStageLabels[livelihood.stage]}`
    : 'запись создаётся';
  residentSkill.textContent = strongestSkill(selected);

  if (selected.lastDecision) {
    const openness = Math.round(selected.lastDecision.openness * 100);
    residentChoice.textContent = `${selected.lastDecision.consideredActionCount} варианта · ${openness}%`;
    residentChoice.title =
      selected.lastDecision.action === selected.lastDecision.dominantAction
        ? 'Выбран самый привлекательный вариант'
        : `Выбран неочевидный вариант вместо «${actionLabels[selected.lastDecision.dominantAction]}»`;
  } else {
    residentChoice.textContent = 'первое решение впереди';
    residentChoice.removeAttribute('title');
  }

  const relationship = closestRelationship(lastFrame.world, selected.id);
  if (relationship) {
    const otherId =
      relationship.agentA === selected.id
        ? relationship.agentB
        : relationship.agentA;
    const other = lastFrame.world.agents[otherId];
    relationshipNote.textContent = other
      ? other.life.alive
        ? `Ближе всего: ${other.name} · доверие ${Math.round(relationship.trust * 100)}%`
        : `Помнит ${other.name} · связь не исчезла после смерти`
      : 'Связи продолжают меняться.';
  } else {
    relationshipNote.textContent = 'Связи ещё формируются.';
  }

  const setNeed = (
    value: number,
    valueElement: HTMLElement,
    barElement: HTMLElement,
  ) => {
    const percent = Math.round(value * 100);
    valueElement.textContent = `${percent}%`;
    barElement.style.width = `${percent}%`;
  };

  setNeed(selected.energy, energyValue, energyBar);
  setNeed(selected.stress, stressValue, stressBar);
  setNeed(selected.resources, personalResourceValue, personalResourceBar);
  setNeed(
    lastFrame.world.v18?.lifeRhythmByAgentId[selected.id]?.satiety ??
      selected.resources,
    satietyValue,
    satietyBar,
  );
  setNeed(selected.needs.belonging, belongingValue, belongingBar);
  setNeed(selected.needs.purpose, purposeValue, purposeBar);
}

function eventAgentName(
  event: Readonly<WorldEvent>,
  world: Readonly<WorldState>,
): string {
  const agentId = event.payload.agentId;
  return typeof agentId === 'string'
    ? world.agents[agentId]?.name ?? 'Житель'
    : 'Житель';
}

function eventText(
  event: Readonly<WorldEvent>,
  world: Readonly<WorldState>,
): string | undefined {
  const name = eventAgentName(event, world);
  switch (event.kind) {
    case 'agent.rested':
      return `${name} решил отдохнуть`;
    case 'agent.relaxed':
      return `${name} отдыхает на природе`;
    case 'agent.walked':
      return `${name} отправился гулять`;
    case 'agent.gathered':
      return `${name} добыл ${
        event.payload.material === 'food'
          ? 'пищу'
          : event.payload.material === 'wood'
            ? 'дерево'
            : event.payload.material === 'stone'
              ? 'камень'
              : event.payload.material === 'metal'
                ? 'металл'
                : event.payload.material === 'fuel'
                  ? 'топливо'
                  : 'ресурсы'
      }`;
    case 'agent.hunted': {
      const species = event.payload.species;
      const label =
        typeof species === 'string' && species in wildlifeLabels
          ? wildlifeLabels[species as WildlifeSpecies].toLowerCase()
          : 'дичь';
      return event.payload.succeeded
        ? `${name} добыл: ${label}`
        : `${name} вернулся с охоты без добычи`;
    }
    case 'agent.worked':
      return `${name} работает в мастерской`;
    case 'agent.explored':
      if (typeof event.payload.discoveredRegionId === 'string') {
        return `${name} открыл: ${
          publicPlacePoints[event.payload.discoveredRegionId]?.label ??
          world.places[event.payload.discoveredRegionId]?.name ??
          event.payload.discoveredRegionId
        }`;
      }
      return event.payload.discovered
        ? `${name} нашёл новые ресурсы`
        : `${name} исследует окраину`;
    case 'agent.reflected':
      return `${name} ушёл поразмышлять`;
    case 'agent.prayed':
      return `${name} пытается понять тайны мира`;
    case 'agent.bond.accepted':
      return `${name} стал кому-то ближе`;
    case 'agent.bond.declined':
      return `${name} получил время всё обдумать`;
    case 'agent.born':
      return `${name} родился — началась новая жизнь`;
    case 'agent.died':
      return event.payload.cause === 'monster'
        ? `${name} погиб при встрече с чудовищем`
        : event.payload.cause === 'war'
          ? `${name} погиб в столкновении поселений`
          : event.payload.cause === 'contamination'
            ? `${name} умер из-за заражения местности`
        : `${name} умер, но его история осталась в мире`;
    case 'agent.life.stage_changed':
      return `${name} перешёл в новый период жизни`;
    case 'agent.socialize.blocked':
      return `${name} не смог найти компанию`;
    case 'agent.help.accepted': {
      const targetId = event.payload.targetId;
      const target =
        typeof targetId === 'string' ? world.agents[targetId]?.name : undefined;
      return `${name} помог${target ? ` ${target}` : ' другому жителю'}`;
    }
    case 'agent.help.rejected':
      return `Помощь ${name} не приняли`;
    case 'agent.goal.changed': {
      const next = event.payload.next;
      return typeof next === 'string' && next in goalLabels
        ? `${name}: новая цель — ${goalLabels[next as AgentState['goal']['kind']]}`
        : `${name} сменил цель`;
    }
    case 'relationship.changed': {
      const a = event.payload.agentA;
      const b = event.payload.agentB;
      const sentiment = event.payload.sentiment;
      const aName = typeof a === 'string' ? world.agents[a]?.name : undefined;
      const bName = typeof b === 'string' ? world.agents[b]?.name : undefined;
      if (!aName || !bName) return 'Между жителями изменилась связь';
      return typeof sentiment === 'number' && sentiment < -0.18
        ? `${aName} и ${bName} поспорили`
        : `${aName} и ${bName} пообщались`;
    }
    case 'world.disturbance.resource_shock':
      return 'Мир пережил ресурсный удар';
    case 'world.effect.social_barrier':
      return 'Общаться стало труднее';
    case 'world.effect.safety_shock':
      return 'В мире выросла опасность';
    case 'world.region.discovered': {
      const regionId = event.payload.regionId;
      return typeof regionId === 'string'
        ? `Карта выросла: ${
            publicPlacePoints[regionId]?.label ??
            world.places[regionId]?.name ??
            regionId
          }`
        : 'Жители открыли новую территорию';
    }
    case 'world.wildlife.recovered': {
      const species = event.payload.species;
      return typeof species === 'string' && species in wildlifeLabels
        ? `${wildlifeLabels[species as WildlifeSpecies]} размножаются`
        : 'Популяция животных восстанавливается';
    }
    case 'world.wildlife.depleted':
      return 'Одна из популяций животных исчезла из поля зрения';
    case 'world.monster.encountered': {
      const species = event.payload.species;
      const monster =
        typeof species === 'string' && species in wildlifeLabels
          ? wildlifeLabels[species as WildlifeSpecies].toLowerCase()
          : 'чудовище';
      return `${name} встретил в глуши: ${monster}`;
    }
    case 'world.monster.hunted_prey': {
      const monsterSpecies = event.payload.monsterSpecies;
      const preySpecies = event.payload.preySpecies;
      const monster =
        typeof monsterSpecies === 'string' && monsterSpecies in wildlifeLabels
          ? wildlifeLabels[monsterSpecies as WildlifeSpecies]
          : 'Чудовище';
      const prey =
        typeof preySpecies === 'string' && preySpecies in wildlifeLabels
          ? wildlifeLabels[preySpecies as WildlifeSpecies].toLowerCase()
          : 'добычу';
      return `${monster} добыл пищу: ${prey}`;
    }
    case 'world.monster.fed': {
      const monsterSpecies = event.payload.monsterSpecies;
      const monster =
        typeof monsterSpecies === 'string' && monsterSpecies in wildlifeLabels
          ? wildlifeLabels[monsterSpecies as WildlifeSpecies]
          : 'Чудовище';
      return `${monster} убил путника и питался его телом`;
    }
    case 'world.monster.hunger': {
      const monsterSpecies = event.payload.monsterSpecies;
      const monster =
        typeof monsterSpecies === 'string' && monsterSpecies in wildlifeLabels
          ? wildlifeLabels[monsterSpecies as WildlifeSpecies]
          : 'Чудовища';
      return `${monster}: популяция сократилась без доступной добычи`;
    }
    case 'world.sapient_race.emerged':
    case 'world.sapient_people.discovered': {
      const race = String(event.payload.race ?? 'unknown');
      const label =
        race === 'goblin'
          ? 'гоблинов'
          : race === 'orc'
            ? 'орков'
            : race === 'ogre'
              ? 'огров'
              : race;
      return event.kind === 'world.sapient_people.discovered'
        ? `Жители открыли самостоятельный разумный народ: ${label}`
        : `В мире возник самостоятельный разумный народ: ${label}`;
    }
    case 'agent.level.changed':
      return `${name} достиг уровня ${String(event.payload.level ?? '?')}`;
    case 'world.settlement.founded':
      return `Жители основали ${String(event.payload.name ?? 'новое поселение')}`;
    case 'agent.resettled':
      return `${name} добровольно переселился в другое поселение`;
    case 'world.building.home_built':
      return 'Жители построили новый дом из местных материалов';
    case 'world.item.tool_crafted':
      return event.payload.toolKind === 'farming'
        ? 'Мастер изготовил земледельческий инструмент'
        : 'Мастер изготовил строительный инструмент';
    case 'world.settlement.contact':
      return 'Представители двух поселений встретились на дороге';
    case 'world.territory.claimed': {
      const placeId = event.payload.placeId;
      return typeof placeId === 'string'
        ? `Поселение заявило землю: ${world.places[placeId]?.name ?? placeId}`
        : 'Поселение заявило право на землю';
    }
    case 'world.settlement.war_started':
      return 'Между поселениями началась война по решению её участников';
    case 'world.settlement.conflict':
      return event.payload.conflictKind === 'land'
        ? 'Поселения столкнулись за спорную землю'
        : 'Поселения совершили вооружённый набег за ресурсами';
    case 'world.settlement.peace':
      return 'Участники прекратили войну';
    case 'world.cemetery.established':
      return 'Жители отвели место под кладбище';
    case 'world.resident.buried': {
      return name === 'Житель'
        ? 'Жители похоронили умершего'
        : `Жители похоронили ${name}`;
    }
    case 'world.city.emerged':
      return `${String(event.payload.name ?? 'Поселение')} выросло в город`;
    case 'world.migrated':
      return 'Старый мир продолжен по новым правилам';
    case 'world.tradition.emerged':
      return 'В мире родилась новая традиция';
    case 'world.entry.resident_manifested':
      return 'В мир вошёл новый внешний житель';
    case 'world.entry.deity_manifested':
      return 'Мир почувствовал присутствие неизвестной силы';
    case 'world.omen.aurora':
    case 'world.omen.voice':
    case 'world.omen.eclipse':
    case 'world.omen.miracle':
    case 'world.omen.storm_sign':
      return 'Жители стали свидетелями необъяснимого знамения';
    case 'world.omen.natural.sky_lights':
    case 'world.omen.natural.distant_voice':
    case 'world.omen.natural.silent_storm':
    case 'world.omen.natural.ruin_echo':
      return 'В мире произошло необъяснимое явление';
    case 'cardinal.world_law.changed':
      return 'Cardinal предложил новый закон, gateway его разрешил';
    case 'cardinal.catastrophe.wildfire':
    case 'cardinal.catastrophe.flood':
    case 'cardinal.catastrophe.epidemic':
    case 'cardinal.catastrophe.earthquake':
    case 'cardinal.catastrophe.drought':
      return 'Мир переживает разрешённую системную катастрофу';
    case 'cardinal.intervention.resource_relief':
      return 'Gateway подтвердил ресурсную помощь';
    case 'cardinal.effect.open_shared_space':
      return 'Gateway временно открыл общее пространство';
    case 'cardinal.effect.safety_support':
      return 'Gateway подтвердил поддержку безопасности';
    case 'cardinal.effect.habitat_support':
      return 'Gateway временно поддержал восстановление среды';
    default:
      return undefined;
  }
}

function compactAinkradWorldTime(worldMinutes: number): string {
  const calendar = worldCalendarAtMinutes(worldMinutes);
  return `Г${calendar.year} · Д${calendar.dayOfYear}`;
}

function renderEventFeed(frame: Readonly<LiveWorldFrame>): void {
  const items = [...frame.recentEvents]
    .reverse()
    .map((event) => ({ event, text: eventText(event, frame.world) }))
    .filter((item): item is { event: WorldEvent; text: string } =>
      Boolean(item.text),
    )
    .slice(0, 6);

  eventFeed.replaceChildren();
  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = 'Мир спокойно проживает этот момент.';
    eventFeed.append(empty);
    return;
  }

  for (const item of items) {
    const element = document.createElement('li');
    element.innerHTML = '<span></span><p></p>';
    const time = element.querySelector('span');
    if (time) {
      time.textContent = item.event.occurredWorldMinutes === undefined
        ? 'старое время'
        : compactAinkradWorldTime(item.event.occurredWorldMinutes);
      time.title = item.event.occurredWorldMinutes === undefined
        ? 'Время старой записи не указано в canonical world minutes.'
        : formatAinkradWorldTime(item.event.occurredWorldMinutes);
    }
    const text = element.querySelector('p');
    if (text) text.textContent = item.text;
    eventFeed.append(element);
  }
}

function renderAudibleConversations(frame: Readonly<LiveWorldFrame>): void {
  const conversations = [...(frame.world.v18?.recentConversations ?? [])]
    .filter((conversation) => conversation.observerAudible)
    .sort((left, right) => right.worldMinute - left.worldMinute)
    .slice(0, 3);
  conversationFeed.replaceChildren();
  if (conversations.length === 0) {
    conversationFeed.textContent = 'Пока рядом не слышно разговора.';
    return;
  }
  for (const conversation of conversations) {
    const item = document.createElement('article');
    const speaker = frame.world.agents[conversation.speakerId]?.name ?? 'Житель';
    const listener = frame.world.agents[conversation.listenerId]?.name ?? 'собеседник';
    const place = frame.world.places[conversation.placeId]?.name ?? conversation.placeId;
    const heading = document.createElement('span');
    heading.textContent = `${speaker} → ${listener} · ${localizedPlaceName(place)}`;
    const quote = document.createElement('p');
    quote.textContent = `«${conversation.utterance}»`;
    const reply = document.createElement('p');
    reply.textContent = `${listener}: «${conversation.reply}»`;
    item.append(heading, quote, reply);
    conversationFeed.append(item);
  }
}

function announceDisturbance(frame: Readonly<LiveWorldFrame>): void {
  const disturbance = frame.disturbances[0];
  if (!disturbance) {
    disturbanceBanner.classList.remove('is-visible');
    return;
  }

  disturbanceBanner.textContent =
    disturbance.kind === 'resource_shock'
      ? '⚠ Ресурсный удар — жители решают сами'
      : disturbance.kind === 'social_barrier'
        ? '⚠ Социальный барьер'
        : '⚠ Угроза безопасности';
  disturbanceBanner.classList.add('is-visible');
}

function updateWorldTime(frame: Readonly<LiveWorldFrame>): void {
  const elapsedWorldMinutes = frame.world.calendar.elapsedWorldMinutes;
  const calendar = worldCalendarAtMinutes(elapsedWorldMinutes);
  worldMap.dataset.phase = calendar.phase;
  const clock = `${String(calendar.hour).padStart(2, '0')}:${String(calendar.minute).padStart(2, '0')}`;
  timeValue.textContent = `год ${calendar.year} · день ${calendar.dayOfYear} · ${clock}`;
  timeValue.title = `Прошло ${calendar.totalDays} дней мира`;
  const elapsedYears = elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR;
  tickValue.textContent = elapsedYears >= 1
    ? `${elapsedYears.toFixed(1)} г.`
    : `${Math.floor(elapsedWorldMinutes / 1_440)} дн.`;
  mapTimeValue.textContent = `${phaseLabels[calendar.phase]} · ${seasonLabels[calendar.season]}`;
}

function persistOfflineClockAnchor(
  frame: Readonly<LiveWorldFrame>,
  wallClockMs = Date.now(),
  speedId = frame.clock.speedId,
  multiplier = frame.clock.multiplier,
): void {
  if (!offlineClockStorageAvailable) return;
  const worldMinutes = Math.max(
    frame.world.calendar.elapsedWorldMinutes,
    offlineCatchUpTargetWorldMinutes ?? 0,
  );
  try {
    localStorage.setItem(
      OFFLINE_CLOCK_ANCHOR_KEY,
      JSON.stringify(
        makeOfflineWorldClockAnchor({
          worldEpoch: frame.world.epoch ?? 1,
          worldMinutes,
          wallClockMs,
          speedId,
          multiplier,
        }),
      ),
    );
  } catch {
    offlineClockStorageAvailable = false;
  }
}

function requestOfflineCatchUp(
  frame: Readonly<LiveWorldFrame>,
  anchor: Readonly<OfflineWorldClockAnchor> | undefined,
  nowWallClockMs = Date.now(),
): void {
  if (!anchor) return;
  const currentWorldMinutes = frame.world.calendar.elapsedWorldMinutes;
  const target = offlineWorldMinuteTarget({
    anchor,
    currentWorldEpoch: frame.world.epoch ?? 1,
    currentWorldMinutes,
    nowWallClockMs,
  });
  if (target === undefined || target <= currentWorldMinutes + 1e-7) return;

  const previousTarget = offlineCatchUpTargetWorldMinutes ?? currentWorldMinutes;
  offlineCatchUpTargetWorldMinutes = Math.max(previousTarget, target);
  if (offlineCatchUpTargetWorldMinutes <= previousTarget + 1e-7) return;
  catchUpOverlay.hidden = false;
  catchUpTitle.textContent = `Догоняем ${worldDurationDescription(
    offlineCatchUpTargetWorldMinutes - currentWorldMinutes,
  )}`;
  catchUpPercent.textContent = '0%';
  catchUpBar.style.width = '0%';
  catchUpDetail.textContent =
    'Запущен быстрый пакетный расчёт. Карта временно не перерисовывается, но мир продолжает жить.';
  liveWorldWorker.postMessage({
    type: 'catch_up_world_time',
    worldEpoch: frame.world.epoch ?? 1,
    targetWorldMinutes: offlineCatchUpTargetWorldMinutes,
  });
}

function resumeOfflineClockFromStoredAnchor(
  frame: Readonly<LiveWorldFrame>,
): void {
  if (!offlineClockStorageAvailable) return;
  try {
    requestOfflineCatchUp(
      frame,
      parseOfflineWorldClockAnchor(
        localStorage.getItem(OFFLINE_CLOCK_ANCHOR_KEY),
      ),
    );
  } catch {
    offlineClockStorageAvailable = false;
  }
}

function updateOfflineClockContinuity(frame: Readonly<LiveWorldFrame>): void {
  const currentWorldMinutes = frame.world.calendar.elapsedWorldMinutes;
  if (!offlineClockAnchorChecked) {
    offlineClockAnchorChecked = true;
    requestOfflineCatchUp(frame, pendingOfflineClockAnchor);
    pendingOfflineClockAnchor = undefined;
  }

  const remaining = Math.max(
    0,
    (offlineCatchUpTargetWorldMinutes ?? currentWorldMinutes) -
      currentWorldMinutes,
  );
  if (remaining > 1e-7) {
    offlineClockStatus.textContent =
      `Мир догоняет ${worldDurationDescription(remaining)} после закрытой вкладки · Cardinal не управляет временем`;
    offlineClockStatus.classList.add('is-catching-up');
  } else {
    offlineCatchUpTargetWorldMinutes = undefined;
    offlineClockStatus.textContent = offlineClockStorageAvailable
      ? 'После закрытия мир продолжит время при следующем открытии · Cardinal не имеет доступа'
      : 'Браузер запретил сохранение фонового времени · Cardinal не имеет доступа';
    offlineClockStatus.classList.remove('is-catching-up');
  }
  persistOfflineClockAnchor(frame);
}

function updateWorld(frame: Readonly<LiveWorldFrame>): void {
  lastFrame = structuredClone(frame);
  updateWorldMapScale(frame.world);
  worldMap.dataset.growth = String(Math.min(3, frame.world.growth.stage));
  renderBiomes(frame.world);
  renderSettlements(frame.world);
  renderPlaces(frame.world);
  renderRoads(frame.world);
  renderWildlife(frame.world);

  const agents = Object.values(frame.world.agents).filter(
    (agent) => agent.life.alive,
  );
  syncResidentPicker(frame.world, agents);
  const livingAgentIds = new Set(agents.map((agent) => agent.id));
  for (const [agentId, avatar] of avatarElements) {
    if (livingAgentIds.has(agentId)) continue;
    avatar.remove();
    avatarElements.delete(agentId);
  }
  if (!selectedAgentId) selectedAgentId = agents[0]?.id;

  const occupancy = new Map<string, AgentState[]>();
  for (const agent of agents) {
    const residents = occupancy.get(agent.locationId) ?? [];
    residents.push(agent);
    occupancy.set(agent.locationId, residents);
  }

  for (const [placeId, element] of placeElements) {
    const count = occupancy.get(placeId)?.length ?? 0;
    const badge = element.querySelector<HTMLElement>('.place-count');
    if (badge) badge.textContent = String(count);
    element.classList.toggle('is-active', count > 0);
  }

  agents.forEach((agent, index) => {
    const avatar = ensureAvatar(agent, index);
    const persistedPosition = projectedResidentPosition(
      agent,
      frame.world,
      frame.tick,
    );
    const base = persistedPosition
      ? normalizeWorldCoordinates(
          frame.world,
          persistedPosition.x,
          persistedPosition.y,
        )
      : pointForPlace(agent.locationId, index, frame.world);
    const residentsHere = occupancy.get(agent.locationId) ?? [agent];
    const localIndex = residentsHere.findIndex((item) => item.id === agent.id);
    const angle =
      (Math.PI * 2 * localIndex) / Math.max(1, residentsHere.length);
    const radius = agent.movement ? 0 : Math.min(1.7, residentsHere.length * 0.35);
    const x = clampMapCoordinate(base.x + Math.cos(angle) * radius);
    const y = clampMapCoordinate(base.y + Math.sin(angle) * radius * 0.72);
    const isMoving = Boolean(agent.movement);

    avatar.style.left = `${x}%`;
    avatar.style.top = `${y}%`;
    avatar.classList.toggle('is-moving', isMoving);
    avatar.classList.toggle(
      'is-ambient',
      !isMoving && agent.lastAction !== 'rest',
    );
    avatar.classList.toggle('is-resting', agent.lastAction === 'rest');
    avatar.classList.toggle('is-relaxing', agent.lastAction === 'relax');
    avatar.classList.toggle('is-walking', agent.lastAction === 'walk');
    avatar.classList.toggle('is-hunting', agent.lastAction === 'hunt');
    avatar.classList.toggle('is-reflecting', agent.lastAction === 'reflect');
    avatar.classList.toggle('is-socializing', agent.lastAction === 'socialize');
    avatar.classList.toggle('is-helping', agent.lastAction === 'help');
    avatar.classList.toggle('is-child', agent.life.stage === 'child');
    avatar.classList.toggle(
      'is-adolescent',
      agent.life.stage === 'adolescent',
    );
    avatar.classList.toggle('is-elder', agent.life.stage === 'elder');
    const physiology = (
      agent.life as Partial<AgentState['life']>
    ).physiology;
    const mobility = physiology?.mobility ?? 0.72;
    avatar.style.setProperty(
      '--walk-duration',
      `${Math.round(280 + (1 - mobility) * 520)}ms`,
    );
    avatar.dataset.lifeStage = agent.life.stage;
    avatar.dataset.action = agent.lastAction ?? 'idle';

    const actionBubble = avatar.querySelector<HTMLElement>('.action-bubble');
    if (actionBubble) {
      const visibleAction = agent.movement?.purpose ?? agent.lastAction;
      actionBubble.textContent = visibleAction
        ? actionIcons[visibleAction]
        : '•';
    }

    avatar.setAttribute(
      'aria-label',
      `${agent.name}: ${
        agent.movement
          ? `идёт: ${actionLabels[agent.movement.purpose]}`
          : agent.lastAction
            ? actionLabels[agent.lastAction]
            : 'осматривается'
      }, ${displayPlaceName(frame.world, agent)}`,
    );
  });

  const humanPopulation = agents.filter(
    (agent) => (agent.race ?? 'human') === 'human',
  ).length;
  populationValue.textContent = `${humanPopulation} людей · ${agents.length} разумных`;
  growthValue.textContent = `${Object.keys(frame.world.places).length} мест · +${Math.round(
    frame.world.growth.explorationProgress * 100,
  )}%`;
  wildlifeValue.textContent = String(
    Object.values(frame.world.wildlife).reduce(
      (sum, population) =>
        sum + (population.isMonster === true ? 0 : population.count),
      0,
    ),
  );
  monsterValue.textContent = String(
    Object.values(frame.world.wildlife).reduce(
      (sum, population) =>
        sum + (population.isMonster === true ? population.count : 0),
      0,
    ),
  );
  resourceValue.textContent = `${Math.round(frame.world.environment.resourcePool * 100)}%`;
  evaluationValue.textContent = String(frame.evaluationCount);
  interventionValue.textContent = String(frame.executedInterventionCount);
  const cardinalActivity = frame.cardinalActivity ?? {
    proposalCount: 0,
    authorizationDecisionCount: frame.executedInterventionCount,
    deniedInterventionCount: 0,
    authorizedWorldChangeCount: 0,
  };
  proposalValue.textContent = String(cardinalActivity.proposalCount);
  worldChangeValue.textContent = String(
    cardinalActivity.authorizedWorldChangeCount,
  );
  proposalValue.title =
    `Решений gateway: ${cardinalActivity.authorizationDecisionCount}; отклонено: ${cardinalActivity.deniedInterventionCount}`;
  if (frame.evaluation?.experience) {
    cardinalLevelValue.textContent = String(frame.evaluation.experience.level);
    cardinalStatusLevel.textContent = `ур. ${frame.evaluation.experience.level}`;
    cardinalXpValue.textContent = String(
      frame.evaluation.experience.totalExperience,
    );
    cardinalCapabilities.textContent = frame.evaluation.experience.capabilities
      .map((capability) => cardinalCapabilityLabels[capability])
      .join(' · ');
  }
  updateWorldTime(frame);
  if (frame.clock) {
    preferredSpeedId = frame.clock.speedId;
    preferredSpeedMultiplier = frame.clock.multiplier;
    showClockControl(frame.clock.speedId, frame.clock.multiplier);
  }
  updateOfflineClockContinuity(frame);

  if (frame.continuity.durable) {
    saveValue.textContent = frame.continuity.resumed
      ? `Продолжен: ${formatAinkradWorldTime(frame.continuity.resumedFromWorldMinutes)}`
      : 'Сохраняется';
    saveValue.classList.add('is-saved');
  } else {
    saveValue.textContent = 'Только сеанс';
    saveValue.classList.remove('is-saved');
  }

  if (frame.continuity.resumed && !continuityAnnounced) {
    liveLabel.textContent = 'МИР ПРОДОЛЖЕН';
    continuityAnnounced = true;
  } else {
    liveLabel.textContent = 'МИР ЖИВЁТ';
  }
  liveIndicator.classList.add('is-live');

  const unlocked = frame.evaluation?.experience.newlyUnlockedCapabilities ?? [];
  if (frame.worldAuthority?.authorized) {
    cardinalMessage.textContent =
      'Cardinal доказал необходимость изменения правила. Независимый gateway разрешил ограниченную поправку.';
  } else if (unlocked.length > 0) {
    cardinalMessage.textContent = `Cardinal освоил: ${unlocked
      .map((capability) => cardinalCapabilityLabels[capability])
      .join(', ')}. Воля жителей не изменилась.`;
  } else if (frame.intervention?.executed) {
    cardinalMessage.textContent =
      'Cardinal предложил меру. Независимый gateway проверил и выполнил её.';
  } else if (frame.intervention && !frame.intervention.executed) {
    cardinalMessage.textContent =
      'Gateway отклонил предложение Cardinal: условия безопасности не выполнены.';
  } else if (frame.evaluation?.proposal) {
    cardinalMessage.textContent =
      'Cardinal обнаружил риск и передал предложение независимому gateway.';
  } else if (frame.evaluation?.deferReason) {
    cardinalMessage.textContent =
      cardinalDeferLabels[frame.evaluation.deferReason];
  } else {
    cardinalMessage.textContent =
      'Сейчас порог системного риска не достигнут. Cardinal наблюдает, а не изображает бурную деятельность.';
  }

  const lastCardinalEvent = cardinalActivity.lastCardinalEvent;
  if (lastCardinalEvent) {
    cardinalLastAction.textContent =
      `Последнее действие · ${
        lastCardinalEvent.occurredWorldMinutes === undefined
          ? 'время старой записи не указано'
          : formatAinkradWorldTime(lastCardinalEvent.occurredWorldMinutes)
      }: ${eventText(
        lastCardinalEvent,
        frame.world,
      ) ?? lastCardinalEvent.kind}`;
    cardinalLastAction.classList.add('has-action');
  } else if (
    cardinalActivity.authorizationDecisionCount > 0 ||
    cardinalActivity.authorizedWorldChangeCount > 0
  ) {
    cardinalLastAction.textContent =
      `Последнее действие: подробная запись уже вне короткой ленты. ` +
      `В этой эпохе gateway принял решений: ${cardinalActivity.authorizationDecisionCount}; ` +
      `выполнено вмешательств: ${frame.executedInterventionCount}; ` +
      `отклонено: ${cardinalActivity.deniedInterventionCount}; ` +
      `изменено правил мира: ${cardinalActivity.authorizedWorldChangeCount}.`;
    cardinalLastAction.classList.add('has-action');
  } else {
    cardinalLastAction.textContent =
      'Последнее действие: вмешательств ещё не было — ни одно условие не прошло проверку.';
    cardinalLastAction.classList.remove('has-action');
  }

  renderEventFeed(frame);
  renderAudibleConversations(frame);
  announceDisturbance(frame);
  updateSelection();
  refreshWorldInspector(frame.world);
}

function metricPercent(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value * 100)}%`
    : 'не записано прежней версией';
}

function canonicalDurationLabel(worldMinutes: number | undefined): string {
  return typeof worldMinutes === 'number' && Number.isFinite(worldMinutes)
    ? worldDurationDescription(worldMinutes)
    : 'Длительность старой записи в canonical world minutes не указана';
}

function russianGatewayReason(reason: string | undefined): string {
  if (!reason) return 'Причина не записана прежней версией.';
  if (reason.includes('inside the runtime allowlist')) {
    return 'Разрешено: мера входит в белый список, не превышает лимит и соблюдает период покоя gateway.';
  }
  if (reason.includes('cooldown')) {
    return 'Отклонено: независимый gateway не разрешил слишком частое повторное вмешательство.';
  }
  if (reason.includes('stale') || reason.includes('changed after observation')) {
    return 'Отклонено: мир изменился после наблюдения, поэтому Cardinal обязан провести новую оценку.';
  }
  if (reason.includes('exceeds gateway limit')) {
    return 'Отклонено: сила воздействия превысила независимый предел gateway.';
  }
  if (reason.includes('allowlist')) {
    return 'Отклонено: такой вид воздействия не разрешён независимым gateway.';
  }
  if (reason.includes('prediction')) {
    return 'Отклонено: предложение не содержит проверяемого ограниченного прогноза.';
  }
  return `Техническая запись gateway: ${reason}`;
}

function lawExplanation(mechanism: WorldState['governance']['laws'][string]['mechanism']): string {
  const explanations: Record<typeof mechanism, string> = {
    frontier_expansion:
      'Жители могут постепенно открывать новые участки карты; Cardinal меняет только темп, а не решения исследователей.',
    wildlife_recovery:
      'Популяции восстанавливаются по состоянию среды, без мгновенного появления животных по команде.',
    fertility_support:
      'Мир поддерживает условия для семей, но решение о близости и детях остаётся за жителями.',
    resource_regeneration:
      'Общие природные ресурсы постепенно восстанавливаются сами.',
    mystic_resonance:
      'Определяет вероятность знамений и развитие верований, не переписывая убеждения жителей.',
    weather_volatility:
      'Ограничивает изменчивость внешних условий и будущих погодных событий.',
    catastrophe_recovery:
      'Определяет способность среды восстановиться после разрешённой катастрофы.',
    settlement_cohesion:
      'Дома, рынок и мастерские образуют компактное поселение, а поля и фермы располагаются у его края.',
    habitat_integrity:
      'Виды возникают и восстанавливаются только в физически подходящей среде обитания.',
    civilization_continuity:
      'При демографическом кризисе условия продолжения цивилизации важнее ускорения освоения новых территорий.',
  };
  return explanations[mechanism];
}

function targetPlacesForProblem(
  kind: CardinalProblemKind | undefined,
  world: Readonly<WorldState>,
): string[] {
  if (!kind) return [];
  if (kind === 'resource_fragility') return world.places.resource_field ? ['resource_field'] : [];
  if (kind === 'social_fragmentation' || kind === 'conflict_overload') {
    return world.places.commons ? ['commons'] : [];
  }
  if (kind === 'ecosystem_fragility') {
    return [...new Set(Object.values(world.wildlife).map((value) => value.habitatId))];
  }
  return Object.values(world.places)
    .filter((place) => place.danger >= 0.45)
    .map((place) => place.id)
    .slice(0, 12);
}

function targetPlacesForIntervention(
  kind: InterventionKind,
  world: Readonly<WorldState>,
): string[] {
  return kind === 'resource_relief'
    ? targetPlacesForProblem('resource_fragility', world)
    : kind === 'open_shared_space'
      ? targetPlacesForProblem('social_fragmentation', world)
      : kind === 'habitat_support'
        ? targetPlacesForProblem('ecosystem_fragility', world)
        : targetPlacesForProblem('safety_instability', world);
}

function targetPlacesForLaw(
  domain: WorldState['governance']['laws'][string]['domain'],
  world: Readonly<WorldState>,
): string[] {
  if (domain === 'geography') return [...world.growth.discoveredRegionIds].slice(-12);
  if (domain === 'resources') return world.places.resource_field ? ['resource_field'] : [];
  if (domain === 'demography') {
    return Object.values(world.places)
      .filter((place) => place.settlementId)
      .map((place) => place.id)
      .slice(0, 20);
  }
  if (domain === 'ecology') {
    return [...new Set(Object.values(world.wildlife).map((value) => value.habitatId))];
  }
  if (domain === 'cosmology') {
    return Object.values(world.places)
      .filter((place) => place.kind === 'ruins' || place.kind === 'quiet_space')
      .map((place) => place.id);
  }
  return [];
}

function locationSummary(placeIds: readonly string[]): string {
  if (!lastFrame) return 'данные карты ещё не получены';
  if (placeIds.length === 0) return 'весь мир; точечная область не записана';
  return placeIds
    .map((id) => localizedPlaceName(lastFrame!.world.places[id]?.name ?? id))
    .join(', ');
}

function showPlacesOnMap(placeIds: readonly string[]): void {
  highlightedPlaceIds = new Set(placeIds);
  if (!lastFrame) return;
  renderPlaces(lastFrame.world);
  renderRoads(lastFrame.world);
  const first = placeIds.find((id) => lastFrame?.world.places[id]);
  if (!first) return;
  const point = pointForPlace(first, 0, lastFrame.world);
  worldMapViewport.scrollTo({
    left: Math.max(0, (point.x / 100) * worldMapStage.scrollWidth - worldMapViewport.clientWidth / 2),
    top: Math.max(0, (point.y / 100) * worldMapStage.scrollHeight - worldMapViewport.clientHeight / 2),
    behavior: 'smooth',
  });
}

function consoleRecord(
  title: string,
  badge: string,
  facts: Array<[string, string]>,
  placeIds: readonly string[],
): HTMLDetailsElement {
  const details = document.createElement('details');
  details.className = 'cardinal-record';
  const summary = document.createElement('summary');
  const titleElement = document.createElement('strong');
  titleElement.textContent = title;
  const badgeElement = document.createElement('span');
  badgeElement.textContent = badge;
  summary.append(titleElement, badgeElement);
  const list = document.createElement('dl');
  for (const [label, value] of facts) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    list.append(row);
  }
  const locate = document.createElement('button');
  locate.type = 'button';
  locate.textContent = placeIds.length > 0 ? 'Показать область на карте' : 'Область: весь мир';
  locate.disabled = placeIds.length === 0;
  locate.addEventListener('click', () => showPlacesOnMap(placeIds));
  details.addEventListener('toggle', () => {
    if (details.open && placeIds.length > 0) showPlacesOnMap(placeIds);
  });
  details.append(summary, list, locate);
  return details;
}

function auditSummary(audits: readonly AuditRecord[]): string {
  if (audits.length === 0) return 'Аудиторская запись ещё не создана или отсутствует в старых данных.';
  const rejected = audits.find((audit) => !audit.accepted);
  if (rejected) {
    return `Не принято Auditor: ${rejected.concerns.length > 0 ? rejected.concerns.join('; ') : 'причина не записана'}`;
  }
  return `Auditor принял ${audits.length} ${audits.length === 1 ? 'проверку' : 'проверки'}; несоответствий не обнаружено.`;
}

function outcomeSummary(
  outcome: Readonly<InterventionOutcomeRecord> | undefined,
): string {
  if (!outcome) return 'Результат ещё не наступил либо не был записан прежней версией.';
  const label = predictionMetricLabels[outcome.predictionMetric];
  const before = outcome.beforeMetrics[outcome.predictionMetric];
  const after = outcome.afterMetrics[outcome.predictionMetric];
  return `${label}: было ${metricPercent(before)}, стало ${metricPercent(after)}. Прогноз ${outcome.expectedDirectionObserved ? 'подтвердился' : 'не подтвердился'}; причинность помечена только как наблюдение.`;
}

function renderCardinalConsole(): void {
  const snapshot = cardinalConsoleSnapshot;
  const world = lastFrame?.world;
  cardinalConsoleContent.replaceChildren();
  document.querySelectorAll<HTMLButtonElement>('[data-console-tab]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.consoleTab === activeConsoleTab);
  });
  if (!snapshot || !world) {
    cardinalConsoleContent.textContent = 'Журнал загружается…';
    return;
  }

  if (activeConsoleTab === 'laws') {
    for (const law of snapshot.laws) {
      const places = targetPlacesForLaw(law.domain, world);
      const report = snapshot.readableLawReports?.find(
        (item) => item.rawTechnical.id === law.id,
      );
      cardinalConsoleContent.append(
        consoleRecord(
          report?.title ?? worldLawMechanismLabels[law.mechanism],
          report?.status ??
            (law.createdBy === 'cardinal' ? 'ПОПРАВКА CARDINAL' : 'БАЗОВЫЙ ЗАКОН'),
          [
            ...(report?.rows.map(
              (row): [string, string] => [row.label, row.value],
            ) ?? []),
            ['Зачем существует', lawExplanation(law.mechanism)],
            ['Где действует', locationSummary(places)],
            ['Срок', 'Постоянно, пока независимый gateway не разрешит новую ограниченную поправку.'],
            ['История', law.revision > 0 ? `Редакция ${law.revision}. Предыдущее числовое значение не хранится в текущем срезе; оно остаётся в append-only событии.` : 'Исходная редакция мира.'],
            ['Граница полномочий', 'Закон не даёт Cardinal доступа к личности, памяти, ценностям, отношениям или выбору жителей.'],
          ],
          places,
        ),
      );
    }
  } else if (activeConsoleTab === 'interventions') {
    const outcomesByIntervention = new Map(
      snapshot.outcomes.map((outcome) => [outcome.interventionId, outcome]),
    );
    for (const intervention of [...snapshot.interventions].reverse()) {
      const evaluation = snapshot.evaluations.find(
        (value) => value.evaluationId === intervention.evaluationId,
      );
      const audits = snapshot.audits.filter(
        (audit) => audit.interventionId === intervention.interventionId || audit.evaluationId === intervention.evaluationId,
      );
      const places = targetPlacesForIntervention(intervention.proposal.kind, world);
      const report = snapshot.readableInterventionReports?.find(
        (item) =>
          item.rawTechnical.interventionId === intervention.interventionId,
      );
      cardinalConsoleContent.append(
        consoleRecord(
          `${report?.title ?? interventionLabels[intervention.proposal.kind]} · ${formatAinkradWorldTime(intervention.requestedWorldMinutes)}`,
          report?.status ??
            (intervention.executed ? 'ВЫПОЛНЕНО GATEWAY' : 'ОТКЛОНЕНО GATEWAY'),
          [
            ...(report?.rows.map(
              (row): [string, string] => [row.label, row.value],
            ) ?? []),
            ['Проблема', evaluation?.detectedProblem ? cardinalProblemLabels[evaluation.detectedProblem.kind] : 'связанный диагноз не записан или не попал в ограниченный срез'],
            ['Почему Cardinal предложил', evaluation?.detectedProblem ? `${cardinalProblemLabels[evaluation.detectedProblem.kind]}; серьёзность ${metricPercent(evaluation.detectedProblem.severity)}, уверенность ${metricPercent(evaluation.detectedProblem.confidence)}` : interventionLabels[intervention.proposal.kind]],
            ['Что именно разрешалось', `${interventionLabels[intervention.proposal.kind]}, сила ${metricPercent(intervention.proposal.magnitude)}`],
            ['Куда', locationSummary(places)],
            ['Длительность эффекта', `${canonicalDurationLabel(intervention.authorizedEffectDurationWorldMinutes)}; после срока эффект прекращается автоматически, запись остаётся навсегда.`],
            ['Решение gateway', russianGatewayReason(intervention.authorizationReason)],
            ['Ожидание', `Должно снизиться: ${predictionMetricLabels[intervention.proposal.prediction.metric]}; минимум на ${metricPercent(intervention.proposal.prediction.minimumImprovement)} за ${canonicalDurationLabel(intervention.proposal.prediction.horizonWorldMinutes)}.`],
            ['Фактический результат', outcomeSummary(outcomesByIntervention.get(intervention.interventionId))],
            ['Auditor', auditSummary(audits)],
          ],
          places,
        ),
      );
    }
  } else if (activeConsoleTab === 'proposals') {
    const proposed = snapshot.evaluations.filter((evaluation) => evaluation.proposal);
    for (const evaluation of [...proposed].reverse()) {
      const proposal = evaluation.proposal!;
      const intervention = snapshot.interventions.find(
        (value) => value.evaluationId === evaluation.evaluationId,
      );
      const places = targetPlacesForIntervention(proposal.kind, world);
      cardinalConsoleContent.append(
        consoleRecord(
          `${interventionLabels[proposal.kind]} · ${formatAinkradWorldTime(evaluation.evaluatedWorldMinutes)}`,
          intervention ? (intervention.executed ? 'РАЗРЕШЕНО' : 'ОТКЛОНЕНО') : 'ОЖИДАЕТ GATEWAY',
          [
            ['Диагноз', evaluation.detectedProblem ? cardinalProblemLabels[evaluation.detectedProblem.kind] : 'нет сохранённого диагноза'],
            ['Доказательства', `${evaluation.evidenceEventIds.length} событий; ресурсное давление ${metricPercent(evaluation.metrics.resourcePressure)}, изоляция ${metricPercent(evaluation.metrics.socialIsolation)}, опасность ${metricPercent(evaluation.metrics.safetyPressure)}, экосистема ${metricPercent(evaluation.metrics.wildlifePressure)}.`],
            ['Предложение', `${interventionLabels[proposal.kind]}, сила ${metricPercent(proposal.magnitude)}.`],
            ['Куда', locationSummary(places)],
            ['Проверяемый прогноз', `${predictionMetricLabels[proposal.prediction.metric]} должно снизиться минимум на ${metricPercent(proposal.prediction.minimumImprovement)} за ${canonicalDurationLabel(proposal.prediction.horizonWorldMinutes)}.`],
            ['Ограничение', 'Это только предложение. Cardinal не может выполнить его без независимого gateway.'],
            ['Итог gateway', intervention ? russianGatewayReason(intervention.authorizationReason) : 'Решение gateway не записано в доступном срезе.'],
          ],
          places,
        ),
      );
    }
  } else if (activeConsoleTab === 'evaluations') {
    const evaluations = [...snapshot.evaluations]
      .filter((evaluation, index, all) => evaluation.decision !== 'no_action' || index >= all.length - 24)
      .reverse();
    for (const evaluation of evaluations) {
      const places = targetPlacesForProblem(evaluation.detectedProblem?.kind, world);
      const decision =
        evaluation.decision === 'propose'
          ? 'передал предложение gateway'
          : evaluation.decision === 'defer'
            ? `отложил действие: ${evaluation.deferReason ? cardinalDeferLabels[evaluation.deferReason] : 'причина не записана'}`
            : 'наблюдал; системный порог не достигнут';
      cardinalConsoleContent.append(
        consoleRecord(
          `Оценка мира · ${formatAinkradWorldTime(evaluation.evaluatedWorldMinutes)}`,
          evaluation.decision === 'propose' ? 'ПРЕДЛОЖЕНИЕ' : evaluation.decision === 'defer' ? 'ОТЛОЖЕНО' : 'БЕЗ ДЕЙСТВИЯ',
          [
            ['Что увидел', evaluation.detectedProblem ? cardinalProblemLabels[evaluation.detectedProblem.kind] : 'ни одна системная проблема не прошла порог'],
            ['Показатели', `ресурсы ${metricPercent(evaluation.metrics.resourcePressure)}, изоляция ${metricPercent(evaluation.metrics.socialIsolation)}, стресс ${metricPercent(evaluation.metrics.averageStress)}, опасность ${metricPercent(evaluation.metrics.safetyPressure)}, экосистема ${metricPercent(evaluation.metrics.wildlifePressure)}`],
            ['Доказательства', `${evaluation.evidenceEventIds.length} событий мира; неопределённостей: ${evaluation.uncertaintyNotes.length}.`],
            ['Решение', decision],
            ['Почему не заменяет людей', 'Оценка касается только среды и агрегированных последствий. Личные действия, цели, чувства и отношения не являются целью записи.'],
            ['Где замечено', locationSummary(places)],
            ['Auditor', auditSummary(snapshot.audits.filter((audit) => audit.evaluationId === evaluation.evaluationId))],
          ],
          places,
        ),
      );
    }
  } else {
    const healthStatusLabels: Record<string, string> = {
      healthy: 'СТАБИЛЬНО',
      watch: 'НАБЛЮДЕНИЕ',
      danger: 'ОПАСНОСТЬ',
      critical: 'КРИТИЧНО',
    };
    const health = snapshot.worldHealth;
    if (!health) {
      cardinalConsoleContent.textContent =
        'Старая вкладка мира не передала world health report. Закройте её и откройте Ainkrad заново.';
      return;
    }
    cardinalConsoleContent.append(
      consoleRecord(
        health.title,
        `${health.score}/100 · ${healthStatusLabels[health.status] ?? health.status}`,
        [
          ['Сводка', health.summary],
          ['Возраст мира', `${health.worldAgeYears.toFixed(2)} года Ainkrad`],
          ['Критические коды', health.criticalCodes.join(', ') || 'нет'],
          ['Предупреждения', health.warningCodes.join(', ') || 'нет'],
          ['Сформировано', formatAinkradWorldTime(snapshot.generatedWorldMinutes)],
        ],
        [],
      ),
    );
    for (const section of health.sections) {
      cardinalConsoleContent.append(
        consoleRecord(
          section.title,
          healthStatusLabels[section.status] ?? section.status,
          [
            ['Состояние', section.summary],
            ['Проверяемые данные', section.evidence.join('; ') || 'нет дополнительных записей'],
          ],
          [],
        ),
      );
    }

    const deathCauseLabels: Record<string, string> = {
      old_age: 'СТАРОСТЬ',
      illness: 'ЗДОРОВЬЕ',
      deprivation: 'ИСТОЩЕНИЕ',
      catastrophe: 'КАТАСТРОФА',
      wildlife: 'ДИКАЯ ФАУНА',
      monster: 'МОНСТР',
      war: 'ВОЙНА',
    };
    const deathDiagnostics = snapshot.deathDiagnostics ?? [];
    if (deathDiagnostics.length === 0) {
      cardinalConsoleContent.append(
        consoleRecord(
          'Диагностика смертей',
          '0 ЗАПИСЕЙ',
          [
            ['Состояние', 'В текущей эпохе ещё нет зафиксированных смертей.'],
            ['Контракт', 'При каждой смерти сохраняются причина, физическое состояние, ресурсы, стресс, место и механизм гибели.'],
          ],
          [],
        ),
      );
    } else {
      for (const death of [...deathDiagnostics].reverse()) {
        const resident = world.agents[death.agentId];
        const place = world.places[death.locationId];
        cardinalConsoleContent.append(
          consoleRecord(
            `${resident?.name ?? death.agentId} · ${formatAinkradWorldTime(death.worldMinutes)}`,
            deathCauseLabels[death.cause] ?? death.cause,
            [
              ['Причина', death.summary],
              ['Основной механизм', death.primaryMechanism ?? 'не записан'],
              ['Возраст и поколение', `${death.ageYears.toFixed(1)} лет · поколение ${death.generation}`],
              ['Уровень', String(death.level)],
              ['Место', localizedPlaceName(place?.name ?? death.locationId)],
              ['Перед смертью', `здоровье ${metricPercent(death.healthBeforeDeath)}, энергия ${metricPercent(death.energyBeforeDeath)}, личные ресурсы ${metricPercent(death.resourcesBeforeDeath)}, стресс ${metricPercent(death.stressBeforeDeath)}`],
              ['Угроза', death.species ? `${death.species}; урон ${metricPercent(death.damage)}, вероятность летального исхода ${metricPercent(death.lethalChance)}` : 'прямая внешняя угроза не записана'],
              ['Диагностические факторы', death.diagnosticFactors?.join('; ') ?? 'нет дополнительных факторов'],
            ],
            place ? [place.id] : [],
          ),
        );
      }
    }
  }

  if (!cardinalConsoleContent.childElementCount) {
    cardinalConsoleContent.textContent = 'В этом разделе записей пока нет.';
  }
}

function requestCardinalConsole(tab: CardinalConsoleTab): void {
  activeConsoleTab = tab;
  cardinalConsole.hidden = false;
  document.body.classList.add('has-modal');
  cardinalConsoleContent.textContent = 'Загрузка проверяемого журнала…';
  liveWorldWorker.postMessage({
    type: 'request_cardinal_console',
    requestId: `console:${Date.now()}:${Math.random().toString(36).slice(2)}`,
  });
}

function closeCardinalConsole(): void {
  cardinalConsole.hidden = true;
  document.body.classList.remove('has-modal');
  highlightedPlaceIds.clear();
  if (lastFrame) {
    renderPlaces(lastFrame.world);
    renderRoads(lastFrame.world);
  }
}

type LiveWorldWorkerMessage =
  | {
      type: 'frame';
      protocolVersion: string;
      frame: LiveWorldFrame;
    }
  | {
      type: 'cardinal_console';
      protocolVersion: string;
      requestId: string;
      snapshot: CardinalConsoleSnapshot;
    }
  | {
      type: 'catch_up_progress';
      protocolVersion: string;
      worldEpoch: number;
      fromWorldMinutes: number;
      currentWorldMinutes: number;
      targetWorldMinutes: number;
      percent: number;
      elapsedRealMs: number;
      estimatedRemainingMs: number | null;
      semanticQuantaProcessed: number;
      completed: boolean;
    }
  | {
      type: 'fatal';
      protocolVersion: string;
      message: string;
    };

async function requestPersistentAinkradStorage(): Promise<void> {
  if (!navigator.storage?.persist) return;
  try {
    const alreadyPersistent =
      typeof navigator.storage.persisted === 'function'
        ? await navigator.storage.persisted()
        : false;
    if (alreadyPersistent) return;
    const granted = await navigator.storage.persist();
    if (!granted) {
      console.warn('[Ainkrad storage] Persistent local storage was not granted.');
    }
  } catch {
    console.warn('[Ainkrad storage] Persistent-storage request failed.');
  }
}
void requestPersistentAinkradStorage();

const liveWorldWorker = new Worker(
  new URL('./runtime/liveWorld.worker.ts', import.meta.url),
  { type: 'module' },
);

mapZoomOut.addEventListener('click', () => setMapZoom(mapZoom / 1.22));
mapZoomIn.addEventListener('click', () => setMapZoom(mapZoom * 1.22));
mapZoomFit.addEventListener('click', fitMapToViewport);

let pinchStartDistance = 0;
let pinchStartZoom = 1;
worldMapViewport.addEventListener(
  'touchstart',
  (event) => {
    if (event.touches.length !== 2) return;
    pinchStartDistance = Math.hypot(
      event.touches[1].clientX - event.touches[0].clientX,
      event.touches[1].clientY - event.touches[0].clientY,
    );
    pinchStartZoom = mapZoom;
  },
  { passive: true },
);
worldMapViewport.addEventListener(
  'touchmove',
  (event) => {
    if (event.touches.length !== 2 || pinchStartDistance <= 0) return;
    event.preventDefault();
    const distance = Math.hypot(
      event.touches[1].clientX - event.touches[0].clientX,
      event.touches[1].clientY - event.touches[0].clientY,
    );
    const bounds = worldMapViewport.getBoundingClientRect();
    const focalX =
      (event.touches[0].clientX + event.touches[1].clientX) / 2 - bounds.left;
    const focalY =
      (event.touches[0].clientY + event.touches[1].clientY) / 2 - bounds.top;
    setMapZoom(pinchStartZoom * (distance / pinchStartDistance), focalX, focalY);
  },
  { passive: false },
);

cardinalOpen.addEventListener('click', () => requestCardinalConsole('laws'));
document.querySelectorAll<HTMLButtonElement>('[data-cardinal-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const tab = button.dataset.cardinalTab as CardinalConsoleTab | undefined;
    if (tab) requestCardinalConsole(tab);
  });
});
document.querySelectorAll<HTMLButtonElement>('[data-console-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    activeConsoleTab = button.dataset.consoleTab as CardinalConsoleTab;
    renderCardinalConsole();
  });
});
cardinalConsoleClose.addEventListener('click', closeCardinalConsole);
cardinalConsole.addEventListener('click', (event) => {
  if (event.target === cardinalConsole) closeCardinalConsole();
});
residentDetailsOpen.addEventListener('click', () => {
  if (selectedAgentId) openWorldInspector('resident', selectedAgentId);
});
residentPicker.addEventListener('change', () => {
  selectedAgentId = residentPicker.value || undefined;
  updateSelection();
});
textScaleButton.addEventListener('click', () => {
  const currentIndex = TEXT_SCALE_STEPS.indexOf(textScale);
  textScale = TEXT_SCALE_STEPS[(currentIndex + 1) % TEXT_SCALE_STEPS.length];
  applyTextScale();
  try {
    localStorage.setItem(TEXT_SCALE_KEY, String(textScale));
  } catch {
    // Scaling remains active for this session when storage is blocked.
  }
});
worldInspectorClose.addEventListener('click', closeWorldInspector);
worldInspector.addEventListener('click', (event) => {
  if (event.target === worldInspector) closeWorldInspector();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !cardinalConsole.hidden) closeCardinalConsole();
  if (event.key === 'Escape' && !worldInspector.hidden) closeWorldInspector();
});
worldMapViewport.addEventListener(
  'wheel',
  (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const bounds = worldMapViewport.getBoundingClientRect();
    setMapZoom(
      mapZoom * (event.deltaY > 0 ? 0.9 : 1.1),
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    );
  },
  { passive: false },
);

function publishClockControl(): void {
  showClockControl(preferredSpeedId, preferredSpeedMultiplier);
  try {
    localStorage.setItem(
      CLOCK_PREFERENCE_KEY,
      JSON.stringify({
        speedId: preferredSpeedId,
        multiplier: preferredSpeedMultiplier,
      }),
    );
  } catch {
    // The running worker still receives the choice when storage is blocked.
  }
  liveWorldWorker.postMessage({
    type: 'set_speed',
    speedId: preferredSpeedId,
    multiplier: preferredSpeedMultiplier,
  });
  if (lastFrame) {
    persistOfflineClockAnchor(
      lastFrame,
      Date.now(),
      preferredSpeedId,
      preferredSpeedMultiplier,
    );
  }
}

worldSpeedSelect.addEventListener('change', () => {
  if (!isWorldSpeedId(worldSpeedSelect.value)) return;
  preferredSpeedId = worldSpeedSelect.value;
  publishClockControl();
});

speedMultiplierButton.addEventListener('click', () => {
  preferredSpeedMultiplier = preferredSpeedMultiplier === 1 ? 10 : 1;
  publishClockControl();
});

resetWorldButton.addEventListener('click', () => {
  const accepted = window.confirm(
    'Создать новый мир? Текущая эпоха завершится, но накопленный опыт Cardinal сохранится.',
  );
  if (!accepted) return;
  pendingOfflineClockAnchor = undefined;
  offlineCatchUpTargetWorldMinutes = undefined;
  liveWorldWorker.postMessage({ type: 'reset_world' });
});

window.addEventListener('pagehide', () => {
  if (lastFrame) persistOfflineClockAnchor(lastFrame);
});

document.addEventListener('visibilitychange', () => {
  if (!lastFrame) return;
  if (document.visibilityState === 'hidden') {
    persistOfflineClockAnchor(lastFrame);
    return;
  }
  resumeOfflineClockFromStoredAnchor(lastFrame);
  updateOfflineClockContinuity(lastFrame);
});

window.addEventListener('pageshow', () => {
  if (!lastFrame) return;
  resumeOfflineClockFromStoredAnchor(lastFrame);
  updateOfflineClockContinuity(lastFrame);
});

publishClockControl();

liveWorldWorker.addEventListener(
  'message',
  (event: MessageEvent<LiveWorldWorkerMessage>) => {
    if (event.data.type === 'frame') {
      updateWorld(event.data.frame);
      return;
    }
    if (event.data.type === 'cardinal_console') {
      cardinalConsoleSnapshot = event.data.snapshot;
      renderCardinalConsole();
      return;
    }
    if (event.data.type === 'catch_up_progress') {
      const percent = Math.max(0, Math.min(100, Math.round(event.data.percent * 100)));
      catchUpOverlay.hidden = false;
      catchUpPercent.textContent = `${percent}%`;
      catchUpBar.style.width = `${percent}%`;
      const processed = Math.max(
        0,
        event.data.currentWorldMinutes - event.data.fromWorldMinutes,
      );
      const remaining = Math.max(
        0,
        event.data.targetWorldMinutes - event.data.currentWorldMinutes,
      );
      const eta = event.data.estimatedRemainingMs === null
        ? 'оцениваем оставшееся время'
        : event.data.estimatedRemainingMs < 1_000
          ? 'меньше секунды'
          : `ещё примерно ${Math.max(1, Math.ceil(event.data.estimatedRemainingMs / 1_000))} сек.`;
      catchUpTitle.textContent = event.data.completed
        ? 'Мир догнан — показываем результат'
        : `Просчитано ${worldDurationDescription(processed)}`;
      catchUpDetail.textContent = event.data.completed
        ? `Готово за ${(event.data.elapsedRealMs / 1_000).toFixed(1)} сек. Все смысловые шаги мира обработаны.`
        : `Осталось ${worldDurationDescription(remaining)} · ${eta} · обработано шагов: ${event.data.semanticQuantaProcessed}`;
      offlineClockStatus.textContent = event.data.completed
        ? 'Догон завершён · Cardinal не управлял временем'
        : `Быстрый догон: ${percent}% · ${eta}`;
      offlineClockStatus.classList.toggle('is-catching-up', !event.data.completed);
      if (event.data.completed) {
        window.setTimeout(() => {
          catchUpOverlay.hidden = true;
        }, 850);
      }
      return;
    }

    liveLabel.textContent = 'ОШИБКА МИРА';
    liveIndicator.classList.remove('is-live');
    cardinalMessage.textContent = event.data.message;
  },
);

liveWorldWorker.addEventListener('error', () => {
  liveLabel.textContent = 'ОШИБКА МИРА';
  liveIndicator.classList.remove('is-live');
  cardinalMessage.textContent = 'Фоновый цикл мира остановился.';
});
