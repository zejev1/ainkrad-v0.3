import { describe, expect, it } from 'vitest';
import { PLAYER_ENTRY_FOUNDATION_V18 } from '../src/v18/PlayerEntryFoundationV18';
import { decideFrontierSettlementAtCampV18 } from '../src/v18/SettlementMobilityV18';
import {
  WORLD_RULES_VERSION_V18,
} from '../src/v18/UnderworldFoundationV18';
import { WORLD_RULES_VERSION_V16 } from '../src/v16/SocietyFoundationV16';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';

describe('v0.3.18 additive Underworld foundation', () => {
  it('migrates v16 once without changing people, time, relations, RNG or Cardinal-facing history', async () => {
    const source = await WorldEngine.create({
      worldId: 'v18-additive-migration',
      seed: 'v18-additive-migration',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const legacy = source.snapshot();
    legacy.rulesVersion = WORLD_RULES_VERSION_V16;
    legacy.governance.constitutionVersion = 'ainkrad-constitution-0.3.16';
    delete legacy.v18;

    const preserved = structuredClone({
      now: legacy.now,
      calendar: legacy.calendar,
      determinism: legacy.determinism,
      agents: legacy.agents,
      relationships: legacy.relationships,
      places: legacy.places,
      v15: legacy.v15,
      v16: legacy.v16,
    });
    const store = new InMemoryWorldStore();
    await store.initializeWorld(legacy);

    const opened = await WorldEngine.open({ worldId: legacy.id, store });
    const migrated = opened.snapshot();
    expect(migrated.rulesVersion).toBe(WORLD_RULES_VERSION_V18);
    expect({
      now: migrated.now,
      calendar: migrated.calendar,
      determinism: migrated.determinism,
      agents: migrated.agents,
      relationships: migrated.relationships,
      places: migrated.places,
      v15: migrated.v15,
      v16: migrated.v16,
    }).toEqual(preserved);
    expect(migrated.v18?.recentConversations).toEqual([]);
    expect(Object.keys(migrated.v18?.languageByAgentId ?? {}).sort()).toEqual(
      Object.keys(migrated.agents).sort(),
    );

    const migrationEvents = (await store.history(legacy.id)).filter(
      (event) => event.payload.migrationMode === 'additive_underworld_foundation',
    );
    expect(migrationEvents).toHaveLength(1);
    expect(migrationEvents[0].payload.fabricatedConversationCount).toBe(0);

    const revision = migrated.revision;
    const reopened = await WorldEngine.open({ worldId: legacy.id, store });
    expect(reopened.snapshot().revision).toBe(revision);
    expect(
      (await store.history(legacy.id)).filter(
        (event) => event.payload.migrationMode === 'additive_underworld_foundation',
      ),
    ).toHaveLength(1);
  });

  it('keeps the player-entry boundary completely dormant in production v18', () => {
    expect(PLAYER_ENTRY_FOUNDATION_V18.productionEntryEnabled).toBe(false);
    expect(PLAYER_ENTRY_FOUNDATION_V18.productionControlsEnabled).toBe(false);
    expect(PLAYER_ENTRY_FOUNDATION_V18.authenticationProvider).toBe('none');
    expect(PLAYER_ENTRY_FOUNDATION_V18.cardinalMayIssueCredentials).toBe(false);
    expect(PLAYER_ENTRY_FOUNDATION_V18.cardinalMayControlAvatar).toBe(false);
  });

  it('adds new profession evidence to an early v18 save without relabeling residents', async () => {
    const source = await WorldEngine.create({
      worldId: 'v18-profession-schema-repair',
      seed: 'v18-profession-schema-repair',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const stale = source.snapshot();
    const resident = Object.values(stale.agents)[0];
    const livelihood = stale.v18!.livelihoodByAgentId[resident.id];
    livelihood.primary = 'forager';
    livelihood.practiceByKind.forager = 17;
    delete (livelihood.practiceByKind as Partial<typeof livelihood.practiceByKind>)
      .woodcutter;
    delete (livelihood.practiceByKind as Partial<typeof livelihood.practiceByKind>)
      .miner;
    delete (livelihood.practiceByKind as Partial<typeof livelihood.practiceByKind>)
      .fisher;
    delete (livelihood.practiceByKind as Partial<typeof livelihood.practiceByKind>)
      .smith;

    const store = new InMemoryWorldStore();
    await store.initializeWorld(stale);
    const repaired = await WorldEngine.open({ worldId: stale.id, store });
    const after = repaired.snapshot().v18!.livelihoodByAgentId[resident.id];

    expect(after.primary).toBe('forager');
    expect(after.practiceByKind.forager).toBe(17);
    expect(after.practiceByKind.woodcutter).toBe(0);
    expect(after.practiceByKind.miner).toBe(0);
    expect(after.practiceByKind.fisher).toBe(0);
    expect(after.practiceByKind.smith).toBe(0);
    expect(repaired.snapshot().revision).toBe(stale.revision + 1);
  });

  it('lets expedition members freely confirm or reject settlement after arrival', async () => {
    const world = await WorldEngine.create({
      worldId: 'v18-camp-choice',
      seed: 'v18-camp-choice',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const state = world.snapshot();
    const resident = Object.values(state.agents)[0];
    resident.personality.curiosity = 1;
    resident.personality.riskTolerance = 1;
    resident.mind.values.ambition = 1;
    resident.mind.values.freedom = 1;
    resident.skills.exploration = 1;
    resident.needs.purpose = 0.7;
    resident.life.health = 1;
    resident.energy = 1;
    resident.stress = 0;
    state.v18!.livelihoodByAgentId[resident.id].primary = 'scout';
    const site = {
      placeId: 'frontier-test-site',
      score: 0.9,
      fertility: 0.82,
      danger: 0.05,
      routeDistance: 4,
      resourceOpportunity: 0.9,
      reasons: ['fertile_land', 'resource_opportunity'],
    };

    expect(
      decideFrontierSettlementAtCampV18(
        state,
        resident,
        'settlement_ainkrad',
        site,
        0,
      ).acceptsSettlement,
    ).toBe(true);

    resident.personality.riskTolerance = 0;
    resident.energy = 0.08;
    resident.stress = 0.96;
    resident.life.health = 0.22;
    const dangerousSite = { ...site, danger: 0.95, score: 0.48 };
    const reconsidered = decideFrontierSettlementAtCampV18(
      state,
      resident,
      'settlement_ainkrad',
      dangerousSite,
      0,
    );
    expect(reconsidered.acceptsSettlement).toBe(false);
    expect(reconsidered.reasons).toContain('camp_exhaustion');
    expect(reconsidered.reasons).toContain('camp_stress');
  });
});
