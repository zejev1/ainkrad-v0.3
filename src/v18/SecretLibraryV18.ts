import { hasGiftV20 } from '../v20/DivineGiftsV20';
import type { GenesisDomain } from '../v15/GenesisBootstrap';
import { rebuildWorldRoutes } from '../world/WorldNavigation';
import { compactLibraryPlot } from '../world/SettlementLibraryLayout';
import type {
  AgentActionKind,
  AgentState,
  WorldPlace,
  WorldState,
} from '../world/types';
import {
  HUMAN_KNOWLEDGE_V18,
  type HumanKnowledgeCategoryV18,
  type HumanKnowledgeEntryV18,
} from './HumanKnowledgeV18';
import {
  REAL_HUMAN_BOOKS_V18,
  type RealHumanBookV18,
} from './SecretLibraryBooksV18';

export const SECRET_LIBRARY_PLACE_ID_V18 = 'secret_library_v18';
export const SECRET_LIBRARY_PLACE_NAME_V18 = 'Тайная библиотека';
export const SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18 = 5;
export const SECRET_LIBRARY_MAX_KNOWLEDGE_PER_AGENT_V18 = 512;
// Four verified six-hour reading sessions fit inside the one-month access
// window after the first physical journey to the building.
export const SECRET_LIBRARY_STUDY_QUANTA_V18 = 60;
// Compatibility name; the access window is now a full Ainkrad year.
export const SECRET_LIBRARY_MONTH_WORLD_MINUTES_V18 = 365 * 24 * 60;

export type SecretLibraryVisitorStatusV18 =
  | 'travelling'
  | 'studying'
  | 'returning'
  | 'completed'
  | 'missed';

export interface SecretLibraryVisitorV18 {
  agentId: string;
  libraryPlaceId?: string;
  readingMinutes?: number;
  wordsRead?: number;
  lastStudyWorldMinute?: number;
  accessYear: number;
  status: SecretLibraryVisitorStatusV18;
  selectedWorldMinute: number;
  originalLocationId: string;
  acceptedVoluntarily: true;
  studyQuanta: number;
  learnedKnowledgeIds: string[];
  arrivedWorldMinute?: number;
  completedWorldMinute?: number;
}

export interface SecretLibraryKnowledgeRecordV18 {
  id: string;
  knowledgeId: string;
  bookId?: string;
  title: string;
  category: HumanKnowledgeCategoryV18;
  historicalSource: string;
  sourceTitle: string;
  sourceUrl: string;
  acquiredWorldMinute: number;
  understanding: number;
  summary: string;
  concepts: string[];
  practiceCount: number;
  sharedCount: number;
  learnedFromAgentId?: string;
  lastPracticedWorldMinute?: number;
  lastSharedWorldMinute?: number;
}

/**
 * Only compact evidence lives in WorldState. Full public-domain texts are
 * requested through SecretLibraryGatewayV18 only on an explicit user action;
 * no simulation tick performs a network request or stores whole books.
 */
export interface SecretLibraryStateV18 {
  version: 'secret-library-v18.1';
  placeId: typeof SECRET_LIBRARY_PLACE_ID_V18;
  anchorPlaceId: string;
  anchorMapX: number;
  anchorMapY: number;
  anchoredWorldEpoch: number;
  currentAccessYear: number;
  status: 'waiting' | 'open' | 'closed';
  opensAtWorldMinute: number;
  closesAtWorldMinute: number;
  visitors: SecretLibraryVisitorV18[];
  knowledgeByAgentId: Record<string, SecretLibraryKnowledgeRecordV18[]>;
  totalVisits: number;
  totalKnowledgeRecords: number;
}

export interface SecretLibraryStudyMaterialV18 {
  knowledge: HumanKnowledgeEntryV18;
  book?: RealHumanBookV18;
  domain: GenesisDomain;
  sourceTitle: string;
  sourceUrl: string;
}

