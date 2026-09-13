import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { residentExplorationTarget } from '../src/world/ResidentExploration';
import {
  WORLD_MINUTES_PER_YEAR,
  WORLD_SPEED_PRESETS,
  worldMinutesPerTick,
} from '../src/world/WorldClock';
import { WorldEngine } from '../src/world/WorldEngine';
import {
  recordEmbodiedReadingV21,
  recordTraumaV21,
  youngChildMayTravelToV21,
} from '../src/v21/EmbodiedWorldV21';
import {
  DUNGEON_FLOOR_COUNT_V21,
  assessDungeonRiskV21,
  dungeonRankForFloorV21,
} from '../src/v21/DungeonRpgV21';
import {
  advanceEmergentSocietyV21,
  marketUnitPriceV21,
} from '../src/v21/EmergentSocietyV21';
import {
  livingHomeClaimantsV21,
  reusableAbandonedHomesV21,
} from '../src/v21/HomeStewardshipV21';
import {
  repairRussianNativeNamesV18,
  toRussianWorldNameV18,
} from '../src/v18/CulturalNamingV18';
import {
  FOUNDING_PRIMER_ID_V21,
  studyFoundingPrimerV21,
} from '../src/v21/FoundingPrimerV21';
import { worldWeatherV21 } from '../src/v21/WeatherV21';

const freshEngine = (id: string) => WorldEngine.create({
  worldId: id,
  seed: `${id}:seed`,
  store: new InMemoryWorldStore(),
  startTime: 0,
});

