import {
  adjustResearchConfidence,
  type ResearchObservationModifiers,
} from './CardinalResearchEvidence';
import {
  applyLearnedConfidence,
  type CardinalLearningProfile,
} from './CardinalSelfLearning';

export interface CardinalConfidenceTraceV15 {
  baseConfidence: number;
  afterObservationQuality: number;
  afterSelfLearning: number;
  signalNoise: number;
  communityGuidance: number;
  learningAdjustment: number;
  notes: string[];
  mayCreateAuthority: false;
  mayBypassGateway: false;
  mayWriteResidentPersonhood: false;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Composes v15 epistemic modifiers without changing any action threshold,
 * constitutional permission or resident state.
 *
 * Order is deliberate:
 * 1. evaluate the quality/corroboration of the current observation;
 * 2. then apply bounded historical reliability of this intervention class.
 */
export function evaluateCardinalConfidenceV15(
  baseConfidence: number,
  modifiers: ResearchObservationModifiers,
  learningProfile?: CardinalLearningProfile,
): CardinalConfidenceTraceV15 {
  const base = clamp01(baseConfidence);
  const afterObservationQuality = adjustResearchConfidence(base, modifiers);
  const afterSelfLearning = applyLearnedConfidence(
    afterObservationQuality,
    learningProfile,
  );

  const notes: string[] = [];
  if (modifiers.signalNoise >= 0.6) {
    notes.push('high_signal_noise');
  }
  if (modifiers.communityGuidance >= 0.65) {
    notes.push('community_corroboration_present');
  }
  if (learningProfile?.usableTrials) {
    notes.push(`learning_trials=${learningProfile.usableTrials}`);
    if (learningProfile.adverseStreak >= 2) {
      notes.push(`adverse_streak=${learningProfile.adverseStreak}`);
    }
  }

  return {
    baseConfidence: base,
    afterObservationQuality,
    afterSelfLearning,
    signalNoise: clamp01(modifiers.signalNoise),
    communityGuidance: clamp01(modifiers.communityGuidance),
    learningAdjustment: learningProfile?.confidenceAdjustment ?? 0,
    notes,
    mayCreateAuthority: false,
    mayBypassGateway: false,
    mayWriteResidentPersonhood: false,
  };
}
