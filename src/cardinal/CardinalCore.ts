import { createStableId } from '../core/stableId';
import type { CardinalMetrics, SensorSnapshot } from '../sensors/types';
import {
  advanceCardinalExperience,
  deriveCardinalExperience,
} from './CardinalExperience';
import {
  CARDINAL_AUTONOMY_MAX_RECENT_INTERVENTIONS,
  CARDINAL_AUTONOMY_WINDOW,
  CARDINAL_RESEARCH_VERSION,
  emptyCardinalResearchContext,
  type CardinalResearchContext,
} from './CardinalResearch';
import type {
  CardinalAutonomyAssessment,
  CardinalCapability,
  CardinalDeferReason,
  CardinalEvaluation,
  CardinalMode,
  CardinalPredictionMetric,
  CardinalProblemAssessment,
  CardinalProblemKind,
  InterventionKind,
  InterventionProposal,
} from './types';

export const CARDINAL_POLICY_VERSION = 'ainkrad-cardinal-policy-0.3.13';
export const DEFAULT_CARDINAL_PREDICTION_HORIZON = 4;
export const MAX_CARDINAL_PREDICTION_HORIZON = 16;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clampMagnitude = (value: number) =>
  Math.max(0.05, Math.min(0.25, value));

interface CandidateDefinition {
  problemKind: CardinalProblemKind;
  interventionKind: InterventionKind;
  severity(metrics: CardinalMetrics): number;
  qualifies(metrics: CardinalMetrics): boolean;
  critical(metrics: CardinalMetrics): boolean;
  trendMetric: keyof CardinalMetrics;
  predictionMetric: CardinalPredictionMetric;
  reason: string;
  expectedOutcome: string;
  claim: string;
  falsifier: string;
  requiredCapability?: CardinalCapability;
}