describe('FIX10 autonomous agents and separated world systems', () => {
  it('removes 50/100-year controls and clamps their old saves to ten years', () => {
    expect(WORLD_SPEED_PRESETS.map((preset) => preset.id)).not.toContain('fifty_years_per_minute');
    expect(WORLD_SPEED_PRESETS.map((preset) => preset.id)).not.toContain('century_per_minute');
    const decade = worldMinutesPerTick('decade_per_minute', 1);
    expect(worldMinutesPerTick('fifty_years_per_minute', 1)).toBe(decade);
    expect(worldMinutesPerTick('century_per_minute', 100)).toBe(decade);
  });

  it('shows distinct race headings, agent terminology and the plain field name', () => {
    const browser = readFileSync(new URL('../src/browser.ts', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../src/browser.css', import.meta.url), 'utf8');
    expect(browser).toContain('group.dataset.race');
    expect(browser).toContain("label: 'Поле'");
    expect(browser).not.toContain("label: 'Ресурсное поле'");
    expect(browser).toContain('Выбранный агент');
    expect(css).toContain("optgroup[data-race='human']");
    expect(css).toContain("optgroup[data-race='elf']");
    expect(css).toMatch(/#resident-picker optgroup\s*\{[^}]*font-weight:\s*900/s);
  });

  it('lets children choose locally but requires a physically accompanying parent remotely', async () => {
    const world = (await freshEngine('fix10-child-supervision')).snapshot();
    const child = world.agents.agent_1;
    const parent = world.agents.agent_2;
    child.life.ageYears = 8;
    child.life.stage = 'child';
    child.life.parentIds = [parent.id];
    parent.life.childIds = [child.id];
    expect(youngChildMayTravelToV21(world, child, child.homeId)).toBe(true);
    expect(youngChildMayTravelToV21(world, child, 'forest')).toBe(false);
    parent.locationId = child.locationId;
    parent.plan = {
      kind: 'explore_frontier',
      targetPlaceId: 'forest',
      startedAt: 0,
      expiresAt: 100,
    };
    expect(youngChildMayTravelToV21(world, child, 'forest')).toBe(true);
  });

  it('keeps book theory separate from embodied observation and injury', async () => {
    const world = (await freshEngine('fix10-embodied-knowledge')).snapshot();
    const agent = world.agents.agent_1;
    recordEmbodiedReadingV21(world, agent, 'medicine', 'anatomy-book', 1);
    const knowledge = world.v21!.appliedKnowledgeByAgentId[agent.id];
    expect(knowledge.anatomyTheory).toBeGreaterThan(0);
    expect(knowledge.treatmentPractice).toBe(0);
    recordTraumaV21(world, agent, 0.5, 'dungeon', 'test-impact');
    expect(world.v21!.bodiesByAgentId[agent.id].wounds.length).toBe(1);
    expect(knowledge.treatmentPractice).toBe(0);
  });

  it('uses 100 sequential dungeon floors and makes a team safer than a lone agent', async () => {
    const world = (await freshEngine('fix10-party-risk')).snapshot();
    const leader = world.agents.agent_1;
    const companion = world.agents.agent_2;
    for (const agent of [leader, companion]) {
      agent.life.stage = 'adult';
      agent.life.ageYears = 24;
      agent.life.health = 1;
      agent.energy = 1;
      agent.skills.hunting = 0.8;
      agent.skills.exploration = 0.8;
    }
    const dungeon = {
      ...Object.values(world.v19!.adventureEconomy.dungeonsById)[0],
      id: 'test-dungeon',
      entrancePlaceId: leader.locationId,
      depth: DUNGEON_FLOOR_COUNT_V21,
      threat: 0.6,
      clearedDepth: 39,
      formationProgress: 1,
      bossFloors: Array.from({ length: 10 }, (_, index) => (index + 1) * 10),
      active: true,
    };
    expect(DUNGEON_FLOOR_COUNT_V21).toBe(100);
    expect(dungeonRankForFloorV21(1)).toBe('F');
    expect(dungeonRankForFloorV21(100)).toBe('S');
    const solo = assessDungeonRiskV21(world, dungeon, [leader], 40);
    const team = assessDungeonRiskV21(world, dungeon, [leader, companion], 40);
    expect(team.partyCapacity).toBeGreaterThan(solo.partyCapacity);
    expect(team.survivalMargin).toBeGreaterThan(solo.survivalMargin);
  });

  it('recognizes practiced work and prices scarce goods without granting combat power', async () => {
    const world = (await freshEngine('fix10-emergent-work')).snapshot();
    const agent = world.agents.agent_1;
    const economy = world.v19!.adventureEconomy;
    const livelihood = world.v18!.livelihoodByAgentId[agent.id];
    livelihood.practiceByKind.builder = 24;
    livelihood.lastPracticedWorldMinute = world.calendar.elapsedWorldMinutes;
    const settlementId = world.places[agent.homeId].settlementId!;
    const market = economy.settlementMarketsById[settlementId];
    world.v16!.settlementEconomyById[settlementId].stocks.food = 0;
    world.calendar.elapsedWorldMinutes += WORLD_MINUTES_PER_YEAR;
    advanceEmergentSocietyV21(world);
    const scarce = marketUnitPriceV21(world, economy, settlementId, 'food');
    const combatBefore = agent.progression?.combatMastery ?? 0;
    expect(Object.values(economy.emergentSociety.professionsById)
      .some((profession) => profession.agentId === agent.id && profession.primaryDomain === 'builder'))
      .toBe(true);
    world.v16!.settlementEconomyById[settlementId].stocks.food = 100;
    economy.emergentSociety.marketPricesByKey[`${settlementId}:food`].updatedWorldMinute = 0;
    world.calendar.elapsedWorldMinutes += WORLD_MINUTES_PER_YEAR;
    const abundant = marketUnitPriceV21(world, economy, settlementId, 'food');
    expect(scarce).toBeGreaterThan(abundant);
    expect(agent.progression?.combatMastery ?? 0).toBe(combatBefore);
  });

  it('does not force every explorer toward the same known frontier', async () => {
    const world = (await freshEngine('fix10-varied-frontier')).snapshot();
    const agent = world.agents.agent_1;
    const model = world.places.outskirts;
    for (let index = 0; index < 4; index += 1) {
      world.places[`frontier-${index}`] = {
        ...structuredClone(model),
        id: `frontier-${index}`,
        settlementId: undefined,
        kind: index % 2 ? 'forest' : 'meadow',
        mapX: model.mapX + 15 + index * 4,
        mapY: model.mapY + (index - 2) * 6,
      };
    }
    agent.knownPlaceIds = Array.from({ length: 4 }, (_, index) => `frontier-${index}`);
    const choices = new Set([0.01, 0.35, 0.68, 0.98].map((roll) =>
      residentExplorationTarget(world, agent, () => true, [], roll)));
    expect(choices.size).toBeGreaterThan(1);
  });

  it('keeps a traveller home claim and exposes only a dead owner home for repair', async () => {
    const world = (await freshEngine('fix10-home-claims')).snapshot();
    const traveller = world.agents.agent_1;
    const deceased = world.agents.agent_2;
    traveller.locationId = 'outskirts';
    traveller.movement = {
      targetPlaceId: 'resource_field',
      purpose: 'gather',
      routePlaceIds: ['outskirts', 'resource_field'],
      routeIndex: 0,
      progressToNext: 0.3,
    };
    deceased.life.alive = false;
    const settlementId = world.places[traveller.homeId].settlementId!;
    expect(livingHomeClaimantsV21(world, traveller.homeId).map((agent) => agent.id))
      .toEqual([traveller.id]);
    const reusableIds = reusableAbandonedHomesV21(world, settlementId)
      .map((home) => home.id);
    expect(reusableIds).toContain(deceased.homeId);
    expect(reusableIds).not.toContain(traveller.homeId);
  });

  it('writes native world names in Cyrillic without changing identity records', async () => {
    const world = (await freshEngine('fix10-russian-names')).snapshot();
    const agent = world.agents.agent_1;
    const id = agent.id;
    agent.name = 'Aron';
    expect(repairRussianNativeNamesV18(world)).toBe(1);
    expect(agent.id).toBe(id);
    expect(agent.name).toBe('Арон');
    expect(toRussianWorldNameV18('Lethiel')).not.toMatch(/[A-Za-z]/);
  });

  it('teaches ages 5-17 a bounded primer without choosing their action', async () => {
    const world = (await freshEngine('fix10-founding-primer')).snapshot();
    const child = world.agents.agent_1;
    child.life.ageYears = 5;
    child.life.stage = 'child';
    child.locationId = child.homeId;
    child.lastAction = 'rest';
    const first = studyFoundingPrimerV21(world, child, 'rest');
    expect(first.firstLesson).toBe(true);
    expect(world.v15!.items[FOUNDING_PRIMER_ID_V21]).toBeDefined();
    expect(world.v21!.appliedKnowledgeByAgentId[child.id].homeTheory)
      .toBeGreaterThan(0);
    expect(child.lastAction).toBe('rest');
    expect(studyFoundingPrimerV21(world, child, 'rest').studied).toBe(false);
  });

  it('derives changing weather that affects outdoor movement', async () => {
    const world = (await freshEngine('fix10-weather')).snapshot();
    const samples = Array.from({ length: 90 }, (_, day) =>
      worldWeatherV21(world, day * 2 * 1_440));
    expect(new Set(samples.map((sample) => sample.kind)).size).toBeGreaterThan(2);
    expect(samples.some((sample) => sample.walkingScale < 0.85)).toBe(true);
    expect(samples.some((sample) => sample.kind === 'clear')).toBe(true);
  });
});
