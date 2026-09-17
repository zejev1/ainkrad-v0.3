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
  if (index < 0) throw new Error(`Patch anchor not found: ${label}`);
  return text.slice(0, index) + after + text.slice(index + before.length);
}

function replaceRegex(text, regex, after, label) {
  if (text.includes(after)) return text;
  if (!regex.test(text)) throw new Error(`Patch regex not found: ${label}`);
  return text.replace(regex, after);
}

update('src/world/ResidentCartography.ts', (text) => replaceOnce(
  text,
  lines(
    '  for (const id of agent.knownPlaceIds ?? []) publish(id);',
    '  publish(agent.homeId); publish(agent.locationId);',
  ),
  lines(
    '  // Raw legacy knownPlaceIds are personal memory, not proof that a distant',
    '  // settlement archive surveyed the far side of the continent. Publish only',
    '  // physical presence here; personal surveys, traversed routes and carried map',
    '  // revisions are published by the evidence loops below.',
    '  publish(agent.homeId); publish(agent.locationId);',
    '  const current = world.places[agent.locationId];',
    '  for (const id of current?.connectedPlaceIds ?? []) {',
    '    const place = world.places[id];',
    '    if (place && Math.hypot(place.mapX - agent.position.x, place.mapY - agent.position.y) <= 45) publish(id);',
    '  }',
  ),
  'cartography must not publish arbitrary known ids',
));

update('src/v19/AdventureEconomyV19.ts', (text) => {
  text = replaceOnce(
    text,
    'export const MAX_AGENT_ABILITIES_V19 = 8;',
    lines(
      'export const MAX_AGENT_ABILITIES_V19 = 8;',
      '/** A dungeon trip begins locally. Longer journeys require ordinary staged travel first. */',
      'export const MAX_DUNGEON_EXPEDITION_DISTANCE_MAP_UNITS = 120;',
    ),
    'dungeon travel constant',
  );
  text = replaceOnce(
    text,
    lines(
      '  const occupiedPlaces = new Set(Object.values(world.agents)',
      '    .filter(agent => agent.life.alive && !agent.movement).map(agent => agent.locationId));',
      '  const candidates = Object.values(world.places)',
      '    .filter(place => eligibleDungeonEntrance(place) && occupiedPlaces.has(place.id))',
    ),
    lines(
      '  const eligibleOccupiedPlaces = new Set(Object.values(world.agents)',
      '    .filter(agent => agent.life.alive && !agent.movement && isAdventureCandidateV19(world, agent))',
      '    .map(agent => agent.locationId));',
      '  const candidates = Object.values(world.places)',
      '    .filter(place => eligibleDungeonEntrance(place) && eligibleOccupiedPlaces.has(place.id))',
    ),
    'dungeon physical discoverer eligibility',
  );
  text = replaceOnce(
    text,
    lines(
      '    .filter(',
      '      (dungeon): dungeon is V19DungeonState =>',
      '        dungeon !== undefined &&',
      '        dungeon.active &&',
      '        ((agent.knownDungeonIds ?? []).includes(dungeon.id) ||',
      '          (agent.knownPlaceIds ?? []).includes(dungeon.entrancePlaceId) ||',
      '          agent.locationId === dungeon.entrancePlaceId) &&',
      '        dungeon.treasureReserve >= 0.2 &&',
      '        rankIndex(dungeon.rank) <= maximumRankIndex,',
      '    )',
    ),
    lines(
      '    .filter((dungeon): dungeon is V19DungeonState => {',
      '      if (',
      '        dungeon === undefined ||',
      '        !dungeon.active ||',
      '        !((agent.knownDungeonIds ?? []).includes(dungeon.id) ||',
      '          (agent.knownPlaceIds ?? []).includes(dungeon.entrancePlaceId) ||',
      '          agent.locationId === dungeon.entrancePlaceId) ||',
      '        dungeon.treasureReserve < 0.2 ||',
      '        rankIndex(dungeon.rank) > maximumRankIndex',
      '      ) return false;',
      '      const entrance = world.places[dungeon.entrancePlaceId];',
      '      return Boolean(entrance) && Math.hypot(',
      '        entrance!.mapX - agent.position.x,',
      '        entrance!.mapY - agent.position.y,',
      '      ) <= MAX_DUNGEON_EXPEDITION_DISTANCE_MAP_UNITS;',
      '    })',
    ),
    'dungeon expedition distance gate',
  );
  return text;
});

