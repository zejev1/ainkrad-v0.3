import './browser.css';
import type { CardinalCapability } from './cardinal/types';
import type { LiveWorldFrame } from './runtime/LiveWorldRuntime';
import type { WorldEvent } from './world/events';
import type {
  AgentActionKind,
  AgentState,
  RelationshipState,
  WildlifeSpecies,
  WorldPlaceKind,
  WorldState,
} from './world/types';

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
};

const wildlifeIcons: Record<WildlifeSpecies, string> = {
  rabbit: '🐇',
  deer: '🦌',
  fish: '🐟',
  boar: '🐗',
  wolf: '🐺',
  bird: '🐦',
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
        <p class="eyebrow">AINKRAD v0.3.10 · живые поколения</p>
        <h1>Первый уровень</h1>
        <p class="world-subtitle">Жители открывают территории. Cardinal учится вместе с миром.</p>
      </div>

      <div class="live-indicator" id="live-indicator">
        <span class="live-dot" aria-hidden="true"></span>
        <span id="live-label">ВОССТАНОВЛЕНИЕ</span>
      </div>
    </header>

    <div class="status-strip" aria-label="Состояние мира">
      <span>Тик <strong id="tick-value">0</strong></span>
      <span>Время <strong id="time-value">Рассвет</strong></span>
      <span>Жителей <strong id="population-value">6</strong></span>
      <span>Территории <strong id="growth-value">0</strong></span>
      <span>Животные <strong id="wildlife-value">0</strong></span>
      <span>Общие ресурсы <strong id="resource-value">—</strong></span>
      <span class="save-state">Состояние <strong id="save-value">Загрузка…</strong></span>
    </div>

    <main class="world-layout">
      <section class="world-map" id="world-map" aria-label="Карта Ainkrad">
        <div class="map-sky" aria-hidden="true"></div>
        <div class="map-grid" aria-hidden="true"></div>
        <div class="terrain terrain--water growth-terrain growth-terrain--3" aria-hidden="true"></div>
        <div class="terrain terrain--grove-one growth-terrain growth-terrain--2" aria-hidden="true"></div>
        <div class="terrain terrain--grove-two growth-terrain growth-terrain--1" aria-hidden="true"></div>

        <svg
          class="roads"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path class="road-main" d="M50 48 L16 23 M50 48 L83 25 M50 48 L18 75 M50 48 L82 76" />
          <path d="M7 49 L18 75 M30 8 L16 23 M69 8 L83 25 M93 49 L82 76 M70 92 L82 76 M30 92 L18 75" />
          <path class="road-growth road-growth--1" d="M16 23 L8 13" />
          <path class="road-growth road-growth--2" d="M16 23 L50 12" />
          <path class="road-growth road-growth--3" d="M82 76 L92 88" />
        </svg>

        <div id="places-layer" class="places-layer"></div>
        <div id="wildlife-layer" class="wildlife-layer"></div>
        <div id="agents-layer" class="agents-layer"></div>

        <div class="map-hint">Нажмите на жителя</div>

        <div
          class="disturbance-banner"
          id="disturbance-banner"
          aria-live="polite"
        ></div>
      </section>

      <aside class="world-sidebar">
        <section class="resident-panel" aria-live="polite">
          <div class="panel-heading-row">
            <p class="panel-label">Выбранный житель</p>
            <span class="autonomy-mark">САМ РЕШАЕТ</span>
          </div>

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
            <div><dt>Характер</dt><dd id="resident-traits">—</dd></div>
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
            <span>Принадлежность</span><span id="belonging-value">—</span>
            <div class="need-track need-track--belonging"><span id="belonging-bar"></span></div>
          </div>
          <div class="need-row need-row--compact">
            <span>Смысл</span><span id="purpose-value">—</span>
            <div class="need-track need-track--purpose"><span id="purpose-bar"></span></div>
          </div>

          <p class="relationship-note" id="relationship-note">Связи ещё формируются.</p>
        </section>

        <section class="event-panel">
          <div class="panel-heading-row">
            <p class="panel-label">Жизнь мира</p>
            <span class="event-live">СЕЙЧАС</span>
          </div>
          <ol class="event-feed" id="event-feed">
            <li>Мир вспоминает свою историю…</li>
          </ol>
        </section>

        <section class="cardinal-panel">
          <div class="panel-heading-row">
            <p class="panel-label">Cardinal наблюдает</p>
            <span class="gateway-mark">GATEWAY</span>
          </div>

          <div class="cardinal-numbers">
            <span><strong id="evaluation-value">0</strong>оценок</span>
            <span><strong id="intervention-value">0</strong>вмешательств</span>
            <span><strong id="cardinal-level-value">1</strong>уровень</span>
            <span><strong id="cardinal-xp-value">0</strong>опыт</span>
          </div>

          <p class="cardinal-capabilities" id="cardinal-capabilities">
            Наблюдение мира · защита автономии
          </p>

          <p id="cardinal-message">
            Cardinal не управляет жителями. Любое изменение мира проходит
            только через независимый gateway.
          </p>
        </section>
      </aside>
    </main>
  </div>
`;

const requiredElement = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing browser element #${id}.`);
  return element as T;
};

