import { describe, expect, it } from 'vitest';
import {
  assertProtectedFamilyPersonalityMutation,
  decideChildVoluntarily,
  decideIntimacyVoluntarily,
  evaluateFamilyAgency,
  type FamilyDecisionContext,
  type FamilyPerson,
} from '../src/v15/FamilyAgency';
import {
  foundingCloseKinAllowedV16,
  reproductiveDevelopmentV16,
} from '../src/v16/SocietyFoundationV16';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';

const person = (
  id: string,
  overrides: Partial<FamilyPerson> = {},
): FamilyPerson => ({
  id,
  sex: id.endsWith('a') ? 'male' : 'female',
  ageYears: 30,
  alive: true,
  health: 0.9,
  stress: 0.25,
  resources: 0.65,
  personality: {
    physicalIntimacyInclination: 0.72,
    childDesire: 0.62,
    autonomy: 0.8,
  },
  parentIds: [],
  childIds: [],
  ...overrides,
});

const context = (
  overrides: Partial<FamilyDecisionContext> = {},
): FamilyDecisionContext => ({
  worldMinutes: 5_000_000,
  relationship: {
    trust: 0.72,
    affinity: 0.76,
    respect: 0.68,
    conflict: 0.08,
    attachment: 0.75,
  },
  householdResourceSecurity: 0.65,
  ...overrides,
});

