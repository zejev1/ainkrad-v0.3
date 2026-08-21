import './browser.css';
import {
  runExperiment,
  type ExperimentTickFrame,
  type ScheduledDisturbance,
} from './experiment/ExperimentRunner';
import type { AgentState, WorldState } from './world/types';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Ainkrad browser root not found.');
}

const TICK_DELAY_MS = 550;
const BROWSER_TICKS = 300;
const disturbances: readonly ScheduledDisturbance[] = [
  { tick: 12, kind: 'resource_shock', magnitude: 0.6 },
  { tick: 30, kind: 'social_barrier', magnitude: 0.5, duration: 8 },
  { tick: 45, kind: 'safety_shock', magnitude: 0.5, duration: 8 },
];

const actionLabels: Record<NonNullable<AgentState['lastAction']>, string> = {
  rest: 'отдыхает',
  gather: 'собирает ресурсы',
  work: 'работает',
  socialize: 'общается',
  help: 'помогает',
  explore: 'исследует мир',
  reflect: 'размышляет',
};

const goalLabels: Record<AgentState['goal']['kind'], string> = {
  recover: 'восстановиться',
  secure_resources: 'добыть ресурсы',
  connect: 'найти общение',
  contribute: 'быть полезным',
  explore: 'исследовать',
  reflect: 'разобраться в себе',
};

interface MapPoint {
  x: number;
  y: number;
  label: string;
  symbol: string;
}

const publicPlacePoints: Record<string, MapPoint> = {
  commons: { x: 50, y: 50, label: 'Общая площадь', symbol: '◆' },
  resource_field: { x: 17, y: 24, label: 'Ресурсное поле', symbol: '✦' },
  workshop: { x: 83, y: 24, label: 'Мастерская', symbol: '⚒' },
  quiet_space: { x: 19, y: 76, label: 'Тихий сад', symbol: '♣' },
  outskirts: { x: 81, y: 76, label: 'Окраина', symbol: '▲' },
};

const homePoints: readonly MapPoint[] = [
  { x: 8, y: 50, label: 'Дом Alex', symbol: '⌂' },
  { x: 30, y: 8, label: 'Дом Mira', symbol: '⌂' },
  { x: 70, y: 8, label: 'Дом Kai', symbol: '⌂' },
  { x: 92, y: 50, label: 'Дом Noa', symbol: '⌂' },
  { x: 70, y: 92, label: 'Дом Ilan', symbol: '⌂' },
  { x: 30, y: 92, label: 'Дом Rin', symbol: '⌂' },
];

