import { describe, expect, it } from 'vitest';
import {
  allowedActionsForAgeV16,
  ensureSettlementRelationV16,
  productiveCapacityScaleV16,
  settlementFamilyCapacityV16,
  SAPIENT_RACES_V16,
  worldPopulationCapacityV16,
} from '../src/v16/SocietyFoundationV16';
import {
  inspectPlaceV16,
  inspectResidentV16,
  inspectWildlifeV16,
} from '../src/v16/TruthfulInspectorsV16';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WORLD_RULES_VERSION, WorldEngine } from '../src/world/WorldEngine';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';

describe('v0.3.16 age-safe autonomy', () => {
  it('does not let a one-year-old gather, work, hunt, explore or form an adult bond', () => {
    for (const race of SAPIENT_RACES_V16) {
      expect([...allowedActionsForAgeV16(race, 1)]).toEqual(['rest']);
      expect(productiveCapacityScaleV16(race, 1)).toBe(0);
    }
  });

  it('enforces the physical capability envelope inside the live world engine', async () => {
    const source = await WorldEngine.create({
      worldId: 'v16-child-safety',
      seed: 'v16-child-safety',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const raw = source.snapshot();
    const child = Object.values(raw.agents)[0];
    child.life.ageYears = 1;
    child.life.stage = 'child';
    child.life.bornAt = 0;
    child.goal = { kind: 'secure_resources', strength: 1, since: 0 };
    child.plan = undefined;
    child.movement = undefined;
    child.lastAction = undefined;
    child.lastDecision = undefined;

    const store = new InMemoryWorldStore();
    await store.initializeWorld(raw);
    const world = await WorldEngine.open({ worldId: raw.id, store });
    await world.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR / 60);

    const after = world.snapshot().agents[child.id];
    expect(after.life.ageYears).toBeLessThan(2);
    expect(after.lastAction).toBe('rest');
    expect(['gather', 'work', 'hunt', 'explore', 'bond']).not.toContain(
      after.lastAction,
    );
  });
});

describe('v0.3.16 additive continuity migration', () => {
  it('repairs an early same-version v16 save once and resumes the existing world', async () => {
    const source = await WorldEngine.create({
      worldId: 'v16-same-version-schema-repair',
      seed: 'v16-same-version-schema-repair',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const stale = source.snapshot();
    const economy = stale.v16!.settlementEconomyById.settlement_ainkrad;
    economy.harvestEvents = 7;
    const preserved = structuredClone({
      now: stale.now,
      calendar: stale.calendar,
      determinism: stale.determinism,
      agents: stale.agents,
      relationships: stale.relationships,
      v15: stale.v15,
      stocks: economy.stocks,
      harvestEvents: economy.harvestEvents,
    });
    delete (economy as Partial<typeof economy>).harvestEventsByMaterial;

    const store = new InMemoryWorldStore();
    await store.initializeWorld(stale);
    const opened = await WorldEngine.open({ worldId: stale.id, store });
    const repaired = opened.snapshot();

    expect(repaired.revision).toBe(stale.revision + 1);
    expect({
      now: repaired.now,
      calendar: repaired.calendar,
      determinism: repaired.determinism,
      agents: repaired.agents,
      relationships: repaired.relationships,
      v15: repaired.v15,
      stocks:
        repaired.v16!.settlementEconomyById.settlement_ainkrad.stocks,
      harvestEvents:
        repaired.v16!.settlementEconomyById.settlement_ainkrad.harvestEvents,
    }).toEqual(preserved);
    expect(
      repaired.v16!.settlementEconomyById.settlement_ainkrad
        .harvestEventsByMaterial,
    ).toEqual({ food: 0, wood: 0, stone: 0, metal: 0, fuel: 0 });
    const repairEvents = (await store.history(stale.id)).filter(
      (event) =>
        event.payload.migrationMode ===
        'same_version_additive_schema_repair',
    );
    expect(repairEvents).toHaveLength(1);

    const reopened = await WorldEngine.open({ worldId: stale.id, store });
    expect(reopened.snapshot().revision).toBe(repaired.revision);
    expect(
      (await store.history(stale.id)).filter(
        (event) =>
          event.payload.migrationMode ===
          'same_version_additive_schema_repair',
      ),
    ).toHaveLength(1);

    await reopened.advanceCanonicalTimeTo(
      repaired.calendar.elapsedWorldMinutes + WORLD_MINUTES_PER_YEAR / 60,
    );
    expect(
      reopened.snapshot().calendar.elapsedWorldMinutes,
    ).toBeGreaterThan(repaired.calendar.elapsedWorldMinutes);
  });

  it('repairs a stale v15 life-stage label without rewriting resident identity', async () => {
    const source = await WorldEngine.create({
      worldId: 'v16-stage-migration',
      seed: 'v16-stage-migration',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const legacy = source.snapshot();
    legacy.rulesVersion = 'ainkrad-world-rules-0.3.15';
    legacy.governance.constitutionVersion = 'ainkrad-constitution-0.3.15';
    delete legacy.v16;

    const resident = Object.values(legacy.agents)[0];
    resident.race = 'goblin';
    resident.life.ageYears = 16;
    resident.life.stage = 'adolescent';
    const identityBefore = structuredClone({
      id: resident.id,
      mind: resident.mind,
      personality: resident.personality,
      skills: resident.skills,
      relationships: legacy.relationships,
    });

    const store = new InMemoryWorldStore();
    await store.initializeWorld(legacy);
    const migrated = await WorldEngine.open({ worldId: legacy.id, store });
    const after = migrated.snapshot();
    const migratedResident = after.agents[resident.id];

    expect(migratedResident.life.ageYears).toBe(16);
    expect(migratedResident.life.stage).toBe('adult');
    expect({
      id: migratedResident.id,
      mind: migratedResident.mind,
      personality: migratedResident.personality,
      skills: migratedResident.skills,
      relationships: after.relationships,
    }).toEqual(identityBefore);
  });

  it('adds society evidence without rewriting the v15 world or RNG future', async () => {
    const source = await WorldEngine.create({
      worldId: 'v16-additive-migration',
      seed: 'v16-additive-migration',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const legacy = source.snapshot();
    legacy.rulesVersion = 'ainkrad-world-rules-0.3.15';
    legacy.governance.constitutionVersion = 'ainkrad-constitution-0.3.15';
    delete legacy.v16;

    const preserved = {
      now: legacy.now,
      worldMinutes: legacy.calendar.elapsedWorldMinutes,
      determinism: structuredClone(legacy.determinism),
      environment: structuredClone(legacy.environment),
      agents: structuredClone(legacy.agents),
      places: structuredClone(legacy.places),
      relationships: structuredClone(legacy.relationships),
      v15: structuredClone(legacy.v15),
    };
    const store = new InMemoryWorldStore();
    await store.initializeWorld(legacy);
    const migrated = await WorldEngine.open({ worldId: legacy.id, store });
    const state = migrated.snapshot();

    expect(state.rulesVersion).toBe(WORLD_RULES_VERSION);
    expect(state.now).toBe(preserved.now);
    expect(state.calendar.elapsedWorldMinutes).toBe(preserved.worldMinutes);
    expect(state.determinism).toEqual(preserved.determinism);
    expect(state.environment).toEqual(preserved.environment);
    expect(state.agents).toEqual(preserved.agents);
    expect(state.places).toEqual(preserved.places);
    expect(state.relationships).toEqual(preserved.relationships);
    expect(state.v15).toEqual(preserved.v15);
    expect(state.v16?.migratedFromRulesVersion).toBe(
      'ainkrad-world-rules-0.3.15',
    );
    expect(Object.keys(state.v16?.residentEvidenceByAgentId ?? {})).toEqual(
      Object.keys(state.agents).sort(),
    );
  });
});

describe('v0.3.16 race-neutral family opportunities', () => {
  it('expands demographic room through real housing instead of a fixed 128-person quota', async () => {
    const world = await WorldEngine.create({
      worldId: 'v16-physical-population-capacity',
      seed: 'v16-physical-population-capacity',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const state = world.snapshot();
    const beforeLocal = settlementFamilyCapacityV16(
      state,
      'settlement_ainkrad',
    );
    const beforeWorld = worldPopulationCapacityV16(state);
    const sourceHome = Object.values(state.places).find(
      (place) => place.kind === 'home',
    )!;
    state.places.v16_capacity_test_home = {
      ...sourceHome,
      id: 'v16_capacity_test_home',
      name: 'Capacity test home',
      capacity: 200,
      settlementId: 'settlement_ainkrad',
    };
    state.settlements.settlement_ainkrad.memberPlaceIds.push(
      'v16_capacity_test_home',
    );

    expect(
      settlementFamilyCapacityV16(state, 'settlement_ainkrad'),
    ).toBe(beforeLocal + 200);
    expect(worldPopulationCapacityV16(state)).toBe(beforeWorld + 200);
    expect(worldPopulationCapacityV16(state)).toBeGreaterThan(128);
  });

  it('lets a non-human people make voluntary family choices and continue a lineage', async () => {
    const source = await WorldEngine.create({
      worldId: 'v16-goblin-lineage',
      seed: 'v16-goblin-lineage',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const raw = source.snapshot();
    const adults = Object.values(raw.agents).slice(0, 4);
    for (const adult of adults) {
      adult.race = 'goblin';
      adult.life.ageYears = 24;
      adult.life.stage = 'adult';
      adult.life.health = 0.96;
      adult.resources = 0.92;
      adult.stress = 0.02;
      const agency = raw.v15!.familyAgencyByAgentId[adult.id];
      agency.physicalIntimacyInclination = 1;
      agency.childDesire = 1;
      agency.autonomy = 1;
    }
    for (const [a, b] of [
      [adults[0], adults[1]],
      [adults[2], adults[3]],
    ] as const) {
      a.sex = 'male';
      b.sex = 'female';
      raw.relationships[[a.id, b.id].sort().join('::')] = {
        agentA: a.id,
        agentB: b.id,
        trust: 1,
        affinity: 1,
        respect: 1,
        conflict: 0,
        updatedAt: 0,
      };
    }

    const store = new InMemoryWorldStore();
    await store.initializeWorld(raw);
    const world = await WorldEngine.open({ worldId: raw.id, store });
    await world.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR * 12);
    const state = world.snapshot();
    const goblins = Object.values(state.agents).filter(
      (agent) => agent.life.alive && agent.race === 'goblin',
    );
    const bornGoblins = Object.values(state.agents).filter(
      (agent) => agent.race === 'goblin' && agent.life.generation > 0,
    );

    expect(goblins.length).toBeGreaterThanOrEqual(4);
    expect(bornGoblins.length).toBeGreaterThan(0);
    expect(
      state.v16!.raceFamilyOpportunityByRace.goblin.opportunityChecks,
    ).toBeGreaterThan(0);
    expect(
      state.v16!.raceFamilyOpportunityByRace.goblin.birthsSinceTracking,
    ).toBeGreaterThan(0);
  }, 60_000);
});

describe('v0.3.16 truthful entity inspectors', () => {
  it('reports only persisted resident, wildlife and terrain evidence', async () => {
    const world = await WorldEngine.create({
      worldId: 'v16-inspectors',
      seed: 'v16-inspectors',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    await world.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR / 2);
    const state = world.snapshot();
    const resident = Object.values(state.agents)[0];
    state.wildlife.inspectable_rabbits = {
      id: 'inspectable_rabbits',
      species: 'rabbit',
      habitatId: 'outskirts',
      count: 7,
      carryingCapacity: 12,
      reproductionRate: 0.18,
      alertness: 0.42,
      threat: 0.03,
      isMonster: false,
      lastChangedAt: state.now,
    };

    const residentReport = inspectResidentV16(state, resident.id);
    const wildlifeReport = inspectWildlifeV16(state, 'inspectable_rabbits');
    const placeReport = inspectPlaceV16(state, 'outskirts');

    expect(residentReport?.kind).toBe('resident');
    expect(residentReport?.title).toBe(resident.name);
    expect(residentReport?.evidenceNote).toContain('не дописывается');
    expect(wildlifeReport?.badge).toBe('ЖИВОТНОЕ');
    expect(wildlifeReport?.sections[0].rows[0].value).toContain('7');
    expect(placeReport?.kind).toBe('place');
    expect(placeReport?.title).toBe(state.places.outskirts.name);
  });
});

describe('v0.3.17 physically grounded hostile ecology', () => {
  it('keeps territorial monsters active without attacking a destination remotely', async () => {
    const store = new InMemoryWorldStore();
    const source = await WorldEngine.create({
      worldId: 'v17-territorial-monster-physical-presence',
      seed: 'v16-demography-02',
      store: new InMemoryWorldStore(),
      startTime: 0,
      agentNames: Array.from({ length: 40 }, (_, index) =>
        `Territory witness ${index + 1}`,
      ),
    });
    const raw = source.snapshot();
    const outskirts = raw.places.outskirts;
    raw.places.test_monster_forest = {
      ...outskirts,
      id: 'test_monster_forest',
      name: 'Controlled monster forest',
      kind: 'forest',
      biome: 'forest',
      mapX: outskirts.mapX + 4,
      mapY: outskirts.mapY + 2,
      connectedPlaceIds: ['outskirts'],
      danger: 0.95,
      settlementId: undefined,
      claimedBySettlementId: undefined,
      discoveredAt: 0,
    };
    outskirts.connectedPlaceIds.push('test_monster_forest');
    raw.wildlife.test_commons_rabbits = {
      id: 'test_commons_rabbits',
      species: 'rabbit',
      habitatId: 'test_monster_forest',
      count: 200,
      carryingCapacity: 220,
      reproductionRate: 0.7,
      alertness: 0.25,
      threat: 0.02,
      isMonster: false,
      lastChangedAt: 0,
    };
    raw.wildlife.test_commons_dire_wolves = {
      id: 'test_commons_dire_wolves',
      species: 'dire_wolf',
      habitatId: 'test_monster_forest',
      count: 12,
      carryingCapacity: 16,
      reproductionRate: 0.2,
      threat: 0.9,
      alertness: 0.9,
      isMonster: true,
      lastChangedAt: 0,
      lastFedAt: 0,
    };
    for (const resident of Object.values(raw.agents)) {
      resident.locationId = 'test_monster_forest';
      resident.position = {
        x: raw.places.test_monster_forest.mapX,
        y: raw.places.test_monster_forest.mapY,
        layerId: 'surface',
      };
      resident.movement = undefined;
      resident.plan = undefined;
    }
    await store.initializeWorld(raw);
    const world = await WorldEngine.open({ worldId: raw.id, store });
    await world.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR);

    const encounters = (
      await store.history('v17-territorial-monster-physical-presence')
    ).filter((event) => event.kind === 'world.monster.encountered');
    expect(encounters.length).toBeGreaterThan(0);
    expect(
      encounters.every(
        (event) =>
          event.payload.reason === 'territorial_defense' &&
          event.payload.routeInProgress === false,
      ),
    ).toBe(true);
    expect(
      Object.values(world.snapshot().wildlife).some(
        (population) => population.isMonster && population.count > 0,
      ),
    ).toBe(true);
  }, 30_000);

  it('makes monsters consume reachable prey and lose population when isolated from food', async () => {
    const source = await WorldEngine.create({
      worldId: 'v17-monster-food-chain',
      seed: 'v17-monster-food-chain',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const raw = source.snapshot();
    const outskirts = raw.places.outskirts;
    raw.places.test_predator_forest = {
      ...outskirts,
      id: 'test_predator_forest',
      name: 'Test Predator Forest',
      kind: 'forest',
      biome: 'forest',
      mapX: outskirts.mapX + 18,
      mapY: outskirts.mapY + 4,
      connectedPlaceIds: ['outskirts'],
      settlementId: undefined,
      claimedBySettlementId: undefined,
      discoveredAt: 0,
    };
    raw.places.test_barren_ruins = {
      ...outskirts,
      id: 'test_barren_ruins',
      name: 'Test Barren Ruins',
      kind: 'ruins',
      biome: 'ancient_ruins',
      mapX: outskirts.mapX - 18,
      mapY: outskirts.mapY + 4,
      connectedPlaceIds: ['outskirts'],
      settlementId: undefined,
      claimedBySettlementId: undefined,
      discoveredAt: 0,
    };
    outskirts.connectedPlaceIds.push(
      'test_predator_forest',
      'test_barren_ruins',
    );
    raw.wildlife.test_rabbits = {
      id: 'test_rabbits',
      species: 'rabbit',
      habitatId: 'test_predator_forest',
      count: 6,
      carryingCapacity: 8,
      reproductionRate: 0,
      alertness: 0.2,
      threat: 0.03,
      isMonster: false,
      lastChangedAt: 0,
    };
    raw.wildlife.test_dire_wolves = {
      id: 'test_dire_wolves',
      species: 'dire_wolf',
      habitatId: 'test_predator_forest',
      count: 2,
      carryingCapacity: 3,
      reproductionRate: 0,
      alertness: 0.72,
      threat: 0.74,
      isMonster: true,
      lastChangedAt: 0,
    };
    raw.wildlife.test_hungry_wraiths = {
      id: 'test_hungry_wraiths',
      species: 'wraith',
      habitatId: 'test_barren_ruins',
      count: 2,
      carryingCapacity: 3,
      reproductionRate: 1,
      alertness: 0.8,
      threat: 0.86,
      isMonster: true,
      lastChangedAt: 0,
    };
    raw.wildlife.test_extinct_wraiths = {
      id: 'test_extinct_wraiths',
      species: 'wraith',
      habitatId: 'test_barren_ruins',
      count: 0,
      carryingCapacity: 3,
      reproductionRate: 1,
      alertness: 0.8,
      threat: 0.86,
      isMonster: true,
      lastChangedAt: 0,
      lastFedAt: 0,
    };

    const store = new InMemoryWorldStore();
    await store.initializeWorld(raw);
    const world = await WorldEngine.open({ worldId: raw.id, store });
    await world.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR);

    const state = world.snapshot();
    const history = await store.history(raw.id);
    const feedingEvents = history.filter(
      (event) => event.kind === 'world.monster.hunted_prey',
    );
    const hungerEvents = history.filter(
      (event) => event.kind === 'world.monster.hunger',
    );
    const extinctRecoveryEvents = history.filter(
      (event) =>
        event.kind === 'world.wildlife.recovered' &&
        event.payload.populationId === 'test_extinct_wraiths',
    );

    expect(feedingEvents.length).toBe(2);
    expect(
      feedingEvents.every(
        (event) =>
          event.payload.monsterPopulationId === 'test_dire_wolves' &&
          event.payload.preyPopulationId === 'test_rabbits' &&
          event.payload.reason === 'feeding',
      ),
    ).toBe(true);
    expect(
      feedingEvents.reduce(
        (total, event) => total + Number(event.payload.consumed ?? 0),
        0,
      ),
    ).toBe(2);
    // Residents remain free to hunt the same rabbits, so the final total may
    // be lower; the predator's own two persisted meals are asserted above.
    expect(state.wildlife.test_rabbits.count).toBeLessThanOrEqual(4);
    expect(state.wildlife.test_dire_wolves.count).toBe(2);
    expect(state.wildlife.test_dire_wolves.lastFedAt).toBe(60);
    expect(state.wildlife.test_hungry_wraiths.count).toBe(1);
    expect(state.wildlife.test_extinct_wraiths.count).toBe(0);
    expect(extinctRecoveryEvents).toHaveLength(0);
    expect(
      hungerEvents.some(
        (event) =>
          event.payload.monsterPopulationId === 'test_hungry_wraiths' &&
          event.payload.reason === 'no_reachable_prey',
      ),
    ).toBe(true);
  }, 30_000);
});

describe('v0.3.16 material settlements and death aftermath', () => {
  it('turns learned field work into recorded food/material harvests', async () => {
    const source = await WorldEngine.create({
      worldId: 'v16-material-harvest',
      seed: 'v16-material-harvest',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const raw = source.snapshot();
    raw.v16!.settlementEconomyById.settlement_ainkrad.stocks.food = 0;
    const store = new InMemoryWorldStore();
    await store.initializeWorld(raw);
    const world = await WorldEngine.open({ worldId: raw.id, store });
    await world.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR * 2);
    const state = world.snapshot();
    const economy = state.v16!.settlementEconomyById.settlement_ainkrad;
    const harvestEvents = (await store.history(state.id)).filter(
      (event) =>
        event.kind === 'agent.gathered' &&
        typeof event.payload.material === 'string' &&
        Number(event.payload.materialYield) > 0,
    );

    expect(economy.harvestEvents).toBeGreaterThan(0);
    expect(economy.lastHarvestWorldMinute).toBeGreaterThan(0);
    expect(Object.values(economy.stocks).every((amount) => amount >= 0)).toBe(true);
    expect(
      (Object.keys(economy.stocks) as Array<keyof typeof economy.stocks>).every(
        (material) =>
          economy.stocks[material] <= economy.storageCapacity[material],
      ),
    ).toBe(true);
    expect(harvestEvents.some((event) => event.payload.material === 'food')).toBe(true);
  });

  it('keeps a real corpse, lets residents bury it and creates a cemetery', async () => {
    const source = await WorldEngine.create({
      worldId: 'v16-burial-aftercare',
      seed: 'v16-burial-aftercare',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const raw = source.snapshot();
    const deceased = Object.values(raw.agents)[0];
    deceased.life.lifespanYears = deceased.life.ageYears + 0.01;
    for (const agent of Object.values(raw.agents).slice(1)) {
      agent.personality.generosity = 1;
      agent.personality.diligence = 1;
      agent.mind.values.care = 1;
      agent.energy = 1;
      agent.life.health = 1;
      agent.movement = undefined;
      agent.plan = undefined;
    }
    const store = new InMemoryWorldStore();
    await store.initializeWorld(raw);
    const world = await WorldEngine.open({ worldId: raw.id, store });
    await world.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR * 2);
    const state = world.snapshot();
    const remains = state.v16!.remainsById[`remains:${deceased.id}`];

    expect(remains).toBeDefined();
    expect(remains.status).toBe('buried');
    expect(remains.buriedByAgentIds.length).toBeGreaterThan(0);
    expect(state.places[remains.burialPlaceId!].kind).toBe('cemetery');
    expect(
      state.v16!.burialSitesBySettlementId.settlement_ainkrad.burialCount,
    ).toBeGreaterThan(0);
  }, 30_000);

  it('reserves local materials and builds a real home when housing is full', async () => {
    const source = await WorldEngine.create({
      worldId: 'v16-material-home',
      seed: 'v16-material-home',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    const raw = source.snapshot();
    const settlement = raw.settlements.settlement_ainkrad;
    const startingHomes = settlement.memberPlaceIds.filter(
      (placeId) => raw.places[placeId]?.kind === 'home',
    );
    for (const homeId of startingHomes) raw.places[homeId].capacity = 1;
    const economy = raw.v16!.settlementEconomyById.settlement_ainkrad;
    economy.stocks.wood = economy.storageCapacity.wood;
    economy.stocks.stone = economy.storageCapacity.stone;
    economy.constructionTools = 1;
    for (const agent of Object.values(raw.agents)) {
      agent.life.stage = 'adult';
      agent.life.ageYears = Math.max(24, agent.life.ageYears);
      agent.life.health = 1;
      agent.energy = 1;
      agent.movement = undefined;
      agent.plan = undefined;
      agent.skills.craft = 1;
      agent.personality.diligence = 1;
      agent.personality.curiosity = 1;
      agent.mind.values.care = 1;
      agent.needs.purpose = 1;
    }
    const store = new InMemoryWorldStore();
    await store.initializeWorld(raw);
    const world = await WorldEngine.open({ worldId: raw.id, store });
    await world.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR * 5);
    const state = world.snapshot();
    const afterHomes = state.settlements.settlement_ainkrad.memberPlaceIds.filter(
      (placeId) => state.places[placeId]?.kind === 'home',
    );
    const homeEvents = (await store.history(state.id)).filter(
      (event) => event.kind === 'world.building.home_built',
    );

    expect(afterHomes.length).toBeGreaterThan(startingHomes.length);
    expect(
      state.v16!.settlementEconomyById.settlement_ainkrad.constructionEvents,
    ).toBeGreaterThan(0);
    expect(homeEvents.length).toBeGreaterThan(0);
  }, 30_000);

  it('allows voluntary settlement war over real resources or claimed land', async () => {
    const source = await WorldEngine.create({
      worldId: 'v16-voluntary-war',
      seed: 'v16-voluntary-war',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    await source.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR * 12);
    const raw = source.snapshot();
    const settlements = Object.values(raw.settlements);
    expect(settlements.length).toBeGreaterThanOrEqual(2);
    const [settlementA, settlementB] = settlements;
    const homesB = settlementB.memberPlaceIds.filter(
      (placeId) => raw.places[placeId]?.kind === 'home',
    );
    const living = Object.values(raw.agents).filter((agent) => agent.life.alive);
    for (let index = 0; index < Math.min(8, living.length); index += 1) {
      if (index < 4 && homesB.length > 0) {
        living[index].homeId = homesB[index % homesB.length];
        living[index].locationId = settlementB.centerPlaceId;
      }
    }
    for (const agent of living) {
      agent.life.stage = 'adult';
      agent.life.ageYears = Math.max(24, agent.life.ageYears);
      agent.life.health = 1;
      agent.energy = 1;
      agent.movement = undefined;
      agent.plan = undefined;
      agent.personality.riskTolerance = 1;
      agent.mind.values.ambition = 1;
      if (agent.progression) agent.progression.combatMastery = 1;
    }
    const relation = ensureSettlementRelationV16(
      raw,
      settlementA.id,
      settlementB.id,
    );
    relation.activeWar = true;
    relation.hostility = 1;
    relation.grievance = 1;
    relation.fear = 0.8;
    relation.trust = 0;
    relation.cooperation = 0;
    relation.warStartedWorldMinute = raw.calendar.elapsedWorldMinutes;
    raw.revision = 0;

    const store = new InMemoryWorldStore();
    await store.initializeWorld(raw);
    const world = await WorldEngine.open({ worldId: raw.id, store });
    await world.advanceCanonicalTimeTo(
      raw.calendar.elapsedWorldMinutes + WORLD_MINUTES_PER_YEAR * 5,
    );
    const state = world.snapshot();
    const after = state.v16!.settlementRelations[
      [settlementA.id, settlementB.id].sort().join('::')
    ];
    const conflicts = (await store.history(state.id)).filter(
      (event) => event.kind === 'world.settlement.conflict',
    );

    expect(after.conflictRounds).toBeGreaterThan(0);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(
      after.resourceRaids > 0 ||
        after.landDisputes > 0 ||
        after.contestedPlaceId !== undefined,
    ).toBe(true);
  }, 60_000);
});
