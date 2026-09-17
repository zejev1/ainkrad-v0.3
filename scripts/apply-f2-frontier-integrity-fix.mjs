import fs from 'node:fs';

const changed = [];

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
  `  for (const id of agent.knownPlaceIds ?? []) publish(id);\n  publish(agent.homeId); publish(agent.locationId);`,
  `  // Raw legacy knownPlaceIds are personal memory, not proof that a distant\n  // settlement archive surveyed the far side of the continent. Publish only\n  // physical presence here; personal surveys, traversed routes and carried map\n  // revisions are published by the evidence loops below.\n  publish(agent.homeId); publish(agent.locationId);\n  const current = world.places[agent.locationId];\n  for (const id of current?.connectedPlaceIds ?? []) {\n    const place = world.places[id];\n    if (place && Math.hypot(place.mapX - agent.position.x, place.mapY - agent.position.y) <= 45) publish(id);\n  }`,
  'cartography must not publish arbitrary known ids',
));

update('src/v19/AdventureEconomyV19.ts', (text) => {
  text = replaceOnce(
    text,
    `export const MAX_AGENT_ABILITIES_V19 = 8;`,
    `export const MAX_AGENT_ABILITIES_V19 = 8;\n/** A dungeon trip begins locally. Longer journeys require ordinary staged travel first. */\nexport const MAX_DUNGEON_EXPEDITION_DISTANCE_MAP_UNITS = 120;`,
    'dungeon travel constant',
  );
  text = replaceOnce(
    text,
    `  const occupiedPlaces = new Set(Object.values(world.agents)\n    .filter(agent => agent.life.alive && !agent.movement).map(agent => agent.locationId));\n  const candidates = Object.values(world.places)\n    .filter(place => eligibleDungeonEntrance(place) && occupiedPlaces.has(place.id))`,
    `  const eligibleOccupiedPlaces = new Set(Object.values(world.agents)\n    .filter(agent => agent.life.alive && !agent.movement && isAdventureCandidateV19(world, agent))\n    .map(agent => agent.locationId));\n  const candidates = Object.values(world.places)\n    .filter(place => eligibleDungeonEntrance(place) && eligibleOccupiedPlaces.has(place.id))`,
    'dungeon physical discoverer eligibility',
  );
  text = replaceOnce(
    text,
    `    .filter(\n      (dungeon): dungeon is V19DungeonState =>\n        dungeon !== undefined &&\n        dungeon.active &&\n        ((agent.knownDungeonIds ?? []).includes(dungeon.id) ||\n          (agent.knownPlaceIds ?? []).includes(dungeon.entrancePlaceId) ||\n          agent.locationId === dungeon.entrancePlaceId) &&\n        dungeon.treasureReserve >= 0.2 &&\n        rankIndex(dungeon.rank) <= maximumRankIndex,\n    )`,
    `    .filter((dungeon): dungeon is V19DungeonState => {\n      if (\n        dungeon === undefined ||\n        !dungeon.active ||\n        !((agent.knownDungeonIds ?? []).includes(dungeon.id) ||\n          (agent.knownPlaceIds ?? []).includes(dungeon.entrancePlaceId) ||\n          agent.locationId === dungeon.entrancePlaceId) ||\n        dungeon.treasureReserve < 0.2 ||\n        rankIndex(dungeon.rank) > maximumRankIndex\n      ) return false;\n      const entrance = world.places[dungeon.entrancePlaceId];\n      return Boolean(entrance) && Math.hypot(\n        entrance!.mapX - agent.position.x,\n        entrance!.mapY - agent.position.y,\n      ) <= MAX_DUNGEON_EXPEDITION_DISTANCE_MAP_UNITS;\n    })`,
    'dungeon expedition distance gate',
  );
  return text;
});

