import fs from 'node:fs';

const changed = [];
const lines = (...items) => items.join('\n');
function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) { fs.writeFileSync(path, after); changed.push(path); }
}
function replaceOnce(text, before, after, label) {
  if (text.includes(after)) return text;
  const i = text.indexOf(before);
  if (i < 0) throw new Error(`Final F2 anchor not found: ${label}`);
  return text.slice(0, i) + after + text.slice(i + before.length);
}

// A physical dungeon may be discovered by the peoples that can actually use
// the adventurer system. This blocks the old goblin/orc remote-dungeon leak
// without requiring the human/elf/dwarf discoverer to already have an
// adventurer profession before seeing an entrance.
update('src/v19/AdventureEconomyV19.ts', (text) => replaceOnce(
  text,
  lines(
    '  const occupiedPlaces = new Set(Object.values(world.agents)',
    '    .filter(agent => agent.life.alive && !agent.movement).map(agent => agent.locationId));',
    '  const candidates = Object.values(world.places)',
    '    .filter(place => eligibleDungeonEntrance(place) && occupiedPlaces.has(place.id))',
  ),
  lines(
    '  const eligibleDiscovererPlaces = new Set(Object.values(world.agents)',
    "    .filter(agent => agent.life.alive && !agent.movement && ['human', 'elf', 'dwarf'].includes(agent.race ?? 'human'))",
    '    .map(agent => agent.locationId));',
    '  const candidates = Object.values(world.places)',
    '    .filter(place => eligibleDungeonEntrance(place) && eligibleDiscovererPlaces.has(place.id))',
  ),
  'race-bounded physical dungeon discovery',
));

// A resident who really knows a dungeon can later tell a co-located resident
// about it. The knowledge may travel by testimony; the body may not. The
// expedition selector separately enforces the local distance gate, so hearing
// about a remote dungeon can never create a one-action cross-continent trip.
update('src/v20/KnowledgeBoundariesV20.ts', (text) => replaceOnce(
  text,
  lines(
    '  // Dungeon knowledge is likewise physical/local. A traveller can tell a',
    '  // companion about the dungeon at the place where they are standing, while a',
    '  // stale dungeon id from thousands of kilometres away no longer propagates.',
    '  const localDungeon = world.v19?.adventureEconomy.dungeonsById[`dungeon:${speaker.locationId}`];',
    '  if (localDungeon && (speaker.knownDungeonIds ?? []).includes(localDungeon.id)) {',
    '    listener.knownDungeonIds = [...new Set([...(listener.knownDungeonIds ?? []), localDungeon.id])];',
    '  }',
  ),
  lines(
    '  // Dungeon testimony is carried knowledge, not teleportation. Only a dungeon',
    '  // that already exists and is explicitly present in the speaker\'s own memory',
    '  // can be mentioned; merely existing in global world state is insufficient.',
    '  const testifiedDungeonIds = (speaker.knownDungeonIds ?? []).filter((id) => {',
    '    const dungeon = world.v19?.adventureEconomy.dungeonsById[id];',
    '    return Boolean(dungeon && (speaker.knownPlaceIds ?? []).includes(dungeon.entrancePlaceId));',
    '  });',
    '  if (testifiedDungeonIds.length) {',
    '    listener.knownDungeonIds = [...new Set([...(listener.knownDungeonIds ?? []), ...testifiedDungeonIds])];',
    '  }',
  ),
  'face-to-face carried dungeon testimony',
));

// Keep the old discovery/testimony regression local in the physically spread
// F2 world. The semantic contract is unchanged: no dungeon before arrival,
// testimony is required, and orcs do not enter the human guild.
update('tests/v0_3_20_regressions.test.ts', (text) => replaceOnce(
  text,
  "    world.places.unseen_ruins = { ...world.places.outskirts, id: 'unseen_ruins', kind: 'ruins', surface: 'land', danger: 0.2, mapX: 65, mapY: 55 };",
  lines(
    '    const outskirts = world.places.outskirts;',
    "    world.places.unseen_ruins = { ...outskirts, id: 'unseen_ruins', kind: 'ruins', surface: 'land', danger: 0.2,",
    '      mapX: outskirts.mapX + 8, mapY: outskirts.mapY + 6 };',
  ),
  'localize old dungeon testimony fixture',
));

