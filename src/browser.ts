import { runExperiment } from './experiment/ExperimentRunner';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Ainkrad browser root not found.');
}

app.innerHTML = '<h2>Мир Ainkrad запускается...</h2>';

const result = await runExperiment(
  'intervene',
  'ainkrad-browser-world',
  60,
  [
    {
      tick: 12,
      kind: 'resource_shock',
      magnitude: 0.6,
    },
    {
      tick: 30,
      kind: 'social_barrier',
      magnitude: 0.5,
      duration: 8,
    },
    {
      tick: 45,
      kind: 'safety_shock',
      magnitude: 0.5,
      duration: 8,
    },
  ],
);

const world = result.finalWorld;
const agents = Object.values(world.agents);
const metrics = result.finalMetrics;

app.innerHTML = `
  <h1>Ainkrad v0.3</h1>

  <h2>Живой мир</h2>
  <p>Тик: <b>${world.now}</b></p>
  <p>Ревизия мира: <b>${world.revision}</b></p>
  <p>Население: <b>${agents.length}</b></p>
  <p>Ресурсы мира: <b>${world.environment.resourcePool.toFixed(2)}</b></p>

  <h2>Cardinal</h2>
  <p>Режим: <b>INTERVENE</b></p>
  <p>Оценок: <b>${result.evaluationCount}</b></p>
  <p>Вмешательств: <b>${result.executedInterventionCount}</b></p>
  <p>Зафиксированных результатов: <b>${result.outcomeCount}</b></p>
  <p>Ожидающих результатов: <b>${result.pendingOutcomeCount}</b></p>

  <h2>Состояние общества</h2>
  <p>Средний стресс: <b>${metrics.averageStress.toFixed(3)}</b></p>
  <p>Социальная изоляция: <b>${metrics.socialIsolation.toFixed(3)}</b></p>
  <p>Давление ресурсов: <b>${metrics.resourcePressure.toFixed(3)}</b></p>
  <p>Способность к восстановлению: <b>${metrics.recoveryCapacity.toFixed(3)}</b></p>

  <h2>Жители</h2>

  ${agents
    .map(
      (agent) => `
        <hr>
        <h3>${agent.name}</h3>
        <p>Цель: <b>${agent.goal.kind}</b></p>
        <p>Действие: <b>${agent.lastAction ?? '—'}</b></p>
        <p>Место: <b>${world.places[agent.locationId]?.name ?? agent.locationId}</b></p>
        <p>Энергия: ${agent.energy.toFixed(2)}</p>
        <p>Стресс: ${agent.stress.toFixed(2)}</p>
        <p>Личные ресурсы: ${agent.resources.toFixed(2)}</p>
        <p>Потребность в общении: ${agent.socialDrive.toFixed(2)}</p>
      `,
    )
    .join('')}
`;