update('src/v18/CulturalNamingV18.ts', (text) => {
  text = replaceOnce(
    text,
    `  AgentState,\n  WorldState,`,
    `  AgentState,\n  WorldBiome,\n  WorldState,`,
    'place naming WorldBiome import',
  );
  const marker = `export function isLegacyTechnicalChildNameV18(`;
  if (!text.includes('export function chooseCulturalPlaceNameV18(')) {
    const insert = `\nconst PLACE_NOUNS_V18: Readonly<Record<WorldBiome, readonly string[]>> = {\n  settlement: ['Перекрёсток', 'Стоянка', 'Предел', 'Урочище'],\n  plains: ['Долина', 'Простор', 'Луга', 'Степь', 'Низина', 'Поля'],\n  forest: ['Роща', 'Лес', 'Бор', 'Чаща', 'Опушка', 'Кроны'],\n  coast: ['Берег', 'Бухта', 'Мыс', 'Коса', 'Прибой'],\n  ocean: ['Воды', 'Залив', 'Пролив', 'Море'],\n  mountains: ['Гряда', 'Перевал', 'Кряж', 'Склоны', 'Ущелье'],\n  lake: ['Озеро', 'Плёс', 'Заводь', 'Чаша'],\n  river: ['Брод', 'Излучина', 'Плёс', 'Протока', 'Берег'],\n  swamp: ['Топь', 'Трясина', 'Мхи', 'Низина', 'Кочки'],\n  ancient_ruins: ['Руины', 'Камни', 'Арка', 'Двор', 'Остатки'],\n};\n\nconst PLACE_RACE_MOTIFS_V18: Readonly<Record<AgentRace, readonly string[]>> = {\n  human: ['Золотого Ветра', 'Семи Трав', 'Ясного Неба', 'Дальних Костров', 'Утренней Росы', 'Трёх Сосен', 'Синей Тени', 'Старого Камня'],\n  elf: ['Лунных Крон', 'Серебряного Листа', 'Тихой Песни', 'Белых Ветвей', 'Звёздной Росы', 'Шепчущих Корней', 'Долгой Памяти', 'Зелёного Света'],\n  dwarf: ['Каменного Звона', 'Медной Жилы', 'Гулких Скал', 'Чёрного Кремня', 'Семи Молотов', 'Глубокой Трещины', 'Седого Камня', 'Железного Эха'],\n  goblin: ['Кривого Корня', 'Рыжего Мха', 'Трёх Нор', 'Скользких Камней', 'Зелёного Дыма', 'Колючей Тропы', 'Ломаной Ветки', 'Хитрого Брода'],\n  orc: ['Красного Ветра', 'Сломанного Клыка', 'Громкой Скалы', 'Чёрной Тропы', 'Железного Неба', 'Двух Копий', 'Серого Пепла', 'Гулкого Грома'],\n  ogre: ['Большой Тени', 'Гулкой Земли', 'Тяжёлого Камня', 'Долгого Эха', 'Сломанной Скалы', 'Трёх Холмов', 'Глубокого Следа', 'Медленного Грома'],\n};\n\nconst PLACE_SHARED_MOTIFS_V18 = [\n  'Тихого Дождя', 'Утреннего Света', 'Семи Камней', 'Двух Ручьёв',\n  'Высокого Облака', 'Белого Тумана', 'Долгой Тени', 'Первой Звезды',\n  'Сухой Травы', 'Холодной Росы', 'Тёплого Ветра', 'Старой Тропы',\n] as const;\n\nconst PLACE_LANDMARKS_V18 = [\n  'у Старого Камня', 'у Белой Скалы', 'за Тремя Холмами', 'у Двойного Брода',\n  'у Кривой Сосны', 'над Тихой Водой', 'у Медного Утёса', 'под Высоким Небом',\n] as const;\n\n/**\n * The discovering Spark names the place from its culture, personality and the\n * terrain it actually saw. The engine supplies grammar and vocabulary, but no\n * tiny global list of «Скрытые/Дикие» labels. The chosen name is deterministic\n * for replay and persisted on the physical place.\n */\nexport function chooseCulturalPlaceNameV18(input: {\n  world: Readonly<WorldState>;\n  explorer: Readonly<AgentState>;\n  biome: WorldBiome;\n  sequence: number;\n  x: number;\n  y: number;\n}): string {\n  const { world, explorer, biome, sequence, x, y } = input;\n  const race = explorer.race ?? 'human';\n  const nouns = PLACE_NOUNS_V18[biome];\n  const raceMotifs = PLACE_RACE_MOTIFS_V18[race];\n  const seed = stableHash([\n    world.id, explorer.id, race, biome, Math.floor(sequence),\n    Math.round(x * 10), Math.round(y * 10),\n    Math.round(explorer.personality.curiosity * 100),\n    Math.round(explorer.mind.values.tradition * 100),\n    Math.round(explorer.mind.values.freedom * 100),\n  ].join(':'));\n  const existing = new Set(Object.values(world.places).map(place => place.name.toLocaleLowerCase('ru-RU')));\n  const startNoun = seed % nouns.length;\n  const startRace = Math.floor(seed / 7) % raceMotifs.length;\n  const startShared = Math.floor(seed / 31) % PLACE_SHARED_MOTIFS_V18.length;\n  const startLandmark = Math.floor(seed / 127) % PLACE_LANDMARKS_V18.length;\n  const variants: string[] = [];\n  for (let attempt = 0; attempt < 96; attempt += 1) {\n    const noun = nouns[(startNoun + attempt * 3) % nouns.length];\n    const personal = raceMotifs[(startRace + attempt * 5) % raceMotifs.length];\n    const shared = PLACE_SHARED_MOTIFS_V18[(startShared + attempt * 7) % PLACE_SHARED_MOTIFS_V18.length];\n    const landmark = PLACE_LANDMARKS_V18[(startLandmark + attempt * 11) % PLACE_LANDMARKS_V18.length];\n    variants.push(\n      attempt % 3 === 0 ? \\`${noun} ${personal}\\` :\n      attempt % 3 === 1 ? \\`${noun} ${shared}\\` :\n      \\`${noun} ${personal} ${landmark}\\`,\n    );\n  }\n  for (const candidate of variants) {\n    if (!existing.has(candidate.toLocaleLowerCase('ru-RU'))) return candidate;\n  }\n  // No numeric engine suffix: in the vanishingly rare exhausted combination,\n  // the discoverer's own identity becomes part of the lived cultural name.\n  return \\`${nouns[startNoun]} ${raceMotifs[startRace]} — след ${explorer.name}\\`;\n}\n\n`;
    const index = text.indexOf(marker);
    if (index < 0) throw new Error('Patch anchor not found: cultural place naming insertion');
    text = text.slice(0, index) + insert + text.slice(index);
  }
  return text;
});