describe('v15 family agency constitution', () => {
  it('models human reproductive development continuously instead of using age 18 as biology', () => {
    expect(reproductiveDevelopmentV16('human', 8)).toBe(0);
    expect(reproductiveDevelopmentV16('human', 9)).toBe(0);
    expect(reproductiveDevelopmentV16('human', 12.99)).toBe(0);
    expect(reproductiveDevelopmentV16('human', 13)).toBeGreaterThan(0);
    expect(reproductiveDevelopmentV16('human', 13)).toBeLessThan(
      reproductiveDevelopmentV16('human', 15),
    );
    expect(reproductiveDevelopmentV16('human', 15)).toBeLessThan(
      reproductiveDevelopmentV16('human', 18),
    );
    expect(reproductiveDevelopmentV16('human', 18)).toBe(1);

    const earlyA = person('a', {
      ageYears: 13,
      stress: 0,
      personality: {
        physicalIntimacyInclination: 0.99,
        childDesire: 0.99,
        autonomy: 0.9,
      },
    });
    const earlyB = person('b', {
      ageYears: 13,
      stress: 0,
      personality: {
        physicalIntimacyInclination: 0.99,
        childDesire: 0.99,
        autonomy: 0.9,
      },
    });
    const earlyContext = context({
      householdResourceSecurity: 1,
      relationship: {
        trust: 0.95,
        affinity: 0.95,
        respect: 0.95,
        conflict: 0,
        attachment: 0.95,
      },
      physicalEligibility: {
        minimumAdultAge: 13,
        maximumReproductiveAge: 55,
        minimumReproductiveHealth: 0.58,
      },
      developmentalReadiness: reproductiveDevelopmentV16('human', 13),
    });
    expect(evaluateFamilyAgency(earlyA, earlyB, earlyContext).childDecisionPossible).toBe(true);
    expect(decideChildVoluntarily(earlyA, earlyB, earlyContext, 0.001, 683_280).chosen).toBe(true);
    expect(evaluateFamilyAgency(
      { ...earlyA, ageYears: 12.99 },
      earlyB,
      earlyContext,
    ).childDecisionPossible).toBe(false);
  });

  it('permits close-kin opportunity only in the first 200 years without forcing a yes', () => {
    const a = person('a', { parentIds: ['founder-parent'] });
    const b = person('b', { parentIds: ['founder-parent'] });
    expect(evaluateFamilyAgency(a, b, context()).intimacyPossible).toBe(false);
    const early = context({ allowCloseKin: true });
    expect(evaluateFamilyAgency(a, b, early).intimacyPossible).toBe(true);
    expect(decideChildVoluntarily(a, b, early, 0.99, 683_280).chosen).toBe(false);
    expect(foundingCloseKinAllowedV16('human', 199 * WORLD_MINUTES_PER_YEAR)).toBe(true);
    expect(foundingCloseKinAllowedV16('human', 200 * WORLD_MINUTES_PER_YEAR)).toBe(false);
    // During the founding window even a direct blood relation is not blocked
    // by the engine. The residents still make their own individual decision.
    expect(foundingCloseKinAllowedV16('human', 50 * WORLD_MINUTES_PER_YEAR)).toBe(true);
    expect(foundingCloseKinAllowedV16('elf', 50 * WORLD_MINUTES_PER_YEAR)).toBe(true);
    expect(foundingCloseKinAllowedV16('elf', 200 * WORLD_MINUTES_PER_YEAR)).toBe(false);
  });

  it('does not use high stress or low resources as a hard intimacy ban', () => {
    const a = person('a', { stress: 0.96, resources: 0.04 });
    const b = person('b', { stress: 0.92, resources: 0.05 });
    const signals = evaluateFamilyAgency(
      a,
      b,
      context({ householdResourceSecurity: 0.04 }),
    );

    expect(signals.intimacyPossible).toBe(true);
    expect(signals.mutualIntimacyInterest).toBeGreaterThan(0);
    expect(signals.familyReadiness).toBeLessThan(0.8);
  });

  it('allows intimacy without a child decision', () => {
    const a = person('a', {
      personality: {
        physicalIntimacyInclination: 0.95,
        childDesire: 0.01,
        autonomy: 0.9,
      },
    });
    const b = person('b', {
      personality: {
        physicalIntimacyInclination: 0.92,
        childDesire: 0.02,
        autonomy: 0.88,
      },
    });
    const ctx = context();

    const intimacy = decideIntimacyVoluntarily(a, b, ctx, 0.01);
    const child = decideChildVoluntarily(a, b, ctx, 0.01, 683_280);

    expect(intimacy.chosen).toBe(true);
    expect(child.chosen).toBe(false);
    expect(child.reason).toBe('not_ready');
  });

  it('does not make a child decision imply intimacy', () => {
    const a = person('a', {
      personality: {
        physicalIntimacyInclination: 0.12,
        childDesire: 0.96,
        autonomy: 0.9,
      },
    });
    const b = person('b', {
      personality: {
        physicalIntimacyInclination: 0.13,
        childDesire: 0.94,
        autonomy: 0.88,
      },
    });
    const ctx = context();

    const child = decideChildVoluntarily(a, b, ctx, 0.01, 683_280);
    const intimacy = decideIntimacyVoluntarily(a, b, ctx, 0.99);

    expect(child.chosen).toBe(true);
    expect(intimacy.chosen).toBe(false);
  });

  it('keeps yes and no possible for the same willing couple', () => {
    const a = person('a');
    const b = person('b');
    const ctx = context();

    const yes = decideChildVoluntarily(a, b, ctx, 0.01, 683_280);
    const no = decideChildVoluntarily(a, b, ctx, 0.99, 683_280);

    expect(yes.probability).toBeGreaterThan(0);
    expect(yes.probability).toBeLessThan(1);
    expect(yes.chosen).toBe(true);
    expect(no.chosen).toBe(false);
    expect(no.reason).toBe('voluntary_no');
  });

  it('keeps yes and no possible for intimacy too', () => {
    const a = person('a');
    const b = person('b');
    const ctx = context();

    const yes = decideIntimacyVoluntarily(a, b, ctx, 0.01);
    const no = decideIntimacyVoluntarily(a, b, ctx, 0.99);

    expect(yes.probability).toBeGreaterThan(0);
    expect(yes.probability).toBeLessThan(1);
    expect(yes.chosen).toBe(true);
    expect(no.chosen).toBe(false);
  });

  it('retains health/age/lineage as physical reproductive constraints', () => {
    const a = person('a', { health: 0.4 });
    const b = person('b');
    const signals = evaluateFamilyAgency(a, b, context());

    expect(signals.intimacyPossible).toBe(true);
    expect(signals.childDecisionPossible).toBe(false);
  });

  it('prevents Cardinal and Gateway from writing protected family personality', () => {
    const before = {
      physicalIntimacyInclination: 0.5,
      childDesire: 0.4,
      autonomy: 0.8,
    };

    expect(() =>
      assertProtectedFamilyPersonalityMutation(
        before,
        { ...before, childDesire: 1 },
        'cardinal',
      ),
    ).toThrow();

    expect(() =>
      assertProtectedFamilyPersonalityMutation(
        before,
        { ...before, physicalIntimacyInclination: 1 },
        'gateway',
      ),
    ).toThrow();
  });
});
