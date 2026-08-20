import { CardinalAuditor } from '../cardinal/CardinalAuditor';
import { CardinalCore } from '../cardinal/CardinalCore';
import { InMemoryCardinalJournal } from '../cardinal/InMemoryCardinalJournal';
import { CardinalObserver } from '../cardinal/CardinalObserver';
import { CardinalRuntime } from '../cardinal/CardinalRuntime';
import { IndependentInterventionGateway } from '../cardinal/InterventionGateway';
import type {
  CardinalEvaluation,
  CardinalMode,
  InterventionRecord,
} from '../cardinal/types';
import { WorldSensors } from '../sensors/WorldSensors';
import { InMemoryEventStore } from '../world/InMemoryEventStore';
import { InMemoryMemoryStore } from '../world/InMemoryMemoryStore';
import { WorldEngine } from '../world/WorldEngine';
import type { WorldDisturbanceKind } from '../world/types';

export interface ScheduledDisturbance {
  tick: number;
  kind: WorldDisturbanceKind;
  magnitude: number;
  duration?: number;
}

interface PendingOutcome {
  dueTick: number;
  evaluation: CardinalEvaluation;
  intervention: InterventionRecord;
}

export interface ExperimentResult {
  mode: CardinalMode;
  finalWorld: ReturnType<WorldEngine['snapshot']>;
  evaluationCount: number;
  interventionCount: number;
  outcomeCount: number;
  auditCount: number;
}

export async function runExperiment(
  mode: CardinalMode,
  seed: string,
  ticks: number,
  disturbances: readonly ScheduledDisturbance[] = [],
): Promise<ExperimentResult> {
  const eventStore = new InMemoryEventStore();
  const world = new WorldEngine({
    // The same logical world ID and seed are used for paired runs. OFF and
    // OBSERVER should therefore remain exactly equivalent if observation has
    // no side effects.
    worldId: 'experiment_world',
    seed,
    eventStore,
    memoryStore: new InMemoryMemoryStore(),
    startTime: 0,
  });

  const sensors = new WorldSensors(eventStore);
  const observer = new CardinalObserver(sensors);
  const journal = new InMemoryCardinalJournal();
  const cardinal = new CardinalRuntime(observer, new CardinalCore(), journal);
  const gateway = new IndependentInterventionGateway(world);
  const auditor = new CardinalAuditor();
  const pendingOutcomes: PendingOutcome[] = [];
  const outcomeHorizon = 4;

  for (let tick = 1; tick <= ticks; tick += 1) {
    for (const disturbance of disturbances) {
      if (disturbance.tick === tick) {
        await world.applyDisturbance(
          disturbance.kind,
          disturbance.magnitude,
          tick,
          disturbance.duration,
        );
      }
    }

    await world.step(tick);

    // Outcome evaluation is independent of Core reasoning. It uses the same
    // read-only world sensors but is performed by the Auditor path.
    for (let index = pendingOutcomes.length - 1; index >= 0; index -= 1) {
      const pending = pendingOutcomes[index];
      if (pending.dueTick > tick) {
        continue;
      }

      const afterObservation = await sensors.observe(world.snapshot(), tick);
      const outcome = auditor.observeOutcome(
        pending.evaluation,
        pending.intervention,
        afterObservation.metrics,
        tick,
      );
      await journal.appendOutcome(outcome);
      await journal.appendAudit(auditor.auditOutcome(pending.evaluation, outcome, tick));
      pendingOutcomes.splice(index, 1);
    }

    const evaluation = await cardinal.cycle(mode, world.snapshot(), tick);
    if (!evaluation) {
      continue;
    }

    let intervention: InterventionRecord | undefined;

    if (mode === 'intervene' && evaluation.proposal) {
      intervention = await gateway.execute(
        evaluation.evaluationId,
        evaluation.proposal,
        world.snapshot(),
        tick,
      );
      await journal.appendIntervention(intervention);

      if (intervention.executed) {
        pendingOutcomes.push({
          dueTick: tick + outcomeHorizon,
          evaluation: structuredClone(evaluation),
          intervention: structuredClone(intervention),
        });
      }
    }

    await journal.appendAudit(auditor.auditDecision(evaluation, intervention, tick));
  }

  const worldId = world.snapshot().id;

  return {
    mode,
    finalWorld: world.snapshot(),
    evaluationCount: (await journal.evaluations(worldId)).length,
    interventionCount: (await journal.interventions(worldId)).length,
    outcomeCount: (await journal.outcomes(worldId)).length,
    auditCount: (await journal.audits(worldId)).length,
  };
}

export async function runControlledComparison(
  seed: string,
  ticks: number,
  disturbances: readonly ScheduledDisturbance[] = [],
): Promise<{
  off: ExperimentResult;
  observer: ExperimentResult;
  intervene: ExperimentResult;
}> {
  const [off, observer, intervene] = await Promise.all([
    runExperiment('off', seed, ticks, disturbances),
    runExperiment('observer', seed, ticks, disturbances),
    runExperiment('intervene', seed, ticks, disturbances),
  ]);

  return { off, observer, intervene };
}
