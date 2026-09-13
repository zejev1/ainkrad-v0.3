import {
  ensureSettlementEconomyV16,
  ensureSettlementRelationV16,
} from '../v16/SocietyFoundationV16';
import type { AgentState, WorldPlace, WorldState } from '../world/types';
import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';
import {
  assertEmergentSocietyV21,
  createEmergentSocietyV21,
  recordVerifiedDungeonOutcomeV21,
  repairEmergentSocietyV21,
  socialRankForEvidenceV21,
} from '../v21/EmergentSocietyV21';
import {
  marketUnitPriceV21,
  recordPhysicalGoodsV21,
  recordTradeEvidenceV21,
} from '../v21/EconomySystemV21';
import { recordTraumaV21 } from '../v21/EmbodiedWorldV21';
import {
  assessDungeonRiskV21,
  DUNGEON_FLOOR_COUNT_V21,
  dungeonRankForFloorV21,
  residentCombatCapacityV21,
} from '../v21/DungeonRpgV21';
import type {
  V19AdventureAbility,
  V19AdventureEconomyState,
  V19AdventurerState,
  V19AdventureRank,
  V19AdventureTransactionRecord,
  V19ArtifactKind,
  V19ArtifactState,
  V19CommodityKind,
  V19DungeonRunRecord,
  V19DungeonState,
  V19SettlementMarketState,
  V19TradeRelationState,
} from './types';

export const ADVENTURE_ECONOMY_VERSION_V19 = 'adventure-economy-v19' as const;
export const MAX_DUNGEONS_V19 = 96;
export const MAX_ARTIFACTS_V19 = 512;
export const MAX_RECENT_DUNGEON_RUNS_V19 = 256;
export const MAX_RECENT_ADVENTURE_TRANSACTIONS_V19 = 256;
export const MAX_AGENT_ARTIFACTS_V19 = 12;
export const MAX_AGENT_ABILITIES_V19 = 8;
export const MAX_MARKET_ARTIFACTS_V19 = 32;

export const ADVENTURE_RANKS_V19: readonly V19AdventureRank[] = [
  'unranked',
  'F',
  'E',
  'D',
  'C',
  'B',
  'A',
  'S',
] as const;

export const ADVENTURE_ABILITIES_V19: readonly V19AdventureAbility[] = [
  'guardian_stance',
  'pathfinder',
  'keen_edge',
  'rapid_recovery',
  'mana_sense',
  'treasure_appraisal',
] as const;

const ARTIFACT_KINDS: readonly V19ArtifactKind[] = [
  'weapon',
  'armor',
  'tool',
  'relic',
  'skill_book',
] as const;

