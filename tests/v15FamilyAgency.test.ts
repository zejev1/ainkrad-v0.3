import { describe, expect, it } from 'vitest';
import {
  assertProtectedFamilyPersonalityMutation,
  decideChildVoluntarily,
  decideIntimacyVoluntarily,
  evaluateFamilyAgency,
  type FamilyDecisionContext,
  type FamilyPerson,
} from '../src/v15/FamilyAgency';

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
