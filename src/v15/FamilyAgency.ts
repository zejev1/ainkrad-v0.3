export interface FamilyPersonality {
  /**
   * Protected personal inclination. Cardinal may observe aggregate statistics
   * but may not write this value.
   */
  physicalIntimacyInclination: number;

  /**
   * Independent personal preference/intent toward having a child.
   */
  childDesire: number;

  /**
   * General autonomy in personal decisions.
   */
  autonomy: number;
}

export interface PairRelationship {
  trust: number;
  affinity: number;
  respect: number;
  conflict: number;

  /**
   * Attachment/love-like bond state is relationship evidence, not sex and not
   * a pregnancy flag.
   */
  attachment: number;
}

export interface FamilyPerson {
  id: string;
  sex: 'male' | 'female';
  ageYears: number;
  alive: boolean;
  health: number;
  stress: number;
  resources: number;
  personality: FamilyPersonality;
  parentIds: string[];
  childIds: string[];
  lastChildWorldMinute?: number;
}

export interface FamilyDecisionContext {
  worldMinutes: number;
  relationship: PairRelationship;
  householdResourceSecurity: number;

  /**
   * Optional race physiology. Defaults preserve the proven human v15
   * contract; it changes physical feasibility only and never consent.
   */
  physicalEligibility?: {
    minimumAdultAge: number;
    maximumReproductiveAge: number;
    minimumReproductiveHealth: number;
  };
}

export interface FamilyDecisionSignals {
  mutualAttachment: number;
  mutualIntimacyInterest: number;
  mutualChildIntent: number;
  familyReadiness: number;

  /** Adult relationship/intimacy is not gated by resources/stress/fertility. */
  intimacyPossible: boolean;

