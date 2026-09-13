import { ensureSettlementEconomyV16 } from '../v16/SocietyFoundationV16';
import type {
  AgentActionKind,
  AgentState,
  V16MaterialKind,
  WorldState,
} from '../world/types';
import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';
import type {
  V19AdventureEconomyState,
  V19AdventureRank,
  V19ArchetypeKind,
  V19CommodityKind,
  V19ContractKind,
  V19ContractState,
  V19EmergentSocietyState,
  V19GuildState,
  V19LocalReputationState,
  V19MarketPriceSignalState,
  V19PracticeDisciplineState,
  V19PracticeDomain,
  V19RecognizedProfessionState,
  V19ResidentSocietyState,
} from '../v19/types';

export const EMERGENT_SOCIETY_VERSION_V21 = 'emergent-society-v21' as const;
export const MAX_CONTRACTS_V21 = 256;
export const MAX_GUILDS_V21 = 96;
export const MAX_PROFESSIONS_V21 = 2_048;
export const MAX_RESIDENT_CONTRACT_HISTORY_V21 = 32;

const PRACTICE_DOMAINS = [
  'farmer',
  'forager',
  'woodcutter',
  'miner',
  'fisher',
  'hunter',
  'artisan',
  'smith',
  'builder',
  'caregiver',
  'scout',
  'cartographer',
  'adventurer',
  'teacher',
  'scribe',
  'guard',
  'warrior',
  'spiritual_keeper',
] as const satisfies readonly Exclude<V19PracticeDomain, 'trader'>[];

const COMMODITIES = [
  'food',
  'wood',
  'stone',
  'metal',
  'fuel',
  'meat',
  'hide',
  'herbs',
  'monster_part',
  'rare_mineral',
] as const satisfies readonly V19CommodityKind[];

const MATERIALS = [
  'food',
  'wood',
  'stone',
  'metal',
  'fuel',
] as const satisfies readonly V16MaterialKind[];

const DOMAIN_LABEL: Readonly<Record<V19PracticeDomain, string>> = {
  farmer: 'земледелец',
  forager: 'собиратель',
  woodcutter: 'лесоруб',
  miner: 'рудокоп',
  fisher: 'рыбак',
  hunter: 'охотник',
  artisan: 'ремесленник',
  smith: 'кузнец',
  builder: 'строитель',
  caregiver: 'целитель',
  scout: 'разведчик',
  cartographer: 'картограф',
  adventurer: 'искатель',
  teacher: 'наставник',
  scribe: 'писец',
  guard: 'страж',
  warrior: 'воин',
  spiritual_keeper: 'хранитель традиций',
  trader: 'торговец',
};

const BASE_PRICE: Readonly<Record<V19CommodityKind, number>> = {
  food: 1,
  wood: 0.72,
  stone: 0.82,
  metal: 2.6,
  fuel: 0.64,
  meat: 1.25,
  hide: 1.55,
  herbs: 1.8,
  monster_part: 4.8,
  rare_mineral: 5.6,
};

