import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { boatWorkSite, BOAT_KNOWLEDGE_ID } from '../src/v21/MaritimePractice';
import { HISTORICAL_SOURCES } from '../src/v18/HistoricalSourceCorpus';

const founders = Array.from({ length: 30 }, (_, index) => `Основатель ${index + 1}`);

describe('Rulid reuses its existing physical shore as beach, pier and shipyard', () => {
  it('keeps Rulid geometry intact and gives the existing shore its maritime civic role', async () => {
    const world = (await WorldEngine.create({
      worldId: 'rulid-existing-shore',
      seed: 'rulid-existing-shore',
      store: new InMemoryWorldStore(),
      agentNames: founders,
      startTime: 0,
    })).snapshot();

    const shore = world.places.rulid_shore;
    expect(shore).toBeDefined();
    expect(shore.name).toBe('Пляж, причал и верфь Рулида');
    expect(shore.surface).toBe('shore');
    expect(shore.settlementId).toBe('settlement_rulid');
    expect(shore.connectedPlaceIds).toContain('rulid_outskirts');
    expect(shore.connectedPlaceIds).toContain('ocean_ainkrad');
    expect(world.settlements.settlement_rulid.centerPlaceId).toBe('rulid_commons');
  });

  it('renames an already-saved Rulid shore without moving the city, residents, time or RNG', async () => {
    const seedStore = new InMemoryWorldStore();
    const created = await WorldEngine.create({
      worldId: 'rulid-existing-shore-migration-source',
      seed: 'rulid-existing-shore-migration-source',
      store: seedStore,
      agentNames: founders,
      startTime: 0,
    });
    const old = created.snapshot();
    old.places.rulid_shore.name = 'Берег Рулид';

    const preserved = {
      shore: { x: old.places.rulid_shore.mapX, y: old.places.rulid_shore.mapY },
      center: {
        x: old.settlements.settlement_rulid.centerX,
        y: old.settlements.settlement_rulid.centerY,
        centerPlaceId: old.settlements.settlement_rulid.centerPlaceId,
      },
      minute: old.calendar.elapsedWorldMinutes,
      rng: old.determinism.rngState,
      residents: Object.fromEntries(
        Object.values(old.agents)
          .filter(agent => old.places[agent.homeId]?.settlementId === 'settlement_rulid')
          .map(agent => [agent.id, { ...agent.position }]),
      ),
    };

    old.revision = 0;
    const store = new InMemoryWorldStore();
    await store.initializeWorld(old);
    const reopened = await WorldEngine.open({ worldId: old.id, store });
    const world = reopened.snapshot();

    expect(world.places.rulid_shore.name).toBe('Пляж, причал и верфь Рулида');
    expect({ x: world.places.rulid_shore.mapX, y: world.places.rulid_shore.mapY }).toEqual(preserved.shore);
    expect({
      x: world.settlements.settlement_rulid.centerX,
      y: world.settlements.settlement_rulid.centerY,
      centerPlaceId: world.settlements.settlement_rulid.centerPlaceId,
    }).toEqual(preserved.center);
    expect(world.calendar.elapsedWorldMinutes).toBe(preserved.minute);
    expect(world.determinism.rngState).toBe(preserved.rng);
    for (const [id, position] of Object.entries(preserved.residents)) {
      expect(world.agents[id].position).toEqual(position);
    }
  });

  it('uses the known Rulid shore as the vessel worksite', async () => {
    const world = (await WorldEngine.create({
      worldId: 'rulid-existing-shore-worksite',
      seed: 'rulid-existing-shore-worksite',
      store: new InMemoryWorldStore(),
      agentNames: founders,
      startTime: 0,
    })).snapshot();

    const resident = world.agents.agent_11;
    resident.life.ageYears = 25;
    resident.life.stage = 'adult';
    resident.skills.craft = 0.95;
    resident.knownPlaceIds = [...new Set([...(resident.knownPlaceIds ?? []), 'rulid_shore'])];
    world.v18!.secretLibrary.knowledgeByAgentId[resident.id] = [{
      id: 'boat-knowledge',
      knowledgeId: BOAT_KNOWLEDGE_ID,
      title: 'Корабль',
      category: 'engineering',
      historicalSource: 'исторический источник',
      sourceTitle: 'Корабль',
      sourceUrl: HISTORICAL_SOURCES[0].sourceUrl,
      acquiredWorldMinute: 0,
      understanding: 0.95,
      summary: 'корпус, парус, мореходность',
      concepts: ['судостроение'],
      practiceCount: 1,
      sharedCount: 0,
    }];

    expect(world.places[resident.homeId].settlementId).toBe('settlement_rulid');
    expect(boatWorkSite(world, resident)).toBe('rulid_shore');
  });
});