update('src/v18/CulturalNamingV18.ts', (text) => {
  text = replaceOnce(
    text,
    lines('  AgentState,', '  WorldState,'),
    lines('  AgentState,', '  WorldBiome,', '  WorldState,'),
    'place naming WorldBiome import',
  );
  if (text.includes('export function chooseCulturalPlaceNameV18(')) return text;
  const marker = 'export function isLegacyTechnicalChildNameV18(';
  const index = text.indexOf(marker);
  if (index < 0) throw new Error('Patch anchor not found: cultural place naming insertion');
  const insert = lines(
    '',
    "const PLACE_NOUNS_V18: Readonly<Record<WorldBiome, readonly string[]>> = {",
    "  settlement: ['Перекрёсток', 'Стоянка', 'Предел', 'Урочище'],",
    "  plains: ['Долина', 'Простор', 'Луга', 'Степь', 'Низина', 'Поля'],",
    "  forest: ['Роща', 'Лес', 'Бор', 'Чаща', 'Опушка', 'Кроны'],",
    "  coast: ['Берег', 'Бухта', 'Мыс', 'Коса', 'Прибой'],",
    "  ocean: ['Воды', 'Залив', 'Пролив', 'Море'],",
    "  mountains: ['Гряда', 'Перевал', 'Кряж', 'Склоны', 'Ущелье'],",
    "  lake: ['Озеро', 'Плёс', 'Заводь', 'Чаша'],",
    "  river: ['Брод', 'Излучина', 'Плёс', 'Протока', 'Берег'],",
    "  swamp: ['Топь', 'Трясина', 'Мхи', 'Низина', 'Кочки'],",
    "  ancient_ruins: ['Руины', 'Камни', 'Арка', 'Двор', 'Остатки'],",
    '};',
    '',
    'const PLACE_RACE_MOTIFS_V18: Readonly<Record<AgentRace, readonly string[]>> = {',
    "  human: ['Золотого Ветра', 'Семи Трав', 'Ясного Неба', 'Дальних Костров', 'Утренней Росы', 'Трёх Сосен', 'Синей Тени', 'Старого Камня'],",
    "  elf: ['Лунных Крон', 'Серебряного Листа', 'Тихой Песни', 'Белых Ветвей', 'Звёздной Росы', 'Шепчущих Корней', 'Долгой Памяти', 'Зелёного Света'],",
    "  dwarf: ['Каменного Звона', 'Медной Жилы', 'Гулких Скал', 'Чёрного Кремня', 'Семи Молотов', 'Глубокой Трещины', 'Седого Камня', 'Железного Эха'],",
    "  goblin: ['Кривого Корня', 'Рыжего Мха', 'Трёх Нор', 'Скользких Камней', 'Зелёного Дыма', 'Колючей Тропы', 'Ломаной Ветки', 'Хитрого Брода'],",
    "  orc: ['Красного Ветра', 'Сломанного Клыка', 'Громкой Скалы', 'Чёрной Тропы', 'Железного Неба', 'Двух Копий', 'Серого Пепла', 'Гулкого Грома'],",
    "  ogre: ['Большой Тени', 'Гулкой Земли', 'Тяжёлого Камня', 'Долгого Эха', 'Сломанной Скалы', 'Трёх Холмов', 'Глубокого Следа', 'Медленного Грома'],",
    '};',
    '',
    'const PLACE_SHARED_MOTIFS_V18 = [',
    "  'Тихого Дождя', 'Утреннего Света', 'Семи Камней', 'Двух Ручьёв',",
    "  'Высокого Облака', 'Белого Тумана', 'Долгой Тени', 'Первой Звезды',",
    "  'Сухой Травы', 'Холодной Росы', 'Тёплого Ветра', 'Старой Тропы',",
    '] as const;',
    '',
    'const PLACE_LANDMARKS_V18 = [',
    "  'у Старого Камня', 'у Белой Скалы', 'за Тремя Холмами', 'у Двойного Брода',",
    "  'у Кривой Сосны', 'над Тихой Водой', 'у Медного Утёса', 'под Высоким Небом',",
    '] as const;',
    '',
    '/**',
    ' * The discovering Spark names the place from its culture, personality and the',
    ' * terrain it actually saw. The engine supplies grammar and vocabulary, but no',
    ' * tiny global list of canned full names. The chosen name is deterministic for',
    ' * replay and persists on the physical place.',
    ' */',
    'export function chooseCulturalPlaceNameV18(input: {',
    '  world: Readonly<WorldState>;',
    '  explorer: Readonly<AgentState>;',
    '  biome: WorldBiome;',
    '  sequence: number;',
    '  x: number;',
    '  y: number;',
    '}): string {',
    '  const { world, explorer, biome, sequence, x, y } = input;',
    "  const race = explorer.race ?? 'human';",
    '  const nouns = PLACE_NOUNS_V18[biome];',
    '  const raceMotifs = PLACE_RACE_MOTIFS_V18[race];',
    '  const seed = stableHash([',
    "    world.id, explorer.id, race, biome, Math.floor(sequence),",
    '    Math.round(x * 10), Math.round(y * 10),',
    '    Math.round(explorer.personality.curiosity * 100),',
    '    Math.round(explorer.mind.values.tradition * 100),',
    '    Math.round(explorer.mind.values.freedom * 100),',
    "].join(':'));",
    "  const existing = new Set(Object.values(world.places).map(place => place.name.toLocaleLowerCase('ru-RU')));",
    '  const startNoun = seed % nouns.length;',
    '  const startRace = Math.floor(seed / 7) % raceMotifs.length;',
    '  const startShared = Math.floor(seed / 31) % PLACE_SHARED_MOTIFS_V18.length;',
    '  const startLandmark = Math.floor(seed / 127) % PLACE_LANDMARKS_V18.length;',
    '  for (let attempt = 0; attempt < 96; attempt += 1) {',
    '    const noun = nouns[(startNoun + attempt * 3) % nouns.length];',
    '    const personal = raceMotifs[(startRace + attempt * 5) % raceMotifs.length];',
    '    const shared = PLACE_SHARED_MOTIFS_V18[(startShared + attempt * 7) % PLACE_SHARED_MOTIFS_V18.length];',
    '    const landmark = PLACE_LANDMARKS_V18[(startLandmark + attempt * 11) % PLACE_LANDMARKS_V18.length];',
    "    const candidate = attempt % 3 === 0 ? noun + ' ' + personal :",
    "      attempt % 3 === 1 ? noun + ' ' + shared : noun + ' ' + personal + ' ' + landmark;",
    "    if (!existing.has(candidate.toLocaleLowerCase('ru-RU'))) return candidate;",
    '  }',
    "  return nouns[startNoun] + ' ' + raceMotifs[startRace] + ' — след ' + explorer.name;",
    '}',
    '',
  );
  return text.slice(0, index) + insert + text.slice(index);
});

