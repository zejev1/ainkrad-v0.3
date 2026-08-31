export interface ResearchEvidence {
  evidenceId: string;
  worldEpoch: string;
  policyVersion: string;
  sensorVersion: string;
  observedWorldMinutes?: number;
  baseConfidence: number;
}

export interface ResearchObservationModifiers {
  /**
   * 0 = clean signal, 1 = extremely noisy/ambiguous signal.
   * Noise may lower confidence, never mutate residents.
   */
  signalNoise: number;

  /**
   * 0 = no corroborating community signal, 1 = strong corroboration.
   * Guidance is evidence, not an order to residents.
   */
  communityGuidance: number;
}

export interface ResearchEvidenceSelection {
  accepted: ResearchEvidence[];
  rejectedLegacyTimeIds: string[];
  rejectedEpochIds: string[];
  rejectedCompatibilityIds: string[];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function adjustResearchConfidence(
  baseConfidence: number,
  modifiers: ResearchObservationModifiers,
): number {
  const base = clamp01(baseConfidence);
  const noise = clamp01(modifiers.signalNoise);
  const guidance = clamp01(modifiers.communityGuidance);

  // Noise is deliberately stronger than guidance: community agreement must
  // not be able to "vote reality into existence".
  const noisePenalty = noise * 0.34;
  const corroborationBonus = guidance * (1 - noise) * 0.16;

  return clamp01(base - noisePenalty + corroborationBonus);
}

/**
 * v15 research context only accepts canonical world-time evidence for
 * current-world decision windows.
 *
 * Legacy entries may still contribute to all-time Cardinal experience in a
 * separate aggregation path, but they cannot masquerade as current timed
 * evidence if they lack observedWorldMinutes.
 */
export function selectCanonicalResearchEvidence(
  evidence: readonly ResearchEvidence[],
  currentEpoch: string,
  policyVersion: string,
  sensorVersion: string,
  currentWorldMinutes: number,
  lookbackWorldMinutes: number,
): ResearchEvidenceSelection {
  if (!currentEpoch.trim()) throw new Error('currentEpoch must not be empty.');
  if (!policyVersion.trim()) throw new Error('policyVersion must not be empty.');
  if (!sensorVersion.trim()) throw new Error('sensorVersion must not be empty.');
  if (!Number.isFinite(currentWorldMinutes) || currentWorldMinutes < 0) {
    throw new Error('currentWorldMinutes must be finite and non-negative.');
  }
  if (!Number.isFinite(lookbackWorldMinutes) || lookbackWorldMinutes < 0) {
    throw new Error('lookbackWorldMinutes must be finite and non-negative.');
  }

  const accepted: ResearchEvidence[] = [];
  const rejectedLegacyTimeIds: string[] = [];
  const rejectedEpochIds: string[] = [];
  const rejectedCompatibilityIds: string[] = [];

  for (const item of evidence) {
    if (item.worldEpoch !== currentEpoch) {
      rejectedEpochIds.push(item.evidenceId);
      continue;
    }

    if (
      item.policyVersion !== policyVersion ||
      item.sensorVersion !== sensorVersion
    ) {
      rejectedCompatibilityIds.push(item.evidenceId);
      continue;
    }

    if (
      item.observedWorldMinutes === undefined ||
      !Number.isFinite(item.observedWorldMinutes) ||
      item.observedWorldMinutes < 0
    ) {
      rejectedLegacyTimeIds.push(item.evidenceId);
      continue;
    }

    const age = currentWorldMinutes - item.observedWorldMinutes;
    if (age < 0) {
      // Future evidence cannot be accepted into a deterministic current context.
      continue;
    }
    if (age > lookbackWorldMinutes) continue;

    accepted.push({ ...item });
  }

  accepted.sort(
    (a, b) =>
      (a.observedWorldMinutes ?? 0) - (b.observedWorldMinutes ?? 0) ||
      a.evidenceId.localeCompare(b.evidenceId),
  );

  return {
    accepted,
    rejectedLegacyTimeIds,
    rejectedEpochIds,
    rejectedCompatibilityIds,
  };
}

export interface ResearchDecisionContext {
  effectiveConfidence: number;
  signalNoise: number;
  communityGuidance: number;
  mayMutateResidentPersonhood: false;
  mayCommandResidentDecision: false;
}

export function buildResearchDecisionContext(
  baseConfidence: number,
  modifiers: ResearchObservationModifiers,
): ResearchDecisionContext {
  return {
    effectiveConfidence: adjustResearchConfidence(baseConfidence, modifiers),
    signalNoise: clamp01(modifiers.signalNoise),
    communityGuidance: clamp01(modifiers.communityGuidance),
    mayMutateResidentPersonhood: false,
    mayCommandResidentDecision: false,
  };
}