const RANK_POINT_THRESHOLDS: Record<V19AdventureRank, number> = {
  unranked: 0,
  F: 1,
  E: 8,
  D: 22,
  C: 50,
  B: 95,
  A: 160,
  S: 260,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clampRoll = (value: number) =>
  Number.isFinite(value) ? clamp01(value) : 0.5;

function rankIndex(rank: V19AdventureRank): number {
  return Math.max(0, ADVENTURE_RANKS_V19.indexOf(rank));
}

export function adventureRankForPointsV19(points: number): V19AdventureRank {
  return socialRankForEvidenceV21(Math.max(0, points));
}

function stableNumber(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function emptyMarket(settlementId: string): V19SettlementMarketState {
  return {
    settlementId,
    // Currency enters circulation only when residents physically recover old
    // coin from a dungeon. A settlement does not receive money from Cardinal.
    treasuryCoin: 0,
    tradeVolume: 0,
    foodSold: 0,
    artifactsBought: 0,
    artifactsSold: 0,
    inventoryArtifactIds: [],
    commodityStocks: {},
  };
}

function emptyAdventurer(agentId: string): V19AdventurerState {
  return {
    agentId,
    rank: 'unranked',
    rankPoints: 0,
    dungeonRuns: 0,
    successfulRuns: 0,
    retreats: 0,
    deepestClear: 0,
    coinBalance: 0,
    totalCoinEarned: 0,
    totalCoinSpent: 0,
    artifactIds: [],
    abilities: [],
    carriedGoods: {},
  };
}

function eligibleDungeonEntrance(place: Readonly<WorldPlace>): boolean {
  return (
    place.surface === 'land' &&
    (place.kind === 'ruins' ||
      place.kind === 'mountains' ||
      (place.kind === 'swamp' && place.danger >= 0.32) ||
      (place.kind === 'forest' && place.danger >= 0.48))
  );
}

function dungeonRankForPlace(
  place: Readonly<WorldPlace>,
): Exclude<V19AdventureRank, 'unranked'> {
  // Distance from the human capital is not a difficulty level. A first
  // local discovery is weak; danger is learned from the terrain/encounters.
  const score = place.danger < 0.55 ? 0 : Math.floor((place.danger - 0.5) * 10);
  const ranks: Array<Exclude<V19AdventureRank, 'unranked'>> = [
    'F',
    'E',
    'D',
    'C',
    'B',
    'A',
    'S',
  ];
  return ranks[Math.max(0, Math.min(ranks.length - 1, Math.floor(score)))]!;
}

function dungeonName(place: Readonly<WorldPlace>): string {
  const ending =
    place.kind === 'ruins'
      ? 'подземные залы'
      : place.kind === 'mountains'
        ? 'глубокие пещеры'
        : place.kind === 'swamp'
          ? 'затопленные катакомбы'
          : 'корневые лабиринты';
  return `${place.name}: ${ending}`;
}

function dungeonFromPlace(
  place: Readonly<WorldPlace>,
  worldMinute: number,
): V19DungeonState {
  const rank = dungeonRankForPlace(place);
  const difficulty = Math.max(1, rankIndex(rank));
  const depth = DUNGEON_FLOOR_COUNT_V21;
  const treasureCapacity = 10 + depth * 2.4 + difficulty * 6;
  const started = Math.max(0, place.discoveredAt ?? worldMinute);
  const formationProgress = clamp01(
    (place.kind === 'ruins' ? 0.2 : 0.08) +
      place.danger * 0.34 +
      (stableNumber(place.id) % 17) / 100,
  );
  return {
    id: `dungeon:${place.id}`,
    name: dungeonName(place),
    entrancePlaceId: place.id,
    rank,
    depth,
    threat: clamp01(0.18 + place.danger * 0.62 + difficulty * 0.045),
    discoveredWorldMinute: started,
    clearedDepth: 0,
    runCount: 0,
    successfulRunCount: 0,
    treasureReserve: treasureCapacity,
    treasureCapacity,
    lastRenewedWorldMinute: worldMinute,
    formationStartedWorldMinute: started,
    lastDevelopedWorldMinute: worldMinute,
    formationProgress,
    formationStage: formationProgress >= 0.7
      ? 'labyrinth'
      : formationProgress >= 0.45
        ? 'passages'
        : formationProgress >= 0.2
          ? 'den'
          : 'trace',
    bossFloors: Array.from({ length: 10 }, (_, index) => (index + 1) * 10),
    active: formationProgress >= 0.2,
  };
}

function syncIntoState(
  world: Readonly<WorldState>,
  state: V19AdventureEconomyState,
): void {
  for (const settlement of Object.values(world.settlements)) {
    state.settlementMarketsById[settlement.id] ??= emptyMarket(settlement.id);
  }
  for (const dungeon of Object.values(state.dungeonsById)) {
    renewDungeon(dungeon, world.calendar.elapsedWorldMinutes);
  }
  const existingCount = Object.keys(state.dungeonsById).length;
  if (existingCount >= MAX_DUNGEONS_V19) return;
  const candidates = Object.values(world.places)
    .filter(place => eligibleDungeonEntrance(place) && Object.values(world.agents).some(agent => agent.life.alive && !agent.movement && agent.locationId === place.id))
    .sort(
      (left, right) =>
        (left.discoveredAt ?? 0) - (right.discoveredAt ?? 0) ||
        left.id.localeCompare(right.id),
    );
  for (const place of candidates) {
    if (Object.keys(state.dungeonsById).length >= MAX_DUNGEONS_V19) break;
    const id = `dungeon:${place.id}`;
    state.dungeonsById[id] ??= dungeonFromPlace(
      place,
      world.calendar.elapsedWorldMinutes,
    );
  }
}

export function createAdventureEconomyV19(
  world: Readonly<WorldState>,
): V19AdventureEconomyState {
  const state: V19AdventureEconomyState = {
    version: ADVENTURE_ECONOMY_VERSION_V19,
    dungeonsById: {},
    adventurersByAgentId: {},
    artifactsById: {},
    settlementMarketsById: {},
    tradeRelationsById: {},
    recentRuns: [],
    recentTransactions: [],
    totalRuns: 0,
    totalSuccessfulRuns: 0,
    totalCoinRecovered: 0,
    totalTradeVolume: 0,
    nextRunSequence: 1,
    nextArtifactSequence: 1,
    nextTransactionSequence: 1,
    emergentSociety: undefined!,
  };
  state.emergentSociety = createEmergentSocietyV21(world);
  syncIntoState(world, state);
  return state;
}

export function repairAdventureEconomyV19(
  world: WorldState,
): V19AdventureEconomyState {
  if (!world.v19) {
    throw new Error('World v19 state is required for adventure economy.');
  }
  const state = (world.v19.adventureEconomy ??= createAdventureEconomyV19(world));
  state.version = ADVENTURE_ECONOMY_VERSION_V19;
  state.dungeonsById ??= {};
  state.adventurersByAgentId ??= {};
  state.artifactsById ??= {};
  state.settlementMarketsById ??= {};
  state.tradeRelationsById ??= {};
  state.recentRuns ??= [];
  state.recentTransactions ??= [];
  state.totalRuns ??= state.recentRuns.length;
  state.totalSuccessfulRuns ??= state.recentRuns.filter(
    (run) => run.outcome === 'success',
  ).length;
  state.totalCoinRecovered ??= 0;
  state.totalTradeVolume ??= 0;
  state.nextRunSequence ??= state.totalRuns + 1;
  state.nextArtifactSequence ??= Object.keys(state.artifactsById).length + 1;
  state.nextTransactionSequence ??= state.recentTransactions.length + 1;
  state.recentRuns = state.recentRuns.slice(-MAX_RECENT_DUNGEON_RUNS_V19);
  state.recentTransactions = state.recentTransactions.slice(
    -MAX_RECENT_ADVENTURE_TRANSACTIONS_V19,
  );

  for (const [agentId, profile] of Object.entries(state.adventurersByAgentId)) {
    if (!world.agents[agentId]) {
      delete state.adventurersByAgentId[agentId];
      continue;
    }
    profile.agentId = agentId;
    profile.rankPoints = Math.max(0, profile.rankPoints ?? 0);
    profile.rank = adventureRankForPointsV19(profile.rankPoints);
    profile.artifactIds = [...new Set(profile.artifactIds ?? [])]
      .filter((id) => state.artifactsById[id]?.ownerAgentId === agentId)
      .slice(-MAX_AGENT_ARTIFACTS_V19);
    profile.abilities = [...new Set(profile.abilities ?? [])]
      .filter((ability) => ADVENTURE_ABILITIES_V19.includes(ability))
      .slice(-MAX_AGENT_ABILITIES_V19);
    profile.carriedGoods ??= {};
    profile.dungeonRuns = Math.max(0, profile.dungeonRuns ?? 0);
    profile.successfulRuns = Math.max(0, profile.successfulRuns ?? 0);
    profile.retreats = Math.max(0, profile.retreats ?? 0);
    profile.deepestClear = Math.max(0, profile.deepestClear ?? 0);
    profile.coinBalance = Math.max(0, profile.coinBalance ?? 0);
    profile.totalCoinEarned = Math.max(0, profile.totalCoinEarned ?? 0);
    profile.totalCoinSpent = Math.max(0, profile.totalCoinSpent ?? 0);
  }
  for (const [artifactId, artifact] of Object.entries(state.artifactsById)) {
    if (
      (artifact.ownerAgentId && !world.agents[artifact.ownerAgentId]) ||
      (artifact.holderSettlementId && !world.settlements[artifact.holderSettlementId]) ||
      !state.dungeonsById[artifact.originDungeonId]
    ) {
      delete state.artifactsById[artifactId];
    }
  }
  // Reconcile both sides after removing stale artifacts. A migrated or partly
  // written save must not retain an inventory id whose physical object no
  // longer exists.
  for (const [agentId, profile] of Object.entries(state.adventurersByAgentId)) {
    profile.artifactIds = profile.artifactIds.filter(
      (id) => state.artifactsById[id]?.ownerAgentId === agentId,
    );
  }
  for (const [settlementId, market] of Object.entries(
    state.settlementMarketsById,
  )) {
    if (!world.settlements[settlementId]) {
      delete state.settlementMarketsById[settlementId];
      continue;
    }
    market.settlementId = settlementId;
    market.treasuryCoin = Math.max(0, market.treasuryCoin ?? 0);
    market.tradeVolume = Math.max(0, market.tradeVolume ?? 0);
    market.foodSold = Math.max(0, market.foodSold ?? 0);
    market.artifactsBought = Math.max(0, market.artifactsBought ?? 0);
    market.artifactsSold = Math.max(0, market.artifactsSold ?? 0);
    market.inventoryArtifactIds = [...new Set(market.inventoryArtifactIds ?? [])]
      .filter(
        (id) => state.artifactsById[id]?.holderSettlementId === settlementId,
      )
      .slice(-MAX_MARKET_ARTIFACTS_V19);
    market.commodityStocks ??= {};
  }
  for (const dungeon of Object.values(state.dungeonsById)) {
    dungeon.formationStartedWorldMinute ??= dungeon.discoveredWorldMinute;
    dungeon.lastDevelopedWorldMinute ??= dungeon.lastRenewedWorldMinute;
    dungeon.formationProgress = clamp01(
      dungeon.formationProgress ?? (dungeon.active ? 1 : 0.12),
    );
    dungeon.formationStage ??= dungeon.formationProgress >= 0.88
      ? 'deep_domain'
      : dungeon.formationProgress >= 0.7
        ? 'labyrinth'
        : dungeon.formationProgress >= 0.45
          ? 'passages'
          : dungeon.formationProgress >= 0.2
            ? 'den'
            : 'trace';
    dungeon.depth = DUNGEON_FLOOR_COUNT_V21;
    dungeon.bossFloors = [...new Set(dungeon.bossFloors ??
      Array.from({ length: 10 }, (_, index) => (index + 1) * 10))]
      .filter((floor) => Number.isInteger(floor) && floor >= 1 && floor <= DUNGEON_FLOOR_COUNT_V21)
      .sort((left, right) => left - right);
    dungeon.rank = dungeonRankForFloorV21(
      Math.min(DUNGEON_FLOOR_COUNT_V21, dungeon.clearedDepth + 1),
    );
    dungeon.active = dungeon.formationProgress >= 0.2;
  }
  repairEmergentSocietyV21(world, state);
  syncIntoState(world, state);
  return state;
}

export function syncAdventureEconomyV19(
  world: WorldState,
): V19AdventureEconomyState {
  const state =
    world.v19?.adventureEconomy ?? repairAdventureEconomyV19(world);
  syncIntoState(world, state);
  return state;
}

export function ensureAdventurerV19(
  world: WorldState,
  agentId: string,
): V19AdventurerState {
  const state = syncAdventureEconomyV19(world);
  return (state.adventurersByAgentId[agentId] ??= emptyAdventurer(agentId));
}

export function isAdventureCandidateV19(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
): boolean {
  if (
    !['human', 'elf', 'dwarf'].includes(agent.race ?? 'human') ||
    !agent.life.alive ||
    agent.life.stage !== 'adult' ||
    agent.life.health < 0.5 ||
    agent.energy < 0.36 ||
    agent.resources < 0.12
  ) {
    return false;
  }
  const livelihood = world.v18?.livelihoodByAgentId[agent.id];
  const practiced = livelihood?.practiceByKind.adventurer ?? 0;
  const livedPath = ['adventurer', 'scout', 'hunter', 'guard', 'warrior'].includes(
    livelihood?.primary ?? '',
  );
  const selfDirectedFit =
    agent.personality.curiosity * 0.34 +
    agent.personality.riskTolerance * 0.38 +
    agent.mind.values.freedom * 0.18 +
    agent.mind.values.ambition * 0.1;
  return livedPath || practiced >= 3 || selfDirectedFit >= 0.61;
}

/**
 * Called only after the resident has independently selected exploration.
 * The roll is a personal decision; neither Cardinal nor settlement quotas are
 * inputs. Candidate ids must already be physically reachable by the engine.
 */
export function chooseDungeonExpeditionV19(
  world: WorldState,
  agent: Readonly<AgentState>,
  reachableDungeonIds: readonly string[],
  choiceRoll: number,
): V19DungeonState | undefined {
  if (!isAdventureCandidateV19(world, agent)) return undefined;
  const state = syncAdventureEconomyV19(world);
  const profile = state.adventurersByAgentId[agent.id];
  const currentRank = profile?.rank ?? 'unranked';
  const maximumRankIndex = Math.max(1, rankIndex(currentRank) + 1);
  const candidates = reachableDungeonIds
    .map((id) => state.dungeonsById[id])
    .filter(
      (dungeon): dungeon is V19DungeonState =>
        dungeon !== undefined &&
        dungeon.active &&
        ((agent.knownDungeonIds ?? []).includes(dungeon.id) ||
          (agent.knownPlaceIds ?? []).includes(dungeon.entrancePlaceId) ||
          agent.locationId === dungeon.entrancePlaceId) &&
        dungeon.treasureReserve >= 0.2 &&
        rankIndex(dungeon.rank) <= maximumRankIndex,
    )
    .slice(0, 6);
  if (candidates.length === 0) return undefined;

  const livelihood = world.v18?.livelihoodByAgentId[agent.id];
  const professionDrive =
    livelihood?.primary === 'adventurer'
      ? 0.34
      : ['scout', 'hunter', 'guard', 'warrior'].includes(
            livelihood?.primary ?? '',
          )
        ? 0.17
        : 0;
  const willingness = clamp01(
    0.06 +
      professionDrive +
      agent.personality.curiosity * 0.18 +
      agent.personality.riskTolerance * 0.23 +
      agent.mind.values.ambition * 0.12 -
      agent.mind.emotions.fear * 0.16 -
      agent.stress * 0.12,
  );
  const normalizedRoll = clampRoll(choiceRoll);
  if (normalizedRoll >= willingness) return undefined;
  const selection = Math.min(
    candidates.length - 1,
    Math.floor((normalizedRoll / Math.max(0.0001, willingness)) * candidates.length),
  );
  return candidates[selection];
}

function nearestSettlementId(
  world: Readonly<WorldState>,
  place: Readonly<WorldPlace>,
): string | undefined {
  return Object.values(world.settlements).sort(
    (left, right) =>
      Math.hypot(left.centerX - place.mapX, left.centerY - place.mapY) -
        Math.hypot(right.centerX - place.mapX, right.centerY - place.mapY) ||
      left.id.localeCompare(right.id),
  )[0]?.id;
}

function ownedArtifactPower(
  state: Readonly<V19AdventureEconomyState>,
  profile: Readonly<V19AdventurerState>,
): number {
  return Math.min(
    0.3,
    profile.artifactIds.reduce(
      (sum, id) => sum + (state.artifactsById[id]?.potency ?? 0) * 0.055,
      0,
    ),
  );
}

function abilityPower(profile: Readonly<V19AdventurerState>): number {
  let result = 0;
  if (profile.abilities.includes('guardian_stance')) result += 0.055;
  if (profile.abilities.includes('pathfinder')) result += 0.045;
  if (profile.abilities.includes('keen_edge')) result += 0.06;
  if (profile.abilities.includes('rapid_recovery')) result += 0.035;
  if (profile.abilities.includes('mana_sense')) result += 0.035;
  return result;
}

function createArtifact(
  world: WorldState,
  state: V19AdventureEconomyState,
  agent: Readonly<AgentState>,
  dungeon: Readonly<V19DungeonState>,
  kindRoll: number,
  abilityRoll: number,
): V19ArtifactState | undefined {
  if (Object.keys(state.artifactsById).length >= MAX_ARTIFACTS_V19) {
    const expendable = Object.values(state.artifactsById)
      .filter((artifact) => artifact.holderSettlementId)
      .sort(
        (left, right) =>
          left.createdWorldMinute - right.createdWorldMinute ||
          left.id.localeCompare(right.id),
      )[0];
    if (!expendable) return undefined;
    const market = expendable.holderSettlementId
      ? state.settlementMarketsById[expendable.holderSettlementId]
      : undefined;
    if (market) {
      market.inventoryArtifactIds = market.inventoryArtifactIds.filter(
        (id) => id !== expendable.id,
      );
    }
    delete state.artifactsById[expendable.id];
  }
  const kind = ARTIFACT_KINDS[
    Math.min(ARTIFACT_KINDS.length - 1, Math.floor(clampRoll(kindRoll) * ARTIFACT_KINDS.length))
  ]!;
  const ability = ADVENTURE_ABILITIES_V19[
    Math.min(
      ADVENTURE_ABILITIES_V19.length - 1,
      Math.floor(clampRoll(abilityRoll) * ADVENTURE_ABILITIES_V19.length),
    )
  ]!;
  const id = `artifact:v19:${state.nextArtifactSequence++}`;
  const rankPower = Math.max(1, rankIndex(dungeon.rank));
  const kindName: Record<V19ArtifactKind, string> = {
    weapon: 'клинок',
    armor: 'доспех',
    tool: 'инструмент',
    relic: 'реликвия',
    skill_book: 'книга навыка',
  };
  const entrance = world.places[dungeon.entrancePlaceId];
  const artifact: V19ArtifactState = {
    id,
    name: `${kindName[kind]} из «${dungeon.name}»`,
    kind,
    rank: dungeon.rank,
    potency: clamp01(0.12 + rankPower * 0.1 + clampRoll(abilityRoll) * 0.12),
    originDungeonId: dungeon.id,
    ...(entrance
      ? { originSettlementId: nearestSettlementId(world, entrance) }
      : {}),
    createdWorldMinute: world.calendar.elapsedWorldMinutes,
    ownerAgentId: agent.id,
    ...(kind === 'skill_book' || clampRoll(abilityRoll) < 0.14
      ? { ability }
      : {}),
  };
  state.artifactsById[id] = artifact;
  return artifact;
}

function pushTransaction(
  state: V19AdventureEconomyState,
  transaction: Omit<V19AdventureTransactionRecord, 'id'>,
): V19AdventureTransactionRecord {
  const record: V19AdventureTransactionRecord = {
    id: `adventure-transaction:v19:${state.nextTransactionSequence++}`,
    ...transaction,
  };
  state.recentTransactions.push(record);
  state.recentTransactions = state.recentTransactions.slice(
    -MAX_RECENT_ADVENTURE_TRANSACTIONS_V19,
  );
  return record;
}

function renewDungeon(
  dungeon: V19DungeonState,
  worldMinute: number,
): void {
  const elapsed = Math.max(0, worldMinute - dungeon.lastRenewedWorldMinute);
  if (elapsed <= 0) return;
  // Cleared chambers do not print money. Over years, monsters, travellers and
  // natural deposits can slowly bring finite valuables back into the site.
  const years = elapsed / WORLD_MINUTES_PER_YEAR;
  dungeon.treasureReserve = Math.min(
    dungeon.treasureCapacity,
    dungeon.treasureReserve + dungeon.treasureCapacity * years * 0.08,
  );
  const formationYears = Math.max(
    0,
    (worldMinute - dungeon.lastDevelopedWorldMinute) / WORLD_MINUTES_PER_YEAR,
  );
  dungeon.formationProgress = clamp01(
    dungeon.formationProgress +
      formationYears * (0.018 + dungeon.threat * 0.018),
  );
  dungeon.formationStage = dungeon.formationProgress >= 0.88
    ? 'deep_domain'
    : dungeon.formationProgress >= 0.7
      ? 'labyrinth'
      : dungeon.formationProgress >= 0.45
        ? 'passages'
        : dungeon.formationProgress >= 0.2
          ? 'den'
          : 'trace';
  dungeon.active = dungeon.formationProgress >= 0.2;
  dungeon.lastDevelopedWorldMinute = worldMinute;
  dungeon.lastRenewedWorldMinute = worldMinute;
}

export interface DungeonExpeditionRollsV19 {
  continuation: number;
  encounter: number;
  depth: number;
  artifact: number;
  artifactKind: number;
  ability: number;
}

export interface DungeonExpeditionResultV19 {
  run: V19DungeonRunRecord;
  artifact?: V19ArtifactState;
  learnedAbility?: V19AdventureAbility;
}

/** Resolve an expedition only while the resident stands at its entrance. */
export function resolveDungeonExpeditionV19(
  world: WorldState,
  agent: AgentState,
  dungeonId: string,
  rolls: Readonly<DungeonExpeditionRollsV19>,
  partyAgentIds: readonly string[] = [],
): DungeonExpeditionResultV19 {
  const state = syncAdventureEconomyV19(world);
  const dungeon = state.dungeonsById[dungeonId];
  if (!dungeon || !dungeon.active) throw new Error('Dungeon is unavailable.');
  if (agent.locationId !== dungeon.entrancePlaceId || agent.movement) {
    throw new Error('A dungeon expedition requires physical arrival at its entrance.');
  }
  if (!isAdventureCandidateV19(world, agent)) {
    throw new Error('Resident is not currently able to enter the dungeon.');
  }

  const profile = ensureAdventurerV19(world, agent.id);
  renewDungeon(dungeon, world.calendar.elapsedWorldMinutes);
  const party = [agent, ...partyAgentIds
    .filter((id) => id !== agent.id)
    .map((id) => world.agents[id])]
    .filter(
      (member): member is AgentState =>
        Boolean(
          member?.life.alive &&
          member.life.stage === 'adult' &&
          member.locationId === dungeon.entrancePlaceId &&
          !member.movement,
        ),
    )
    .slice(0, 6);
  const rankBefore = profile.rank;
  const giftKinds = new Set(
    world.v19?.divineAgency.byAgentId[agent.id]?.gifts.map((grant) => grant.gift) ?? [],
  );
  const legendaryGift = giftKinds.has('demon_king_hero');
  const equipment = ownedArtifactPower(state, profile);
  const progression = agent.progression;
  const personalCapacity = clamp01(
    agent.life.health * 0.16 +
      agent.energy * 0.12 +
      agent.life.physiology.strength * 0.13 +
      agent.life.physiology.endurance * 0.11 +
      agent.skills.hunting * 0.11 +
      agent.skills.exploration * 0.1 +
      (progression?.combatMastery ?? 0) * 0.13 +
      Math.min(0.08, (progression?.level ?? 1) / 900) +
      equipment +
      abilityPower(profile) +
      (giftKinds.has('might') ? 0.13 : 0) +
      (legendaryGift ? 0.42 : 0),
  );
  const courage = clamp01(
    agent.personality.riskTolerance * 0.34 +
      agent.personality.resilience * 0.2 +
      agent.mind.values.ambition * 0.18 +
      personalCapacity * 0.24 -
      agent.mind.emotions.fear * 0.18 -
      agent.stress * 0.12,
  );
  const formedDepth = Math.max(
    1,
    Math.floor(dungeon.formationProgress * DUNGEON_FLOOR_COUNT_V21),
  );
  // A resident can only attempt the next unexplored part of this physical
  // dungeon. A random roll varies the size of the attempt, never teleports a
  // newcomer straight to a late floor.
  const intendedDepth = Math.min(
    formedDepth,
    dungeon.clearedDepth + 1 + Math.floor(clampRoll(rolls.depth) * 3),
  );
  const assessment = assessDungeonRiskV21(world, dungeon, party, intendedDepth);
  const capacity = clamp01(
    assessment.partyCapacity +
      equipment +
      abilityPower(profile) +
      (giftKinds.has('might') ? 0.13 : 0) +
      (legendaryGift ? 0.42 : 0),
  );
  const difficulty = assessment.knownDanger;
  const mustRetreat =
    !legendaryGift &&
    (agent.energy < 0.28 ||
      agent.life.health < 0.46 ||
      (assessment.recommendation === 'reckless' &&
        agent.personality.riskTolerance < 0.78) ||
      clampRoll(rolls.continuation) > 0.42 + courage * 0.48);
  const success =
    !mustRetreat &&
    (legendaryGift ||
      capacity * (0.82 + clampRoll(rolls.encounter) * 0.54) >= difficulty);
  const outcome: V19DungeonRunRecord['outcome'] = mustRetreat
    ? 'retreat'
    : success
      ? 'success'
      : 'defeat';
  const rankPower = Math.max(1, rankIndex(dungeon.rank));
  const healthDamage = legendaryGift
    ? 0
    : outcome === 'success'
      ? dungeon.threat * (0.018 + (1 - capacity) * 0.04)
      : outcome === 'retreat'
        ? dungeon.threat * 0.025
        : dungeon.threat * (0.11 + (1 - capacity) * 0.16);
  const casualtyAgentIds: string[] = [];
  for (const member of party) {
    const memberCapacity = residentCombatCapacityV21(member);
    const exposure = clamp01(
      healthDamage *
        (member.id === agent.id ? 1 : 0.72 + clampRoll(rolls.encounter) * 0.34) *
        (1.14 - memberCapacity * 0.34),
    );
    member.life.health = clamp01(member.life.health - exposure);
    recordTraumaV21(
      world,
      member,
      exposure,
      'dungeon',
      `${dungeon.id}:${state.nextRunSequence}:${member.id}`,
    );
    member.energy = clamp01(
      member.energy -
        (outcome === 'success' ? 0.12 : outcome === 'retreat' ? 0.055 : 0.18),
    );
    member.resources = clamp01(
      member.resources - (outcome === 'success' ? 0.025 : 0.014),
    );
    member.stress = clamp01(
      member.stress + (outcome === 'defeat' ? 0.13 : outcome === 'retreat' ? 0.035 : -0.025),
    );
    member.mind.emotions.fear = clamp01(
      member.mind.emotions.fear + (outcome === 'defeat' ? 0.1 : -0.018),
    );
    member.needs.purpose = clamp01(
      member.needs.purpose + (outcome === 'success' ? 0.1 : 0.018),
    );
    member.skills.exploration = clamp01(
      member.skills.exploration + (outcome === 'success' ? 0.014 : 0.004),
    );
    member.skills.hunting = clamp01(
      member.skills.hunting + (outcome === 'success' ? 0.009 : 0.003),
    );
    if (member.life.health <= 0.015) casualtyAgentIds.push(member.id);
  }

  const experienceGained =
    outcome === 'success'
      ? 24 + rankPower * 18 + intendedDepth * 4
      : outcome === 'defeat'
        ? 5 + rankPower * 2
        : 1.5;
  agent.progression ??= {
    level: 1,
    experience: 0,
    objectControlAuthority: 0,
    systemControlAuthority: 0,
    combatMastery: agent.skills.hunting,
    sacredArts: 0,
  };
  agent.progression.experience += experienceGained;
  agent.progression.level = Math.max(
    1,
    Math.min(100, 1 + Math.floor(Math.sqrt(agent.progression.experience / 24))),
  );
  agent.progression.combatMastery = clamp01(
    agent.progression.combatMastery +
      (outcome === 'success' ? 0.012 + rankPower * 0.002 : 0.003),
  );

  profile.dungeonRuns += 1;
  profile.successfulRuns += outcome === 'success' ? 1 : 0;
  profile.retreats += outcome === 'retreat' ? 1 : 0;
  profile.deepestClear = Math.max(
    profile.deepestClear,
    outcome === 'success' ? intendedDepth : 0,
  );
  profile.lastRunWorldMinute = world.calendar.elapsedWorldMinutes;
  dungeon.runCount += 1;
  dungeon.successfulRunCount += outcome === 'success' ? 1 : 0;
  dungeon.lastRunWorldMinute = world.calendar.elapsedWorldMinutes;
  dungeon.clearedDepth = Math.max(
    dungeon.clearedDepth,
    outcome === 'success' ? intendedDepth : 0,
  );
  dungeon.rank = dungeonRankForFloorV21(
    Math.min(DUNGEON_FLOOR_COUNT_V21, dungeon.clearedDepth + 1),
  );

  const coinRecovered =
    outcome === 'success'
      ? Math.min(
          dungeon.treasureReserve,
          0.6 + rankPower * 0.65 + intendedDepth * 0.18 + clampRoll(rolls.encounter),
        )
      : 0;
  dungeon.treasureReserve = Math.max(0, dungeon.treasureReserve - coinRecovered);
  const coinShare = coinRecovered / Math.max(1, party.length);
  for (const member of party) {
    const memberProfile = ensureAdventurerV19(world, member.id);
    memberProfile.coinBalance += coinShare;
    memberProfile.totalCoinEarned += coinShare;
  }
  state.totalCoinRecovered += coinRecovered;
  if (coinRecovered > 0) {
    pushTransaction(state, {
      kind: 'dungeon_reward',
      worldMinute: world.calendar.elapsedWorldMinutes,
      agentId: agent.id,
      physicalPlaceId: dungeon.entrancePlaceId,
      coin: coinRecovered,
      food: 0,
    });
  }

  const loot = outcome === 'success'
    ? {
        monster_part: Math.min(
          0.32,
          dungeon.treasureReserve * 0.018 + dungeon.threat * 0.12,
        ),
        rare_mineral: Math.min(
          0.18,
          dungeon.treasureReserve * 0.009 + rankPower * 0.012,
        ),
      }
    : undefined;
  if (loot) {
    for (const member of party) {
      recordPhysicalGoodsV21(
        world,
        member,
        'monster_part',
        loot.monster_part / party.length,
      );
      recordPhysicalGoodsV21(
        world,
        member,
        'rare_mineral',
        loot.rare_mineral / party.length,
      );
    }
    dungeon.treasureReserve = Math.max(
      0,
      dungeon.treasureReserve - loot.monster_part * 0.4 - loot.rare_mineral,
    );
  }

  const artifactChance = clamp01(
    0.14 +
      rankPower * 0.035 +
      (profile.abilities.includes('treasure_appraisal') ? 0.12 : 0),
  );
  const artifact =
    outcome === 'success' &&
    profile.artifactIds.length < MAX_AGENT_ARTIFACTS_V19 &&
    clampRoll(rolls.artifact) < artifactChance
      ? createArtifact(
          world,
          state,
          agent,
          dungeon,
          rolls.artifactKind,
          rolls.ability,
        )
      : undefined;
  let learnedAbility: V19AdventureAbility | undefined;
  if (artifact) {
    profile.artifactIds.push(artifact.id);
    const canLearn =
      artifact.ability &&
      !profile.abilities.includes(artifact.ability) &&
      (artifact.kind !== 'skill_book' ||
        clampRoll(rolls.ability) <
          0.38 + agent.mind.values.knowledge * 0.34 + agent.personality.curiosity * 0.18);
    if (canLearn && artifact.ability) {
      learnedAbility = artifact.ability;
      profile.abilities.push(artifact.ability);
      profile.abilities = profile.abilities.slice(-MAX_AGENT_ABILITIES_V19);
    }
  }

  // Social rank is changed only by witnessed, physical evidence. It never
  // contributes to the capacity calculation above and therefore grants no
  // magical combat statistics.
  recordVerifiedDungeonOutcomeV21(
    world,
    agent,
    dungeon.entrancePlaceId,
    outcome,
    outcome === 'success' ? intendedDepth : 0,
  );
  for (const member of party) {
    if (member.id === agent.id) continue;
    recordVerifiedDungeonOutcomeV21(
      world,
      member,
      dungeon.entrancePlaceId,
      outcome,
      outcome === 'success' ? intendedDepth : 0,
    );
  }

  const run: V19DungeonRunRecord = {
    id: `dungeon-run:v19:${state.nextRunSequence++}`,
    worldMinute: world.calendar.elapsedWorldMinutes,
    agentId: agent.id,
    dungeonId: dungeon.id,
    entrancePlaceId: dungeon.entrancePlaceId,
    voluntary: true,
    outcome,
    rankBefore,
    rankAfter: profile.rank,
    clearedDepth: outcome === 'success' ? intendedDepth : 0,
    experienceGained,
    coinRecovered,
    ...(artifact ? { artifactId: artifact.id } : {}),
    ...(loot ? { loot } : {}),
    healthDamage,
    partyAgentIds: party.map((member) => member.id),
    casualtyAgentIds,
  };
  state.recentRuns.push(run);
  state.recentRuns = state.recentRuns.slice(-MAX_RECENT_DUNGEON_RUNS_V19);
  state.totalRuns += 1;
  state.totalSuccessfulRuns += outcome === 'success' ? 1 : 0;
  return { run, ...(artifact ? { artifact } : {}), ...(learnedAbility ? { learnedAbility } : {}) };
}

function recordCarriedTrade(
  world: WorldState,
  state: V19AdventureEconomyState,
  originSettlementId: string | undefined,
  destinationSettlementId: string,
  agentId: string,
  value: number,
): void {
  if (
    !originSettlementId ||
    originSettlementId === destinationSettlementId ||
    !world.settlements[originSettlementId] ||
    !world.settlements[destinationSettlementId]
  ) {
    return;
  }
  const [settlementA, settlementB] = [
    originSettlementId,
    destinationSettlementId,
  ].sort();
  const id = `${settlementA}::${settlementB}`;
  const relation: V19TradeRelationState = (state.tradeRelationsById[id] ??= {
    id,
    settlementA,
    settlementB,
    carriedTradeCount: 0,
    tradeVolume: 0,
    lastCarrierAgentId: agentId,
    lastTradeWorldMinute: world.calendar.elapsedWorldMinutes,
  });
  relation.carriedTradeCount += 1;
  relation.tradeVolume += value;
  relation.lastCarrierAgentId = agentId;
  relation.lastTradeWorldMinute = world.calendar.elapsedWorldMinutes;

  const social = ensureSettlementRelationV16(
    world,
    originSettlementId,
    destinationSettlementId,
  );
  social.contactEvents += 1;
  social.familiarity = clamp01(social.familiarity + 0.012);
  social.trust = clamp01(social.trust + 0.004);
  social.cooperation = clamp01(social.cooperation + 0.008);
  social.lastEvidenceWorldMinute = world.calendar.elapsedWorldMinutes;
}

function artifactPrice(artifact: Readonly<V19ArtifactState>): number {
  return 0.8 + rankIndex(artifact.rank) * 0.55 + artifact.potency * 2.8;
}

/**
 * A resident can trade only while physically standing inside the market's
 * settlement. Food is deducted from the real v16 granary; no resource aid is
 * created by Cardinal or by this economy layer.
 */
export function tryAdventureMarketTradeV19(
  world: WorldState,
  agent: AgentState,
  settlementId: string,
  choiceRoll: number,
): V19AdventureTransactionRecord | undefined {
  const physicalSettlementId = world.places[agent.locationId]?.settlementId;
  if (physicalSettlementId !== settlementId || !world.settlements[settlementId]) {
    return undefined;
  }
  const state = syncAdventureEconomyV19(world);
  const profile = state.adventurersByAgentId[agent.id];
  if (!profile) return undefined;
  if (
    profile.lastTradeWorldMinute !== undefined &&
    world.calendar.elapsedWorldMinutes - profile.lastTradeWorldMinute < 30 * 24 * 60
  ) {
    return undefined;
  }
  const market = (state.settlementMarketsById[settlementId] ??=
    emptyMarket(settlementId));
  const homeSettlementId = world.places[agent.homeId]?.settlementId;
  const economy = ensureSettlementEconomyV16(world, settlementId);
  const roll = clampRoll(choiceRoll);

  if (
    agent.resources < 0.62 &&
    profile.coinBalance >= 0.05 &&
    economy.stocks.food >= 0.08
  ) {
    const unitPrice = marketUnitPriceV21(
      world,
      state,
      settlementId,
      'food',
    );
    const food = Math.min(
      0.16,
      economy.stocks.food,
      profile.coinBalance / Math.max(0.05, unitPrice),
      0.08 + (0.62 - agent.resources) * 0.16,
    );
    const coin = Math.min(profile.coinBalance, food * unitPrice);
    if (food <= 0.001 || coin <= 0.001) return undefined;
    economy.stocks.food = Math.max(0, economy.stocks.food - food);
    agent.resources = clamp01(agent.resources + food * 0.72);
    profile.coinBalance -= coin;
    profile.totalCoinSpent += coin;
    market.treasuryCoin += coin;
    market.foodSold += food;
    market.tradeVolume += coin;
    state.totalTradeVolume += coin;
    market.lastTradeWorldMinute = world.calendar.elapsedWorldMinutes;
    profile.lastTradeWorldMinute = world.calendar.elapsedWorldMinutes;
    recordCarriedTrade(
      world,
      state,
      homeSettlementId,
      settlementId,
      agent.id,
      coin,
    );
    const transaction = pushTransaction(state, {
      kind: 'food_purchase',
      worldMinute: world.calendar.elapsedWorldMinutes,
      agentId: agent.id,
      physicalPlaceId: agent.locationId,
      settlementId,
      ...(homeSettlementId ? { originSettlementId: homeSettlementId } : {}),
      coin,
      food,
      commodity: 'food',
      quantity: food,
      unitPrice,
    });
    recordTradeEvidenceV21(world, agent, settlementId, 'food', food);
    return transaction;
  }

  const saleGood = (Object.entries(profile.carriedGoods ?? {}) as Array<
    [V19CommodityKind, number]
  >)
    .filter(([, quantity]) => Number.isFinite(quantity) && quantity > 0.01)
    .sort((left, right) => {
      const leftValue = left[1] * marketUnitPriceV21(world, state, settlementId, left[0]);
      const rightValue = right[1] * marketUnitPriceV21(world, state, settlementId, right[0]);
      return rightValue - leftValue || left[0].localeCompare(right[0]);
    })[0];
  if (saleGood && market.treasuryCoin > 0.01 && roll < 0.42) {
    const [commodity, carried] = saleGood;
    const unitPrice = marketUnitPriceV21(
      world,
      state,
      settlementId,
      commodity,
    );
    const quantity = Math.min(
      carried,
      0.4,
      market.treasuryCoin / Math.max(0.05, unitPrice),
    );
    const coin = quantity * unitPrice;
    if (quantity > 0.001 && coin > 0.001) {
      profile.carriedGoods[commodity] = Math.max(0, carried - quantity);
      market.commodityStocks[commodity] =
        (market.commodityStocks[commodity] ?? 0) + quantity;
      market.treasuryCoin -= coin;
      market.tradeVolume += coin;
      market.lastTradeWorldMinute = world.calendar.elapsedWorldMinutes;
      profile.coinBalance += coin;
      profile.totalCoinEarned += coin;
      profile.lastTradeWorldMinute = world.calendar.elapsedWorldMinutes;
      state.totalTradeVolume += coin;
      agent.resources = clamp01(agent.resources - Math.min(0.12, quantity * 0.2));
      if (
        commodity === 'food' ||
        commodity === 'wood' ||
        commodity === 'stone' ||
        commodity === 'metal' ||
        commodity === 'fuel'
      ) {
        economy.stocks[commodity] += quantity;
      } else if (commodity === 'meat' || commodity === 'herbs') {
        economy.stocks.food += quantity * (commodity === 'meat' ? 0.72 : 0.22);
      }
      recordCarriedTrade(
        world,
        state,
        homeSettlementId,
        settlementId,
        agent.id,
        coin,
      );
      const transaction = pushTransaction(state, {
        kind: 'commodity_sale',
        worldMinute: world.calendar.elapsedWorldMinutes,
        agentId: agent.id,
        physicalPlaceId: agent.locationId,
        settlementId,
        ...(homeSettlementId ? { originSettlementId: homeSettlementId } : {}),
        coin,
        food: 0,
        commodity,
        quantity,
        unitPrice,
      });
      recordTradeEvidenceV21(world, agent, settlementId, commodity, quantity);
      return transaction;
    }
  }

  const saleCandidate = profile.artifactIds
    .map((id) => state.artifactsById[id])
    .filter((artifact): artifact is V19ArtifactState => artifact?.ownerAgentId === agent.id)
    .sort(
      (left, right) =>
        left.potency - right.potency || left.createdWorldMinute - right.createdWorldMinute,
    )[0];
  if (
    saleCandidate &&
    market.inventoryArtifactIds.length < MAX_MARKET_ARTIFACTS_V19 &&
    roll <
      clamp01(
        0.18 +
          (1 - agent.resources) * 0.32 +
          agent.mind.values.ambition * 0.16 +
          Math.max(0, profile.artifactIds.length - 1) * 0.16,
      )
  ) {
    const price = artifactPrice(saleCandidate);
    const coin = Math.min(price, market.treasuryCoin);
    const barterFood =
      coin + 0.001 < price && economy.stocks.food >= 0.16
        ? Math.min(0.22, economy.stocks.food)
        : 0;
    if (coin >= price * 0.55 || barterFood > 0) {
      market.treasuryCoin -= coin;
      economy.stocks.food -= barterFood;
      profile.coinBalance += coin;
      profile.totalCoinEarned += coin;
      agent.resources = clamp01(agent.resources + barterFood * 0.72);
      profile.artifactIds = profile.artifactIds.filter(
        (id) => id !== saleCandidate.id,
      );
      saleCandidate.ownerAgentId = undefined;
      saleCandidate.holderSettlementId = settlementId;
      market.inventoryArtifactIds.push(saleCandidate.id);
      market.artifactsBought += 1;
      const value = coin + barterFood * 3;
      market.tradeVolume += value;
      state.totalTradeVolume += value;
      market.lastTradeWorldMinute = world.calendar.elapsedWorldMinutes;
      profile.lastTradeWorldMinute = world.calendar.elapsedWorldMinutes;
      recordCarriedTrade(
        world,
        state,
        saleCandidate.originSettlementId ?? homeSettlementId,
        settlementId,
        agent.id,
        value,
      );
      const transaction = pushTransaction(state, {
        kind: 'artifact_sale',
        worldMinute: world.calendar.elapsedWorldMinutes,
        agentId: agent.id,
        physicalPlaceId: agent.locationId,
        settlementId,
        ...(saleCandidate.originSettlementId
          ? { originSettlementId: saleCandidate.originSettlementId }
          : {}),
        coin,
        food: barterFood,
        artifactId: saleCandidate.id,
      });
      recordTradeEvidenceV21(world, agent, settlementId, undefined, 1);
      return transaction;
    }
  }

  const purchaseCandidate = market.inventoryArtifactIds
    .map((id) => state.artifactsById[id])
    .filter((artifact): artifact is V19ArtifactState => Boolean(artifact))
    .sort((left, right) => right.potency - left.potency || left.id.localeCompare(right.id))[0];
  if (
    purchaseCandidate &&
    profile.artifactIds.length < MAX_AGENT_ARTIFACTS_V19 &&
    roll < 0.12 + agent.mind.values.ambition * 0.18 + agent.personality.riskTolerance * 0.12
  ) {
    const price = artifactPrice(purchaseCandidate) * 1.08;
    if (profile.coinBalance >= price) {
      profile.coinBalance -= price;
      profile.totalCoinSpent += price;
      market.treasuryCoin += price;
      market.tradeVolume += price;
      market.artifactsSold += 1;
      market.lastTradeWorldMinute = world.calendar.elapsedWorldMinutes;
      profile.lastTradeWorldMinute = world.calendar.elapsedWorldMinutes;
      state.totalTradeVolume += price;
      market.inventoryArtifactIds = market.inventoryArtifactIds.filter(
        (id) => id !== purchaseCandidate.id,
      );
      purchaseCandidate.holderSettlementId = undefined;
      purchaseCandidate.ownerAgentId = agent.id;
      profile.artifactIds.push(purchaseCandidate.id);
      recordCarriedTrade(
        world,
        state,
        purchaseCandidate.originSettlementId,
        settlementId,
        agent.id,
        price,
      );
      const transaction = pushTransaction(state, {
        kind: 'artifact_purchase',
        worldMinute: world.calendar.elapsedWorldMinutes,
        agentId: agent.id,
        physicalPlaceId: agent.locationId,
        settlementId,
        ...(purchaseCandidate.originSettlementId
          ? { originSettlementId: purchaseCandidate.originSettlementId }
          : {}),
        coin: price,
        food: 0,
        artifactId: purchaseCandidate.id,
      });
      recordTradeEvidenceV21(world, agent, settlementId, undefined, 1);
      return transaction;
    }
  }
  return undefined;
}

function finiteNonNegative(value: number, path: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${path} must be a finite non-negative number.`);
  }
}

export function assertAdventureEconomyV19(world: Readonly<WorldState>): void {
  const state = world.v19?.adventureEconomy;
  if (!state || state.version !== ADVENTURE_ECONOMY_VERSION_V19) {
    throw new Error('World v19 adventure economy is missing or invalid.');
  }
  if (
    Object.keys(state.dungeonsById).length > MAX_DUNGEONS_V19 ||
    Object.keys(state.artifactsById).length > MAX_ARTIFACTS_V19 ||
    state.recentRuns.length > MAX_RECENT_DUNGEON_RUNS_V19 ||
    state.recentTransactions.length > MAX_RECENT_ADVENTURE_TRANSACTIONS_V19
  ) {
    throw new Error('World v19 adventure economy exceeds a bounded limit.');
  }
  finiteNonNegative(state.totalRuns, 'Adventure totalRuns');
  finiteNonNegative(state.totalSuccessfulRuns, 'Adventure totalSuccessfulRuns');
  finiteNonNegative(state.totalCoinRecovered, 'Adventure totalCoinRecovered');
  finiteNonNegative(state.totalTradeVolume, 'Adventure totalTradeVolume');
  for (const dungeon of Object.values(state.dungeonsById)) {
    if (!world.places[dungeon.entrancePlaceId]) {
      throw new Error(`Dungeon ${dungeon.id} has no physical entrance.`);
    }
    if (dungeon.treasureReserve > dungeon.treasureCapacity + 1e-9) {
      throw new Error(`Dungeon ${dungeon.id} exceeds its treasure capacity.`);
    }
    finiteNonNegative(dungeon.treasureReserve, `Dungeon ${dungeon.id}.treasureReserve`);
    if (
      dungeon.formationProgress < 0 ||
      dungeon.formationProgress > 1 ||
      dungeon.active !== (dungeon.formationProgress >= 0.2)
    ) {
      throw new Error(`Dungeon ${dungeon.id} has invalid formation state.`);
    }
  }
  for (const [agentId, profile] of Object.entries(state.adventurersByAgentId)) {
    if (!world.agents[agentId] || profile.agentId !== agentId) {
      throw new Error(`Adventure profile ${agentId} references a missing resident.`);
    }
    if (
      profile.artifactIds.length > MAX_AGENT_ARTIFACTS_V19 ||
      profile.abilities.length > MAX_AGENT_ABILITIES_V19 ||
      profile.rank !== adventureRankForPointsV19(profile.rankPoints)
    ) {
      throw new Error(`Adventure profile ${agentId} is invalid.`);
    }
    finiteNonNegative(profile.coinBalance, `Adventure profile ${agentId}.coinBalance`);
  }
  for (const artifact of Object.values(state.artifactsById)) {
    const ownershipCount = Number(Boolean(artifact.ownerAgentId)) + Number(Boolean(artifact.holderSettlementId));
    if (ownershipCount !== 1 || !state.dungeonsById[artifact.originDungeonId]) {
      throw new Error(`Artifact ${artifact.id} has invalid provenance or ownership.`);
    }
    if (artifact.ownerAgentId && !world.agents[artifact.ownerAgentId]) {
      throw new Error(`Artifact ${artifact.id} references a missing owner.`);
    }
    if (
      artifact.ownerAgentId &&
      !state.adventurersByAgentId[artifact.ownerAgentId]?.artifactIds.includes(
        artifact.id,
      )
    ) {
      throw new Error(`Artifact ${artifact.id} is absent from its owner's inventory.`);
    }
    if (artifact.holderSettlementId && !world.settlements[artifact.holderSettlementId]) {
      throw new Error(`Artifact ${artifact.id} references a missing market.`);
    }
    if (
      artifact.holderSettlementId &&
      !state.settlementMarketsById[
        artifact.holderSettlementId
      ]?.inventoryArtifactIds.includes(artifact.id)
    ) {
      throw new Error(`Artifact ${artifact.id} is absent from its market inventory.`);
    }
  }
  for (const [settlementId, market] of Object.entries(state.settlementMarketsById)) {
    if (!world.settlements[settlementId] || market.settlementId !== settlementId) {
      throw new Error(`Adventure market ${settlementId} is stale.`);
    }
    if (market.inventoryArtifactIds.length > MAX_MARKET_ARTIFACTS_V19) {
      throw new Error(`Adventure market ${settlementId} exceeds its inventory bound.`);
    }
    finiteNonNegative(market.treasuryCoin, `Adventure market ${settlementId}.treasuryCoin`);
    for (const quantity of Object.values(market.commodityStocks)) {
      finiteNonNegative(quantity ?? 0, `Adventure market ${settlementId}.commodityStocks`);
    }
  }
  for (const run of state.recentRuns) {
    if (
      !world.agents[run.agentId] ||
      !state.dungeonsById[run.dungeonId] ||
      run.entrancePlaceId !== state.dungeonsById[run.dungeonId].entrancePlaceId ||
      run.voluntary !== true
    ) {
      throw new Error(`Dungeon run ${run.id} has invalid physical evidence.`);
    }
  }
  assertEmergentSocietyV21(world, state);
}
