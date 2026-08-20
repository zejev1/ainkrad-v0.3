import {
  CardinalAuditor,
} from '../cardinal/CardinalAuditor';

import {
  CardinalCore,
} from '../cardinal/CardinalCore';

import {
  InMemoryCardinalJournal,
} from '../cardinal/InMemoryCardinalJournal';

import {
  CardinalObserver,
} from '../cardinal/CardinalObserver';

import {
  CardinalRuntime,
} from '../cardinal/CardinalRuntime';

import {
  IndependentInterventionGateway,
} from '../cardinal/InterventionGateway';

import type {
  CardinalMode,
} from '../cardinal/types';

import {
  WorldSensors,
} from '../sensors/WorldSensors';

import {
  InMemoryEventStore,
} from '../world/InMemoryEventStore';

import {
  WorldEngine,
} from '../world/WorldEngine';

export interface ExperimentResult {
  mode: CardinalMode;
  finalWorld:
    ReturnType<
      WorldEngine['snapshot']
    >;
  evaluationCount: number;
  interventionCount: number;
  auditCount: number;
}

export async function runExperiment(
  mode: CardinalMode,
  seed: string,
  ticks: number,
): Promise<ExperimentResult> {
  const eventStore =
    new InMemoryEventStore();

  const world =
    new WorldEngine({
      worldId:
        `world_${mode}`,
      seed,
      eventStore,
      startTime:
        0,
    });

  const sensors =
    new WorldSensors(
      eventStore,
    );

  const journal =
    new InMemoryCardinalJournal();

  const cardinal =
    new CardinalRuntime(
      new CardinalObserver(
        sensors,
      ),
      new CardinalCore(),
      new IndependentInterventionGateway(),
      new CardinalAuditor(),
      journal,
    );

  for (
    let tick = 1;
    tick <= ticks;
    tick += 1
  ) {
    await world.step(
      tick,
    );

    await cardinal.cycle(
      mode,
      world,
      tick,
    );
  }

  const worldId =
    world.snapshot().id;

  return {
    mode,
    finalWorld:
      world.snapshot(),
    evaluationCount:
      (
        await journal
          .evaluations(
            worldId,
          )
      ).length,
    interventionCount:
      (
        await journal
          .interventions(
            worldId,
          )
      ).length,
    auditCount:
      (
        await journal
          .audits(
            worldId,
          )
      ).length,
  };
}