  /** Child decisions have separate physical/health/fertility eligibility. */
  childDecisionPossible: boolean;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function closeRelative(a: FamilyPerson, b: FamilyPerson): boolean {
  if (a.parentIds.includes(b.id) || b.parentIds.includes(a.id)) return true;
  return a.parentIds.some((parentId) => b.parentIds.includes(parentId));
}

/**
 * Produces independent signals. It deliberately does NOT roll love,
 * intimacy and reproduction into one hidden "family score".
 *
 * v15 constitutional rule:
 * - stress and material security may influence a resident's desire/readiness;
 * - they may NOT remove the resident's right to form an adult relationship or
 *   make a personal intimacy decision;
 * - reproductive age/health/lineage remain physical eligibility constraints.
 */
export function evaluateFamilyAgency(
  a: FamilyPerson,
  b: FamilyPerson,
  context: FamilyDecisionContext,
): FamilyDecisionSignals {
  const relationship = context.relationship;
  const meanStress = clamp01((a.stress + b.stress) / 2);
  const resourceSecurity = clamp01(context.householdResourceSecurity);
  const physicalEligibility = context.physicalEligibility ?? {
    minimumAdultAge: 18,
    maximumReproductiveAge: 55,
    minimumReproductiveHealth: 0.58,
  };

  const mutualAttachment = clamp01(
    relationship.attachment * 0.5 +
      relationship.trust * 0.2 +
      relationship.affinity * 0.2 +
      relationship.respect * 0.1 -
      relationship.conflict * 0.28,
  );

  // Intimacy is a protected personal/social decision. Stress can make it less
  // likely, but never acts as a hard ban.
  const mutualIntimacyInterest = clamp01(
    Math.min(
      a.personality.physicalIntimacyInclination,
      b.personality.physicalIntimacyInclination,
    ) *
      (0.38 + mutualAttachment * 0.62) *
      (1 - meanStress * 0.34),
  );

  // Child intent is independent of intimacy. Security and stress influence the
  // preference context, but neither one decides for the residents.
  const mutualChildIntent = clamp01(
    Math.min(a.personality.childDesire, b.personality.childDesire) *
      (0.34 + mutualAttachment * 0.48) +
      resourceSecurity * 0.12 +
      Math.min(a.health, b.health) * 0.06 -
      meanStress * 0.1,
  );

  const intimateRelationshipEligible =
    a.alive &&
    b.alive &&
    a.sex !== b.sex &&
    a.ageYears >= physicalEligibility.minimumAdultAge &&
    b.ageYears >= physicalEligibility.minimumAdultAge &&
    !closeRelative(a, b);

  const reproductivelyEligible =
    intimateRelationshipEligible &&
    a.ageYears <= physicalEligibility.maximumReproductiveAge &&
    b.ageYears <= physicalEligibility.maximumReproductiveAge &&
    a.health >= physicalEligibility.minimumReproductiveHealth &&
    b.health >= physicalEligibility.minimumReproductiveHealth;

  const familyReadiness = clamp01(
    mutualChildIntent * 0.56 +
      mutualAttachment * 0.2 +
      resourceSecurity * 0.12 +
      Math.min(a.health, b.health) * 0.12 -
      meanStress * 0.06,
  );

  return {
    mutualAttachment,
    mutualIntimacyInterest,
    mutualChildIntent,
    familyReadiness,
    intimacyPossible:
      intimateRelationshipEligible &&
      mutualAttachment >= 0.28 &&
      mutualIntimacyInterest >= 0.1,
    childDecisionPossible:
      reproductivelyEligible &&
      mutualAttachment >= 0.3 &&
      mutualChildIntent >= 0.16 &&
      familyReadiness >= 0.24,
  };
}

export interface IntimacyDecision {
  pairId: string;
  worldMinutes: number;
  chosen: boolean;
  probability: number;
  reason: 'not_ready' | 'voluntary_yes' | 'voluntary_no';
}

/**
 * Intimacy has its own voluntary draw and is never inferred from love or child
 * intent. The probability is deliberately capped below 1, preserving a real
 * possibility to say no even under a strong relationship.
 */
export function decideIntimacyVoluntarily(
  a: FamilyPerson,
  b: FamilyPerson,
  context: FamilyDecisionContext,
  random01: number,
): IntimacyDecision {
  if (!Number.isFinite(random01) || random01 < 0 || random01 >= 1) {
    throw new Error('random01 must be in [0,1).');
  }

  const signals = evaluateFamilyAgency(a, b, context);
  const pairId = [a.id, b.id].sort().join('::');
  if (!signals.intimacyPossible) {
    return {
      pairId,
      worldMinutes: context.worldMinutes,
      chosen: false,
      probability: 0,
      reason: 'not_ready',
    };
  }

  const mutualAutonomy = Math.min(
    a.personality.autonomy,
    b.personality.autonomy,
  );
  const probability = Math.max(
    0.02,
    Math.min(
      0.82,
      0.045 +
        signals.mutualIntimacyInterest * 0.34 +
        signals.mutualAttachment * 0.18 +
        mutualAutonomy * 0.05,
    ),
  );
  const chosen = random01 < probability;
  return {
    pairId,
    worldMinutes: context.worldMinutes,
    chosen,
    probability,
    reason: chosen ? 'voluntary_yes' : 'voluntary_no',
  };
}

export interface ChildDecision {
  pairId: string;
  worldMinutes: number;
  chosen: boolean;
  probability: number;
  reason:
    | 'not_ready'
    | 'voluntary_yes'
    | 'voluntary_no'
    | 'cooldown';
}

/**
 * A deterministic RNG draw can decide this per simulation event, but there is
 * no schedule that says "every eligible pair must eventually have one child".
 *
 * The child decision does NOT imply intimacy and does NOT imply pregnancy.
 */
export function decideChildVoluntarily(
  a: FamilyPerson,
  b: FamilyPerson,
  context: FamilyDecisionContext,
  random01: number,
  minWorldMinutesBetweenChildren: number,
): ChildDecision {
  if (!Number.isFinite(random01) || random01 < 0 || random01 >= 1) {
    throw new Error('random01 must be in [0,1).');
  }

  const signals = evaluateFamilyAgency(a, b, context);
  const pairId = [a.id, b.id].sort().join('::');

  const latestBirth = Math.max(
    a.lastChildWorldMinute ?? -Infinity,
    b.lastChildWorldMinute ?? -Infinity,
  );
  if (
    Number.isFinite(latestBirth) &&
    context.worldMinutes - latestBirth < minWorldMinutesBetweenChildren
  ) {
    return {
      pairId,
      worldMinutes: context.worldMinutes,
      chosen: false,
      probability: 0,
      reason: 'cooldown',
    };
  }

  if (!signals.childDecisionPossible) {
    return {
      pairId,
      worldMinutes: context.worldMinutes,
      chosen: false,
      probability: 0,
      reason: 'not_ready',
    };
  }

  // Voluntary even under very high readiness; no hidden "must reproduce" path.
  // The lower base probability is compensated by repeated life opportunities,
  // not by ever forcing a yes.
  const probability = Math.max(
    0.015,
    Math.min(
      0.52,
      0.025 +
        signals.mutualChildIntent * 0.24 +
        signals.familyReadiness * 0.16,
    ),
  );
  const chosen = random01 < probability;
  return {
    pairId,
    worldMinutes: context.worldMinutes,
    chosen,
    probability,
    reason: chosen ? 'voluntary_yes' : 'voluntary_no',
  };
}

export function assertProtectedFamilyPersonalityMutation(
  before: FamilyPersonality,
  after: FamilyPersonality,
  actor: 'resident' | 'world' | 'cardinal' | 'gateway',
): void {
  if (
    (actor === 'cardinal' || actor === 'gateway') &&
    (
      before.physicalIntimacyInclination !== after.physicalIntimacyInclination ||
      before.childDesire !== after.childDesire ||
      before.autonomy !== after.autonomy
    )
  ) {
    throw new Error(
      `${actor} attempted to write protected resident family/personality state.`,
    );
  }
}