app.innerHTML = `
  <div class="ainkrad-app">
    <header class="world-header">
      <div>
        <p class="eyebrow">AINKRAD v0.3 · автономный мир</p>
        <h1>Первый уровень</h1>
      </div>
      <div class="live-indicator" id="live-indicator">
        <span class="live-dot" aria-hidden="true"></span>
        <span id="live-label">ЗАПУСК</span>
      </div>
    </header>

    <div class="status-strip" aria-label="Состояние мира">
      <span>Тик <strong id="tick-value">0</strong></span>
      <span>Жителей <strong id="population-value">6</strong></span>
      <span>Ресурсы <strong id="resource-value">—</strong></span>
      <span>Cardinal <strong>INTERVENE</strong></span>
    </div>

    <main class="world-layout">
      <section class="world-map" aria-label="Карта Ainkrad">
        <div class="map-grid" aria-hidden="true"></div>
        <svg class="roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M50 50 L17 24 M50 50 L83 24 M50 50 L19 76 M50 50 L81 76" />
          <path d="M8 50 L19 76 M30 8 L17 24 M70 8 L83 24 M92 50 L81 76 M70 92 L81 76 M30 92 L19 76" />
        </svg>
        <div id="places-layer" class="places-layer"></div>
        <div id="agents-layer" class="agents-layer"></div>
        <div class="disturbance-banner" id="disturbance-banner" aria-live="polite"></div>
      </section>

      <aside class="world-sidebar">
        <section class="resident-panel" aria-live="polite">
          <p class="panel-label">Выбранный житель</p>
          <h2 id="resident-name">Мир запускается…</h2>
          <p id="resident-activity" class="resident-activity">Подготавливаем жителей</p>
          <dl class="resident-facts">
            <div><dt>Место</dt><dd id="resident-place">—</dd></div>
            <div><dt>Цель</dt><dd id="resident-goal">—</dd></div>
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
        </section>

        <section class="cardinal-panel">
          <p class="panel-label">Cardinal наблюдает</p>
          <div class="cardinal-numbers">
            <span><strong id="evaluation-value">0</strong> оценок</span>
            <span><strong id="intervention-value">0</strong> вмешательств</span>
          </div>
          <p id="cardinal-message">Cardinal не управляет жителями и вмешивается только при подтверждённой системной проблеме.</p>
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

const placesLayer = requiredElement<HTMLDivElement>('places-layer');
const agentsLayer = requiredElement<HTMLDivElement>('agents-layer');
const tickValue = requiredElement<HTMLElement>('tick-value');
const populationValue = requiredElement<HTMLElement>('population-value');
const resourceValue = requiredElement<HTMLElement>('resource-value');
const evaluationValue = requiredElement<HTMLElement>('evaluation-value');
const interventionValue = requiredElement<HTMLElement>('intervention-value');
const liveIndicator = requiredElement<HTMLElement>('live-indicator');
const liveLabel = requiredElement<HTMLElement>('live-label');
const disturbanceBanner = requiredElement<HTMLElement>('disturbance-banner');
const residentName = requiredElement<HTMLElement>('resident-name');
const residentActivity = requiredElement<HTMLElement>('resident-activity');
const residentPlace = requiredElement<HTMLElement>('resident-place');
const residentGoal = requiredElement<HTMLElement>('resident-goal');
const energyValue = requiredElement<HTMLElement>('energy-value');
const energyBar = requiredElement<HTMLElement>('energy-bar');
const stressValue = requiredElement<HTMLElement>('stress-value');
const stressBar = requiredElement<HTMLElement>('stress-bar');
const personalResourceValue = requiredElement<HTMLElement>('personal-resource-value');
const personalResourceBar = requiredElement<HTMLElement>('personal-resource-bar');
const cardinalMessage = requiredElement<HTMLElement>('cardinal-message');

const avatarElements = new Map<string, HTMLButtonElement>();
let placesRendered = false;
let selectedAgentId: string | undefined;
let lastFrame: ExperimentTickFrame | undefined;
let evaluationCount = 0;
let executedInterventionCount = 0;

const clampMapCoordinate = (value: number) => Math.max(5, Math.min(95, value));
const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

function pointForPlace(placeId: string, agentIndex = 0): MapPoint {
  const publicPoint = publicPlacePoints[placeId];
  if (publicPoint) return publicPoint;

  if (placeId.startsWith('home_')) {
    return homePoints[agentIndex % homePoints.length];
  }

  return { x: 50, y: 50, label: placeId, symbol: '•' };
}

function displayPlaceName(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
): string {
  return (
    publicPlacePoints[agent.locationId]?.label ??
    world.places[agent.locationId]?.name ??
    agent.locationId
  );
}

function renderPlaces(world: Readonly<WorldState>): void {
  if (placesRendered) return;

  const agentIds = Object.keys(world.agents);
  for (const [placeId, place] of Object.entries(world.places)) {
    const homeAgentIndex = agentIds.findIndex(
      (agentId) => world.agents[agentId]?.homeId === placeId,
    );
    const point = pointForPlace(placeId, Math.max(0, homeAgentIndex));
    const placeElement = document.createElement('div');
    placeElement.className =
      place.kind === 'home' ? 'map-place map-place--home' : 'map-place';
    placeElement.style.left = `${point.x}%`;
    placeElement.style.top = `${point.y}%`;
    placeElement.setAttribute('aria-label', point.label);

    const symbol = document.createElement('span');
    symbol.className = 'place-symbol';
    symbol.textContent = point.symbol;

    const label = document.createElement('span');
    label.className = 'place-label';
    label.textContent = point.label;

    placeElement.append(symbol, label);
    placesLayer.append(placeElement);
  }

  placesRendered = true;
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
    <span class="resident-figure" aria-hidden="true">
      <span class="resident-head"></span>
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

function updateSelection(): void {
  if (!lastFrame) return;

  const agents = Object.values(lastFrame.world.agents);
  const selected =
    agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];

  if (!selected) return;

  selectedAgentId = selected.id;

  for (const [agentId, avatar] of avatarElements) {
    avatar.classList.toggle('is-selected', agentId === selected.id);
    avatar.setAttribute('aria-pressed', String(agentId === selected.id));
  }

  residentName.textContent = selected.name;
  residentActivity.textContent = selected.lastAction
    ? actionLabels[selected.lastAction]
    : 'осматривается';
  residentPlace.textContent = displayPlaceName(lastFrame.world, selected);
  residentGoal.textContent = goalLabels[selected.goal.kind];

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
}

function announceDisturbance(tick: number): void {
  const disturbance = disturbances.find((item) => item.tick === tick);

  if (!disturbance) {
    disturbanceBanner.classList.remove('is-visible');
    return;
  }

  disturbanceBanner.textContent =
    disturbance.kind === 'resource_shock'
      ? 'Ресурсный удар'
      : disturbance.kind === 'social_barrier'
        ? 'Социальный барьер'
        : 'Угроза безопасности';

  disturbanceBanner.classList.add('is-visible');
}

function updateWorld(frame: Readonly<ExperimentTickFrame>): void {
  lastFrame = structuredClone(frame);
  renderPlaces(frame.world);

  const agents = Object.values(frame.world.agents);
  if (!selectedAgentId) selectedAgentId = agents[0]?.id;

  agents.forEach((agent, index) => {
    const avatar = ensureAvatar(agent, index);
    const base = pointForPlace(agent.locationId, index);
    const isMoving =
      agent.lastAction !== 'rest' && agent.lastAction !== 'reflect';
    const stride = isMoving ? 3.8 : 1.1;
    const phase = frame.tick * 1.15 + index * 1.7;
    const x = clampMapCoordinate(base.x + Math.sin(phase) * stride);
    const y = clampMapCoordinate(base.y + Math.cos(phase * 0.83) * stride);

    avatar.style.left = `${x}%`;
    avatar.style.top = `${y}%`;
    avatar.classList.toggle('is-moving', isMoving);
    avatar.classList.toggle('is-resting', agent.lastAction === 'rest');
    avatar.setAttribute(
      'aria-label',
      `${agent.name}: ${
        agent.lastAction ? actionLabels[agent.lastAction] : 'осматривается'
      }, ${displayPlaceName(frame.world, agent)}`,
    );
  });

  if (frame.evaluation) evaluationCount += 1;
  if (frame.intervention?.executed) executedInterventionCount += 1;

  tickValue.textContent = String(frame.tick);
  populationValue.textContent = String(agents.length);
  resourceValue.textContent =
    `${Math.round(frame.world.environment.resourcePool * 100)}%`;
  evaluationValue.textContent = String(evaluationCount);
  interventionValue.textContent = String(executedInterventionCount);
  liveLabel.textContent = 'МИР ЖИВЁТ';
  liveIndicator.classList.add('is-live');

  announceDisturbance(frame.tick);
  updateSelection();
}

const result = await runExperiment(
  'intervene',
  'ainkrad-browser-world',
  BROWSER_TICKS,
  disturbances,
  {
    onTick: async (frame) => {
      updateWorld(frame);
      await sleep(TICK_DELAY_MS);
    },
  },
);

lastFrame = {
  tick: result.finalWorld.now,
  world: result.finalWorld,
  metrics: result.finalMetrics,
};

evaluationValue.textContent = String(result.evaluationCount);
interventionValue.textContent = String(result.executedInterventionCount);

cardinalMessage.textContent = result.executedInterventionCount
  ? `Cardinal выполнила ${result.executedInterventionCount} подтверждённых вмешательств через независимый gateway.`
  : 'Мир справился своими силами. Cardinal наблюдала и не вмешивалась без достаточного основания.';

liveLabel.textContent = 'ЦИКЛ ЗАВЕРШЁН';
liveIndicator.classList.remove('is-live');
disturbanceBanner.classList.remove('is-visible');

updateSelection();