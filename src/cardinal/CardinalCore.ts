import { createEventId } from '../runtime/inputBus/createEventId';
import type { SensorSnapshot } from '../sensors/types';
import type {
  CardinalEvaluation,
  CardinalMode,
  InterventionKind,
  InterventionProposal,
} from './types';

const clampMagnitude = (value: number) =>
  Math.max(0.05, Math.min(0.25, value));

interface Candidate {
  kind: InterventionKind;
  severity: number;
  reason: string;
  expectedOutcome: string;
}

export class CardinalCore {
  evaluate(
    mode: Exclude<CardinalMode, 'off'>,
    observation: SensorSnapshot,
  ): CardinalEvaluation {
    const { metrics } = observation;
    const candidates: Candidate[] = [];

    if (metrics.resourcePressure > 0.72 && metrics.recoveryCapacity < 0.45) {
      candidates.push({
        kind: 'resource_relief',
        severity: metrics.resourcePressure - 0.65,
        reason: 'Resource pressure is high while recovery capacity is weak.',
        expectedOutcome:
          'Restore enough resource slack for agents to recover through their own decisions.',
      });
    }

    if (metrics.socialIsolation > 0.72 && metrics.populationActivity < 0.55) {
      candidates.push({
        kind: 'open_shared_space',
        severity: metrics.socialIsolation - 0.65,
        reason: 'Persistent isolation coincides with low meaningful activity.',
        expectedOutcome:
          'Increase opportunity for voluntary interaction without forcing relationships.',
      });
    }

    if (metrics.conflictPressure > 0.7 && metrics.averageStress > 0.6) {
      candidates.push({
        kind: 'safety_support',
        severity:
          (metrics.conflictPressure + metrics.averageStress) / 2 - 0.55,
        reason: 'High conflict and stress are reducing recovery capacity.',
        expectedOutcome:
          'Reduce environmental pressure without rewriting agent beliefs or relationships.',
      });
    }

    // If several systemic problems qualify at once, choose the strongest
    // measured condition rather than silently encoding a permanent priority
    // order such as "resources always beat social collapse".
    candidates.sort((a, b) => b.severity - a.severity);
    const selected = candidates[0];

    const evaluation: CardinalEvaluation = {
      evaluationId: createEventId('evaluation'),
      worldId: observation.worldId,
      evaluatedAt: observation.observedAt,
      mode,
      metrics: structuredClone(metrics),
      evidenceEventIds: [...observation.evidenceEventIds],
      uncertaintyNotes: [...observation.limitations],
      decision: selected ? 'propose' : 'no_action',
      rationale:
        selected?.reason ??
        'No systemic condition currently justifies intervention.',
      hypotheticalOnly: mode === 'observer',
    };

    if (selected) {
      const proposal: InterventionProposal = {
        proposalId: createEventId('proposal'),
        worldId: observation.worldId,
        kind: selected.kind,
        magnitude: clampMagnitude(selected.severity),
        reason: selected.reason,
        expectedOutcome: selected.expectedOutcome,
      };

      evaluation.proposal = proposal;
    }

    return evaluation;
  }
}
