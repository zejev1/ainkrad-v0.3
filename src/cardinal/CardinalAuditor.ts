import {
  createEventId,
} from '../runtime/inputBus/createEventId';

import type {
  AuditRecord,
  CardinalEvaluation,
  InterventionRecord,
} from './types';

export class CardinalAuditor {
  auditDecision(
    evaluation:
      Readonly<
        CardinalEvaluation
      >,
    intervention:
      Readonly<
        InterventionRecord
      > |
      undefined,
    now: number,
  ): AuditRecord {
    const concerns:
      string[] = [];

    if (
      evaluation.mode ===
        'observer' &&
      intervention?.executed
    ) {
      concerns.push(
        'Observer mode caused a world intervention.',
      );
    }

    if (
      evaluation.proposal &&
      evaluation.proposal
        .magnitude >
        0.25
    ) {
      concerns.push(
        'Proposed intervention exceeded the minimal-intervention magnitude.',
      );
    }

    if (
      evaluation.decision ===
        'propose' &&
      !evaluation.proposal
    ) {
      concerns.push(
        'Evaluation proposed action without a concrete proposal.',
      );
    }

    if (
      intervention?.executed &&
      !intervention
        .authorized
    ) {
      concerns.push(
        'An unauthorized intervention was executed.',
      );
    }

    return {
      auditId:
        createEventId(
          'audit',
        ),
      worldId:
        evaluation.worldId,
      auditedAt:
        now,
      evaluationId:
        evaluation
          .evaluationId,
      interventionId:
        intervention
          ?.interventionId,
      accepted:
        concerns.length ===
        0,
      concerns,
    };
  }
}
