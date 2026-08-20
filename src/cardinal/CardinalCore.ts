import {
  createEventId,
} from '../runtime/inputBus/createEventId';

import type {
  SensorSnapshot,
} from '../sensors/types';

import type {
  CardinalEvaluation,
  CardinalMode,
  InterventionKind,
  InterventionProposal,
} from './types';

const clampMagnitude = (
  value: number,
) =>
  Math.max(
    0.05,
    Math.min(
      0.25,
      value,
    ),
  );

export class CardinalCore {
  evaluate(
    mode:
      Exclude<
        CardinalMode,
        'off'
      >,
    observation:
      SensorSnapshot,
  ): CardinalEvaluation {
    const {
      metrics,
    } = observation;

    let kind:
      InterventionKind |
      undefined;

    let severity =
      0;

    let reason =
      'No systemic condition currently justifies intervention.';

    let expectedOutcome =
      'World continues without Cardinal intervention.';

    if (
      metrics.resourcePressure >
        0.72 &&
      metrics.recoveryCapacity <
        0.45
    ) {
      kind =
        'resource_relief';

      severity =
        metrics
          .resourcePressure -
        0.65;

      reason =
        'Resource pressure is high while recovery capacity is weak.';

      expectedOutcome =
        'Restore enough resource slack for agents to recover through their own decisions.';
    } else if (
      metrics.socialIsolation >
        0.72 &&
      metrics.populationActivity <
        0.55
    ) {
      kind =
        'open_shared_space';

      severity =
        metrics
          .socialIsolation -
        0.65;

      reason =
        'Persistent isolation coincides with low meaningful activity.';

      expectedOutcome =
        'Increase opportunity for voluntary interaction without forcing relationships.';
    } else if (
      metrics.conflictPressure >
        0.7 &&
      metrics.averageStress >
        0.6
    ) {
      kind =
        'safety_support';

      severity =
        (
          metrics
            .conflictPressure +
          metrics
            .averageStress
        ) /
          2 -
        0.55;

      reason =
        'High conflict and stress are reducing recovery capacity.';

      expectedOutcome =
        'Reduce environmental pressure without rewriting agent beliefs or relationships.';
    }

    const evaluation:
      CardinalEvaluation = {
        evaluationId:
          createEventId(
            'evaluation',
          ),
        worldId:
          observation.worldId,
        evaluatedAt:
          observation
            .observedAt,
        mode,
        metrics:
          structuredClone(
            metrics,
          ),
        evidenceEventIds:
          [
            ...observation
              .evidenceEventIds,
          ],
        decision:
          kind
            ? 'propose'
            : 'no_action',
        rationale:
          reason,
        hypotheticalOnly:
          mode ===
          'observer',
      };

    if (kind) {
      const proposal:
        InterventionProposal = {
          proposalId:
            createEventId(
              'proposal',
            ),
          worldId:
            observation.worldId,
          kind,
          magnitude:
            clampMagnitude(
              severity,
            ),
          reason,
          expectedOutcome,
        };

      evaluation.proposal =
        proposal;
    }

    return evaluation;
  }
}
