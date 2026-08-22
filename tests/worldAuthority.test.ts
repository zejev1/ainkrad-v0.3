import { describe, expect, it } from 'vitest';
import { IndependentWorldEntryGateway } from '../src/boundary/WorldEntryGateway';
import {
  IndependentWorldAuthorityGateway,
  observeWorldArchitecture,
  type WorldAuthorityProposal,
} from '../src/cardinal/WorldAuthorityGateway';
import type { CardinalExperienceState } from '../src/cardinal/types';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';

const experiencedCardinal: CardinalExperienceState = {
  level: 6,
  totalExperience: 3000,
  observationCycles: 900,
  ecologyObservationCycles: 700,
  evaluatedOutcomes: 20,
  successfulPredictions: 14,
  capabilities: [
    'world_observation',
    'autonomy_guard',
    'trend_reasoning',
    'ecosystem_observation',
    'outcome_learning',
    'habitat_support_planning',
    'world_rule_design',
    'demographic_stewardship',
    'catastrophe_modeling',
  ],
  newlyUnlockedCapabilities: [],
};

function lawProposal(
  worldId: string,
  proposedAt: number,
  lawId: string,
): WorldAuthorityProposal {
  return {
    proposalId: `proposal:${lawId}`,
    worldId,
    proposedAt,
    necessity: 0.8,
    reason: 'Long-lived frontier evidence supports a bounded environmental rule.',
    expectedOutcome: 'World conditions change without selecting a resident action.',
    evidenceEventIds: ['evidence:1', 'evidence:2', 'evidence:3'],
    kind: 'world_law',
    lawId,
    domain: 'geography',
    mechanism: 'frontier_expansion',
    value: 0.7,
    minimum: 0.2,
    maximum: 1.2,
  };
}

describe('Independent world authority', () => {
  it('permits bounded world laws while permanently protecting resident minds', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'constitutional-world',
      seed: 'constitutional-seed',
      store,
      startTime: 0,
    });
    const gateway = new IndependentWorldAuthorityGateway(world, 0);
    const before = world.snapshot();
    const protectedMinds = Object.fromEntries(
      Object.values(before.agents).map((agent) => [
        agent.id,
        structuredClone(agent.mind),
      ]),
    );

    const denied = await gateway.execute(
      lawProposal(before.id, before.now, 'memory_rewrite_rate'),
      before,
      experiencedCardinal,
    );
    expect(denied.authorized).toBe(false);
    expect(world.snapshot()).toEqual(before);

    const allowed = await gateway.execute(
      lawProposal(before.id, before.now, 'mountain_erosion_rate'),
      before,
      experiencedCardinal,
    );
    expect(allowed.authorized).toBe(true);
    const after = world.snapshot();
    expect(after.governance.laws.mountain_erosion_rate.value).toBe(0.7);
    expect(after.governance.protectedPersonhoodDomains).toEqual([
      'identity',
      'memory',
      'agency',
      'values',
      'relationships',
    ]);
    expect(
      Object.fromEntries(
        Object.values(after.agents).map((agent) => [agent.id, agent.mind]),
      ),
    ).toEqual(protectedMinds);
    expect(
      (await store.history(after.id)).some(
        (event) => event.kind === 'cardinal.world_law.changed',
      ),
    ).toBe(true);
  });

  it('does not authorize catastrophe against a small civilization', async () => {
    const world = await WorldEngine.create({
      worldId: 'small-world',
      seed: 'small-world-seed',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const expected = world.snapshot();
    const gateway = new IndependentWorldAuthorityGateway(world, 0);
    const record = await gateway.execute(
      {
        proposalId: 'catastrophe:small-world',
        worldId: expected.id,
        proposedAt: expected.now,
        necessity: 0.99,
        reason: 'Hypothetical systemic reset pressure.',
        expectedOutcome: 'A bounded ecological transition.',
        evidenceEventIds: Array.from(
          { length: 12 },
          (_, index) => `evidence:${index}`,
        ),
        kind: 'catastrophe',
        catastropheKind: 'drought',
        magnitude: 0.25,
        predictedCasualtyRatio: 0.1,
        recoveryPlan: 'Restore habitat and resources after the bounded event.',
        duration: 24,
        scope: 'systemic',
      },
      expected,
      experiencedCardinal,
    );

    expect(record.authorized).toBe(false);
    expect(record.reason).toContain('too small');
    expect(world.snapshot()).toEqual(expected);
  });

  it('keeps an exceptional catastrophe systemic, bounded and recoverable', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'large-world',
      seed: 'large-world-seed',
      store,
      startTime: 0,
      agentNames: Array.from({ length: 12 }, (_, index) => `Resident ${index + 1}`),
    });
    const expected = world.snapshot();
    const gateway = new IndependentWorldAuthorityGateway(world, 0);
    const record = await gateway.execute(
      {
        proposalId: 'catastrophe:large-world',
        worldId: expected.id,
        proposedAt: expected.now,
        necessity: 0.99,
        reason: 'Twelve independent systemic signals indicate irreversible collapse.',
        expectedOutcome: 'A bounded transition followed by habitat recovery.',
        evidenceEventIds: Array.from(
          { length: 12 },
          (_, index) => `systemic-evidence:${index}`,
        ),
        kind: 'catastrophe',
        catastropheKind: 'earthquake',
        magnitude: 0.3,
        predictedCasualtyRatio: 0.15,
        recoveryPlan: 'Open a recovery phase governed by catastrophe-recovery law.',
        duration: 24,
        scope: 'systemic',
      },
      expected,
      experiencedCardinal,
    );

    expect(record.authorized).toBe(true);
    const after = world.snapshot();
    const living = Object.values(after.agents).filter(
      (agent) => agent.life.alive,
    ).length;
    expect(living).toBeGreaterThanOrEqual(8);
    expect(Object.keys(expected.agents).length - living).toBeLessThanOrEqual(
      Math.floor(12 * 0.15),
    );
    const event = (await store.history(after.id)).find(
      (candidate) => candidate.kind === 'cardinal.catastrophe.earthquake',
    );
    expect(event?.payload.recoveryPlan).toBeTruthy();
    expect(event?.payload.recoveryMagnitude).toBeGreaterThan(0);
    expect(event?.activeUntil).toBe(72);
  });

  it('exposes only aggregate architecture to the Cardinal world designer', async () => {
    const world = await WorldEngine.create({
      worldId: 'aggregate-world',
      seed: 'aggregate-world-seed',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const observation = observeWorldArchitecture(world.snapshot()) as unknown as Record<
      string,
      unknown
    >;

    expect(observation.agents).toBeUndefined();
    expect(observation.minds).toBeUndefined();
    expect(observation.relationships).toBeUndefined();
    expect(observation.livingPopulation).toBe(6);
  });
});