const KNOWLEDGE_CATEGORIES = new Set<HumanKnowledgeCategoryV18>([
  'agriculture',
  'medicine',
  'construction',
  'mathematics',
  'economics',
  'trade',
  'craft',
  'metallurgy',
  'navigation',
  'astronomy',
  'biology',
  'chemistry',
  'physics',
  'engineering',
  'governance',
  'law',
  'military',
  'logistics',
  'education',
  'writing',
  'philosophy',
]);

const VISITOR_STATUSES = new Set<SecretLibraryVisitorStatusV18>([
  'travelling',
  'studying',
  'returning',
  'completed',
  'missed',
]);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

const finiteNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const nonNegativeInteger = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : fallback;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function stringArray(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string =>
    typeof item === 'string' && item.trim().length > 0,
  ))].slice(-maximum);
}

function stableUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function worldYearAt(worldMinutes: number): number {
  return Math.floor(Math.max(0, worldMinutes) / (365 * 24 * 60)) + 1;
}

export function createSecretLibraryStateV18(
  worldMinutes = 0,
): SecretLibraryStateV18 {
  const year = worldYearAt(worldMinutes);
  return {
    version: 'secret-library-v18.1',
    placeId: SECRET_LIBRARY_PLACE_ID_V18,
    anchorPlaceId: '',
    anchorMapX: 0,
    anchorMapY: 0,
    anchoredWorldEpoch: 0,
    currentAccessYear: 0,
    status: 'waiting',
    opensAtWorldMinute: (year - 1) * 365 * 24 * 60,
    closesAtWorldMinute:
      (year - 1) * 365 * 24 * 60 + SECRET_LIBRARY_MONTH_WORLD_MINUTES_V18,
    visitors: [],
    knowledgeByAgentId: {},
    totalVisits: 0,
    totalKnowledgeRecords: 0,
  };
}

function repairedVisitor(
  raw: unknown,
  fallbackYear: number,
): SecretLibraryVisitorV18 | undefined {
  const value = asRecord(raw);
  if (!value) return undefined;
  const agentId = stringValue(value.agentId);
  if (!agentId) return undefined;
  const oldStatus = stringValue(value.status, 'travelling');
  const status: SecretLibraryVisitorStatusV18 =
    oldStatus === 'inside' || oldStatus === 'temporarily_outside'
      ? 'studying'
      : oldStatus === 'finished'
        ? 'completed'
        : oldStatus === 'failed'
          ? 'missed'
          : VISITOR_STATUSES.has(oldStatus as SecretLibraryVisitorStatusV18)
            ? oldStatus as SecretLibraryVisitorStatusV18
            : 'travelling';
  return {
    agentId,
    libraryPlaceId: stringValue(value.libraryPlaceId, SECRET_LIBRARY_PLACE_ID_V18),
    readingMinutes: Math.max(0, finiteNumber(value.readingMinutes, 0)),
    wordsRead: Math.max(0, finiteNumber(value.wordsRead, 0)),
    lastStudyWorldMinute: Math.max(0, finiteNumber(value.lastStudyWorldMinute, finiteNumber(value.arrivedWorldMinute, 0))),
    accessYear: Math.max(1, nonNegativeInteger(value.accessYear, fallbackYear)),
    status,
    selectedWorldMinute: finiteNumber(value.selectedWorldMinute, 0),
    originalLocationId: stringValue(value.originalLocationId, 'commons'),
    acceptedVoluntarily: true,
    studyQuanta: Math.min(
      SECRET_LIBRARY_STUDY_QUANTA_V18,
      nonNegativeInteger(
        value.studyQuanta,
        Math.floor(finiteNumber(value.studiedMinutes, 0) / (6 * 24 * 60)),
      ),
    ),
    learnedKnowledgeIds: stringArray(value.learnedKnowledgeIds, 32),
    ...(typeof value.arrivedWorldMinute === 'number'
      ? { arrivedWorldMinute: finiteNumber(value.arrivedWorldMinute, 0) }
      : {}),
    ...(typeof value.completedWorldMinute === 'number' ||
      typeof value.finishedWorldMinute === 'number'
      ? {
          completedWorldMinute: finiteNumber(
            value.completedWorldMinute,
            finiteNumber(value.finishedWorldMinute, 0),
          ),
        }
      : {}),
  };
}

