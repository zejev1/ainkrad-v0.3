import { describe, expect, it } from 'vitest';
import {
  assertAdventureEconomyV19,
  chooseDungeonExpeditionV19,
  resolveDungeonExpeditionV19,
  syncAdventureEconomyV19,
  tryAdventureMarketTradeV19,
} from '../src/v19/AdventureEconomyV19';
import { ensureSettlementEconomyV16 } from '../src/v16/SocietyFoundationV16';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import type { AgentState, WorldState } from '../src/world/types';

async function preparedWorld(worldId: string): Promise<{
  state: WorldState;
  resident: AgentState;
  dungeonId: string;
}> {
  const engine = await WorldEngine.create({
    worldId,
    seed: `${worldId}-seed`,
    store: new InMemoryWorldStore(),
    startTime: 0,
  });
  const state = engine.snapshot();
  state.places.adventure_ruins = {
    id: 'adventure_ruins',
    name: 'Каменные руины',
    kind: 'ruins',
    capacity: 10,
    biome: 'ancient_ruins',
    mapX: 74,
    mapY: 64,
    connectedPlaceIds: ['outskirts'],
    fertility: 0.12,
    danger: 0.24,
    surface: 'land',
    discoveredAt: state.calendar.elapsedWorldMinutes,
  };
  state.places.outskirts.connectedPlaceIds.push('adventure_ruins');
  state.growth.discoveredRegionIds.push('adventure_ruins');
  // A scout first physically discovers the entrance, then tells the resident.
  const scout = state.agents.agent_2;
  scout.locationId = 'adventure_ruins';
  scout.position = { x: 74, y: 64, layerId: 'surface' };
  scout.movement = undefined;
  const adventure = syncAdventureEconomyV19(state);
  const dungeon = Object.values(adventure.dungeonsById).find(
    (candidate) => candidate.entrancePlaceId === 'adventure_ruins',
  )!;
  const resident = Object.values(state.agents)[0];
  resident.knownDungeonIds = [dungeon.id];
  resident.life.stage = 'adult';
  resident.life.ageYears = Math.max(20, resident.life.ageYears);
  resident.life.health = 1;
  resident.energy = 1;
  resident.resources = 0.8;
  resident.stress = 0;
  resident.personality.curiosity = 1;
  resident.personality.riskTolerance = 1;
  resident.personality.resilience = 1;
  resident.mind.values.freedom = 1;
  resident.mind.values.ambition = 1;
  state.v18!.livelihoodByAgentId[resident.id].primary = 'adventurer';
  return { state, resident, dungeonId: dungeon.id };
}