update('src/v18/SecretLibraryV18.ts', (text) => {
  text = replaceOnce(
    text,
    "import { compactLibraryPlot } from '../world/SettlementLibraryLayout';",
    lines(
      "import { compactLibraryPlot } from '../world/SettlementLibraryLayout';",
      "import { HUMAN_LIBRARY_IDS, LIBRARY_IDS, LIBRARY_LIMIT } from '../v21/LibraryAdmissions';",
    ),
    'library branch imports',
  );
  if (!text.includes('const HUMAN_BRANCH_LIBRARIES_V18 = [')) {
    const replacement = lines(
      'const HUMAN_BRANCH_LIBRARIES_V18 = [',
      "  { id: HUMAN_LIBRARY_IDS[1], settlementId: 'settlement_rulid', name: 'Тайная библиотека Рулида' },",
      "  { id: HUMAN_LIBRARY_IDS[2], settlementId: 'settlement_zakkaria', name: 'Тайная библиотека Заккарии' },",
      '] as const;',
      '',
      'function settlementAnchorV18(world: Readonly<WorldState>, settlementId: string): WorldPlace | undefined {',
      '  const settlement = world.settlements[settlementId];',
      '  return settlement ? world.places[settlement.centerPlaceId] : undefined;',
      '}',
      '',
      'function mountLibraryPlaceV18(',
      '  world: WorldState,',
      '  id: string,',
      '  name: string,',
      '  anchor: WorldPlace,',
      '  settlementId?: string,',
      '): boolean {',
      '  const existing = world.places[id];',
      '  if (',
      "    existing?.kind === 'library' &&",
      '    existing.connectedPlaceIds.includes(anchor.id) &&',
      '    (settlementId === undefined || existing.settlementId === settlementId)',
      '  ) return false;',
      '',
      '  const plot = compactLibraryPlot(world.places, { x: anchor.mapX, y: anchor.mapY }, id);',
      '  if (!plot) return false;',
      '  const planet = world.v18?.planetaryGeography;',
      '  const mapX = planet ? Math.max(planet.minMapX, Math.min(planet.maxMapX, plot.x)) : plot.x;',
      '  const mapY = planet ? Math.max(planet.minMapY, Math.min(planet.maxMapY, plot.y)) : plot.y;',
      '  for (const place of Object.values(world.places)) {',
      '    place.connectedPlaceIds = place.connectedPlaceIds.filter(connectedId => connectedId !== id);',
      '  }',
      '  if (!anchor.connectedPlaceIds.includes(id)) anchor.connectedPlaceIds.push(id);',
      '  world.places[id] = {',
      "    id, name, kind: 'library', capacity: LIBRARY_LIMIT, biome: 'ancient_ruins',",
      '    mapX, mapY, connectedPlaceIds: [anchor.id], fertility: 0, danger: 0,',
      "    surface: 'land', discoveredAt: existing?.discoveredAt ?? 0,",
      '    ...(settlementId ? { settlementId } : {}),',
      '  };',
      '  return true;',
      '}',
      '',
      '/**',
      ' * Mounts or repairs the human library network. Ainkrad retains the canonical',
      ' * archive state; Rulid and Zakkaria receive local physical branches with their',
      ' * own five-person admission quotas. Existing lived towns are not moved.',
      ' */',
      'export function repairSecretLibraryPlacementV18(world: WorldState): boolean {',
      '  const v18 = world.v18;',
      '  const library = v18?.secretLibrary;',
      '  if (!v18 || !library) return false;',
      '  const epoch = world.epoch ?? 1;',
      '  let changed = false;',
      '',
      '  const mainExisting = world.places[SECRET_LIBRARY_PLACE_ID_V18];',
      '  const mainValid = Boolean(',
      '    mainExisting &&',
      "    mainExisting.kind === 'library' &&",
      '    library.anchoredWorldEpoch === epoch &&',
      '    library.anchorPlaceId &&',
      '    Number.isFinite(library.anchorMapX) &&',
      '    Number.isFinite(library.anchorMapY),',
      '  );',
      '  if (!mainValid) {',
      '    const anchor = ainkradAnchor(world);',
      '    if (anchor && mountLibraryPlaceV18(world, SECRET_LIBRARY_PLACE_ID_V18, SECRET_LIBRARY_PLACE_NAME_V18, anchor)) {',
      '      const place = world.places[SECRET_LIBRARY_PLACE_ID_V18];',
      '      library.anchorPlaceId = anchor.id;',
      '      library.anchorMapX = place.mapX;',
      '      library.anchorMapY = place.mapY;',
      '      library.anchoredWorldEpoch = epoch;',
      '      changed = true;',
      '    }',
      '  }',
      '',
      '  for (const branch of HUMAN_BRANCH_LIBRARIES_V18) {',
      '    const anchor = settlementAnchorV18(world, branch.settlementId);',
      '    if (!anchor) continue;',
      '    if (mountLibraryPlaceV18(world, branch.id, branch.name, anchor, branch.settlementId)) changed = true;',
      '  }',
      '',
      '  if (changed) world.routes = rebuildWorldRoutes(world.places, world.routes);',
      '  return changed;',
      '}',
      '',
      'export function rankedSecretLibraryCandidatesV18',
    );
    text = replaceRegex(
      text,
      /export function repairSecretLibraryPlacementV18\(world: WorldState\): boolean \{[\s\S]*?\n\}\n\nexport function rankedSecretLibraryCandidatesV18/,
      replacement,
      'human library branch placement',
    );
  }
  text = replaceOnce(
    text,
    lines(
      '  if (',
      '    library.visitors.length > SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18 * 2 ||',
      "    ['secret_library_v18', 'elf_library_v20'].some(id => library.visitors.filter(v => (v.libraryPlaceId ?? SECRET_LIBRARY_PLACE_ID_V18) === id).length > 5) ||",
    ),
    lines(
      '  for (const branch of HUMAN_BRANCH_LIBRARIES_V18) {',
      '    if (!world.settlements[branch.settlementId]) continue;',
      '    const branchPlace = world.places[branch.id];',
      "    if (!branchPlace || branchPlace.kind !== 'library' || branchPlace.settlementId !== branch.settlementId) {",
      "      throw new Error('Secret Library branch ' + branch.id + ' is missing or misplaced.');",
      '    }',
      '  }',
      '  if (',
      '    library.visitors.length > SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18 * LIBRARY_IDS.length ||',
      '    LIBRARY_IDS.some(id => library.visitors.filter(v => (v.libraryPlaceId ?? SECRET_LIBRARY_PLACE_ID_V18) === id).length > LIBRARY_LIMIT) ||',
    ),
    'library branch validation and quota',
  );
  return text;
});