function repairedKnowledgeRecord(
  raw: unknown,
  agentId: string,
  index: number,
): SecretLibraryKnowledgeRecordV18 | undefined {
  const value = asRecord(raw);
  if (!value) return undefined;
  const title = stringValue(value.title, stringValue(value.topic));
  if (!title) return undefined;
  const rawCategory = stringValue(value.category, 'education');
  const category = KNOWLEDGE_CATEGORIES.has(
    rawCategory as HumanKnowledgeCategoryV18,
  )
    ? rawCategory as HumanKnowledgeCategoryV18
    : 'education';
  const knowledgeId = stringValue(
    value.knowledgeId,
    stringValue(value.id, `legacy-${agentId}-${index}`),
  );
  return {
    id: stringValue(value.id, `${agentId}:${knowledgeId}:${index}`),
    knowledgeId,
    ...(stringValue(value.bookId) ? { bookId: stringValue(value.bookId) } : {}),
    title,
    category,
    historicalSource: stringValue(
      value.historicalSource,
      stringValue(value.sourceTitle, 'реальное человеческое знание'),
    ),
    sourceTitle: stringValue(value.sourceTitle, title),
    sourceUrl: stringValue(
      value.sourceUrl,
      `https://en.wikisource.org/wiki/Special:Search?search=${encodeURIComponent(title)}`,
    ),
    acquiredWorldMinute: finiteNumber(value.acquiredWorldMinute, 0),
    understanding: clamp01(finiteNumber(value.understanding, 0.25)),
    summary: stringValue(value.summary, title).slice(0, 800),
    concepts: stringArray(value.concepts ?? value.practicalDomains, 16),
    practiceCount: nonNegativeInteger(value.practiceCount),
    sharedCount: nonNegativeInteger(value.sharedCount),
    ...(stringValue(value.learnedFromAgentId)
      ? { learnedFromAgentId: stringValue(value.learnedFromAgentId) }
      : {}),
    ...(typeof value.lastPracticedWorldMinute === 'number'
      ? {
          lastPracticedWorldMinute: finiteNumber(
            value.lastPracticedWorldMinute,
            0,
          ),
        }
      : {}),
    ...(typeof value.lastSharedWorldMinute === 'number'
      ? { lastSharedWorldMinute: finiteNumber(value.lastSharedWorldMinute, 0) }
      : {}),
  };
}

