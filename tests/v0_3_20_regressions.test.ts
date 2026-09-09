import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { WORLD_MINUTES_PER_YEAR, WORLD_SPEED_PRESETS } from '../src/world/WorldClock';
import { applyDivineActionV19, recordContextualPrayerV19 } from '../src/v19/DivineAgencyV19';
import { GIFT_CATALOG_V20, giftLearningSnapshotV20, applyLivedGiftLearningV20 } from '../src/v20/DivineGiftsV20';
import { observeLocalPlacesV20, sharePlaceKnowledgeV20, frontierSiteV20, removeUnsurveyedHomelandLinksV20 } from '../src/v20/KnowledgeBoundariesV20';
import { ensureElfLibraryV20, readingBudgetV20 } from '../src/v20/LibraryLearningV20';
import { syncAdventureEconomyV19, chooseDungeonExpeditionV19 } from '../src/v19/AdventureEconomyV19';
import type { DivineGiftKind } from '../src/world/types';

const fresh = async () => (await WorldEngine.create({ worldId: 'v20-regression', seed: 'ainkrad-browser-world', store: new InMemoryWorldStore() })).snapshot();

describe('v0.3.20 lived knowledge, gifts and continuity', () => {
  it('keeps libraries private to their people even after face-to-face map sharing', async () => {
    const world = await fresh();
    const human = world.agents.agent_1, elf = world.agents.agent_2, orc = world.agents.agent_3;
    elf.race = 'elf'; orc.race = 'orc';
    const model = world.places.commons;
    world.places.settlement_elf_homeland = { ...model, id: 'settlement_elf_homeland', settlementId: 'settlement_elf_homeland', mapX: -7950, mapY: 8050, connectedPlaceIds: [] };
    ensureElfLibraryV20(world);
    const anchor = { ...world.places.elf_library_v20 };
    world.places.remote = { ...model, id: 'remote', mapX: -100000, mapY: -100000 };
    ensureElfLibraryV20(world);
    expect(world.places.elf_library_v20).toEqual(anchor);
    for (const agent of [human, elf, orc]) { agent.locationId = 'commons'; agent.movement = undefined; agent.position = { x: 50, y: 50, layerId: 'surface' }; }
    human.knownPlaceIds = ['commons', 'secret_library_v18'];
    elf.knownPlaceIds = ['commons', 'elf_library_v20']; orc.knownPlaceIds = ['commons'];
    sharePlaceKnowledgeV20(world, human, elf); sharePlaceKnowledgeV20(world, elf, human); sharePlaceKnowledgeV20(world, human, orc);
    expect(elf.knownPlaceIds).not.toContain('secret_library_v18');
    expect(orc.knownPlaceIds).not.toContain('secret_library_v18');
    expect(human.knownPlaceIds).not.toContain('elf_library_v20');
  });

  it('removes unsurveyed cross-continent edges and grows a frontier beside the explorer', async () => {
    const world = await fresh(); const human = world.agents.agent_1;
    const home = world.places.commons;
    world.places.remote_homeland = { ...home, id: 'remote_homeland', settlementId: 'remote_homeland', mapX: -12000, connectedPlaceIds: ['commons'] };
    home.connectedPlaceIds.push('remote_homeland');
    removeUnsurveyedHomelandLinksV20(world);
    expect(home.connectedPlaceIds).not.toContain('remote_homeland');
    human.locationId = 'commons'; human.position = { x: home.mapX, y: home.mapY, layerId: 'surface' };
    const site = frontierSiteV20(world, human, 300);
    expect(Math.hypot(site.x-home.mapX,site.y-home.mapY)).toBeLessThanOrEqual(40);
    expect(site.connections).toContain('commons');
    expect(site.connections).not.toContain('remote_homeland');
  });

  it('requires discovery and testimony for dungeons and does not enroll orcs in the human guild', async () => {
    const world = await fresh(); const a = world.agents.agent_1, b = world.agents.agent_2;
    world.places.unseen_ruins = { ...world.places.outskirts, id: 'unseen_ruins', kind: 'ruins', surface: 'land', danger: 0.2, mapX: 65, mapY: 55 };
    const state = syncAdventureEconomyV19(world);
    expect(state.dungeonsById['dungeon:unseen_ruins']).toBeUndefined();
    a.locationId = 'unseen_ruins'; a.movement = undefined;
    syncAdventureEconomyV19(world); observeLocalPlacesV20(world, a);
    const id = 'dungeon:unseen_ruins'; expect(state.dungeonsById[id].rank).toBe('F');
    b.energy = 1; b.resources = 1; b.life.health = 1; b.life.stage = 'adult';
    world.v18!.livelihoodByAgentId[b.id].primary = 'adventurer';
    expect(chooseDungeonExpeditionV19(world, b, [id], 0)).toBeUndefined();
    a.locationId = b.locationId; a.movement = undefined; b.movement = undefined;
    sharePlaceKnowledgeV20(world, a, b);
    expect(chooseDungeonExpeditionV19(world, b, [id], 0)?.id).toBe(id);
    b.race = 'orc'; expect(chooseDungeonExpeditionV19(world, b, [id], 0)).toBeUndefined();
  });

  it('grants every capability without changing identity, profession or inserting future knowledge', async () => {
    for (const gift of Object.keys(GIFT_CATALOG_V20) as DivineGiftKind[]) {
      const world = await fresh(); const person = world.agents.agent_1;
      world.v18!.livelihoodByAgentId[person.id].primary = 'farmer';
      const protectedBefore = structuredClone({ personality: person.personality, mind: person.mind.values, parents: person.life.parentIds, children: person.life.childIds });
      if (gift === 'legacy') applyDivineActionV19(world, { operationId: 'prior', agentId: person.id, deityId: 'player_deity', deityName: 'Создатель', gift: 'might', worldMinute: 0, interpretationRoll: 0.5 });
      const knowledgeBefore = structuredClone(world.v15!.knowledgeByAgentId[person.id]);
      applyDivineActionV19(world, { operationId: `test-${gift}`, agentId: person.id, deityId: 'player_deity', deityName: 'Создатель', gift, inheritanceGift: gift === 'legacy' ? 'might' : undefined, worldMinute: 0, interpretationRoll: 0.5 });
      expect(world.v18!.livelihoodByAgentId[person.id].primary).toBe('farmer');
      expect({ personality: person.personality, mind: person.mind.values, parents: person.life.parentIds, children: person.life.childIds }).toEqual(protectedBefore);
      expect(world.v15!.knowledgeByAgentId[person.id]).toEqual(knowledgeBefore);
      if (gift !== 'demon_king_hero') expect(person.progression!.level).toBeLessThan(100);
    }
  });

  it('accelerates actual practice but does not learn during an idle step', async () => {
    const world = await fresh(), person = world.agents.agent_1;
    applyDivineActionV19(world, { operationId: 'learning', agentId: person.id, deityId: 'player_deity', deityName: 'Создатель', gift: 'fast_learning', worldMinute: 0, interpretationRoll: 0.5 });
    const before = giftLearningSnapshotV20(world, person);
    applyLivedGiftLearningV20(world, person, before); expect(person.skills).toEqual(before.skills);
    person.skills.craft += 0.01;
    applyLivedGiftLearningV20(world, person, before);
    expect(person.skills.craft - before.skills.craft).toBeCloseTo(0.017);
  });

  it('uses elapsed reading time and literacy instead of instant whole-book acquisition', async () => {
    const person = (await fresh()).agents.agent_1;
    const hour = readingBudgetV20(person, 1, 240, 0);
    expect(hour.minutes).toBe(60); expect(hour.wordsPerMinute).toBe(238);
    expect(readingBudgetV20(person, 0.1, 240, 0.7).maximumWords).toBeLessThan(hour.maximumWords / 5);
    expect(readingBudgetV20(person, 1, 0, 0).maximumWords).toBe(0);
  });

  it('does not label a fed child with access to a granary as hungry or poor', async () => {
    const world = await fresh(), child = world.agents.agent_1;
    child.life.ageYears = 9; child.life.stage = 'child'; child.resources = 0;
    const rhythm = world.v18!.lifeRhythmByAgentId[child.id]; rhythm.satiety = 0.9; rhythm.missedMealQuanta = 0;
    const economy = world.v16!.settlementEconomyById[world.places[child.homeId].settlementId!]; economy.stocks.food = 10;
    for (let roll = 0; roll < 1; roll += 0.1) {
      const prayer = recordContextualPrayerV19(world, child, { subject: roll, deity: roll, wording: roll });
      expect(['hunger','poverty']).not.toContain(prayer.topic);
    }
  });

  it('retains displayed Cardinal experience on reload without an extra world tick', async () => {
    const options = { worldId: 'v20-cardinal-reopen', seed: 'ainkrad-browser-world', store: new InMemoryWorldStore(), controlLog: new InMemoryAppendOnlyLog(), mode: 'intervene' as const };
    const runtime = await LiveWorldRuntime.create(options);
    let frame = await runtime.tick(); for (let i=0;i<5;i++) frame = await runtime.tick();
    const experience = frame.evaluation!.experience.totalExperience;
    expect(experience).toBeGreaterThan(0); expect(frame.executedInterventionCount).toBe(0);
    const reopened = await LiveWorldRuntime.create(options);
    const resumed = await reopened.tick(0);
    expect(resumed.evaluation!.experience.totalExperience).toBeGreaterThanOrEqual(experience);
    expect(resumed.world.calendar).toEqual(frame.world.calendar);
    expect(WORLD_SPEED_PRESETS.find(p => p.id === 'century_per_minute')!.worldMinutesPerRealMinute).toBe(100 * WORLD_MINUTES_PER_YEAR);
  });
});