update('src/v18/SecretLibraryV18.ts', (text) => {
  text = replaceOnce(
    text,
    `import { compactLibraryPlot } from '../world/SettlementLibraryLayout';`,
    `import { compactLibraryPlot } from '../world/SettlementLibraryLayout';\nimport { HUMAN_LIBRARY_IDS, LIBRARY_IDS, LIBRARY_LIMIT } from '../v21/LibraryAdmissions';`,
    'library branch imports',
  );

  const replacement = `const HUMAN_BRANCH_LIBRARIES_V18 = [\n  { id: HUMAN_LIBRARY_IDS[1], settlementId: 'settlement_rulid', name: 'Тайная библиотека Рулида' },\n  { id: HUMAN_LIBRARY_IDS[2], settlementId: 'settlement_zakkaria', name: 'Тайная библиотека Заккарии' },\n] as const;\n\nfunction settlementAnchorV18(world: Readonly<WorldState>, settlementId: string): WorldPlace | undefined {\n  const settlement = world.settlements[settlementId];\n  return settlement ? world.places[settlement.centerPlaceId] : undefined;\n}\n\nfunction mountLibraryPlaceV18(\n  world: WorldState,\n  id: string,\n  name: string,\n  anchor: WorldPlace,\n  settlementId?: string,\n): boolean {\n  const existing = world.places[id];\n  if (\n    existing?.kind === 'library' &&\n    existing.connectedPlaceIds.includes(anchor.id) &&\n    (settlementId === undefined || existing.settlementId === settlementId)\n  ) return false;\n\n  const plot = compactLibraryPlot(world.places, { x: anchor.mapX, y: anchor.mapY }, id);\n  if (!plot) return false;\n  const planet = world.v18?.planetaryGeography;\n  const mapX = planet ? Math.max(planet.minMapX, Math.min(planet.maxMapX, plot.x)) : plot.x;\n  const mapY = planet ? Math.max(planet.minMapY, Math.min(planet.maxMapY, plot.y)) : plot.y;\n  for (const place of Object.values(world.places)) {\n    place.connectedPlaceIds = place.connectedPlaceIds.filter(connectedId => connectedId !== id);\n  }\n  if (!anchor.connectedPlaceIds.includes(id)) anchor.connectedPlaceIds.push(id);\n  world.places[id] = {\n    id, name, kind: 'library', capacity: LIBRARY_LIMIT, biome: 'ancient_ruins',\n    mapX, mapY, connectedPlaceIds: [anchor.id], fertility: 0, danger: 0,\n    surface: 'land', discoveredAt: existing?.discoveredAt ?? 0,\n    ...(settlementId ? { settlementId } : {}),\n  };\n  return true;\n}\n\n/**\n * Mounts or repairs the human library network. Ainkrad retains the canonical\n * archive state; Rulid and Zakkaria receive local physical branches with their\n * own five-person admission quotas, so nobody walks thousands of kilometres\n * merely to read. Existing lived towns are not moved.\n */\nexport function repairSecretLibraryPlacementV18(world: WorldState): boolean {\n  const v18 = world.v18;\n  const library = v18?.secretLibrary;\n  if (!v18 || !library) return false;\n  const epoch = world.epoch ?? 1;\n  let changed = false;\n\n  const mainExisting = world.places[SECRET_LIBRARY_PLACE_ID_V18];\n  const mainValid = Boolean(\n    mainExisting &&\n    mainExisting.kind === 'library' &&\n    library.anchoredWorldEpoch === epoch &&\n    library.anchorPlaceId &&\n    Number.isFinite(library.anchorMapX) &&\n    Number.isFinite(library.anchorMapY),\n  );\n  if (!mainValid) {\n    const anchor = ainkradAnchor(world);\n    if (anchor && mountLibraryPlaceV18(\n      world, SECRET_LIBRARY_PLACE_ID_V18, SECRET_LIBRARY_PLACE_NAME_V18, anchor,\n    )) {\n      const place = world.places[SECRET_LIBRARY_PLACE_ID_V18];\n      library.anchorPlaceId = anchor.id;\n      library.anchorMapX = place.mapX;\n      library.anchorMapY = place.mapY;\n      library.anchoredWorldEpoch = epoch;\n      changed = true;\n    }\n  }\n\n  for (const branch of HUMAN_BRANCH_LIBRARIES_V18) {\n    const anchor = settlementAnchorV18(world, branch.settlementId);\n    if (!anchor) continue;\n    if (mountLibraryPlaceV18(world, branch.id, branch.name, anchor, branch.settlementId)) changed = true;\n  }\n\n  if (changed) world.routes = rebuildWorldRoutes(world.places, world.routes);\n  return changed;\n}\n\nexport function rankedSecretLibraryCandidatesV18`;
  text = replaceRegex(
    text,
    /export function repairSecretLibraryPlacementV18\(world: WorldState\): boolean \{[\s\S]*?\n\}\n\nexport function rankedSecretLibraryCandidatesV18/,
    replacement,
    'human library branch placement',
  );

  text = replaceOnce(
    text,
    `  if (\n    library.visitors.length > SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18 * 2 ||\n    ['secret_library_v18', 'elf_library_v20'].some(id => library.visitors.filter(v => (v.libraryPlaceId ?? SECRET_LIBRARY_PLACE_ID_V18) === id).length > 5) ||`,
    `  for (const branch of HUMAN_BRANCH_LIBRARIES_V18) {\n    if (!world.settlements[branch.settlementId]) continue;\n    const branchPlace = world.places[branch.id];\n    if (!branchPlace || branchPlace.kind !== 'library' || branchPlace.settlementId !== branch.settlementId) {\n      throw new Error(\\`Secret Library branch ${branch.id} is missing or misplaced.\\`);\n    }\n  }\n  if (\n    library.visitors.length > SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18 * LIBRARY_IDS.length ||\n    LIBRARY_IDS.some(id => library.visitors.filter(v => (v.libraryPlaceId ?? SECRET_LIBRARY_PLACE_ID_V18) === id).length > LIBRARY_LIMIT) ||`,
    'library branch validation and quota',
  );
  return text;
});