const worldMap = requiredElement<HTMLElement>('world-map');
const placesLayer = requiredElement<HTMLDivElement>('places-layer');
const wildlifeLayer = requiredElement<HTMLDivElement>('wildlife-layer');
const agentsLayer = requiredElement<HTMLDivElement>('agents-layer');
const tickValue = requiredElement<HTMLElement>('tick-value');
const timeValue = requiredElement<HTMLElement>('time-value');
const populationValue = requiredElement<HTMLElement>('population-value');
const growthValue = requiredElement<HTMLElement>('growth-value');
const wildlifeValue = requiredElement<HTMLElement>('wildlife-value');
const resourceValue = requiredElement<HTMLElement>('resource-value');
const saveValue = requiredElement<HTMLElement>('save-value');
const evaluationValue = requiredElement<HTMLElement>('evaluation-value');
const interventionValue = requiredElement<HTMLElement>('intervention-value');
const cardinalLevelValue = requiredElement<HTMLElement>('cardinal-level-value');
const cardinalXpValue = requiredElement<HTMLElement>('cardinal-xp-value');
const cardinalCapabilities = requiredElement<HTMLElement>('cardinal-capabilities');
const liveIndicator = requiredElement<HTMLElement>('live-indicator');
const liveLabel = requiredElement<HTMLElement>('live-label');
const disturbanceBanner = requiredElement<HTMLElement>('disturbance-banner');
const residentPortrait = requiredElement<HTMLElement>('resident-portrait');
const residentName = requiredElement<HTMLElement>('resident-name');
const residentActivity = requiredElement<HTMLElement>('resident-activity');
const residentPlace = requiredElement<HTMLElement>('resident-place');
const residentGoal = requiredElement<HTMLElement>('resident-goal');
const residentLife = requiredElement<HTMLElement>('resident-life');
const residentTraits = requiredElement<HTMLElement>('resident-traits');
const residentSkill = requiredElement<HTMLElement>('resident-skill');
const residentChoice = requiredElement<HTMLElement>('resident-choice');
const relationshipNote = requiredElement<HTMLElement>('relationship-note');
const eventFeed = requiredElement<HTMLOListElement>('event-feed');
const energyValue = requiredElement<HTMLElement>('energy-value');
const energyBar = requiredElement<HTMLElement>('energy-bar');
const stressValue = requiredElement<HTMLElement>('stress-value');
const stressBar = requiredElement<HTMLElement>('stress-bar');
const personalResourceValue = requiredElement<HTMLElement>('personal-resource-value');
const personalResourceBar = requiredElement<HTMLElement>('personal-resource-bar');
const belongingValue = requiredElement<HTMLElement>('belonging-value');
const belongingBar = requiredElement<HTMLElement>('belonging-bar');
const purposeValue = requiredElement<HTMLElement>('purpose-value');
const purposeBar = requiredElement<HTMLElement>('purpose-bar');
const cardinalMessage = requiredElement<HTMLElement>('cardinal-message');

const avatarElements = new Map<string, HTMLButtonElement>();
const placeElements = new Map<string, HTMLElement>();
const wildlifeElements = new Map<string, HTMLElement>();
const previousLocations = new Map<string, string>();

