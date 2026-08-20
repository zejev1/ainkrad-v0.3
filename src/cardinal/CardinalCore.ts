import { createStableId } from '../core/stableId';
import type { SensorSnapshot } from '../sensors/types';
import type {
  CardinalEvaluation,
  CardinalMode,
  InterventionKind,
  InterventionProposal,
} from './types';

export const CARDINAL_POLICY_VERSION = 'ainkrad-cardinal-policy-0.3.3';

const clampMagnitude = (value: number) =>
  Math.max(0.05, Math.min(0.25, value));

interface Candidate {
  kind: InterventionKind;
  severity: number;
  reason: string;
  expectedOutcome: string;
}

export class CardinalCore {
  constructor(
    readonly policyVersion: string = CARDINAL_POLICY_VERSION,
  ) {
    if (!policyVersion.trim()) {
      throw new Error('Cardinal policyVersion must not be empty.');
    }
  }

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

    candidates.sort((a, b) => b.severity - a.severity);
    const selected = candidates[0];

    const evaluationId = createStableId('evaluation', {
      worldId: observation.worldId,
      worldRevision: observation.worldRevision,
      sensorVersion: observation.sensorVersion,
      policyVersion: this.policyVersion,
      observedAt: observation.observedAt,
      mode,
      metrics: observation.metrics,
      evidenceEventIds: observation.evidenceEventIds,
      limitations: observation.limitations,
    });

    const evaluation: CardinalEvaluation = {
      evaluationId,
      worldId: observation.worldId,
      evaluatedAt: observation.observedAt,
      observedWorldRevision: observation.worldRevision,
      sensorVersion: observation.sensorVersion,
      policyVersion: this.policyVersion,
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
        proposalId: createStableId('proposal', {
          evaluationId,
          kind: selected.kind,
          magnitude: clampMagnitude(selected.severity),
        }),
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