update('src/world/WorldEngine.ts', (text) => {
  text = replaceOnce(
    text,
    "import { LIBRARY_IDS, LIBRARY_YEAR, admissionDeadline, isSecretLibrary, libraryIdOf, hasLibraryAdmission, reconcileLibraryAdmissions, enforceLibraryBoundary, noteLibraryArrival } from '../v21/LibraryAdmissions';",
    "import { LIBRARY_IDS, LIBRARY_YEAR, admissionDeadline, isSecretLibrary, libraryIdOf, libraryIdForAgent, hasLibraryAdmission, reconcileLibraryAdmissions, enforceLibraryBoundary, noteLibraryArrival } from '../v21/LibraryAdmissions';",
    'WorldEngine library helper import',
  );
  text = replaceOnce(
    text,
    lines('  chooseCulturalChildNameV18,', '  toRussianWorldNameV18,'),
    lines('  chooseCulturalChildNameV18,', '  chooseCulturalPlaceNameV18,', '  toRussianWorldNameV18,'),
    'WorldEngine place naming import',
  );
  text = replaceOnce(
    text,
    lines('  createGenesisTeachers,', '  GENESIS_ACTIVE_WORLD_MINUTES,'),
    lines('  createGenesisTeachers,', '  genesisBootstrapAvailableToV15,', '  GENESIS_ACTIVE_WORLD_MINUTES,'),
    'WorldEngine Genesis eligibility import',
  );
  text = replaceOnce(
    text,
    lines('  const shore = world.places.rulid_shore;', '  const center = world.places.rulid_center;'),
    lines("  const shore = world.places.rulid_shore;", "  const center = world.places[world.settlements.settlement_rulid?.centerPlaceId ?? 'rulid_commons'];"),
    'Rulid civic center coast repair',
  );
  text = replaceOnce(
    text,
    lines(
      '    const genesis = v15.genesisTeachers.find(',
      '      (teacher) =>',
      '        teacher.domain === mapped.domain &&',
      '        isGenesisTeacherActive(teacher, worldMinutes),',
      '    );',
    ),
    lines(
      '    const genesisSettlementId = this.homeSettlementId(agent);',
      '    const genesis = genesisBootstrapAvailableToV15(agent.race, genesisSettlementId)',
      '      ? v15.genesisTeachers.find(',
      '          (teacher) =>',
      '            teacher.domain === mapped.domain &&',
      '            isGenesisTeacherActive(teacher, worldMinutes),',
      '        )',
      '      : undefined;',
    ),
    'Genesis mentors for all three human foundations only',
  );
  text = replaceOnce(
    text,
    "      const libraryPlaceId = agent.race === 'elf' ? LIBRARY_IDS[1] : LIBRARY_IDS[0];",
    '      const libraryPlaceId = libraryIdForAgent(this.state, agent);',
    'local human library selection',
  );
  text = replaceOnce(
    text,
    lines(
      '    const prefix = REGION_NAME_PREFIXES[',
      '      (stage + Math.floor(this.rng.next() * REGION_NAME_PREFIXES.length)) %',
      '        REGION_NAME_PREFIXES.length',
      '    ];',
      '    const regionId = `region_${stage}`;',
      '    const suffixes = REGION_NAME_SUFFIXES[biome];',
      '    const suffix = suffixes[stage % suffixes.length];',
      '    const mapX = site.x;',
      '    const mapY = site.y;',
    ),
    lines(
      '    const regionId = `region_${stage}`;',
      '    const mapX = site.x;',
      '    const mapY = site.y;',
      '    const regionName = chooseCulturalPlaceNameV18({',
      '      world: this.state, explorer, biome, sequence: stage, x: mapX, y: mapY,',
      '    });',
    ),
    'Spark-created regional name',
  );
  text = replaceOnce(
    text,
    '      `${prefix} ${suffix}`,',
    '      regionName,',
    'use Spark-created regional name',
  );
  return text;
});

update('tests/v0_3_21_localExplorationReading.test.ts', (text) => replaceOnce(
  text,
  '        expect(Math.hypot(site.x-agent.position.x,site.y-agent.position.y)).toBeLessThanOrEqual(8.0001);',
  lines(
    '        const step=Math.hypot(site.x-agent.position.x,site.y-agent.position.y);',
    '        expect(step).toBeGreaterThanOrEqual(5.9999);',
    '        expect(step).toBeLessThanOrEqual(36.0001);',
  ),
  'local exploration distance regression',
));

console.log(JSON.stringify({ changed }, null, 2));