/** Converts the user's older library save without retaining its heavy runtime. */
export function repairSecretLibraryStateV18(
  raw: unknown,
  worldMinutes: number,
  agents: Readonly<Record<string, AgentState>>,
): SecretLibraryStateV18 {
  const fallback = createSecretLibraryStateV18(worldMinutes);
  const value = asRecord(raw);
  if (!value) return fallback;
  const year = Math.max(
    0,
    nonNegativeInteger(value.currentAccessYear, fallback.currentAccessYear),
  );
  const visitors = (Array.isArray(value.visitors) ? value.visitors : [])
    .map((visitor) => repairedVisitor(visitor, Math.max(1, year)))
    .filter((visitor): visitor is SecretLibraryVisitorV18 =>
      visitor !== undefined && agents[visitor.agentId] !== undefined,
    )
    .filter((visitor, index, all) =>
      all.findIndex((candidate) => candidate.agentId === visitor.agentId) === index,
    )
    .slice(0, SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18 * 4);
  const knowledgeByAgentId: Record<string, SecretLibraryKnowledgeRecordV18[]> = {};
  const rawKnowledge = asRecord(value.knowledgeByAgentId) ?? {};
  for (const [agentId, records] of Object.entries(rawKnowledge)) {
    if (!agents[agentId] || !Array.isArray(records)) continue;
    knowledgeByAgentId[agentId] = records
      .map((record, index) => repairedKnowledgeRecord(record, agentId, index))
      .filter((record): record is SecretLibraryKnowledgeRecordV18 => record !== undefined)
      .slice(-SECRET_LIBRARY_MAX_KNOWLEDGE_PER_AGENT_V18);
  }
  const legacyWasAlreadyAnchored =
    value.version === 'secret-library-v18.1' &&
    nonNegativeInteger(value.anchoredWorldEpoch) > 0;
  return {
    version: 'secret-library-v18.1',
    placeId: SECRET_LIBRARY_PLACE_ID_V18,
    anchorPlaceId: legacyWasAlreadyAnchored
      ? stringValue(value.anchorPlaceId)
      : '',
    anchorMapX: legacyWasAlreadyAnchored ? finiteNumber(value.anchorMapX, 0) : 0,
    anchorMapY: legacyWasAlreadyAnchored ? finiteNumber(value.anchorMapY, 0) : 0,
    anchoredWorldEpoch: legacyWasAlreadyAnchored
      ? nonNegativeInteger(value.anchoredWorldEpoch)
      : 0,
    currentAccessYear: year,
    status: value.status === 'open' ? 'open' : year > 0 ? 'closed' : 'waiting',
    opensAtWorldMinute: finiteNumber(
      value.opensAtWorldMinute,
      finiteNumber(value.openedAtWorldMinute, fallback.opensAtWorldMinute),
    ),
    closesAtWorldMinute: finiteNumber(
      value.closesAtWorldMinute,
      fallback.closesAtWorldMinute,
    ),
    visitors,
    knowledgeByAgentId,
    totalVisits: Math.max(visitors.length, nonNegativeInteger(value.totalVisits)),
    totalKnowledgeRecords: Math.max(
      Object.values(knowledgeByAgentId).reduce((sum, records) => sum + records.length, 0),
      nonNegativeInteger(value.totalKnowledgeRecords),
    ),
  };
}

function ainkradAnchor(world: Readonly<WorldState>): WorldPlace | undefined {
  const settlement = world.settlements.settlement_ainkrad;
  return (
    (settlement ? world.places[settlement.centerPlaceId] : undefined) ??
    world.places.commons ??
    world.places.outskirts ??
    Object.values(world.places).find((place) => place.surface === 'land')
  );
}

/**
 * Mounts or repairs once per epoch. Coordinates depend only on Ainkrad's
 * original centre, never on min/max extents, so map growth cannot drag the
 * library into a new corner.
 */
