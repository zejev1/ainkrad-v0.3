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
  const index = text.indexOf(before);
  if (index < 0) throw new Error(`Follow-up anchor not found: ${label}`);
  return text.slice(0, index) + after + text.slice(index + before.length);
}

function replaceRegex(text, regex, after, label) {
  if (text.includes(after)) return text;
  if (!regex.test(text)) throw new Error(`Follow-up regex not found: ${label}`);
  return text.replace(regex, after);
}

// Multiple human libraries are a new-world foundation feature. Preserve the
// canonical Ainkrad library repair for lived/legacy worlds and never move old
// residents or rewrite old routes merely because branch libraries were added.
update('src/v18/SecretLibraryV18.ts', (text) => {
  const canonicalRepair = lines(
    'export function repairSecretLibraryPlacementV18(world: WorldState): boolean {',
    '  const v18 = world.v18;',
    '  const library = v18?.secretLibrary;',
    '  if (!v18 || !library) return false;',
    '  const epoch = world.epoch ?? 1;',
    '  const existing = world.places[SECRET_LIBRARY_PLACE_ID_V18];',
    '  if (',
    '    existing &&',
    "    existing.kind === 'library' &&",
    '    library.anchoredWorldEpoch === epoch &&',
    '    library.anchorPlaceId &&',
    '    Number.isFinite(library.anchorMapX) &&',
    '    Number.isFinite(library.anchorMapY)',
    '  ) {',
    '    return false;',
    '  }',
    '  const anchor = ainkradAnchor(world);',
    '  if (!anchor) return false;',
    '  const planet = v18.planetaryGeography;',
    '  const plot = compactLibraryPlot(world.places, { x: anchor.mapX, y: anchor.mapY }, SECRET_LIBRARY_PLACE_ID_V18);',
    '  if (!plot) return false;',
    '  const mapX = Math.max(planet.minMapX, Math.min(planet.maxMapX, plot.x));',
    '  const mapY = Math.max(planet.minMapY, Math.min(planet.maxMapY, plot.y));',
    '',
    '  for (const place of Object.values(world.places)) {',
    '    place.connectedPlaceIds = place.connectedPlaceIds.filter(',
    '      (connectedId) => connectedId !== SECRET_LIBRARY_PLACE_ID_V18,',
    '    );',
    '  }',
    '  if (!anchor.connectedPlaceIds.includes(SECRET_LIBRARY_PLACE_ID_V18)) {',
    '    anchor.connectedPlaceIds.push(SECRET_LIBRARY_PLACE_ID_V18);',
    '  }',
    '  world.places[SECRET_LIBRARY_PLACE_ID_V18] = {',
    '    id: SECRET_LIBRARY_PLACE_ID_V18,',
    '    name: SECRET_LIBRARY_PLACE_NAME_V18,',
    "    kind: 'library',",
    '    capacity: 5,',
    "    biome: 'ancient_ruins',",
    '    mapX,',
    '    mapY,',
    '    connectedPlaceIds: [anchor.id],',
    '    fertility: 0,',
    '    danger: 0,',
    "    surface: 'land',",
    '    discoveredAt: 0,',
    '  };',
    '  library.anchorPlaceId = anchor.id;',
    '  library.anchorMapX = mapX;',
    '  library.anchorMapY = mapY;',
    '  library.anchoredWorldEpoch = epoch;',
    '  world.routes = rebuildWorldRoutes(world.places, world.routes);',
    '  return true;',
    '}',
    '',
    'export function rankedSecretLibraryCandidatesV18',
  );
  text = replaceRegex(
    text,
    /export function repairSecretLibraryPlacementV18\(world: WorldState\): boolean \{[\s\S]*?\n\}\n\nexport function rankedSecretLibraryCandidatesV18/,
    canonicalRepair,
    'restore canonical library migration repair',
  );

  text = replaceRegex(
    text,
    /  for \(const branch of HUMAN_BRANCH_LIBRARIES_V18\) \{[\s\S]*?\n  \}\n  if \(\n    library\.visitors\.length > SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18 \* LIBRARY_IDS\.length \|\|\n    LIBRARY_IDS\.some\(id => library\.visitors\.filter\(v => \(v\.libraryPlaceId \?\? SECRET_LIBRARY_PLACE_ID_V18\) === id\)\.length > LIBRARY_LIMIT\) \|\|/,
    lines(
      '  for (const branch of HUMAN_BRANCH_LIBRARIES_V18) {',
      '    const branchPlace = world.places[branch.id];',
      '    if (!branchPlace) continue;',
      "    if (branchPlace.kind !== 'library' || branchPlace.settlementId !== branch.settlementId) {",
      "      throw new Error('Secret Library branch ' + branch.id + ' is misplaced.');",
      '    }',
      '  }',
      '  const activeLibraryIds = LIBRARY_IDS.filter(id => Boolean(world.places[id]));',
      '  if (',
      '    library.visitors.length > SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18 * activeLibraryIds.length ||',
      '    activeLibraryIds.some(id => library.visitors.filter(v => (v.libraryPlaceId ?? SECRET_LIBRARY_PLACE_ID_V18) === id).length > LIBRARY_LIMIT) ||',
    ),
    'make branch library validation legacy-safe',
  );
  return text;
});

update('src/v21/LibraryAdmissions.ts', (text) => {
  text = replaceOnce(
    text,
    lines(
      "  if ((agent.race ?? 'human') === 'elf') return ELF_LIBRARY_ID;",
      '  const homeSettlementId = world.places[agent.homeId]?.settlementId;',
      '  return humanLibraryIdForSettlement(homeSettlementId);',
    ),
    lines(
      "  if ((agent.race ?? 'human') === 'elf') return ELF_LIBRARY_ID;",
      '  const homeSettlementId = world.places[agent.homeId]?.settlementId;',
      '  const preferred = humanLibraryIdForSettlement(homeSettlementId);',
      '  return world.places[preferred] ? preferred : HUMAN_LIBRARY_IDS[0];',
    ),
    'legacy-safe human library selection',
  );
  text = replaceOnce(
    text,
    lines(
      '  for (const id of LIBRARY_IDS) {',
      '    const prior = library.annualSelections[id];',
    ),
    lines(
      '  for (const id of LIBRARY_IDS) {',
      '    if (!world.places[id]) continue;',
      '    const prior = library.annualSelections[id];',
    ),
    'skip absent libraries in old saves',
  );
  return text;
});

// Branch libraries are created only during a fresh three-foundation world,
// before terrain is sealed. Reloading an already-lived world cannot create or
// move them, so continuity remains exact.
update('src/world/CompactSettlementLayout.ts', (text) => {
  text = replaceOnce(
    text,
    "import { rebuildWorldRoutes } from './WorldNavigation';",
    lines(
      "import { rebuildWorldRoutes } from './WorldNavigation';",
      "import { compactLibraryPlot } from './SettlementLibraryLayout';",
      "import { HUMAN_LIBRARY_IDS, LIBRARY_LIMIT } from '../v21/LibraryAdmissions';",
    ),
    'founding library imports',
  );
  if (!text.includes('function ensureFreshFoundingHumanLibraries(')) {
    const marker = 'function invalidateRulidLayoutForCoast(world:WorldState):void {';
    const index = text.indexOf(marker);
    if (index < 0) throw new Error('Follow-up anchor not found: fresh human libraries insertion');
    const insert = lines(
      'function ensureFreshFoundingHumanLibraries(world: WorldState): boolean {',
      '  if (world.terrain) return false;',
      '  const specs = [',
      "    { id: HUMAN_LIBRARY_IDS[1], settlementId: 'settlement_rulid', name: 'Тайная библиотека Рулида' },",
      "    { id: HUMAN_LIBRARY_IDS[2], settlementId: 'settlement_zakkaria', name: 'Тайная библиотека Заккарии' },",
      '  ] as const;',
      '  let changed = false;',
      '  for (const spec of specs) {',
      '    if (world.places[spec.id]) continue;',
      '    const town = world.settlements[spec.settlementId];',
      '    const anchor = town ? world.places[town.centerPlaceId] : undefined;',
      '    if (!town || !anchor) continue;',
      '    const plot = compactLibraryPlot(world.places, { x: anchor.mapX, y: anchor.mapY }, spec.id);',
      '    if (!plot) continue;',
      '    world.places[spec.id] = {',
      '      id: spec.id, name: spec.name, kind: \'library\', capacity: LIBRARY_LIMIT,',
      "      biome: 'ancient_ruins', mapX: plot.x, mapY: plot.y, connectedPlaceIds: [anchor.id],",
      "      fertility: 0, danger: 0, surface: 'land', settlementId: spec.settlementId, discoveredAt: 0,",
      '    };',
      '    if (!anchor.connectedPlaceIds.includes(spec.id)) anchor.connectedPlaceIds.push(spec.id);',
      '    if (!town.memberPlaceIds.includes(spec.id)) town.memberPlaceIds.push(spec.id);',
      '    changed = true;',
      '  }',
      '  return changed;',
      '}',
      '',
    );
    text = text.slice(0, index) + insert + text.slice(index);
  }
  text = replaceOnce(
    text,
    lines(
      '  const civicCenterChanged=normalizeFreshFoundingCivicCenters(world);',
      '  const foundingSpreadChanged=spreadFoundingHumanSettlements(world,moved);',
      '  const naturalChanged=updateNaturalGeography(world);',
    ),
    lines(
      '  const civicCenterChanged=normalizeFreshFoundingCivicCenters(world);',
      '  const foundingSpreadChanged=spreadFoundingHumanSettlements(world,moved);',
      '  const freshLibraryChanged=ensureFreshFoundingHumanLibraries(world);',
      '  const naturalChanged=updateNaturalGeography(world);',
    ),
    'create branch libraries only during fresh foundation',
  );
  text = replaceOnce(
    text,
    '  if(!terrainChanged&&!naturalChanged&&!civicCenterChanged&&!foundingSpreadChanged&&!moved.size&&!geographyChanged)return false;',
    '  if(!terrainChanged&&!naturalChanged&&!civicCenterChanged&&!foundingSpreadChanged&&!freshLibraryChanged&&!moved.size&&!geographyChanged)return false;',
    'count founding library geometry change',
  );
  return text;
});

// A physical entrance can be discovered by any present resident. Whether that
// resident later becomes an adventurer is a separate voluntary choice. The
// cross-continent bug is blocked by staged frontier travel and expedition range,
// not by suppressing real entrances.
update('src/v19/AdventureEconomyV19.ts', (text) => replaceOnce(
  text,
  lines(
    '  const eligibleOccupiedPlaces = new Set(Object.values(world.agents)',
    '    .filter(agent => agent.life.alive && !agent.movement && isAdventureCandidateV19(world, agent))',
    '    .map(agent => agent.locationId));',
    '  const candidates = Object.values(world.places)',
    '    .filter(place => eligibleDungeonEntrance(place) && eligibleOccupiedPlaces.has(place.id))',
  ),
  lines(
    '  const occupiedPlaces = new Set(Object.values(world.agents)',
    '    .filter(agent => agent.life.alive && !agent.movement).map(agent => agent.locationId));',
    '  const candidates = Object.values(world.places)',
    '    .filter(place => eligibleDungeonEntrance(place) && occupiedPlaces.has(place.id))',
  ),
  'physical dungeon entrance discovery',
));

// Naming must not mask a deliberately corrupted save with a TypeError before
// the world validator can report the actual missing structure.
update('src/v18/CulturalNamingV18.ts', (text) => {
  text = replaceOnce(text,
    '    Math.round(explorer.personality.curiosity * 100),',
    '    Math.round((explorer.personality?.curiosity ?? 0.5) * 100),',
    'safe curiosity read during validation');
  text = replaceOnce(text,
    '    Math.round(explorer.mind.values.tradition * 100),',
    '    Math.round((explorer.mind?.values?.tradition ?? 0.5) * 100),',
    'safe tradition read during validation');
  text = replaceOnce(text,
    '    Math.round(explorer.mind.values.freedom * 100),',
    '    Math.round((explorer.mind?.values?.freedom ?? 0.5) * 100),',
    'safe freedom read during validation');
  return text;
});

// The old dungeon fixture used absolute pre-F2 coordinates. Keep the semantic
// test, but place the artificial ruins beside the actual seeded outskirts.
update('tests/v0_3_19_adventureEconomy.test.ts', (text) => {
  text = replaceOnce(
    text,
    lines(
      '  const state = engine.snapshot();',
      '  state.places.adventure_ruins = {',
    ),
    lines(
      '  const state = engine.snapshot();',
      '  const outskirts = state.places.outskirts;',
      '  const ruinsX = outskirts.mapX + 8;',
      '  const ruinsY = outskirts.mapY + 6;',
      '  state.places.adventure_ruins = {',
    ),
    'local dungeon fixture origin',
  );
  text = replaceOnce(text, '    mapX: 74,\n    mapY: 64,', '    mapX: ruinsX,\n    mapY: ruinsY,', 'local dungeon fixture coordinates');
  text = replaceOnce(text,
    "  scout.position = { x: 74, y: 64, layerId: 'surface' };",
    "  scout.position = { x: ruinsX, y: ruinsY, layerId: 'surface' };",
    'local dungeon scout coordinates');
  return text;
});

// A carried settlement map freezes real survey evidence, not a raw legacy
// knownPlaceIds flag. Make that test use an actual physical survey.
update('tests/v0_3_22_settlementCartography.test.ts', (text) => replaceOnce(
  text,
  lines(
    "    first.knownPlaceIds = [...(first.knownPlaceIds ?? []), 'remote_a'];",
    '    consultSettlementMap(world, first); consultSettlementMap(world, second);',
  ),
  lines(
    "    at(world, first, 'remote_a'); recordResidentSurvey(world, first, 'remote_a');",
    '    at(world, first, first.homeId);',
    '    consultSettlementMap(world, first); consultSettlementMap(world, second);',
  ),
  'cartography carried-copy evidence fixture',
));

// Three independent human foundations can each admit five readers. Preserve
// the five-person limit per library rather than the obsolete global limit.
update('tests/v0_3_18_secretLibrary.test.ts', (text) => {
  text = replaceOnce(
    text,
    "import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';",
    lines(
      "import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';",
      "import { HUMAN_LIBRARY_IDS, libraryIdOf } from '../src/v21/LibraryAdmissions';",
    ),
    'library branch test imports',
  );
  text = replaceOnce(
    text,
    lines(
      '    expect(selected.length).toBeLessThanOrEqual(',
      '      SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18,',
      '    );',
    ),
    lines(
      '    expect(selected.length).toBeLessThanOrEqual(',
      '      SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18 * HUMAN_LIBRARY_IDS.length,',
      '    );',
      '    for (const id of HUMAN_LIBRARY_IDS) {',
      '      expect(selected.filter(visitor => libraryIdOf(visitor) === id).length)',
      '        .toBeLessThanOrEqual(SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18);',
      '    }',
    ),
    'per-human-library visitor limit',
  );
  text = replaceOnce(
    text,
    lines(
      '      selected.every((visitor) =>',
      '        world.snapshot().agents[visitor.agentId].movement?.targetPlaceId ===',
      '          SECRET_LIBRARY_PLACE_ID_V18,',
      '      ),',
    ),
    lines(
      '      selected.every((visitor) =>',
      '        world.snapshot().agents[visitor.agentId].movement?.targetPlaceId ===',
      '          libraryIdOf(visitor),',
      '      ),',
    ),
    'visitor moves to its own settlement library',
  );
  return text;
});

console.log(JSON.stringify({ changed }, null, 2));
