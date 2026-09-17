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

console.log(JSON.stringify({ changed }, null, 2));