export function repairSecretLibraryPlacementV18(world: WorldState): boolean {
  const v18 = world.v18;
  const library = v18?.secretLibrary;
  if (!v18 || !library) return false;
  const epoch = world.epoch ?? 1;
  const existing = world.places[SECRET_LIBRARY_PLACE_ID_V18];
  if (
    existing &&
    existing.kind === 'library' &&
    library.anchoredWorldEpoch === epoch &&
    library.anchorPlaceId &&
    Number.isFinite(library.anchorMapX) &&
    Number.isFinite(library.anchorMapY)
  ) {
    return false;
  }
  const anchor = ainkradAnchor(world);
  if (!anchor) return false;
  const planet = v18.planetaryGeography;
  const plot = compactLibraryPlot(world.places, { x: anchor.mapX, y: anchor.mapY }, SECRET_LIBRARY_PLACE_ID_V18);
  if (!plot) return false;
  const mapX = Math.max(planet.minMapX, Math.min(planet.maxMapX, plot.x));
  const mapY = Math.max(planet.minMapY, Math.min(planet.maxMapY, plot.y));

  for (const place of Object.values(world.places)) {
    place.connectedPlaceIds = place.connectedPlaceIds.filter(
      (connectedId) => connectedId !== SECRET_LIBRARY_PLACE_ID_V18,
    );
  }
  if (!anchor.connectedPlaceIds.includes(SECRET_LIBRARY_PLACE_ID_V18)) {
    anchor.connectedPlaceIds.push(SECRET_LIBRARY_PLACE_ID_V18);
  }
  world.places[SECRET_LIBRARY_PLACE_ID_V18] = {
    id: SECRET_LIBRARY_PLACE_ID_V18,
    name: SECRET_LIBRARY_PLACE_NAME_V18,
    kind: 'library',
    capacity: 6,
    biome: 'ancient_ruins',
    mapX,
    mapY,
    connectedPlaceIds: [anchor.id],
    fertility: 0,
    danger: 0,
    surface: 'land',
    discoveredAt: 0,
  };
  library.anchorPlaceId = anchor.id;
  library.anchorMapX = mapX;
  library.anchorMapY = mapY;
  library.anchoredWorldEpoch = epoch;
  world.routes = rebuildWorldRoutes(world.places, world.routes);
  return true;
}

export function rankedSecretLibraryCandidatesV18(
  agents: readonly AgentState[],
  year: number,
  literacyByAgentId: Readonly<Record<string, number>>,
  priorKnowledgeByAgentId: Readonly<Record<string, readonly SecretLibraryKnowledgeRecordV18[]>>,
): AgentState[] {
  return agents
    .filter((agent) => agent.life.alive && ['human', 'elf'].includes(agent.race ?? 'human') && agent.life.stage !== 'child')
    .map((agent) => ({
      agent,
      score:
        agent.personality.curiosity * 0.3 +
        agent.personality.diligence * 0.16 +
        agent.mind.values.knowledge * 0.22 +
        agent.mind.memoryCoherence * 0.12 +
        (literacyByAgentId[agent.id] ?? 0) * 0.12 +
        stableUnit(`${agent.id}:${year}`) * 0.08 -
        Math.min(0.18, (priorKnowledgeByAgentId[agent.id]?.length ?? 0) * 0.008),
    }))
    .sort((left, right) =>
      right.score - left.score || left.agent.id.localeCompare(right.agent.id),
    )
    .map(({ agent }) => agent);
}

function categoryMatchesBook(
  category: HumanKnowledgeCategoryV18,
  book: RealHumanBookV18,
): boolean {
  if (book.category === category) return true;
  if (category === 'construction') {
    return book.category === 'architecture' || book.category === 'engineering';
  }
  if (category === 'navigation') return book.category === 'geography';
  if (['biology', 'chemistry', 'physics'].includes(category)) {
    return book.category === 'natural_science';
  }
  if (category === 'logistics') return book.category === 'military';
  return false;
}

export function genesisDomainForLibraryCategoryV18(
  category: HumanKnowledgeCategoryV18,
): GenesisDomain {
  if (category === 'agriculture') return 'agriculture';
  if (['construction', 'craft', 'metallurgy', 'engineering'].includes(category)) {
    return 'construction';
  }
  if (
    ['economics', 'trade', 'governance', 'law', 'education', 'writing', 'philosophy']
      .includes(category)
  ) {
    return 'household';
  }
  return 'survival';
}

