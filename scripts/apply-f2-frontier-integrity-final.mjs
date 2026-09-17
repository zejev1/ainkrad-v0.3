import fs from 'node:fs';

const changed = [];
const lines = (...items) => items.join('\n');
function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    changed.push(path);
  }
}
function replaceOnce(text, before, after, label) {
  if (text.includes(after)) return text;
  const i = text.indexOf(before);
  if (i < 0) throw new Error(`Final F2 anchor not found: ${label}`);
  return text.slice(0, i) + after + text.slice(i + before.length);
}

// Audit correction: physical discovery is race-neutral. A Spark of any race
// that is actually standing at an eligible entrance may discover the dungeon.
// Guild/adventurer eligibility stays separate and may still exclude a race.
update('src/v19/AdventureEconomyV19.ts', (text) => replaceOnce(
  text,
  lines(
    '  const eligibleDiscovererPlaces = new Set(Object.values(world.agents)',
    "    .filter(agent => agent.life.alive && !agent.movement && ['human', 'elf', 'dwarf'].includes(agent.race ?? 'human'))",
    '    .map(agent => agent.locationId));',
    '  const candidates = Object.values(world.places)',
    '    .filter(place => eligibleDungeonEntrance(place) && eligibleDiscovererPlaces.has(place.id))',
  ),
  lines(
    '  const occupiedPlaces = new Set(Object.values(world.agents)',
    '    .filter(agent => agent.life.alive && !agent.movement).map(agent => agent.locationId));',
    '  const candidates = Object.values(world.places)',
    '    .filter(place => eligibleDungeonEntrance(place) && occupiedPlaces.has(place.id))',
  ),
  'race-neutral physical dungeon discovery',
));

// Keep the frontier test aligned with the world rule: a goblin physically at
// ruins may discover the place/dungeon, but that does not grant human/elf/dwarf
// adventurer-guild eligibility or a dungeon expedition action.
update('tests/v0_3_22_frontierIntegrity.test.ts', (text) => {
  text = text.replace(
    "  it('does not let an ineligible goblin create a dungeon merely by standing on remote ruins', async () => {",
    "  it('lets any physically present Spark discover a dungeon while keeping guild eligibility separate', async () => {",
  );
  return replaceOnce(
    text,
    "    syncAdventureEconomyV19(world);\n    expect(world.v19!.adventureEconomy.dungeonsById[`dungeon:${ruins.id}`]).toBeUndefined();",
    lines(
      '    syncAdventureEconomyV19(world);',
      '    const dungeon = world.v19!.adventureEconomy.dungeonsById[`dungeon:${ruins.id}`];',
      '    expect(dungeon).toBeDefined();',
      '    goblin.knownPlaceIds = [...new Set([...(goblin.knownPlaceIds ?? []), ruins.id])];',
      '    goblin.knownDungeonIds = [dungeon!.id];',
      '    expect(chooseDungeonExpeditionV19(world, goblin, [dungeon!.id], 0)).toBeUndefined();',
    ),
    'separate physical dungeon discovery from guild eligibility',
  );
});

// Remove the temporary lineage diagnostic now that the rendezvous defect is fixed.
update('tests/v0_3_16_societyFoundation.test.ts', (text) => {
  const marker = "    console.log('F2_GOBLIN_LINEAGE_DIAG', JSON.stringify({";
  const start = text.indexOf(marker);
  if (start < 0) return text;
  const endMarker = '    }));\n';
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error('Final F2 diagnostic end anchor not found');
  return text.slice(0, start) + text.slice(end + endMarker.length);
});

console.log(JSON.stringify({ changed }, null, 2));