const CANDIDATES: readonly CandidateDefinition[] = [
  {
    problemKind: 'civilization_collapse',
    interventionKind: 'safety_support',
    severity: (metrics) =>
      (metrics.civilizationCriticality ?? 0) +
      (metrics.recentDeathPressure ?? 0) * 0.55 +
      (metrics.monsterDeathShare ?? 0) * (metrics.monsterPressure ?? 0) * 0.45 +
      (metrics.wildlifeAttackDeathShare ?? 0) *
        (metrics.wildlifeDangerPressure ?? 0) *
        0.3,
    qualifies: (metrics) =>
      ((metrics.livingPopulation ?? 100) <= 7 ||
        (metrics.recentDeathPressure ?? 0) > 0.08 ||
        (metrics.civilizationCriticality ?? 0) >= 0.78) &&
      ((metrics.monsterDeathShare ?? 0) +
          (metrics.wildlifeAttackDeathShare ?? 0) > 0.2 ||
        (metrics.monsterPressure ?? 0) > 0.48 ||
        (metrics.wildlifeDangerPressure ?? 0) > 0.34 ||
        metrics.safetyPressure > 0.82),
    critical: (metrics) =>
      ((metrics.livingPopulation ?? 100) <= 7 &&
        ((metrics.monsterDeathShare ?? 0) +
            (metrics.wildlifeAttackDeathShare ?? 0) > 0.1 ||
          (metrics.monsterPressure ?? 0) > 0.3 ||
          (metrics.wildlifeDangerPressure ?? 0) > 0.25 ||
          metrics.safetyPressure > 0.72)) ||
      ((metrics.civilizationCriticality ?? 0) >= 0.9 &&
        ((metrics.monsterDeathShare ?? 0) +
            (metrics.wildlifeAttackDeathShare ?? 0) > 0.25 ||
          (metrics.monsterPressure ?? 0) > 0.55 ||
          (metrics.wildlifeDangerPressure ?? 0) > 0.42 ||
          metrics.safetyPressure > 0.9)) ||
      ((metrics.recentDeathPressure ?? 0) > 0.2 &&
        (metrics.monsterDeathShare ?? 0) +
          (metrics.wildlifeAttackDeathShare ?? 0) > 0.35),
    trendMetric: 'civilizationCriticality',
    predictionMetric: 'safetyPressure',
    reason:
      'Civilization has fallen below the full-society floor or is losing residents faster than it can recover.',
    expectedOutcome:
      'Create a bounded survival window by reducing systemic danger while residents retain every personal decision.',
    claim:
      'The human civilization is in demographic decline; recent mortality and hostile pressure threaten its ability to continue.',
    falsifier:
      'The hypothesis weakens if population stabilizes, death pressure falls and civilization criticality declines without Cardinal assistance.',
  },
  {
    problemKind: 'resource_fragility',
    interventionKind: 'resource_relief',
    severity: (metrics) => metrics.resourcePressure - 0.65,
    qualifies: (metrics) =>
      metrics.resourcePressure > 0.62 && metrics.recoveryCapacity < 0.7,
    critical: (metrics) =>
      metrics.resourcePressure > 0.88 && metrics.recoveryCapacity < 0.3,
    trendMetric: 'resourcePressure',
    predictionMetric: 'resourcePressure',
    reason: 'Resource pressure is high while recovery capacity is weak.',
    expectedOutcome:
      'Restore enough resource slack for agents to recover through their own decisions.',
    claim:
      'The world is experiencing persistent resource fragility that its current recovery mechanisms are not resolving quickly enough.',
    falsifier:
      'The hypothesis weakens if resource pressure falls or recovery capacity rises without Cardinal assistance.',
  },
  {
    problemKind: 'social_fragmentation',
    interventionKind: 'open_shared_space',
    severity: (metrics) => metrics.socialIsolation - 0.65,
    qualifies: (metrics) =>
      metrics.socialIsolation > 0.66 && metrics.relationshipDiversity < 0.5,
    critical: (metrics) =>
      metrics.socialIsolation > 0.9 && metrics.relationshipDiversity < 0.22,
    trendMetric: 'socialIsolation',
    predictionMetric: 'socialIsolation',
    reason: 'Persistent isolation coincides with low meaningful activity.',
    expectedOutcome:
      'Increase opportunity for voluntary interaction without forcing relationships.',
    claim:
      'The society is entering persistent social fragmentation rather than a temporary low-interaction period.',
    falsifier:
      'The hypothesis weakens if isolation falls or meaningful activity recovers without Cardinal intervention.',
  },
  {
    problemKind: 'safety_instability',
    interventionKind: 'safety_support',
    severity: (metrics) => metrics.safetyPressure - 0.58,
    qualifies: (metrics) =>
      metrics.safetyPressure > 0.72 && metrics.averageStress > 0.38,
    critical: (metrics) =>
      metrics.safetyPressure > 0.95 && metrics.averageStress > 0.68,
    trendMetric: 'safetyPressure',
    predictionMetric: 'safetyPressure',
    reason: 'Persistent environmental danger is raising population stress.',
    expectedOutcome:
      'Temporarily restore environmental safety while residents keep control of every personal decision.',
    claim:
      'The world is experiencing a persistent safety failure that endogenous recovery is not resolving quickly enough.',
    falsifier:
      'The hypothesis weakens if environmental danger or population stress falls without Cardinal support.',
  },
  {
    problemKind: 'conflict_overload',
    interventionKind: 'safety_support',
    severity: (metrics) =>
      (metrics.conflictPressure + metrics.averageStress) / 2 - 0.55,
    qualifies: (metrics) =>
      metrics.conflictPressure > 0.7 && metrics.averageStress > 0.6,
    critical: (metrics) =>
      metrics.conflictPressure > 0.9 && metrics.averageStress > 0.8,
    trendMetric: 'averageStress',
    predictionMetric: 'averageStress',
    reason: 'High conflict and stress are reducing recovery capacity.',
    expectedOutcome:
      'Reduce environmental pressure without rewriting agent beliefs or relationships.',
    claim:
      'Conflict and stress are persistently overwhelming the society\'s endogenous recovery capacity.',
    falsifier:
      'The hypothesis weakens if stress or conflict pressure recedes through autonomous adaptation.',
  },
  {
    problemKind: 'ecosystem_fragility',
    interventionKind: 'habitat_support',
    severity: (metrics) => metrics.wildlifePressure - 0.58,
    qualifies: (metrics) =>
      metrics.exploredWorldRatio > 0 && metrics.wildlifePressure > 0.7,
    critical: (metrics) =>
      metrics.exploredWorldRatio > 0 && metrics.wildlifePressure > 0.94,
    trendMetric: 'wildlifePressure',
    predictionMetric: 'wildlifePressure',
    reason:
      'Wildlife populations are depleted across discovered habitats.',
    expectedOutcome:
      'Temporarily improve habitat recovery while residents remain free to hunt, abstain or adapt.',
    claim:
      'The discovered ecosystem is losing wildlife faster than its own recovery cycle restores it.',
    falsifier:
      'The hypothesis weakens if wildlife pressure falls through natural recovery or changed resident behavior.',
    requiredCapability: 'habitat_support_planning',
  },
];