export function secretLibraryStudyMaterialV18(
  agentId: string,
  accessYear: number,
  studyQuantum: number,
  learnedKnowledgeIds: readonly string[],
): SecretLibraryStudyMaterialV18 {
  if (HUMAN_KNOWLEDGE_V18.length === 0) {
    throw new Error('Secret Library human knowledge catalogue is empty.');
  }
  const start = Math.floor(
    stableUnit(`${agentId}:${accessYear}:${studyQuantum}`) * HUMAN_KNOWLEDGE_V18.length,
  );
  let knowledge = HUMAN_KNOWLEDGE_V18[start];
  for (let offset = 0; offset < HUMAN_KNOWLEDGE_V18.length; offset += 1) {
    const candidate = HUMAN_KNOWLEDGE_V18[(start + offset) % HUMAN_KNOWLEDGE_V18.length];
    if (!learnedKnowledgeIds.includes(candidate.id)) {
      knowledge = candidate;
      break;
    }
  }
  const book = REAL_HUMAN_BOOKS_V18.find((candidate) =>
    categoryMatchesBook(knowledge.category, candidate),
  );
  const query = book
    ? `${book.externalLookup.workTitle} ${book.externalLookup.author}`
    : `${knowledge.title} ${knowledge.historicalSource}`;
  return {
    knowledge,
    book,
    domain: genesisDomainForLibraryCategoryV18(knowledge.category),
    sourceTitle: book
      ? `${book.title} — ${book.author}`
      : knowledge.historicalSource,
    sourceUrl:
      `https://en.wikisource.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
  };
}

const ACTION_KNOWLEDGE_AFFINITY_V18: Readonly<
  Record<
    AgentActionKind,
    Readonly<Partial<Record<HumanKnowledgeCategoryV18, number>>>
  >
> = {
  rest: {},
  relax: { medicine: 0.03, biology: 0.025, philosophy: 0.025 },
  walk: { navigation: 0.07, astronomy: 0.035, biology: 0.025 },
  gather: {
    agriculture: 0.13,
    biology: 0.04,
    logistics: 0.035,
    economics: 0.02,
  },
  hunt: {
    military: 0.11,
    navigation: 0.055,
    biology: 0.05,
    medicine: 0.035,
    logistics: 0.035,
  },
  work: {
    construction: 0.12,
    craft: 0.12,
    metallurgy: 0.13,
    engineering: 0.12,
    mathematics: 0.055,
    chemistry: 0.045,
    physics: 0.045,
    logistics: 0.035,
  },
  socialize: {
    education: 0.075,
    governance: 0.055,
    law: 0.05,
    trade: 0.045,
    philosophy: 0.035,
    writing: 0.03,
  },
  help: {
    medicine: 0.13,
    education: 0.07,
    governance: 0.035,
    law: 0.035,
    logistics: 0.03,
  },
  explore: {
    navigation: 0.14,
    astronomy: 0.09,
    biology: 0.055,
    logistics: 0.045,
    military: 0.035,
  },
  reflect: {
    philosophy: 0.085,
    education: 0.075,
    writing: 0.07,
    mathematics: 0.055,
    astronomy: 0.045,
    physics: 0.04,
  },
  bond: { education: 0.045, medicine: 0.03, law: 0.02 },
  pray: { philosophy: 0.075, writing: 0.025, education: 0.02 },
};

function recordActionAffinityV18(
  record: Readonly<SecretLibraryKnowledgeRecordV18>,
  action: AgentActionKind,
): number {
  const categoryAffinity = ACTION_KNOWLEDGE_AFFINITY_V18[action][record.category] ?? 0;
  const practicedConfidence =
    0.48 + Math.min(0.52, Math.log1p(record.practiceCount) / Math.log(64));
  return categoryAffinity * record.understanding * practicedConfidence;
}

/**
 * Knowledge changes what a resident notices as possible, never commands the
 * action. Only the three most relevant understood records contribute, keeping
 * the influence bounded even after centuries of reading.
 */
export function secretLibraryActionAffinityV18(
  world: Readonly<WorldState>,
  agentId: string,
  action: AgentActionKind,
): number {
  const records = world.v18?.secretLibrary.knowledgeByAgentId[agentId] ?? [];
  const contributions = records
    .map((record) => recordActionAffinityV18(record, action))
    .filter((value) => value > 0)
    .sort((left, right) => right - left)
    .slice(0, 3);
  return Math.min(0.18, contributions.reduce((sum, value) => sum + value, 0));
}

/**
 * Reading produces a hypothesis. A matching lived action slowly turns one
 * such hypothesis into personal understanding; no action grants mastery in a
 * single step and no new durable record is created here.
 */
export function practiceSecretLibraryKnowledgeV18(
  world: WorldState,
  agentId: string,
  action: AgentActionKind,
): string | undefined {
  const agent = world.agents[agentId];
  const records = world.v18?.secretLibrary.knowledgeByAgentId[agentId];
  if (!agent || !records?.length) return undefined;
  let selected: SecretLibraryKnowledgeRecordV18 | undefined;
  let selectedAffinity = 0;
  for (const record of records) {
    const categoryAffinity = ACTION_KNOWLEDGE_AFFINITY_V18[action][record.category] ?? 0;
    if (categoryAffinity <= 0) continue;
    if (
      !selected ||
      record.practiceCount < selected.practiceCount ||
      (record.practiceCount === selected.practiceCount &&
        categoryAffinity > selectedAffinity)
    ) {
      selected = record;
      selectedAffinity = categoryAffinity;
    }
  }
  if (!selected) return undefined;

  const readiness = clamp01(
    0.2 +
      agent.personality.diligence * 0.3 +
      agent.personality.curiosity * 0.22 +
      agent.mind.memoryCoherence * 0.18 +
      agent.mind.values.knowledge * 0.1,
  );
  const gain =
    (1 - selected.understanding) *
    (0.0005 + selectedAffinity * 0.004 * readiness);
  selected.understanding = clamp01(selected.understanding + gain);
  selected.practiceCount = Math.min(1_000_000, selected.practiceCount + 1);
  selected.lastPracticedWorldMinute = world.calendar.elapsedWorldMinutes;
  return selected.knowledgeId;
}

/** Transfers a bounded fragment only through a real, co-located conversation. */
export function shareSecretLibraryKnowledgeV18(input: {
  world: WorldState;
  speakerId: string;
  listenerId: string;
  knowledgeId: string;
  relationshipTrust: number;
  sentiment: number;
}): boolean {
  const {
    world,
    speakerId,
    listenerId,
    knowledgeId,
    relationshipTrust,
    sentiment,
  } = input;
  const v18 = world.v18;
  const speaker = world.agents[speakerId];
  const listener = world.agents[listenerId];
  const speakerRecord = v18?.secretLibrary.knowledgeByAgentId[speakerId]?.find(
    (record) => record.knowledgeId === knowledgeId,
  );
  const listenerLanguage = v18?.languageByAgentId[listenerId];
  if (
    !v18 ||
    !speaker ||
    !listener ||
    speaker.locationId !== listener.locationId ||
    Boolean(speaker.movement || listener.movement) ||
    !speakerRecord ||
    speakerRecord.understanding < 0.22 ||
    !listenerLanguage ||
    listenerLanguage.spokenComprehension < 0.08
  ) {
    return false;
  }

  const attention = clamp01(
    0.08 +
      listener.personality.curiosity * 0.2 +
      listener.mind.values.knowledge * 0.18 +
      listenerLanguage.spokenComprehension * 0.2 +
      relationshipTrust * 0.19 +
      Math.max(0, sentiment) * 0.1 -
      listener.stress * 0.1,
  );
  const records = v18.secretLibrary.knowledgeByAgentId[listenerId] ?? [];
  const existing = records.find((record) => record.knowledgeId === knowledgeId);
  const heardUnderstanding = clamp01(
    Math.min(
      speakerRecord.understanding * 0.58,
      0.035 + speakerRecord.understanding * attention * (hasGiftV20(world, speakerId, 'gifted_teacher') ? 0.6 : 0.32),
    ),
  );
  let changed = false;
  if (existing) {
    const reinforced = clamp01(
      existing.understanding +
        Math.max(0, speakerRecord.understanding - existing.understanding) *
          attention *
          0.045,
    );
    changed = reinforced > existing.understanding + 0.000001;
    existing.understanding = reinforced;
    existing.learnedFromAgentId ??= speakerId;
  } else if (heardUnderstanding >= 0.04) {
    records.push({
      ...speakerRecord,
      id: `oral:${listenerId}:${knowledgeId}:${world.calendar.elapsedWorldMinutes}`,
      bookId: speakerRecord.bookId,
      sourceTitle: `${speakerRecord.sourceTitle}; устно от ${speaker.name}`,
      acquiredWorldMinute: world.calendar.elapsedWorldMinutes,
      understanding: heardUnderstanding,
      concepts: speakerRecord.concepts.slice(0, 12),
      practiceCount: 0,
      sharedCount: 0,
      learnedFromAgentId: speakerId,
      lastPracticedWorldMinute: undefined,
      lastSharedWorldMinute: undefined,
    });
    v18.secretLibrary.knowledgeByAgentId[listenerId] = records.slice(
      -SECRET_LIBRARY_MAX_KNOWLEDGE_PER_AGENT_V18,
    );
    v18.secretLibrary.totalKnowledgeRecords += 1;
    changed = true;
  }
  if (changed) {
    speakerRecord.sharedCount = Math.min(1_000_000, speakerRecord.sharedCount + 1);
    speakerRecord.lastSharedWorldMinute = world.calendar.elapsedWorldMinutes;
  }
  return changed;
}

export function assertSecretLibraryStateV18(world: Readonly<WorldState>): void {
  const library = world.v18?.secretLibrary;
  if (!library || library.version !== 'secret-library-v18.1') {
    throw new Error('World v18 Secret Library state is missing or invalid.');
  }
  const place = world.places[SECRET_LIBRARY_PLACE_ID_V18];
  if (
    !place ||
    place.kind !== 'library' ||
    place.mapX !== library.anchorMapX ||
    place.mapY !== library.anchorMapY ||
    place.id !== library.placeId
  ) {
    throw new Error('Secret Library physical anchor is invalid.');
  }
  if (
    library.visitors.length > SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18 * 4 ||
    new Set(library.visitors.map((visitor) => visitor.agentId)).size !==
      library.visitors.length
  ) {
    throw new Error('Secret Library visitor window is invalid.');
  }
  for (const visitor of library.visitors) {
    if (
      !world.agents[visitor.agentId] ||
      !VISITOR_STATUSES.has(visitor.status) ||
      visitor.acceptedVoluntarily !== true ||
      visitor.studyQuanta < 0 ||
      visitor.studyQuanta > SECRET_LIBRARY_STUDY_QUANTA_V18
    ) {
      throw new Error(`Secret Library visitor ${visitor.agentId} is invalid.`);
    }
  }
  for (const [agentId, records] of Object.entries(library.knowledgeByAgentId)) {
    if (!world.agents[agentId] || records.length > SECRET_LIBRARY_MAX_KNOWLEDGE_PER_AGENT_V18) {
      throw new Error(`Secret Library knowledge for ${agentId} is invalid.`);
    }
    for (const record of records) {
      if (
        !record.id ||
        !record.knowledgeId ||
        !record.sourceUrl.startsWith('https://') ||
        !KNOWLEDGE_CATEGORIES.has(record.category) ||
        !Number.isFinite(record.understanding) ||
        record.understanding < 0 ||
        record.understanding > 1 ||
        !Number.isInteger(record.practiceCount) ||
        record.practiceCount < 0 ||
        !Number.isInteger(record.sharedCount) ||
        record.sharedCount < 0 ||
        (record.learnedFromAgentId !== undefined &&
          !world.agents[record.learnedFromAgentId])
      ) {
        throw new Error(`Secret Library record ${record.id} is invalid.`);
      }
    }
  }
}