const NECESSITY: Readonly<Record<V19CommodityKind, number>> = {
  food: 1,
  wood: 0.72,
  stone: 0.55,
  metal: 0.64,
  fuel: 0.76,
  meat: 0.82,
  hide: 0.38,
  herbs: 0.68,
  monster_part: 0.18,
  rare_mineral: 0.22,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function finiteNonNegative(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function settlementOf(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
): string | undefined {
  return world.places[agent.homeId]?.settlementId ??
    world.places[agent.locationId]?.settlementId;
}

function emptyReputation(
  settlementId: string,
  worldMinute: number,
): V19LocalReputationState {
  return {
    settlementId,
    trust: 0.5,
    reliability: 0.5,
    provenCompetence: 0,
    completedContracts: 0,
    failedContracts: 0,
    rescuedPeople: 0,
    groupLosses: 0,
    crimes: 0,
    unpaidDebts: 0,
    recommendations: 0,
    lastEvidenceWorldMinute: worldMinute,
  };
}

function masteryFromPractice(practice: number): number {
  return clamp01(1 - Math.exp(-Math.max(0, practice) / 72));
}

function emptyResidentSociety(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
): V19ResidentSocietyState {
  const practices = world.v18?.livelihoodByAgentId[agent.id]?.practiceByKind;
  const disciplinesByDomain: V19ResidentSocietyState['disciplinesByDomain'] = {};
  for (const domain of PRACTICE_DOMAINS) {
    const practice = finiteNonNegative(practices?.[domain]);
    if (practice <= 0) continue;
    disciplinesByDomain[domain] = {
      domain,
      lifetimePractice: practice,
      currentMastery: masteryFromPractice(practice),
      practiceEvents: Math.floor(practice),
      mentorIds: [],
      observedPractice: practice,
      ...(world.v18?.livelihoodByAgentId[agent.id]?.lastPracticedWorldMinute ===
      undefined
        ? {}
        : {
            lastPracticedWorldMinute:
              world.v18.livelihoodByAgentId[agent.id].lastPracticedWorldMinute,
          }),
    };
  }
  return {
    agentId: agent.id,
    disciplinesByDomain,
    archetypes: [],
    localReputationBySettlementId: {},
    completedContractIds: [],
    failedContractIds: [],
    lastUpdatedWorldMinute: world.calendar.elapsedWorldMinutes,
  };
}

function ensureDiscipline(
  profile: V19ResidentSocietyState,
  domain: V19PracticeDomain,
): V19PracticeDisciplineState {
  return (profile.disciplinesByDomain[domain] ??= {
    domain,
    lifetimePractice: 0,
    currentMastery: 0,
    practiceEvents: 0,
    mentorIds: [],
    observedPractice: 0,
  });
}

function ensureResidentSociety(
  world: Readonly<WorldState>,
  society: V19EmergentSocietyState,
  agent: Readonly<AgentState>,
): V19ResidentSocietyState {
  return (society.residentsByAgentId[agent.id] ??=
    emptyResidentSociety(world, agent));
}

function deriveArchetypes(
  agent: Readonly<AgentState>,
  profile: Readonly<V19ResidentSocietyState>,
): V19ArchetypeKind[] {
  const mastery = (domain: V19PracticeDomain): number =>
    profile.disciplinesByDomain[domain]?.currentMastery ?? 0;
  const combat =
    agent.skills.hunting * 0.28 +
    (agent.progression?.combatMastery ?? 0) * 0.4 +
    agent.life.physiology.strength * 0.18 +
    agent.life.physiology.endurance * 0.14;
  const result: V19ArchetypeKind[] = [];
  if (combat >= 0.52 || mastery('warrior') >= 0.35) result.push('fighter');
  if (
    combat >= 0.62 &&
    agent.life.physiology.strength >= 0.68 &&
    agent.life.physiology.endurance >= 0.66 &&
    (mastery('guard') >= 0.18 || mastery('warrior') >= 0.25)
  ) {
    result.push('heavy_fighter');
  }
  if (
    agent.skills.exploration >= 0.48 ||
    mastery('scout') >= 0.28 ||
    mastery('cartographer') >= 0.28
  ) result.push('scout');
  if (agent.skills.hunting >= 0.48 || mastery('hunter') >= 0.3) {
    result.push('hunter');
  }
  if (mastery('caregiver') >= 0.3) result.push('healer');
  if (
    agent.skills.craft >= 0.5 ||
    Math.max(mastery('artisan'), mastery('smith'), mastery('builder')) >= 0.32
  ) result.push('craft_specialist');
  if (mastery('trader') >= 0.24) result.push('merchant');
  if (
    agent.skills.social >= 0.58 &&
    agent.mind.values.care + agent.mind.values.ambition >= 1.05
  ) result.push('leader');
  return result.slice(0, 4);
}

function professionFor(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
  profile: V19ResidentSocietyState,
): V19RecognizedProfessionState | undefined {
  const settlementId = settlementOf(world, agent);
  if (!settlementId) return undefined;
  const ranked = Object.values(profile.disciplinesByDomain)
    .filter((entry): entry is V19PracticeDisciplineState => entry !== undefined)
    .sort(
      (left, right) =>
        right.currentMastery - left.currentMastery ||
        right.lifetimePractice - left.lifetimePractice ||
        left.domain.localeCompare(right.domain),
    );
  const primary = ranked[0];
  if (!primary || primary.lifetimePractice < 6 || primary.currentMastery < 0.07) {
    return undefined;
  }
  const evidence = world.v16?.residentEvidenceByAgentId[agent.id];
  const witnessCount = Object.keys(evidence?.contactCounts ?? {}).length;
  if (witnessCount < 2 && primary.practiceEvents < 12) return undefined;
  const secondary = ranked.find(
    (entry, index) =>
      index > 0 &&
      entry.lifetimePractice >= 5 &&
      entry.currentMastery >= primary.currentMastery * 0.62,
  );
  const title = secondary
    ? `${DOMAIN_LABEL[primary.domain]}-${DOMAIN_LABEL[secondary.domain]}`
    : DOMAIN_LABEL[primary.domain];
  return {
    id: `profession:${settlementId}:${agent.id}`,
    agentId: agent.id,
    settlementId,
    title,
    primaryDomain: primary.domain,
    ...(secondary ? { secondaryDomain: secondary.domain } : {}),
    recognizedWorldMinute: world.calendar.elapsedWorldMinutes,
    evidenceCount: Math.max(primary.practiceEvents, Math.floor(primary.lifetimePractice)),
    witnessCount,
  };
}

function updateResidentPractice(
  world: Readonly<WorldState>,
  society: V19EmergentSocietyState,
  agent: Readonly<AgentState>,
  elapsedYears: number,
): void {
  const now = world.calendar.elapsedWorldMinutes;
  const profile = ensureResidentSociety(world, society, agent);
  const livelihood = world.v18?.livelihoodByAgentId[agent.id];
  for (const domain of PRACTICE_DOMAINS) {
    const observed = finiteNonNegative(livelihood?.practiceByKind[domain]);
    const discipline = ensureDiscipline(profile, domain);
    const gained = Math.max(0, observed - discipline.observedPractice);
    if (gained > 1e-9) {
      discipline.lifetimePractice += gained;
      discipline.practiceEvents += Math.max(1, Math.round(gained));
      discipline.currentMastery = clamp01(
        discipline.currentMastery +
          gained * 0.0075 * (1 - discipline.currentMastery * 0.58),
      );
      discipline.lastPracticedWorldMinute = now;
      for (const mentorId of livelihood?.mentorIds ?? []) {
        if (
          mentorId !== agent.id &&
          world.agents[mentorId] &&
          !discipline.mentorIds.includes(mentorId)
        ) discipline.mentorIds.push(mentorId);
      }
      discipline.mentorIds = discipline.mentorIds.slice(-12);
    } else if (
      discipline.lastPracticedWorldMinute !== undefined &&
      now - discipline.lastPracticedWorldMinute > 2 * WORLD_MINUTES_PER_YEAR
    ) {
      // Long-term memory remains in lifetimePractice; only immediately usable
      // mastery softens when a craft is abandoned for years.
      discipline.currentMastery = Math.max(
        masteryFromPractice(observed) * 0.35,
        discipline.currentMastery * Math.pow(0.985, elapsedYears),
      );
    }
    discipline.observedPractice = observed;
  }
  profile.archetypes = deriveArchetypes(agent, profile);
  profile.lastUpdatedWorldMinute = now;
  const recognized = professionFor(world, agent, profile);
  if (recognized) {
    const prior = society.professionsById[recognized.id];
    society.professionsById[recognized.id] = prior
      ? {
          ...recognized,
          recognizedWorldMinute: prior.recognizedWorldMinute,
        }
      : recognized;
    profile.recognizedProfessionId = recognized.id;
  }
}

function settlementResidents(
  world: Readonly<WorldState>,
  settlementId: string,
): AgentState[] {
  return Object.values(world.agents).filter(
    (agent) =>
      agent.life.alive &&
      world.places[agent.homeId]?.settlementId === settlementId,
  );
}

function desiredStock(material: V16MaterialKind, residents: number): number {
  const perResident: Record<V16MaterialKind, number> = {
    food: 0.12,
    wood: 0.06,
    stone: 0.04,
    metal: 0.008,
    fuel: 0.025,
  };
  const floor: Record<V16MaterialKind, number> = {
    food: 1,
    wood: 0.55,
    stone: 0.35,
    metal: 0.12,
    fuel: 0.18,
  };
  return Math.max(floor[material], residents * perResident[material]);
}

function sourceDistanceAndRisk(
  world: Readonly<WorldState>,
  settlementId: string,
  commodity: V19CommodityKind,
): { distanceKm: number; risk: number } {
  const origin = world.settlements[settlementId];
  if (!origin) return { distanceKm: 0, risk: 0 };
  const material = MATERIALS.includes(commodity as V16MaterialKind)
    ? (commodity as V16MaterialKind)
    : undefined;
  const candidates = Object.values(world.settlements)
    .filter((candidate) => candidate.id !== settlementId)
    .map((candidate) => {
      const economy = world.v16?.settlementEconomyById[candidate.id];
      const supply = material
        ? finiteNonNegative(economy?.stocks[material]) /
          Math.max(0.01, desiredStock(material, settlementResidents(world, candidate.id).length))
        : 0.5;
      const distanceKm =
        Math.hypot(candidate.centerX - origin.centerX, candidate.centerY - origin.centerY) /
        1_000;
      return { candidate, supply, distanceKm };
    })
    .filter((entry) => entry.supply >= 0.85)
    .sort(
      (left, right) =>
        left.distanceKm - right.distanceKm ||
        left.candidate.id.localeCompare(right.candidate.id),
    );
  const nearest = candidates[0];
  if (!nearest) return { distanceKm: 0, risk: 0.12 };
  const originDanger = world.places[origin.centerPlaceId]?.danger ?? 0;
  const targetDanger = world.places[nearest.candidate.centerPlaceId]?.danger ?? 0;
  const relation = Object.values(world.v16?.settlementRelations ?? {}).find(
    (item) =>
      (item.settlementA === settlementId &&
        item.settlementB === nearest.candidate.id) ||
      (item.settlementB === settlementId &&
        item.settlementA === nearest.candidate.id),
  );
  const conflictRisk = relation ? clamp01(relation.hostility) : 0.08;
  return {
    distanceKm: nearest.distanceKm,
    risk: clamp01(
      (originDanger + targetDanger) * 0.28 +
        conflictRisk * 0.38 +
        Math.min(0.28, nearest.distanceKm / 1_000),
    ),
  };
}

function marketKey(settlementId: string, commodity: V19CommodityKind): string {
  return `${settlementId}:${commodity}`;
}

function marketSignal(
  world: Readonly<WorldState>,
  economy: Readonly<V19AdventureEconomyState>,
  settlementId: string,
  commodity: V19CommodityKind,
): V19MarketPriceSignalState {
  const residents = settlementResidents(world, settlementId);
  const settlementEconomy = world.v16?.settlementEconomyById[settlementId];
  const market = economy.settlementMarketsById[settlementId];
  const isMaterial = MATERIALS.includes(commodity as V16MaterialKind);
  const material = commodity as V16MaterialKind;
  const supply = isMaterial
    ? finiteNonNegative(settlementEconomy?.stocks[material])
    : finiteNonNegative(market?.commodityStocks[commodity]);
  const target = isMaterial
    ? desiredStock(material, residents.length)
    : Math.max(0.2, residents.length * (commodity === 'meat' ? 0.025 : 0.008));
  const scarcity = clamp01(1 - supply / Math.max(0.01, target));
  const { distanceKm, risk } = sourceDistanceAndRisk(
    world,
    settlementId,
    commodity,
  );
  const craftQuality = residents.length
    ? residents.reduce(
        (sum, resident) => sum + resident.skills.craft * 0.65 + resident.skills.gathering * 0.35,
        0,
      ) / residents.length
    : 0.35;
  const localEconomy = world.v16?.settlementEconomyById[settlementId];
  const inventionCount = Object.values(world.v15?.smithingInnovations ?? {}).filter(
    (innovation) =>
      world.places[world.agents[innovation.inventorAgentId]?.homeId ?? '']
        ?.settlementId === settlementId,
  ).length;
  const toolEfficiency = clamp01(
    ((localEconomy?.farmingTools ?? 0) +
      (localEconomy?.constructionTools ?? 0) +
      inventionCount * 0.8) /
      Math.max(4, residents.length / 3),
  );
  const necessity = NECESSITY[commodity];
  const demand = clamp01(scarcity * 0.68 + necessity * 0.32);
  const quality = clamp01(0.4 + craftQuality * 0.46 + toolEfficiency * 0.14);
  const price = BASE_PRICE[commodity] *
    (0.48 +
      scarcity * 1.5 +
      demand * 0.72 +
      risk * 0.62 +
      Math.min(0.5, distanceKm / 600) +
      necessity * 0.48 -
      toolEfficiency * (commodity === 'food' || commodity === 'wood' ? 0.12 : 0.05)) *
    (0.8 + quality * 0.4);
  return {
    settlementId,
    commodity,
    unitPrice: Math.max(0.05, Math.min(50, price)),
    supply,
    demand,
    scarcity,
    deliveryDistanceKm: distanceKm,
    deliveryRisk: risk,
    quality,
    necessity,
    updatedWorldMinute: world.calendar.elapsedWorldMinutes,
  };
}

function refreshMarkets(
  world: Readonly<WorldState>,
  economy: V19AdventureEconomyState,
  society: V19EmergentSocietyState,
): void {
  for (const settlementId of Object.keys(world.settlements).sort()) {
    for (const commodity of COMMODITIES) {
      const signal = marketSignal(world, economy, settlementId, commodity);
      society.marketPricesByKey[marketKey(settlementId, commodity)] = signal;
    }
  }
  for (const key of Object.keys(society.marketPricesByKey)) {
    if (!world.settlements[society.marketPricesByKey[key].settlementId]) {
      delete society.marketPricesByKey[key];
    }
  }
}

export function marketUnitPriceV21(
  world: Readonly<WorldState>,
  economy: V19AdventureEconomyState,
  settlementId: string,
  commodity: V19CommodityKind,
): number {
  const society = repairEmergentSocietyV21(world, economy);
  const key = marketKey(settlementId, commodity);
  const old = society.marketPricesByKey[key];
  if (
    !old ||
    world.calendar.elapsedWorldMinutes - old.updatedWorldMinute >=
      WORLD_MINUTES_PER_YEAR / 12
  ) {
    society.marketPricesByKey[key] = marketSignal(
      world,
      economy,
      settlementId,
      commodity,
    );
  }
  return society.marketPricesByKey[key]?.unitPrice ?? BASE_PRICE[commodity];
}

function rankIndex(rank: V19AdventureRank): number {
  return ['unranked', 'F', 'E', 'D', 'C', 'B', 'A', 'S'].indexOf(rank);
}

export function socialRankForEvidenceV21(points: number): V19AdventureRank {
  if (points >= 260) return 'S';
  if (points >= 160) return 'A';
  if (points >= 95) return 'B';
  if (points >= 50) return 'C';
  if (points >= 22) return 'D';
  if (points >= 8) return 'E';
  if (points >= 1) return 'F';
  return 'unranked';
}

function issuerFor(
  world: Readonly<WorldState>,
  settlementId: string,
): AgentState | undefined {
  return settlementResidents(world, settlementId)
    .filter(
      (agent) =>
        agent.life.stage === 'adult' &&
        agent.personality.sociability * 0.28 +
          agent.personality.diligence * 0.24 +
          agent.mind.values.care * 0.24 +
          agent.mind.values.ambition * 0.24 >=
          0.5,
    )
    .sort(
      (left, right) =>
        right.skills.social - left.skills.social ||
        right.personality.diligence - left.personality.diligence ||
        left.id.localeCompare(right.id),
    )[0];
}

function openContractExists(
  society: Readonly<V19EmergentSocietyState>,
  settlementId: string,
  kind: V19ContractKind,
  commodity?: V19CommodityKind,
  targetPlaceId?: string,
): boolean {
  return Object.values(society.contractsById).some(
    (contract) =>
      contract.issuerSettlementId === settlementId &&
      contract.kind === kind &&
      contract.commodity === commodity &&
      contract.targetPlaceId === targetPlaceId &&
      (contract.status === 'open' || contract.status === 'accepted'),
  );
}

function addContract(
  world: Readonly<WorldState>,
  economy: Readonly<V19AdventureEconomyState>,
  society: V19EmergentSocietyState,
  input: Omit<V19ContractState, 'id' | 'offeredWorldMinute' | 'expiresWorldMinute'>,
): void {
  const now = world.calendar.elapsedWorldMinutes;
  const guild = Object.values(society.guildsById).find(
    (candidate) => candidate.settlementId === input.issuerSettlementId,
  );
  const id = `contract:v21:${society.nextContractSequence++}`;
  const contract: V19ContractState = {
    id,
    ...input,
    ...(guild ? { issuerKind: 'guild', guildId: guild.id } : {}),
    offeredWorldMinute: now,
    expiresWorldMinute: now + WORLD_MINUTES_PER_YEAR * 2,
  };
  society.contractsById[id] = contract;
  if (guild) {
    guild.contractIds.push(id);
    guild.contractIds = guild.contractIds.slice(-64);
  }
  void economy;
}

function generateContracts(
  world: Readonly<WorldState>,
  economy: V19AdventureEconomyState,
  society: V19EmergentSocietyState,
): void {
  const now = world.calendar.elapsedWorldMinutes;
  for (const contract of Object.values(society.contractsById)) {
    if (
      (contract.status === 'open' || contract.status === 'accepted') &&
      now >= contract.expiresWorldMinute
    ) {
      contract.status = 'expired';
      contract.resolvedWorldMinute = now;
    }
  }
  for (const settlementId of Object.keys(world.settlements).sort()) {
    const issuer = issuerFor(world, settlementId);
    if (!issuer) continue;
    const market = economy.settlementMarketsById[settlementId];
    const materialNeed = MATERIALS
      .map((commodity) =>
        society.marketPricesByKey[marketKey(settlementId, commodity)],
      )
      .filter((signal): signal is V19MarketPriceSignalState => Boolean(signal))
      .sort(
        (left, right) =>
          right.scarcity * right.necessity - left.scarcity * left.necessity ||
          left.commodity.localeCompare(right.commodity),
      )[0];
    if (
      materialNeed &&
      materialNeed.scarcity >= 0.42 &&
      !openContractExists(
        society,
        settlementId,
        materialNeed.commodity === 'metal' || materialNeed.commodity === 'stone'
          ? 'mining'
          : 'delivery',
        materialNeed.commodity,
      )
    ) {
      const quantity = Math.max(0.12, materialNeed.demand * 0.8);
      const rewardCoin = Math.min(
        finiteNonNegative(market?.treasuryCoin) * 0.18,
        quantity * materialNeed.unitPrice * (1 + materialNeed.deliveryRisk * 0.35),
      );
      addContract(world, economy, society, {
        kind:
          materialNeed.commodity === 'metal' || materialNeed.commodity === 'stone'
            ? 'mining'
            : 'delivery',
        status: 'open',
        issuerKind: 'resident',
        issuerAgentId: issuer.id,
        issuerSettlementId: settlementId,
        commodity: materialNeed.commodity,
        requestedQuantity: quantity,
        deliveredQuantity: 0,
        danger: materialNeed.deliveryRisk,
        rewardCoin,
        rewardFood:
          rewardCoin < 0.1
            ? Math.min(0.2, finiteNonNegative(world.v16?.settlementEconomyById[settlementId]?.stocks.food) * 0.04)
            : 0,
        minimumRank: materialNeed.deliveryRisk >= 0.55 ? 'E' : 'F',
        evidence: [
          `scarcity:${materialNeed.scarcity.toFixed(3)}`,
          `distance_km:${materialNeed.deliveryDistanceKm.toFixed(2)}`,
          `risk:${materialNeed.deliveryRisk.toFixed(3)}`,
        ],
      });
    }

    const center = world.places[world.settlements[settlementId].centerPlaceId];
    const nearbyDungeon = Object.values(economy.dungeonsById)
      .filter((dungeon) => dungeon.active)
      .sort((left, right) => {
        const leftPlace = world.places[left.entrancePlaceId];
        const rightPlace = world.places[right.entrancePlaceId];
        return (
          Math.hypot(
            (leftPlace?.mapX ?? 0) - (center?.mapX ?? 0),
            (leftPlace?.mapY ?? 0) - (center?.mapY ?? 0),
          ) -
            Math.hypot(
              (rightPlace?.mapX ?? 0) - (center?.mapX ?? 0),
              (rightPlace?.mapY ?? 0) - (center?.mapY ?? 0),
            ) || left.id.localeCompare(right.id)
        );
      })[0];
    if (
      nearbyDungeon &&
      nearbyDungeon.threat >= 0.3 &&
      !openContractExists(
        society,
        settlementId,
        'dungeon_clear',
        undefined,
        nearbyDungeon.entrancePlaceId,
      )
    ) {
      const rank = nearbyDungeon.threat >= 0.72 ? 'D' : nearbyDungeon.threat >= 0.5 ? 'E' : 'F';
      addContract(world, economy, society, {
        kind: 'dungeon_clear',
        status: 'open',
        issuerKind: 'resident',
        issuerAgentId: issuer.id,
        issuerSettlementId: settlementId,
        targetPlaceId: nearbyDungeon.entrancePlaceId,
        requestedQuantity: 1,
        deliveredQuantity: 0,
        danger: nearbyDungeon.threat,
        rewardCoin: Math.min(
          finiteNonNegative(market?.treasuryCoin) * 0.22,
          0.8 + nearbyDungeon.threat * 2.4,
        ),
        rewardFood: 0,
        minimumRank: rank,
        evidence: [
          `physical_entrance:${nearbyDungeon.entrancePlaceId}`,
          `threat:${nearbyDungeon.threat.toFixed(3)}`,
          `formation:${nearbyDungeon.formationStage}`,
        ],
      });
    }
  }

  const resolved = Object.values(society.contractsById)
    .filter((contract) => !['open', 'accepted'].includes(contract.status))
    .sort(
      (left, right) =>
        (left.resolvedWorldMinute ?? 0) - (right.resolvedWorldMinute ?? 0) ||
        left.id.localeCompare(right.id),
    );
  while (Object.keys(society.contractsById).length > MAX_CONTRACTS_V21) {
    const oldest = resolved.shift();
    if (!oldest) break;
    delete society.contractsById[oldest.id];
  }
}

function guildFocus(
  professions: readonly V19RecognizedProfessionState[],
): V19GuildState['focus'] {
  const domains = new Set(professions.map((profession) => profession.primaryDomain));
  if ([...domains].some((domain) => ['adventurer', 'scout', 'hunter', 'guard', 'warrior'].includes(domain))) {
    return 'adventure';
  }
  if (domains.has('trader') || domains.has('cartographer')) return 'trade';
  if ([...domains].some((domain) => ['artisan', 'smith', 'builder'].includes(domain))) return 'craft';
  return 'mixed';
}

function formGuilds(
  world: Readonly<WorldState>,
  economy: Readonly<V19AdventureEconomyState>,
  society: V19EmergentSocietyState,
): void {
  if (Object.keys(society.guildsById).length >= MAX_GUILDS_V21) return;
  for (const settlementId of Object.keys(world.settlements).sort()) {
    if (Object.values(society.guildsById).some((guild) => guild.settlementId === settlementId)) {
      continue;
    }
    const professions = Object.values(society.professionsById).filter(
      (profession) => profession.settlementId === settlementId,
    );
    const candidates = professions
      .map((profession) => world.agents[profession.agentId])
      .filter(
        (agent): agent is AgentState =>
          Boolean(agent?.life.alive) &&
          (agent.personality.sociability + agent.mind.values.ambition) / 2 >= 0.48,
      );
    const connected = candidates.filter((agent) => {
      const constructive = world.v16?.residentEvidenceByAgentId[agent.id]
        ?.constructiveContactCounts ?? {};
      return candidates.some(
        (other) => other.id !== agent.id && finiteNonNegative(constructive[other.id]) >= 2,
      );
    });
    const completedContracts = Object.values(society.contractsById).filter(
      (contract) =>
        contract.issuerSettlementId === settlementId && contract.status === 'completed',
    ).length;
    const market = economy.settlementMarketsById[settlementId];
    const collectiveEvidence =
      completedContracts + economy.totalSuccessfulRuns + Math.floor((market?.tradeVolume ?? 0) / 4);
    if (connected.length < 4 || collectiveEvidence < 3) continue;
    const founders = connected
      .sort(
        (left, right) =>
          right.skills.social - left.skills.social || left.id.localeCompare(right.id),
      )
      .slice(0, 8);
    const founderProfessions = professions.filter((profession) =>
      founders.some((founder) => founder.id === profession.agentId),
    );
    const focus = guildFocus(founderProfessions);
    const focusName: Record<V19GuildState['focus'], string> = {
      adventure: 'Гильдия искателей',
      trade: 'Торговое товарищество',
      craft: 'Союз мастеров',
      mixed: 'Вольное товарищество',
    };
    const id = `guild:v21:${society.nextGuildSequence++}`;
    society.guildsById[id] = {
      id,
      name: `${focusName[focus]} · ${world.settlements[settlementId].name}`,
      settlementId,
      focus,
      founderAgentIds: founders.map((agent) => agent.id),
      memberAgentIds: founders.map((agent) => agent.id),
      foundedWorldMinute: world.calendar.elapsedWorldMinutes,
      contractIds: [],
      reputation: clamp01(0.35 + collectiveEvidence * 0.025),
    };
  }
}

export function createEmergentSocietyV21(
  world: Readonly<WorldState>,
): V19EmergentSocietyState {
  const society: V19EmergentSocietyState = {
    version: EMERGENT_SOCIETY_VERSION_V21,
    residentsByAgentId: {},
    professionsById: {},
    marketPricesByKey: {},
    contractsById: {},
    guildsById: {},
    lastAdvancedWorldMinute: world.calendar.elapsedWorldMinutes,
    nextContractSequence: 1,
    nextGuildSequence: 1,
  };
  for (const agent of Object.values(world.agents)) {
    society.residentsByAgentId[agent.id] = emptyResidentSociety(world, agent);
  }
  return society;
}

export function repairEmergentSocietyV21(
  world: Readonly<WorldState>,
  economy: V19AdventureEconomyState,
): V19EmergentSocietyState {
  const society = (economy.emergentSociety ??= createEmergentSocietyV21(world));
  society.version = EMERGENT_SOCIETY_VERSION_V21;
  society.residentsByAgentId ??= {};
  society.professionsById ??= {};
  society.marketPricesByKey ??= {};
  society.contractsById ??= {};
  society.guildsById ??= {};
  society.lastAdvancedWorldMinute = finiteNonNegative(
    society.lastAdvancedWorldMinute,
    world.calendar.elapsedWorldMinutes,
  );
  society.nextContractSequence = Math.max(
    1,
    Math.floor(finiteNonNegative(society.nextContractSequence, 1)),
  );
  society.nextGuildSequence = Math.max(
    1,
    Math.floor(finiteNonNegative(society.nextGuildSequence, 1)),
  );
  for (const agent of Object.values(world.agents)) {
    const profile = ensureResidentSociety(world, society, agent);
    profile.agentId = agent.id;
    profile.disciplinesByDomain ??= {};
    profile.archetypes ??= [];
    profile.localReputationBySettlementId ??= {};
    profile.completedContractIds ??= [];
    profile.failedContractIds ??= [];
    profile.lastUpdatedWorldMinute = finiteNonNegative(
      profile.lastUpdatedWorldMinute,
      world.calendar.elapsedWorldMinutes,
    );
    for (const [domain, raw] of Object.entries(profile.disciplinesByDomain)) {
      const discipline = raw as V19PracticeDisciplineState;
      discipline.domain = domain as V19PracticeDomain;
      discipline.lifetimePractice = finiteNonNegative(discipline.lifetimePractice);
      discipline.currentMastery = clamp01(finiteNonNegative(discipline.currentMastery));
      discipline.practiceEvents = Math.floor(finiteNonNegative(discipline.practiceEvents));
      discipline.mentorIds = [...new Set(discipline.mentorIds ?? [])]
        .filter((id) => id !== agent.id && world.agents[id] !== undefined)
        .slice(-12);
      discipline.observedPractice = finiteNonNegative(discipline.observedPractice);
    }
  }
  for (const [id, profession] of Object.entries(society.professionsById)) {
    if (!world.agents[profession.agentId] || !world.settlements[profession.settlementId]) {
      delete society.professionsById[id];
    }
  }
  for (const [id, guild] of Object.entries(society.guildsById)) {
    if (!world.settlements[guild.settlementId]) {
      delete society.guildsById[id];
      continue;
    }
    guild.founderAgentIds = [...new Set(guild.founderAgentIds ?? [])]
      .filter((agentId) => world.agents[agentId] !== undefined)
      .slice(-8);
    guild.memberAgentIds = [...new Set(guild.memberAgentIds ?? [])]
      .filter((agentId) => world.agents[agentId] !== undefined)
      .slice(-64);
    guild.contractIds = [...new Set(guild.contractIds ?? [])].slice(-64);
    guild.reputation = clamp01(finiteNonNegative(guild.reputation));
  }
  return society;
}

export function advanceEmergentSocietyV21(
  world: WorldState,
): V19EmergentSocietyState {
  const economy = world.v19?.adventureEconomy;
  if (!economy) throw new Error('Adventure economy is required for emergent society.');
  const society = repairEmergentSocietyV21(world, economy);
  const now = world.calendar.elapsedWorldMinutes;
  const elapsed = Math.max(0, now - society.lastAdvancedWorldMinute);
  if (elapsed < WORLD_MINUTES_PER_YEAR) return society;
  const elapsedYears = elapsed / WORLD_MINUTES_PER_YEAR;
  for (const agent of Object.values(world.agents).filter((item) => item.life.alive)) {
    updateResidentPractice(world, society, agent, elapsedYears);
  }
  refreshMarkets(world, economy, society);
  generateContracts(world, economy, society);
  formGuilds(world, economy, society);
  society.lastAdvancedWorldMinute = now;
  return society;
}

function ensureLegacyWallet(
  economy: V19AdventureEconomyState,
  agentId: string,
) {
  return (economy.adventurersByAgentId[agentId] ??= {
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
  });
}

function reputationFor(
  world: Readonly<WorldState>,
  profile: V19ResidentSocietyState,
  settlementId: string,
): V19LocalReputationState {
  return (profile.localReputationBySettlementId[settlementId] ??=
    emptyReputation(settlementId, world.calendar.elapsedWorldMinutes));
}

function updateSocialRank(
  economy: V19AdventureEconomyState,
  agentId: string,
  points: number,
): void {
  const wallet = ensureLegacyWallet(economy, agentId);
  wallet.rankPoints = Math.max(0, wallet.rankPoints + points);
  wallet.rank = socialRankForEvidenceV21(wallet.rankPoints);
}

export function recordPhysicalGoodsV21(
  world: WorldState,
  agent: Readonly<AgentState>,
  commodity: V19CommodityKind,
  quantity: number,
): void {
  const economy = world.v19?.adventureEconomy;
  if (!economy || quantity <= 0 || !Number.isFinite(quantity)) return;
  const wallet = ensureLegacyWallet(economy, agent.id);
  wallet.carriedGoods ??= {};
  wallet.carriedGoods[commodity] = Math.min(
    100,
    finiteNonNegative(wallet.carriedGoods[commodity]) + quantity,
  );
}

export interface LivedContractOutcomeV21 {
  kind: V19ContractKind;
  settlementId?: string;
  targetPlaceId?: string;
  commodity?: V19CommodityKind;
  quantity?: number;
  succeeded: boolean;
}

export function fulfillContractFromLivedActionV21(
  world: WorldState,
  agent: AgentState,
  outcome: Readonly<LivedContractOutcomeV21>,
): V19ContractState | undefined {
  const economy = world.v19?.adventureEconomy;
  if (!economy) return undefined;
  const society = repairEmergentSocietyV21(world, economy);
  const settlementId =
    outcome.settlementId ??
    world.places[agent.locationId]?.settlementId ??
    settlementOf(world, agent);
  if (!settlementId) return undefined;
  const wallet = ensureLegacyWallet(economy, agent.id);
  const contract = Object.values(society.contractsById)
    .filter(
      (candidate) =>
        candidate.issuerSettlementId === settlementId &&
        candidate.kind === outcome.kind &&
        (candidate.status === 'open' ||
          (candidate.status === 'accepted' &&
            candidate.acceptedByAgentId === agent.id)) &&
        (candidate.targetPlaceId === undefined ||
          candidate.targetPlaceId === outcome.targetPlaceId) &&
        (candidate.commodity === undefined || candidate.commodity === outcome.commodity) &&
        (rankIndex(candidate.minimumRank) <= 1 ||
          rankIndex(wallet.rank) >= rankIndex(candidate.minimumRank)),
    )
    .sort(
      (left, right) =>
        right.danger - left.danger ||
        left.offeredWorldMinute - right.offeredWorldMinute ||
        left.id.localeCompare(right.id),
    )[0];
  if (!contract) return undefined;
  const now = world.calendar.elapsedWorldMinutes;
  contract.status = 'accepted';
  contract.acceptedByAgentId = agent.id;
  contract.acceptedWorldMinute ??= now;
  contract.deliveredQuantity = Math.min(
    contract.requestedQuantity,
    contract.deliveredQuantity + Math.max(0, outcome.quantity ?? 1),
  );
  const finished = outcome.succeeded &&
    contract.deliveredQuantity + 1e-9 >= contract.requestedQuantity;
  if (!finished && outcome.succeeded) return contract;
  contract.status = finished ? 'completed' : 'failed';
  contract.resolvedWorldMinute = now;

  const profile = ensureResidentSociety(world, society, agent);
  const reputation = reputationFor(world, profile, settlementId);
  reputation.lastEvidenceWorldMinute = now;
  if (finished) {
    reputation.completedContracts += 1;
    reputation.reliability = clamp01(reputation.reliability + 0.035);
    reputation.trust = clamp01(reputation.trust + 0.022);
    reputation.provenCompetence = clamp01(
      reputation.provenCompetence + 0.025 + contract.danger * 0.025,
    );
    profile.completedContractIds.push(contract.id);
    profile.completedContractIds = profile.completedContractIds.slice(
      -MAX_RESIDENT_CONTRACT_HISTORY_V21,
    );
    const market = economy.settlementMarketsById[settlementId];
    const settlementEconomy = ensureSettlementEconomyV16(world, settlementId);
    const paidCoin = Math.min(
      finiteNonNegative(market?.treasuryCoin),
      contract.rewardCoin,
    );
    const paidFood = Math.min(
      finiteNonNegative(settlementEconomy.stocks.food),
      contract.rewardFood,
    );
    if (market) {
      market.treasuryCoin -= paidCoin;
      market.tradeVolume += paidCoin;
    }
    settlementEconomy.stocks.food -= paidFood;
    wallet.coinBalance += paidCoin;
    wallet.totalCoinEarned += paidCoin;
    agent.resources = clamp01(agent.resources + paidFood * 0.72);
    updateSocialRank(
      economy,
      agent.id,
      1 + contract.danger * 4 + Math.min(3, contract.requestedQuantity),
    );
    economy.recentTransactions.push({
      id: `adventure-transaction:v19:${economy.nextTransactionSequence++}`,
      kind: 'contract_reward',
      worldMinute: now,
      agentId: agent.id,
      physicalPlaceId: agent.locationId,
      settlementId,
      coin: paidCoin,
      food: paidFood,
      contractId: contract.id,
    });
    economy.recentTransactions = economy.recentTransactions.slice(-256);
  } else {
    reputation.failedContracts += 1;
    reputation.reliability = clamp01(reputation.reliability - 0.045);
    reputation.trust = clamp01(reputation.trust - 0.025);
    profile.failedContractIds.push(contract.id);
    profile.failedContractIds = profile.failedContractIds.slice(
      -MAX_RESIDENT_CONTRACT_HISTORY_V21,
    );
    updateSocialRank(economy, agent.id, -1.2 - contract.danger);
  }
  return contract;
}

export function recordVerifiedDungeonOutcomeV21(
  world: WorldState,
  agent: AgentState,
  entrancePlaceId: string,
  outcome: 'success' | 'retreat' | 'defeat',
  clearedDepth: number,
): void {
  const economy = world.v19?.adventureEconomy;
  if (!economy) return;
  const society = repairEmergentSocietyV21(world, economy);
  const profile = ensureResidentSociety(world, society, agent);
  const nearest = Object.values(world.settlements).sort((left, right) => {
    const place = world.places[entrancePlaceId];
    return (
      Math.hypot(left.centerX - place.mapX, left.centerY - place.mapY) -
        Math.hypot(right.centerX - place.mapX, right.centerY - place.mapY) ||
      left.id.localeCompare(right.id)
    );
  })[0];
  if (nearest) {
    const reputation = reputationFor(world, profile, nearest.id);
    reputation.lastEvidenceWorldMinute = world.calendar.elapsedWorldMinutes;
    reputation.provenCompetence = clamp01(
      reputation.provenCompetence +
        (outcome === 'success' ? 0.012 + clearedDepth * 0.004 : 0.002),
    );
    if (outcome === 'success') {
      reputation.reliability = clamp01(reputation.reliability + 0.006);
    }
  }
  updateSocialRank(
    economy,
    agent.id,
    outcome === 'success' ? 1 + clearedDepth * 0.35 : outcome === 'retreat' ? 0.15 : 0,
  );
  fulfillContractFromLivedActionV21(world, agent, {
    kind: 'dungeon_clear',
    settlementId: nearest?.id,
    targetPlaceId: entrancePlaceId,
    quantity: outcome === 'success' ? 1 : 0,
    succeeded: outcome === 'success',
  });
}

export function recordTradeEvidenceV21(
  world: WorldState,
  agent: AgentState,
  destinationSettlementId: string,
  commodity: V19CommodityKind | undefined,
  quantity: number,
): void {
  const economy = world.v19?.adventureEconomy;
  if (!economy) return;
  const society = repairEmergentSocietyV21(world, economy);
  const profile = ensureResidentSociety(world, society, agent);
  const trader = ensureDiscipline(profile, 'trader');
  const practice = Math.max(0.1, Math.min(2, quantity));
  trader.lifetimePractice += practice;
  trader.currentMastery = clamp01(
    trader.currentMastery + practice * 0.008 * (1 - trader.currentMastery * 0.5),
  );
  trader.practiceEvents += 1;
  trader.lastPracticedWorldMinute = world.calendar.elapsedWorldMinutes;
  const reputation = reputationFor(world, profile, destinationSettlementId);
  reputation.reliability = clamp01(reputation.reliability + 0.004);
  reputation.trust = clamp01(reputation.trust + 0.003);
  reputation.lastEvidenceWorldMinute = world.calendar.elapsedWorldMinutes;
  if (commodity) {
    fulfillContractFromLivedActionV21(world, agent, {
      kind: 'delivery',
      settlementId: destinationSettlementId,
      commodity,
      quantity,
      succeeded: quantity > 0,
    });
  }
}

export function emergentPracticeActionAffinityV21(
  world: Readonly<WorldState>,
  agentId: string,
  action: AgentActionKind,
): number {
  const profile = world.v19?.adventureEconomy.emergentSociety
    ?.residentsByAgentId[agentId];
  if (!profile) return 0;
  const matching: Partial<Record<AgentActionKind, V19PracticeDomain[]>> = {
    gather: ['farmer', 'forager', 'woodcutter', 'miner'],
    hunt: ['fisher', 'hunter', 'guard', 'warrior'],
    work: ['artisan', 'smith', 'builder'],
    help: ['caregiver'],
    explore: ['scout', 'cartographer', 'adventurer'],
    walk: ['scout', 'guard'],
    socialize: ['teacher', 'trader'],
    reflect: ['scribe', 'cartographer'],
    pray: ['spiritual_keeper'],
  };
  return Math.min(
    0.11,
    Math.max(
      0,
      ...(matching[action] ?? []).map(
        (domain) => profile.disciplinesByDomain[domain]?.currentMastery ?? 0,
      ),
    ) * 0.11,
  );
}

export function assertEmergentSocietyV21(
  world: Readonly<WorldState>,
  economy: Readonly<V19AdventureEconomyState>,
): void {
  const society = economy.emergentSociety;
  if (!society || society.version !== EMERGENT_SOCIETY_VERSION_V21) {
    throw new Error('Emergent society state is missing or invalid.');
  }
  if (
    Object.keys(society.contractsById).length > MAX_CONTRACTS_V21 ||
    Object.keys(society.guildsById).length > MAX_GUILDS_V21 ||
    Object.keys(society.professionsById).length > MAX_PROFESSIONS_V21 ||
    Object.keys(society.residentsByAgentId).length > Object.keys(world.agents).length
  ) throw new Error('Emergent society exceeds a bounded limit.');
  for (const [agentId, profile] of Object.entries(society.residentsByAgentId)) {
    if (!world.agents[agentId] || profile.agentId !== agentId) {
      throw new Error(`Emergent society profile ${agentId} is stale.`);
    }
    for (const discipline of Object.values(profile.disciplinesByDomain)) {
      if (!discipline) continue;
      if (
        discipline.currentMastery < 0 ||
        discipline.currentMastery > 1 ||
        discipline.lifetimePractice < 0
      ) throw new Error(`Practice discipline ${agentId}:${discipline.domain} is invalid.`);
    }
  }
  for (const contract of Object.values(society.contractsById)) {
    if (!world.settlements[contract.issuerSettlementId]) {
      throw new Error(`Contract ${contract.id} has no physical issuer settlement.`);
    }
    if (contract.issuerAgentId && !world.agents[contract.issuerAgentId]) {
      throw new Error(`Contract ${contract.id} has no resident issuer.`);
    }
  }
}
