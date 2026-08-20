import {
  createEventId,
} from '../runtime/inputBus/createEventId';

import {
  WorldEngine,
} from '../world/WorldEngine';

import {
  CardinalAuditor,
} from './CardinalAuditor';

import {
  CardinalCore,
} from './CardinalCore';

import type {
  CardinalJournal,
} from './CardinalJournal';

import {
  CardinalObserver,
} from './CardinalObserver';

import type {
  InterventionGateway,
} from './InterventionGateway';

import type {
  CardinalMode,
  InterventionRecord,
} from './types';

export class CardinalRuntime {
  constructor(
    private readonly observer:
      CardinalObserver,
    private readonly core:
      CardinalCore,
    private readonly gateway:
      InterventionGateway,
    private readonly auditor:
      CardinalAuditor,
    private readonly journal:
      CardinalJournal,
  ) {}

  async cycle(
    mode: CardinalMode,
    world:
      WorldEngine,
    now: number,
  ): Promise<void> {
    if (
      mode ===
      'off'
    ) {
      return;
    }

    const before =
      world.snapshot();

    const observation =
      await this.observer
        .observe(
          before,
          now,
        );

    const evaluation =
      this.core.evaluate(
        mode,
        observation,
      );

    await this.journal
      .appendEvaluation(
        evaluation,
      );

    let intervention:
      InterventionRecord |
      undefined;

    if (
      mode ===
        'intervene' &&
      evaluation.proposal
    ) {
      const decision =
        await this.gateway
          .authorize(
            evaluation.proposal,
            before,
          );

      intervention = {
        interventionId:
          createEventId(
            'intervention',
          ),
        evaluationId:
          evaluation
            .evaluationId,
        worldId:
          evaluation
            .worldId,
        requestedAt:
          now,
        proposal:
          structuredClone(
            evaluation.proposal,
          ),
        authorized:
          decision.authorized,
        authorizationReason:
          decision.reason,
        executed: false,
      };

      if (
        decision.authorized
      ) {
        await world
          .applyEnvironmentalIntervention(
            evaluation
              .proposal
              .kind,
            evaluation
              .proposal
              .magnitude,
            now,
          );

        intervention.executed =
          true;
      }

      await this.journal
        .appendIntervention(
          intervention,
        );
    }

    const audit =
      this.auditor
        .auditDecision(
          evaluation,
          intervention,
          now,
        );

    await this.journal
      .appendAudit(
        audit,
      );
  }
}