function trendFromDelta(delta: number): 'rising' | 'stable' | 'falling' {
  if (delta > 0.04) return 'rising';
  if (delta < -0.04) return 'falling';
  return 'stable';
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
    research: CardinalResearchContext = emptyCardinalResearchContext(),
  ): CardinalEvaluation {
    if (research.researchVersion !== CARDINAL_RESEARCH_VERSION) {
      throw new Error(
        `Cardinal research version ${research.researchVersion} is incompatible with ${CARDINAL_RESEARCH_VERSION}.`,
      );
    }

    const experience = advanceCardinalExperience(
      research.experience ?? deriveCardinalExperience([], []),
      observation.metrics,
    );

    const qualified = CANDIDATES
      .filter((candidate) => candidate.qualifies(observation.metrics))
      .map((candidate) => ({
        candidate,
        severity: Math.max(0, candidate.severity(observation.metrics)),
      }))
      .sort((a, b) => b.severity - a.severity);

    const selected = qualified[0];
    let detectedProblem: CardinalProblemAssessment | undefined;
    let decision: CardinalEvaluation['decision'] = 'no_action';
    let rationale = 'No systemic condition currently justifies intervention.';
    let deferReason: CardinalDeferReason | undefined;
    let autonomyAssessment: CardinalAutonomyAssessment | undefined;
    const reasoningFactors: string[] = [];

    if (selected) {
      const isCritical = selected.candidate.critical(observation.metrics);
      detectedProblem = this.assessProblem(
        selected.candidate,
        selected.severity,
        isCritical,
        observation,
        research,
      );
      autonomyAssessment = this.assessAutonomy(
        selected.candidate.interventionKind,
        observation,
        research,
      );
      const recentAdverseOutcomes = this.recentAdverseOutcomes(
        selected.candidate.interventionKind,
        research,
      );

      reasoningFactors.push(
        `problem=${detectedProblem.kind}`,
        `severity=${detectedProblem.severity.toFixed(3)}`,
        `persistence=${detectedProblem.persistence}`,
        `trend=${detectedProblem.trend}`,
        `confidence=${detectedProblem.confidence.toFixed(3)}`,
        `recent_adverse_outcomes=${recentAdverseOutcomes.length}`,
        `autonomy_budget=${autonomyAssessment.budgetStatus}`,
        `recent_executed_interventions=${autonomyAssessment.recentExecutedInterventionIds.length}`,
        `same_kind_in_progress=${autonomyAssessment.activeOrUnresolvedSameKindIds.length}`,
        `cardinal_level=${experience.level}`,
        `cardinal_experience=${experience.totalExperience}`,
        `living_population=${observation.metrics.livingPopulation}`,
        `reproductive_pairs=${observation.metrics.reproductivePairPotential}`,
        `reproductive_continuity=${observation.metrics.reproductiveContinuity.toFixed(3)}`,
      );

      const capabilityReady =
        !selected.candidate.requiredCapability ||
        experience.capabilities.includes(
          selected.candidate.requiredCapability,
        );
      if (selected.candidate.requiredCapability) {
        reasoningFactors.push(
          `required_capability=${selected.candidate.requiredCapability}`,
          `capability_ready=${capabilityReady}`,
        );
      }

      if (!capabilityReady) {
        decision = 'defer';
        deferReason = 'capability_not_ready';
        rationale =
          `${selected.candidate.reason} Cardinal has not yet accumulated enough independent ecosystem observations to plan this class of intervention.`;
      } else if (autonomyAssessment.activeOrUnresolvedSameKindIds.length > 0) {
        decision = 'defer';
        deferReason = 'experiment_in_progress';
        rationale =
          `${selected.candidate.reason} Cardinal is deferring because an earlier intervention of the same kind is still active or has not yet produced its scheduled outcome. Overlapping tests would confound the evidence.`;
      } else if (!isCritical && detectedProblem.persistence < 3) {
        decision = 'defer';
        deferReason = 'insufficient_persistence';
        rationale =
          `${selected.candidate.reason} Cardinal is deferring because the condition has not yet persisted across three compatible observations.`;
      } else if (!isCritical && autonomyAssessment.budgetStatus === 'exhausted') {
        decision = 'defer';
        deferReason = 'autonomy_budget';
        rationale =
          `${selected.candidate.reason} Cardinal is deferring because recent intervention density has exhausted the autonomy budget. The world must be given a washout period to recover or fail through its own mechanisms before another non-critical test.`;
      } else if (!isCritical && recentAdverseOutcomes.length >= 2) {
        decision = 'defer';
        deferReason = 'failed_prediction_caution';
        rationale =
          `${selected.candidate.reason} Cardinal is deferring because two recent post-intervention observations for the same action failed its stated prediction; this is caution, not a causal conclusion.`;
      } else {
        decision = 'propose';
        rationale = isCritical
          ? `${selected.candidate.reason} The condition crossed the critical threshold, so Cardinal may propose a minimal intervention without waiting for the normal persistence window.`
          : `${selected.candidate.reason} The condition persisted across multiple observations, so a minimal falsifiable intervention may be tested.`;
        if (isCritical && autonomyAssessment.budgetStatus === 'exhausted') {
          reasoningFactors.push('critical_autonomy_budget_override=true');
        }
      }
    }

    const evaluationId = createStableId('evaluation', {
      worldId: observation.worldId,
      worldRevision: observation.worldRevision,
      sensorVersion: observation.sensorVersion,
      policyVersion: this.policyVersion,
      researchVersion: research.researchVersion,
      researchContextFingerprint: research.fingerprint,
      observedAt: observation.observedAt,
      mode,
      metrics: observation.metrics,
      evidenceEventIds: observation.evidenceEventIds,
      limitations: observation.limitations,
      detectedProblem,
      decision,
      deferReason,
      autonomyAssessment,
      experience,
    });

    const evaluation: CardinalEvaluation = {
      evaluationId,
      worldId: observation.worldId,
      evaluatedAt: observation.observedAt,
      observedWorldRevision: observation.worldRevision,
      sensorVersion: observation.sensorVersion,
      policyVersion: this.policyVersion,
      researchVersion: research.researchVersion,
      researchContextFingerprint: research.fingerprint,
      mode,
      metrics: structuredClone(observation.metrics),
      evidenceEventIds: [...observation.evidenceEventIds],
      uncertaintyNotes: [...observation.limitations],
      detectedProblem,
      decision,
      deferReason,
      autonomyAssessment,
      rationale,
      reasoningFactors,
      experience,
      hypotheticalOnly: mode === 'observer',
    };

    if (selected && detectedProblem && decision === 'propose') {
      const magnitude = clampMagnitude(
        Math.min(selected.severity, 0.08 + detectedProblem.confidence * 0.12),
      );
      const proposal: InterventionProposal = {
        proposalId: createStableId('proposal', {
          evaluationId,
          hypothesisId: detectedProblem.hypothesisId,
          kind: selected.candidate.interventionKind,
          magnitude,
        }),
        worldId: observation.worldId,
        hypothesisId: detectedProblem.hypothesisId,
        kind: selected.candidate.interventionKind,
        magnitude,
        reason: selected.candidate.reason,
        expectedOutcome: selected.candidate.expectedOutcome,
        prediction: {
          metric: selected.candidate.predictionMetric,
          direction: 'decrease',
          minimumImprovement: 0.01,
          horizon: DEFAULT_CARDINAL_PREDICTION_HORIZON,
          statement:
            `${selected.candidate.predictionMetric} should decrease by at least 0.01 within ${DEFAULT_CARDINAL_PREDICTION_HORIZON} logical ticks.`,
        },
      };

      evaluation.proposal = proposal;
    }

    return evaluation;
  }

  private assessProblem(
    definition: CandidateDefinition,
    severity: number,
    criticalThresholdCrossed: boolean,
    observation: SensorSnapshot,
    research: CardinalResearchContext,
  ): CardinalProblemAssessment {
    const compatibleHistory = research.priorEvaluations.filter(
      (evaluation) =>
        evaluation.policyVersion === this.policyVersion &&
        evaluation.sensorVersion === observation.sensorVersion,
    );

    const supporting: CardinalEvaluation[] = [];
    for (let index = compatibleHistory.length - 1; index >= 0; index -= 1) {
      const evaluation = compatibleHistory[index];
      if (!definition.qualifies(evaluation.metrics)) {
        break;
      }
      supporting.unshift(evaluation);
    }

    const previousMetric = supporting.at(-1)?.metrics[definition.trendMetric];
    const currentMetric = observation.metrics[definition.trendMetric];
    const trend = trendFromDelta(
      typeof previousMetric === 'number' && typeof currentMetric === 'number'
        ? currentMetric - previousMetric
        : 0,
    );

    const priorHypothesis = [...supporting]
      .reverse()
      .map((evaluation) => evaluation.detectedProblem)
      .find((problem) => problem?.kind === definition.problemKind)?.hypothesisId;

    const hypothesisId =
      priorHypothesis ??
      createStableId('hypothesis', {
        worldId: observation.worldId,
        problemKind: definition.problemKind,
        firstObservedAt: observation.observedAt,
        firstWorldRevision: observation.worldRevision,
        sensorVersion: observation.sensorVersion,
        policyVersion: this.policyVersion,
      });

    const relevantInterventionIds = new Set(
      research.priorInterventions
        .filter((item) => item.proposal.kind === definition.interventionKind)
        .map((item) => item.interventionId),
    );
    const priorOutcomeIds = research.priorOutcomes
      .filter((outcome) => relevantInterventionIds.has(outcome.interventionId))
      .slice(-3)
      .map((outcome) => outcome.outcomeId);

    const limitationPenalty = Math.min(0.3, observation.limitations.length * 0.08);
    const confidence = clamp01(
      0.35 + Math.min(0.45, (supporting.length + 1) * 0.15) - limitationPenalty,
    );

    return {
      hypothesisId,
      kind: definition.problemKind,
      severity: clamp01(severity),
      persistence: supporting.length + 1,
      trend,
      confidence,
      criticalThresholdCrossed,
      supportingEvaluationIds: supporting.map((evaluation) => evaluation.evaluationId),
      priorOutcomeIds,
      claim: definition.claim,
      falsifier: definition.falsifier,
    };
  }

  private assessAutonomy(
    interventionKind: InterventionKind,
    observation: SensorSnapshot,
    research: CardinalResearchContext,
  ): CardinalAutonomyAssessment {
    const resolved = new Set(
      research.priorOutcomes.map((outcome) => outcome.interventionId),
    );
    const executed = research.priorInterventions.filter(
      (intervention) =>
        intervention.executed && intervention.requestedAt < observation.observedAt,
    );
    const recent = executed.filter(
      (intervention) =>
        observation.observedAt - intervention.requestedAt <= CARDINAL_AUTONOMY_WINDOW,
    );
    const activeOrUnresolved = executed.filter((intervention) => {
      if (
        !Number.isFinite(intervention.authorizedEffectDuration) ||
        intervention.authorizedEffectDuration < 1
      ) {
        throw new Error(
          `Cardinal research intervention ${intervention.interventionId} is missing a valid authorized effect duration.`,
        );
      }
      const effectOrPredictionHorizon = Math.max(
        intervention.authorizedEffectDuration,
        intervention.proposal.prediction.horizon,
      );
      const stillInsideWashout =
        intervention.requestedAt + effectOrPredictionHorizon > observation.observedAt;
      return !resolved.has(intervention.interventionId) || stillInsideWashout;
    });
    const sameKind = activeOrUnresolved.filter(
      (intervention) => intervention.proposal.kind === interventionKind,
    );
    const interventionDensity = clamp01(
      recent.length / CARDINAL_AUTONOMY_MAX_RECENT_INTERVENTIONS,
    );
    const budgetStatus: CardinalAutonomyAssessment['budgetStatus'] =
      recent.length >= CARDINAL_AUTONOMY_MAX_RECENT_INTERVENTIONS
        ? 'exhausted'
        : recent.length === CARDINAL_AUTONOMY_MAX_RECENT_INTERVENTIONS - 1
          ? 'caution'
          : 'open';

    return {
      window: CARDINAL_AUTONOMY_WINDOW,
      recentExecutedInterventionIds: recent.map(
        (intervention) => intervention.interventionId,
      ),
      activeOrUnresolvedInterventionIds: activeOrUnresolved.map(
        (intervention) => intervention.interventionId,
      ),
      activeOrUnresolvedSameKindIds: sameKind.map(
        (intervention) => intervention.interventionId,
      ),
      interventionDensity,
      dependencyRisk: interventionDensity,
      budgetStatus,
    };
  }

  private recentAdverseOutcomes(
    interventionKind: InterventionKind,
    research: CardinalResearchContext,
  ) {
    const relevantInterventionIds = new Set(
      research.priorInterventions
        .filter(
          (intervention) =>
            intervention.executed && intervention.proposal.kind === interventionKind,
        )
        .map((intervention) => intervention.interventionId),
    );

    return research.priorOutcomes
      .filter((outcome) => relevantInterventionIds.has(outcome.interventionId))
      .slice(-2)
      .filter((outcome) => !outcome.expectedDirectionObserved);
  }
}