update('src/world/WorldEngine.ts', (text) => {
  text = replaceOnce(
    text,
    `import { LIBRARY_IDS, LIBRARY_YEAR, admissionDeadline, isSecretLibrary, libraryIdOf, hasLibraryAdmission, reconcileLibraryAdmissions, enforceLibraryBoundary, noteLibraryArrival } from '../v21/LibraryAdmissions';`,
    `import { LIBRARY_IDS, LIBRARY_YEAR, admissionDeadline, isSecretLibrary, libraryIdOf, libraryIdForAgent, hasLibraryAdmission, reconcileLibraryAdmissions, enforceLibraryBoundary, noteLibraryArrival } from '../v21/LibraryAdmissions';`,
    'WorldEngine library helper import',
  );
  text = replaceOnce(
    text,
    `  chooseCulturalChildNameV18,\n  toRussianWorldNameV18,`,
    `  chooseCulturalChildNameV18,\n  chooseCulturalPlaceNameV18,\n  toRussianWorldNameV18,`,
    'WorldEngine place naming import',
  );
  text = replaceOnce(
    text,
    `  const shore = world.places.rulid_shore;\n  const center = world.places.rulid_center;`,
    `  const shore = world.places.rulid_shore;\n  const center = world.places[world.settlements.settlement_rulid?.centerPlaceId ?? 'rulid_commons'];`,
    'Rulid civic center coast repair',
  );
  text = replaceOnce(
    text,
    `    const genesis = v15.genesisTeachers.find(\n      (teacher) =>\n        teacher.domain === mapped.domain &&\n        isGenesisTeacherActive(teacher, worldMinutes),\n    );`,
    `    const genesisSettlementId = this.homeSettlementId(agent);\n    const genesis =\n      (agent.race ?? 'human') === 'human' &&\n      ['settlement_ainkrad', 'settlement_rulid', 'settlement_zakkaria'].includes(genesisSettlementId ?? '')\n        ? v15.genesisTeachers.find(\n            (teacher) =>\n              teacher.domain === mapped.domain &&\n              isGenesisTeacherActive(teacher, worldMinutes),\n          )\n        : undefined;`,
    'Genesis mentors for all three human foundations only',
  );
  text = replaceOnce(
    text,
    `      const libraryPlaceId = agent.race === 'elf' ? LIBRARY_IDS[1] : LIBRARY_IDS[0];`,
    `      const libraryPlaceId = libraryIdForAgent(this.state, agent);`,
    'local human library selection',
  );
  text = replaceOnce(
    text,
    `    const prefix = REGION_NAME_PREFIXES[\n      (stage + Math.floor(this.rng.next() * REGION_NAME_PREFIXES.length)) %\n        REGION_NAME_PREFIXES.length\n    ];\n    const regionId = \\`region_${stage}\\`;\n    const suffixes = REGION_NAME_SUFFIXES[biome];\n    const suffix = suffixes[stage % suffixes.length];\n    const mapX = site.x;\n    const mapY = site.y;`,
    `    const regionId = \\`region_${stage}\\`;\n    const mapX = site.x;\n    const mapY = site.y;\n    const regionName = chooseCulturalPlaceNameV18({\n      world: this.state, explorer, biome, sequence: stage, x: mapX, y: mapY,\n    });`,
    'Spark-created regional name',
  );
  text = replaceOnce(
    text,
    `      \\`${'${prefix} ${suffix}'}\\`,`,
    `      regionName,`,
    'use Spark-created regional name',
  );
  return text;
});

update('tests/v0_3_21_localExplorationReading.test.ts', (text) => replaceOnce(
  text,
  `        expect(Math.hypot(site.x-agent.position.x,site.y-agent.position.y)).toBeLessThanOrEqual(8.0001);`,
  `        const step=Math.hypot(site.x-agent.position.x,site.y-agent.position.y);\n        expect(step).toBeGreaterThanOrEqual(5.9999);\n        expect(step).toBeLessThanOrEqual(36.0001);`,
  'local exploration distance regression',
));

console.log(JSON.stringify({ changed }, null, 2));