let selectedAgentId: string | undefined;
let lastFrame: LiveWorldFrame | undefined;
let continuityAnnounced = false;

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
      village: '⌂',
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
      label:
        publicPoint?.label ??
        (place.kind === 'home'
          ? place.name.replace("'s Home", ' — дом')
          : place.name),
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
  return storedName.replace("'s Home", ' — дом');
}

function renderPlaces(world: Readonly<WorldState>): void {
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
      placeElement = document.createElement('div');
      placeElement.className = `map-place map-place--${place.kind}`;
      placeElement.innerHTML = `
        <span class="place-building" aria-hidden="true">
          <span class="place-symbol"></span>
        </span>
        <span class="place-label"></span>
        <span class="place-count">0</span>
      `;
      placesLayer.append(placeElement);
      placeElements.set(placeId, placeElement);
    }
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
  for (const [populationId, population] of Object.entries(world.wildlife)) {
    const habitat = pointForPlace(population.habitatId, 0, world);
    const offsets: Record<WildlifeSpecies, { x: number; y: number }> = {
      rabbit: { x: 6, y: 4 },
      deer: { x: 7, y: 5 },
      fish: { x: -6, y: -5 },
      boar: { x: 5, y: 5 },
      wolf: { x: -5, y: 4 },
      bird: { x: 3, y: -5 },
    };
    const offset = offsets[population.species];
    let element = wildlifeElements.get(populationId);
    if (!element) {
      element = document.createElement('div');
      element.className = `wildlife-population wildlife-population--${population.species}`;
      element.innerHTML = `
        <span class="wildlife-icon" aria-hidden="true">${wildlifeIcons[population.species]}</span>
        <span class="wildlife-count"></span>
      `;
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
  return `${skillLabels[strongest[0]]} · ${Math.round(strongest[1] * 100)}%`;
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

function updateSelection(): void {
  if (!lastFrame) return;

  const agents = Object.values(lastFrame.world.agents).filter(
    (agent) => agent.life.alive,
  );
  const selected =
    agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];
  if (!selected) return;
  selectedAgentId = selected.id;

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
  residentActivity.textContent = selected.lastAction
    ? actionLabels[selected.lastAction]
    : 'осматривается';
  residentPlace.textContent = displayPlaceName(lastFrame.world, selected);
  residentGoal.textContent = goalLabels[selected.goal.kind];
  residentLife.textContent = `${Math.floor(selected.life.ageYears)} лет · поколение ${selected.life.generation} · ${
    selected.origin === 'native' ? 'рождён здесь' : 'вошёл извне'
  }`;
  residentTraits.textContent = strongestTraits(selected);
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
      return `${name} добыл ресурсы`;
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
      return `${name} умер, но его история осталась в мире`;
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
    element.innerHTML = `<span>${item.event.occurredAt}</span><p></p>`;
    const text = element.querySelector('p');
    if (text) text.textContent = item.text;
    eventFeed.append(element);
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

function updateWorldTime(tick: number): void {
  const phases = [
    { id: 'dawn', label: 'Рассвет' },
    { id: 'day', label: 'День' },
    { id: 'evening', label: 'Вечер' },
    { id: 'night', label: 'Ночь' },
  ] as const;
  const phase = phases[Math.floor(tick / 28) % phases.length];
  const day = Math.floor(tick / (28 * phases.length)) + 1;
  worldMap.dataset.phase = phase.id;
  timeValue.textContent = `${phase.label} · ${day}`;
}

function updateWorld(frame: Readonly<LiveWorldFrame>): void {
  lastFrame = structuredClone(frame);
  worldMap.dataset.growth = String(Math.min(3, frame.world.growth.stage));
  renderPlaces(frame.world);
  renderWildlife(frame.world);

  const agents = Object.values(frame.world.agents).filter(
    (agent) => agent.life.alive,
  );
  const livingAgentIds = new Set(agents.map((agent) => agent.id));
  for (const [agentId, avatar] of avatarElements) {
    if (livingAgentIds.has(agentId)) continue;
    avatar.remove();
    avatarElements.delete(agentId);
    previousLocations.delete(agentId);
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
    const base = pointForPlace(agent.locationId, index, frame.world);
    const residentsHere = occupancy.get(agent.locationId) ?? [agent];
    const localIndex = residentsHere.findIndex((item) => item.id === agent.id);
    const angle =
      (Math.PI * 2 * localIndex) / Math.max(1, residentsHere.length) +
      frame.tick * 0.11;
    const radius = agent.locationId.startsWith('home_') ? 1.6 : 3.6;
    const x = clampMapCoordinate(base.x + Math.cos(angle) * radius);
    const y = clampMapCoordinate(base.y + Math.sin(angle) * radius * 0.72);
    const changedPlace = previousLocations.get(agent.id) !== agent.locationId;
    const isMoving =
      changedPlace ||
      (agent.lastAction !== 'rest' &&
        agent.lastAction !== 'relax' &&
        agent.lastAction !== 'reflect');

    avatar.style.left = `${x}%`;
    avatar.style.top = `${y}%`;
    avatar.classList.toggle('is-moving', isMoving);
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
    avatar.dataset.lifeStage = agent.life.stage;
    avatar.dataset.action = agent.lastAction ?? 'idle';

    const actionBubble = avatar.querySelector<HTMLElement>('.action-bubble');
    if (actionBubble) {
      actionBubble.textContent = agent.lastAction
        ? actionIcons[agent.lastAction]
        : '•';
    }

    avatar.setAttribute(
      'aria-label',
      `${agent.name}: ${
        agent.lastAction ? actionLabels[agent.lastAction] : 'осматривается'
      }, ${displayPlaceName(frame.world, agent)}`,
    );
    previousLocations.set(agent.id, agent.locationId);
  });

  tickValue.textContent = String(frame.tick);
  populationValue.textContent = String(agents.length);
  growthValue.textContent = `${frame.world.growth.stage} · ${Math.round(
    frame.world.growth.explorationProgress * 100,
  )}%`;
  wildlifeValue.textContent = String(
    Object.values(frame.world.wildlife).reduce(
      (sum, population) => sum + population.count,
      0,
    ),
  );
  resourceValue.textContent = `${Math.round(frame.world.environment.resourcePool * 100)}%`;
  evaluationValue.textContent = String(frame.evaluationCount);
  interventionValue.textContent = String(frame.executedInterventionCount);
  if (frame.evaluation?.experience) {
    cardinalLevelValue.textContent = String(frame.evaluation.experience.level);
    cardinalXpValue.textContent = String(
      frame.evaluation.experience.totalExperience,
    );
    cardinalCapabilities.textContent = frame.evaluation.experience.capabilities
      .map((capability) => cardinalCapabilityLabels[capability])
      .join(' · ');
  }
  updateWorldTime(frame.tick);

  if (frame.continuity.durable) {
    saveValue.textContent = frame.continuity.resumed
      ? `Продолжен с ${frame.continuity.resumedFromTick}`
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
  if (unlocked.length > 0) {
    cardinalMessage.textContent = `Cardinal освоил: ${unlocked
      .map((capability) => cardinalCapabilityLabels[capability])
      .join(', ')}. Воля жителей не изменилась.`;
  } else if (frame.intervention?.executed) {
    cardinalMessage.textContent =
      'Cardinal предложил меру. Независимый gateway проверил и выполнил её.';
  } else if (frame.evaluation?.proposal) {
    cardinalMessage.textContent =
      'Cardinal обнаружил риск и передал предложение независимому gateway.';
  } else {
    cardinalMessage.textContent =
      'Cardinal наблюдает. Решения жителей принадлежат только самому миру.';
  }

  renderEventFeed(frame);
  announceDisturbance(frame);
  updateSelection();
}

type LiveWorldWorkerMessage =
  | {
      type: 'frame';
      protocolVersion: 'ainkrad-live-frame-0.3.10';
      frame: LiveWorldFrame;
    }
  | {
      type: 'fatal';
      protocolVersion: 'ainkrad-live-frame-0.3.10';
      message: string;
    };

const liveWorldWorker = new Worker(
  new URL('./runtime/liveWorld.worker.ts', import.meta.url),
  { type: 'module' },
);

liveWorldWorker.addEventListener(
  'message',
  (event: MessageEvent<LiveWorldWorkerMessage>) => {
    if (event.data.type === 'frame') {
      updateWorld(event.data.frame);
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