describe('v0.3.19 autonomous dungeons, ranks and carried economy', () => {
  it('creates a dungeon below a discovered physical entrance and never teleports entry', async () => {
    const { state, resident, dungeonId } = await preparedWorld(
      'v19-physical-dungeon',
    );
    const dungeon = state.v19!.adventureEconomy.dungeonsById[dungeonId];
    expect(state.places[dungeon.entrancePlaceId]).toBeDefined();
    expect(
      chooseDungeonExpeditionV19(state, resident, [dungeonId], 0)?.id,
    ).toBe(dungeonId);
    expect(() =>
      resolveDungeonExpeditionV19(state, resident, dungeonId, {
        continuation: 0,
        encounter: 1,
        depth: 0,
        artifact: 0,
        artifactKind: 0.99,
        ability: 0,
      }),
    ).toThrow(/physical arrival/i);
  });

  it('lets a willing adventurer gain fast lived experience, rank, coin, an artifact and a learnable ability', async () => {
    const { state, resident, dungeonId } = await preparedWorld(
      'v19-lived-dungeon-run',
    );
    const dungeon = state.v19!.adventureEconomy.dungeonsById[dungeonId];
    resident.locationId = dungeon.entrancePlaceId;
    resident.position = {
      x: state.places[dungeon.entrancePlaceId].mapX,
      y: state.places[dungeon.entrancePlaceId].mapY,
      layerId: 'surface',
    };
    resident.progression = {
      level: 1,
      experience: 0,
      objectControlAuthority: 0,
      systemControlAuthority: 0,
      combatMastery: 0.8,
      sacredArts: 0,
    };

    const result = resolveDungeonExpeditionV19(state, resident, dungeonId, {
      continuation: 0,
      encounter: 1,
      depth: 0,
      artifact: 0,
      artifactKind: 0.99,
      ability: 0,
    });
    const profile = state.v19!.adventureEconomy.adventurersByAgentId[resident.id];

    expect(result.run.outcome).toBe('success');
    expect(result.run.voluntary).toBe(true);
    expect(result.run.experienceGained).toBeGreaterThan(24);
    expect(resident.progression.level).toBeGreaterThan(1);
    expect(profile.rank).toBe('F');
    expect(profile.coinBalance).toBeGreaterThan(0);
    expect(result.artifact?.kind).toBe('skill_book');
    expect(profile.artifactIds).toContain(result.artifact?.id);
    expect(profile.abilities).toContain(result.learnedAbility);
    expect(state.v19!.adventureEconomy.totalSuccessfulRuns).toBe(1);
    assertAdventureEconomyV19(state);
  });

  it('uses real granary food and the resident as a physical carrier between settlement economies', async () => {
    const { state, resident, dungeonId } = await preparedWorld(
      'v19-carried-market',
    );
    const dungeon = state.v19!.adventureEconomy.dungeonsById[dungeonId];
    resident.locationId = dungeon.entrancePlaceId;
    resident.position = {
      x: state.places[dungeon.entrancePlaceId].mapX,
      y: state.places[dungeon.entrancePlaceId].mapY,
      layerId: 'surface',
    };
    resolveDungeonExpeditionV19(state, resident, dungeonId, {
      continuation: 0,
      encounter: 1,
      depth: 0,
      artifact: 1,
      artifactKind: 0,
      ability: 0,
    });

    state.settlements.foreign_market = {
      id: 'foreign_market',
      name: 'Дальний Торг',
      kind: 'village',
      centerPlaceId: 'foreign_market_place',
      centerX: 90,
      centerY: 66,
      radius: 8,
      memberPlaceIds: ['foreign_market_place'],
      foundedAt: state.calendar.elapsedWorldMinutes,
    };
    state.places.foreign_market_place = {
      id: 'foreign_market_place',
      name: 'Дальний Торг',
      kind: 'village',
      capacity: 20,
      biome: 'settlement',
      mapX: 90,
      mapY: 66,
      connectedPlaceIds: ['adventure_ruins'],
      fertility: 0.6,
      danger: 0.04,
      surface: 'land',
      settlementId: 'foreign_market',
      discoveredAt: state.calendar.elapsedWorldMinutes,
    };
    const economy = ensureSettlementEconomyV16(state, 'foreign_market');
    economy.stocks.food = 2;
    resident.locationId = 'foreign_market_place';
    resident.position = { x: 90, y: 66, layerId: 'surface' };
    resident.resources = 0.1;
    const beforeFood = economy.stocks.food;

    const trade = tryAdventureMarketTradeV19(
      state,
      resident,
      'foreign_market',
      0,
    );
    const adventure = state.v19!.adventureEconomy;

    expect(trade?.kind).toBe('food_purchase');
    expect(economy.stocks.food).toBeLessThan(beforeFood);
    expect(resident.resources).toBeGreaterThan(0.1);
    expect(adventure.totalTradeVolume).toBeGreaterThan(0);
    expect(Object.values(adventure.tradeRelationsById)[0]).toMatchObject({
      lastCarrierAgentId: resident.id,
      carriedTradeCount: 1,
    });
    const socialRelation = Object.values(state.v16!.settlementRelations).find(
      (relation) =>
        relation.settlementA === 'foreign_market' ||
        relation.settlementB === 'foreign_market',
    );
    expect(socialRelation?.cooperation).toBeGreaterThan(0);
    assertAdventureEconomyV19(state);
  });

  it('does not turn an unprepared child or resident into an adventurer by quota', async () => {
    const { state, resident, dungeonId } = await preparedWorld(
      'v19-no-forced-adventurer',
    );
    resident.life.stage = 'child';
    resident.life.ageYears = 9;
    expect(chooseDungeonExpeditionV19(state, resident, [dungeonId], 0)).toBeUndefined();
    expect(state.v19!.adventureEconomy.adventurersByAgentId[resident.id]).toBeUndefined();
  });
});