// A carried-map freeze test needs a legitimate known-but-not-yet-surveyed
// point. Use a nearby physically connected landmark instead of the legacy raw
// knownPlaceIds shortcut that the F2 fix intentionally removed.
update('tests/v0_3_22_settlementCartography.test.ts', (text) => replaceOnce(
  text,
  lines(
    "    at(world, first, 'remote_a'); recordResidentSurvey(world, first, 'remote_a');",
    '    at(world, first, first.homeId);',
    '    consultSettlementMap(world, first); consultSettlementMap(world, second);',
    "    expect(second.knownPlaceIds).toContain('remote_a');",
    "    expect(residentSurveyedPlaceIds(world, second)).not.toContain('remote_a');",
  ),
  lines(
    '    const home = world.places[first.homeId];',
    '    world.places.remote_a.mapX = home.mapX + 20;',
    '    world.places.remote_a.mapY = home.mapY;',
    "    home.connectedPlaceIds = [...new Set([...home.connectedPlaceIds, 'remote_a'])];",
    "    world.places.remote_a.connectedPlaceIds = [...new Set([...world.places.remote_a.connectedPlaceIds, home.id])];",
    '    consultSettlementMap(world, first); consultSettlementMap(world, second);',
    "    expect(second.knownPlaceIds).toContain('remote_a');",
    "    expect(residentSurveyedPlaceIds(world, second)).not.toContain('remote_a');",
  ),
  'legitimate pre-survey carried-map fixture',
));

// Temporary diagnostic for the one remaining lineage regression. This prints
// only test-fixture aggregate state and is removed before a verified patch can
// be promoted to main.
update('tests/v0_3_16_societyFoundation.test.ts', (text) => replaceOnce(
  text,
  lines(
    '    const bornGoblins = Object.values(state.agents).filter(',
    "      (agent) => agent.race === 'goblin' && agent.life.generation > 0,",
    '    );',
    '',
    '    expect(goblins.length).toBeGreaterThanOrEqual(4);',
  ),
  lines(
    '    const bornGoblins = Object.values(state.agents).filter(',
    "      (agent) => agent.race === 'goblin' && agent.life.generation > 0,",
    '    );',
    "    console.log('F2_GOBLIN_LINEAGE_DIAG', JSON.stringify({",
    '      livingGoblinCount: goblins.length,',
    '      bornGoblinCount: bornGoblins.length,',
    '      raceOpportunity: state.v16!.raceFamilyOpportunityByRace.goblin,',
    '      localOpportunities: Object.values(state.v16!.localFamilyOpportunityByKey).filter((value) => value.race === \'goblin\'),',
    '      lifecycles: Object.values(state.v16!.familyLifecycleByPairId).filter((value) => {',
    '        const a = state.agents[value.agentAId];',
    "        return a?.race === 'goblin';",
    '      }),',
    '      adults: adults.map((adult) => {',
    '        const current = state.agents[adult.id];',
    '        return current ? { id: current.id, sex: current.sex, homeId: current.homeId, locationId: current.locationId,',
    '          alive: current.life.alive, age: current.life.ageYears, health: current.life.health, children: current.life.childIds.length,',
    '          movement: Boolean(current.movement) } : { id: adult.id, missing: true };',
    '      }),',
    '    }));',
    '',
    '    expect(goblins.length).toBeGreaterThanOrEqual(4);',
  ),
  'diagnose remaining goblin lineage regression',
));

console.log(JSON.stringify({ changed }, null, 2));