describe('Independent resident and deity entry', () => {
  it('creates a new resident identity and never replaces a native person', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'entry-world',
      seed: 'entry-world-seed',
      store,
      startTime: 0,
    });
    const gateway = new IndependentWorldEntryGateway(world);
    const before = world.snapshot();
    const nativeIdentities = Object.fromEntries(
      Object.values(before.agents).map((agent) => [
        agent.id,
        agent.mind.identityId,
      ]),
    );

    const residentEntry = await gateway.enter(
      {
        requestId: 'entry:resident:1',
        worldId: before.id,
        externalIdentityId: 'player-one',
        displayName: 'Traveler',
        role: 'resident',
        requestedAt: before.now,
      },
      before,
    );
    expect(residentEntry.authorized).toBe(true);
    const afterResident = world.snapshot();
    expect(afterResident.agents['visitor_player-one'].origin).toBe(
      'external_resident',
    );
    for (const [agentId, identity] of Object.entries(nativeIdentities)) {
      expect(afterResident.agents[agentId].mind.identityId).toBe(identity);
    }

    const deityEntry = await gateway.enter(
      {
        requestId: 'entry:deity:1',
        worldId: afterResident.id,
        externalIdentityId: 'keeper-of-stars',
        displayName: 'Keeper of Stars',
        role: 'deity',
        requestedAt: afterResident.now,
      },
      afterResident,
    );
    expect(deityEntry.authorized).toBe(true);

    const beforeOmen = world.snapshot();
    const omen = await gateway.omen(
      {
        requestId: 'omen:1',
        worldId: beforeOmen.id,
        deityId: 'keeper-of-stars',
        omen: 'aurora',
        magnitude: 0.25,
        requestedAt: beforeOmen.now,
      },
      beforeOmen,
    );
    expect(omen.authorized).toBe(true);
    expect(world.snapshot().cosmology.omenCount).toBe(1);
    expect(
      (await store.history('entry-world')).some(
        (event) => event.kind === 'world.omen.aurora',
      ),
    ).toBe(true);
    const witnessed = await Promise.all(
      Object.keys(world.snapshot().agents).map((agentId) =>
        store.historyForAgent('entry-world', agentId),
      ),
    );
    expect(witnessed.flat().some((memory) => memory.kind === 'omen')).toBe(true);
  });
});
