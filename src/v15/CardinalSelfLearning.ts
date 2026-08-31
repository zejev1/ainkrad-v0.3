export type CardinalLearningKind =
  | 'safety_support'
  | 'resource_relief'
  | 'open_shared_space'
  | 'habitat_support';

export interface CardinalLearningOutcome {
  outcomeId: string;
  interventionId: string;
  kind: CardinalLearningKind;
  worldEpoch: string;
  policyVersion: string;
  sensorVersion: string;
  observedWorldMinutes: number;
  expectedDirectionObserved: boolean;
  /**
   * Absolute measured improvement in the proposal's predicted direction.
   * 0 means no measurable improvement. Values above 1 are rejected.
   */
  measuredImprovement: number;
  /**
   * True when overlapping interventions, missing observations or other
   * conditions make causal attribution unsafe.
   */
  confounded?: boolean;
}

export interface CardinalLearningProfile {
  kind: CardinalLearningKind;
  usableTrials: number;
  successes: number;
  failures: number;
  inconclusive: number;
  reliability: number;
  meanMeasuredImprovement: number;
  adverseStreak: number;
  confidenceAdjustment: number;
}

export interface CardinalLearningBook {
  policyVersion: string;
  sensorVersion: string;
  profiles: Record<CardinalLearningKind, CardinalLearningProfile>;
  usableOutcomeIds: string[];
  excludedOutcomeIds: string[];
  /**
   * Learning changes epistemic confidence only.
   * These flags are deliberately immutable false.
   */
  mayCreateAuthority: false;
  mayBypassGateway: false;
  mayWriteResidentPersonhood: false;
}

const LEARNING_KINDS: readonly CardinalLearningKind[] = [
  'safety_support',
  'resource_relief',
  'open_shared_space',
  'habitat_support',
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function emptyProfile(kind: CardinalLearningKind): CardinalLearningProfile {
  return {
    kind,
    usableTrials: 0,
    successes: 0,
    failures: 0,
    inconclusive: 0,
    reliability: 0.5,
    meanMeasuredImprovement: 0,
    adverseStreak: 0,
    confidenceAdjustment: 0,
  };
}

/**
 * Builds an evidence-based learning book from completed outcomes.
 *
 * This intentionally does NOT mutate thresholds, resident state, Gateway
 * rules or constitutional authority. It only supplies a bounded epistemic
 * adjustment that CardinalCore may use while judging hypotheses.
 *
 * Cross-world outcomes may contribute to all-time technique reliability only
 * when policy and sensor semantics are compatible. Current-world persistence
 * still belongs to the separate current-epoch research context.
 */
export function deriveCardinalLearningBook(
  outcomes: readonly CardinalLearningOutcome[],
  policyVersion: string,
  sensorVersion: string,
): CardinalLearningBook {
  if (!policyVersion.trim()) throw new Error('policyVersion must not be empty.');
  if (!sensorVersion.trim()) throw new Error('sensorVersion must not be empty.');

  const profiles = Object.fromEntries(
    LEARNING_KINDS.map((kind) => [kind, emptyProfile(kind)]),
  ) as Record<CardinalLearningKind, CardinalLearningProfile>;

  const usableOutcomeIds: string[] = [];
  const excludedOutcomeIds: string[] = [];
  const improvements: Record<CardinalLearningKind, number[]> = {
    safety_support: [],
    resource_relief: [],
    open_shared_space: [],
    habitat_support: [],
  };
  const orderedUsable: CardinalLearningOutcome[] = [];

  const seen = new Set<string>();
  for (const outcome of outcomes) {
    if (seen.has(outcome.outcomeId)) continue;
    seen.add(outcome.outcomeId);

    const canonicalTime =
      Number.isFinite(outcome.observedWorldMinutes) &&
      outcome.observedWorldMinutes >= 0;
    const compatible =
      outcome.policyVersion === policyVersion &&
      outcome.sensorVersion === sensorVersion;
    const validImprovement =
      Number.isFinite(outcome.measuredImprovement) &&
      outcome.measuredImprovement >= 0 &&
      outcome.measuredImprovement <= 1;
    const knownKind = LEARNING_KINDS.includes(outcome.kind);

    if (
      !canonicalTime ||
      !compatible ||
      !validImprovement ||
      !knownKind ||
      outcome.confounded === true
    ) {
      excludedOutcomeIds.push(outcome.outcomeId);
      continue;
    }

    usableOutcomeIds.push(outcome.outcomeId);
    orderedUsable.push(outcome);
    const profile = profiles[outcome.kind];
    profile.usableTrials += 1;

    // A directional success with no measurable movement is treated as
    // inconclusive rather than "free credit".
    if (outcome.expectedDirectionObserved && outcome.measuredImprovement > 0) {
      profile.successes += 1;
      improvements[outcome.kind].push(outcome.measuredImprovement);
    } else if (!outcome.expectedDirectionObserved) {
      profile.failures += 1;
    } else {
      profile.inconclusive += 1;
    }
  }

  // Stable chronological order is only needed for adverse streaks.
  orderedUsable.sort(
    (a, b) =>
      a.observedWorldMinutes - b.observedWorldMinutes ||
      a.outcomeId.localeCompare(b.outcomeId),
  );

  for (const kind of LEARNING_KINDS) {
    const profile = profiles[kind];

    // Beta(2,2) prior prevents one lucky result from becoming certainty.
    profile.reliability =
      (profile.successes + 2) /
      (profile.successes + profile.failures + 4);

    const values = improvements[kind];
    profile.meanMeasuredImprovement =
      values.length === 0
        ? 0
        : values.reduce((sum, value) => sum + value, 0) / values.length;

    let streak = 0;
    for (let i = orderedUsable.length - 1; i >= 0; i -= 1) {
      const outcome = orderedUsable[i];
      if (outcome.kind !== kind) continue;
      if (outcome.expectedDirectionObserved && outcome.measuredImprovement > 0) {
        break;
      }
      if (!outcome.expectedDirectionObserved) {
        streak += 1;
      }
    }
    profile.adverseStreak = streak;

    // Learning is deliberately bounded and asymmetric:
    // repeated failures can reduce confidence more than successes can raise it.
    const reliabilityDelta = profile.reliability - 0.5;
    const evidenceScale = Math.min(1, profile.usableTrials / 8);
    const rawAdjustment = reliabilityDelta * 0.32 * evidenceScale;
    const adversePenalty = Math.min(0.12, profile.adverseStreak * 0.04);
    profile.confidenceAdjustment = Math.max(
      -0.18,
      Math.min(0.08, rawAdjustment - adversePenalty),
    );
  }

  return {
    policyVersion,
    sensorVersion,
    profiles,
    usableOutcomeIds,
    excludedOutcomeIds,
    mayCreateAuthority: false,
    mayBypassGateway: false,
    mayWriteResidentPersonhood: false,
  };
}

export function applyLearnedConfidence(
  baseConfidence: number,
  profile: CardinalLearningProfile | undefined,
): number {
  const base = clamp01(baseConfidence);
  if (!profile || profile.usableTrials === 0) return base;
  return clamp01(base + profile.confidenceAdjustment);
}
