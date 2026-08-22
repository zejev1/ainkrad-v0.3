import type { InterventionKind } from '../cardinal/types';
import { stableJsonStringify } from '../core/stableJson';
import type { InputEnvelope } from '../runtime/inputBus/types';
import { SeededRng } from '../utils/rng';
import type { WorldEvent } from './events';
import type { WorldStore } from './persistence';
import { StaleWorldObservationError, WorldRevisionConflictError } from './persistence';
import {
  DEFAULT_WORLD_MINUTES_PER_TICK,
  WORLD_MINUTES_PER_YEAR,
  WORLD_TICKS_PER_YEAR,
} from './WorldClock';
import {
  orientedRouteWaypoints,
  rebuildWorldRoutes,
  routeIdBetween,
  surfaceForPlace,
} from './WorldNavigation';
import type {
  AgentActionKind,
  AgentDeathCause,
  AgentGoalKind,
  AgentLifeStage,
  AgentPhysiologyState,
  AgentState,
  MemoryRecord,
  RelationshipState,
  WorldBiome,
  WorldDisturbanceKind,
  WorldEnvironment,
  WorldGrowthState,
  WorldLawDomain,
  WorldLawMechanism,
  WorldLawState,
  WorldPlace,
  WorldPlaceKind,
  WorldPoint2D,
  WorldRouteState,
  WorldSettlementState,
  WorldState,
  WildlifePopulation,
  WildlifeSpecies,
} from './types';

export const WORLD_RULES_VERSION = 'ainkrad-world-rules-0.3.13';
const LEGACY_WORLD_RULES_VERSIONS = new Set([
  'ainkrad-world-rules-0.3.8',
  'ainkrad-world-rules-0.3.9',
  'ainkrad-world-rules-0.3.10',
  'ainkrad-world-rules-0.3.11',
  'ainkrad-world-rules-0.3.12',
]);
export const WORLD_CONSTITUTION_VERSION = 'ainkrad-constitution-0.3.10';
export { WORLD_TICKS_PER_YEAR } from './WorldClock';
const MIN_ADULT_AGE = 18;
const ELDER_AGE = 62;
const BIRTH_CHECK_INTERVAL = 12;
const MAX_LIVING_POPULATION = 128;
const LEGACY_WORLD_TICKS_PER_YEAR = 96;
const MIN_WORLD_MINUTES_BETWEEN_BIRTHS = WORLD_MINUTES_PER_YEAR * 0.8;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clampSigned = (value: number) => Math.max(-1, Math.min(1, value));
const ROUTINE_EVENT_SAMPLE_INTERVAL = 1800;
const SAPIENT_RACES = ['human', 'goblin', 'orc', 'ogre'] as const;

function levelForExperience(experience: number): number {
  return Math.max(1, Math.min(100, 1 + Math.floor(Math.sqrt(Math.max(0, experience) / 24))));
}

function progressionFromAgent(agent: Readonly<AgentState>): NonNullable<AgentState['progression']> {
  const skillAverage =
    (agent.skills.gathering +
      agent.skills.hunting +
      agent.skills.craft +
      agent.skills.social +
      agent.skills.exploration) /
    5;
  const livedAdultYears = Math.max(0, agent.life.ageYears - 18);
  const experience = Math.max(0, skillAverage * 90 + livedAdultYears * 1.2 + agent.life.generation * 18);
  return {
    level: levelForExperience(experience),
    experience,
    objectControlAuthority: clamp01(skillAverage * 0.72 + agent.skills.craft * 0.18),
    systemControlAuthority: clamp01(agent.mind.values.knowledge * 0.34 + agent.personality.curiosity * 0.28 + agent.skills.exploration * 0.2),
    combatMastery: clamp01(agent.skills.hunting * 0.62 + agent.life.physiology.strength * 0.22),
    sacredArts: clamp01(agent.mind.values.knowledge * 0.22 + agent.mind.emotions.awe * 0.28 + agent.mind.beliefs.divinePresence * 0.18),
  };
}

const ROUTINE_AGENT_EVENT_KINDS = new Set([
  'agent.rested',
  'agent.relaxed',
  'agent.walked',
  'agent.gathered',
  'agent.worked',
  'agent.explored',
  'agent.reflected',
  'agent.prayed',
  'agent.hunted',
  'agent.socialize.blocked',
  'agent.goal.changed',
  'agent.help.rejected',
  'agent.bond.declined',
]);

const ACTION_KINDS: readonly AgentActionKind[] = [
  'rest',
  'relax',
  'walk',
  'gather',
  'hunt',
  'work',
  'socialize',
  'help',
  'explore',
  'reflect',
  'bond',
  'pray',
];

const GOAL_KINDS: readonly AgentGoalKind[] = [
  'recover',
  'secure_resources',
  'connect',
  'contribute',
  'explore',
  'reflect',
  'build_family',
  'seek_truth',
];

const PLACE_KINDS: readonly WorldPlaceKind[] = [
  'home',
  'commons',
  'resource_field',
  'workshop',
  'quiet_space',
  'outskirts',
  'meadow',
  'forest',
  'shore',
  'mountains',
  'lake',
  'river',
  'swamp',
  'ruins',
  'village',
  'city',
];

const WILDLIFE_SPECIES: readonly WildlifeSpecies[] = [
  'rabbit',
  'deer',
  'fish',
  'boar',
  'wolf',
  'bird',
  'dire_wolf',
  'ogre',
  'wraith',
];

const MONSTER_SPECIES = new Set<WildlifeSpecies>([
  'dire_wolf',
  'ogre',
  'wraith',
]);

const BIOMES: readonly WorldBiome[] = [
  'settlement',
  'plains',
  'forest',
  'coast',
  'mountains',
  'lake',
  'river',
  'swamp',
  'ancient_ruins',
];

const LAW_MECHANISM_DOMAINS: Record<WorldLawMechanism, WorldLawDomain> = {
  frontier_expansion: 'geography',
  wildlife_recovery: 'ecology',
  fertility_support: 'demography',
  resource_regeneration: 'resources',
  mystic_resonance: 'cosmology',
  weather_volatility: 'climate',
  catastrophe_recovery: 'ecology',
};

interface WorldExpansionDefinition {
  stage: number;
  place: WorldPlace;
  wildlife: WildlifePopulation[];
}

const WORLD_EXPANSIONS: readonly WorldExpansionDefinition[] = [
  {
    stage: 1,
    place: {
      id: 'meadow',
      name: 'Wild Meadow',
      kind: 'meadow',
      capacity: 12,
      biome: 'plains',
      mapX: 8,
      mapY: 13,
      connectedPlaceIds: ['outskirts'],
      fertility: 0.82,
      danger: 0.12,
      surface: 'land',
    },
    wildlife: [
      {
        id: 'wildlife_rabbits',
        species: 'rabbit',
        habitatId: 'meadow',
        count: 4,
        carryingCapacity: 8,
        reproductionRate: 0.16,
        alertness: 0.2,
        threat: 0.04,
        isMonster: false,
        lastChangedAt: 0,
      },
    ],
  },
  {
    stage: 2,
    place: {
      id: 'forest',
      name: 'Northern Forest',
      kind: 'forest',
      capacity: 14,
      biome: 'forest',
      mapX: 50,
      mapY: 12,
      connectedPlaceIds: ['meadow', 'outskirts'],
      fertility: 0.74,
      danger: 0.3,
      surface: 'land',
    },
    wildlife: [
      {
        id: 'wildlife_deer',
        species: 'deer',
        habitatId: 'forest',
        count: 3,
        carryingCapacity: 7,
        reproductionRate: 0.1,
        alertness: 0.32,
        threat: 0.12,
        isMonster: false,
        lastChangedAt: 0,
      },
    ],
  },
  {
    stage: 3,
    place: {
      id: 'shore',
      name: 'Sea Shore',
      kind: 'shore',
      capacity: 16,
      biome: 'coast',
      mapX: 92,
      mapY: 88,
      connectedPlaceIds: ['outskirts'],
      fertility: 0.68,
      danger: 0.2,
      surface: 'shore',
    },
    wildlife: [
      {
        id: 'wildlife_fish',
        species: 'fish',
        habitatId: 'shore',
        count: 6,
        carryingCapacity: 12,
        reproductionRate: 0.2,
        alertness: 0.12,
        threat: 0.02,
        isMonster: false,
        lastChangedAt: 0,
      },
    ],
  },
];

const REGION_NAME_PREFIXES = [
  'Северные',
  'Серебряные',
  'Тихие',
  'Древние',
  'Восточные',
  'Скрытые',
  'Ветреные',
  'Янтарные',
] as const;

const REGION_NAME_SUFFIXES: Record<WorldBiome, readonly string[]> = {
  settlement: ['Поселение', 'Перекрёстки'],
  plains: ['Поля', 'Степи', 'Луга'],
  forest: ['Леса', 'Рощи', 'Чащи'],
  coast: ['Берега', 'Бухты', 'Побережья'],
  mountains: ['Высоты', 'Хребты', 'Перевалы'],
  lake: ['Озёра', 'Воды'],
  river: ['Речные земли', 'Броды'],
  swamp: ['Топи', 'Болота'],
  ancient_ruins: ['Руины', 'Святилища'],
};

function law(
  id: string,
  domain: WorldLawState['domain'],
  mechanism: WorldLawMechanism,
  value: number,
  minimum: number,
  maximum: number,
  now: number,
  rationale: string,
): WorldLawState {
  return {
    id,
    domain,
    mechanism,
    value,
    minimum,
    maximum,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
    rationale,
  };
}

function defaultWorldLaws(now: number): Record<string, WorldLawState> {
  const laws = [
    law(
      'frontier_expansion_rate',
      'geography',
      'frontier_expansion',
      1,
      0.25,
      2.5,
      now,
      'Residents may discover a continuously generated frontier.',
    ),
    law(
      'wildlife_recovery_rate',
      'ecology',
      'wildlife_recovery',
      1,
      0.35,
      2,
      now,
      'Wildlife recovers through habitat conditions rather than spawning on command.',
    ),
    law(
      'fertility_support',
      'demography',
      'fertility_support',
      0.55,
      0.1,
      1,
      now,
      'Families remain voluntary while the world can support new life.',
    ),
    law(
      'resource_regeneration',
      'resources',
      'resource_regeneration',
      1,
      0.35,
      2,
      now,
      'Shared resources recover according to ecological capacity.',
    ),
    law(
      'mystic_resonance',
      'cosmology',
      'mystic_resonance',
      0.35,
      0,
      1,
      now,
      'Unexplained events may become belief, ritual and myth through lived experience.',
    ),
    law(
      'weather_volatility',
      'climate',
      'weather_volatility',
      0.2,
      0,
      0.8,
      now,
      'Weather may vary without directly commanding residents.',
    ),
    law(
      'catastrophe_recovery',
      'ecology',
      'catastrophe_recovery',
      0.75,
      0.25,
      1.5,
      now,
      'A damaged world retains a path to recovery after a systemic event.',
    ),
  ];
  return Object.fromEntries(laws.map((entry) => [entry.id, entry]));
}

function lifeStageForAge(ageYears: number): AgentLifeStage {
  if (ageYears < 12) return 'child';
  if (ageYears < MIN_ADULT_AGE) return 'adolescent';
  if (ageYears < ELDER_AGE) return 'adult';
  return 'elder';
}

/** A smooth human-like body curve: growth, a young-adult peak, then decline. */
function physiologyForAge(
  ageYears: number,
  lifespanYears: number,
  health: number,
): AgentPhysiologyState {
  const age = Math.max(0, ageYears);
  const adultPeak =
    age < 5
      ? 0.08 + (age / 5) * 0.22
      : age < 15
        ? 0.3 + ((age - 5) / 10) * 0.42
        : age < 25
          ? 0.72 + ((age - 15) / 10) * 0.28
          : age <= 35
            ? 1
            : age < 55
              ? 1 - ((age - 35) / 20) * 0.2
              : age < 70
                ? 0.8 - ((age - 55) / 15) * 0.25
                : Math.max(
                    0.12,
                    0.55 -
                      ((age - 70) / Math.max(8, lifespanYears - 70)) * 0.43,
                  );
  const healthFactor = 0.48 + clamp01(health) * 0.52;
  const experienceReserve = clamp01(age / 55) * 0.08;

  return {
    strength: clamp01(adultPeak * healthFactor),
    endurance: clamp01(
      (adultPeak * 0.86 + experienceReserve) * (0.42 + health * 0.58),
    ),
    mobility: clamp01(
      (adultPeak * (age > 60 ? 0.9 : 1.02)) * (0.45 + health * 0.55),
    ),
    recovery: clamp01(
      (age < 18
        ? 0.76 + adultPeak * 0.2
        : age < 40
          ? 0.94
          : age < 65
            ? 0.94 - ((age - 40) / 25) * 0.3
            : Math.max(0.16, 0.64 - ((age - 65) / 30) * 0.48)) *
        (0.46 + health * 0.54),
    ),
  };
}

function identityId(worldId: string, agentId: string): string {
  return `person:${worldId}:${agentId}`;
}

function relationshipKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be finite.`);
  }
  return value;
}

function unitNumber(value: unknown, path: string): number {
  const result = finiteNumber(value, path);
  if (result < 0 || result > 1) {
    throw new Error(`${path} must be between 0 and 1.`);
  }
  return result;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${path} must be a non-negative integer.`);
  }
  return value;
}

function assertUnitFields(
  record: Record<string, unknown>,
  fields: readonly string[],
  path: string,
): void {
  for (const field of fields) {
    unitNumber(record[field], `${path}.${field}`);
  }
}

function assertWorldState(value: unknown): asserts value is WorldState {
  const state = asRecord(value, 'World state');
  const id = requiredString(state.id, 'World state id');
  finiteNumber(state.now, 'World state time');
  nonNegativeInteger(state.revision, 'World state revision');
  requiredString(state.rulesVersion, 'World state rulesVersion');

  const determinism = asRecord(state.determinism, 'World determinism');
  finiteNumber(determinism.rngState, 'World RNG state');
  nonNegativeInteger(determinism.eventSequence, 'World event sequence');

  const calendar = asRecord(state.calendar, 'World calendar');
  const elapsedWorldMinutes = finiteNumber(
    calendar.elapsedWorldMinutes,
    'World calendar.elapsedWorldMinutes',
  );
  if (elapsedWorldMinutes < 0) {
    throw new Error('World calendar.elapsedWorldMinutes cannot be negative.');
  }

  const environment = asRecord(state.environment, 'World environment');
  assertUnitFields(
    environment,
    [
      'resourcePool',
      'resourceRegenerationRate',
      'socialOpportunity',
      'safetySupport',
      'habitatSupport',
    ],
    'World environment',
  );

  const growth = asRecord(state.growth, 'World growth');
  const growthStage = nonNegativeInteger(growth.stage, 'World growth.stage');
  unitNumber(growth.explorationProgress, 'World growth.explorationProgress');
  finiteNumber(growth.lastExpansionAt, 'World growth.lastExpansionAt');
  const frontierSequence = nonNegativeInteger(
    growth.frontierSequence,
    'World growth.frontierSequence',
  );
  if (
    !Array.isArray(growth.discoveredRegionIds) ||
    growth.discoveredRegionIds.some(
      (regionId) => typeof regionId !== 'string' || !regionId.trim(),
    )
  ) {
    throw new Error('World growth.discoveredRegionIds must contain strings.');
  }
  const discoveredRegionIds = growth.discoveredRegionIds as string[];
  if (growthStage !== discoveredRegionIds.length) {
    throw new Error(
      'World growth.stage must equal the number of discovered frontier regions.',
    );
  }
  if (frontierSequence < growthStage) {
    throw new Error('World growth.frontierSequence cannot trail discovered regions.');
  }
  const expectedPrefix = WORLD_EXPANSIONS.slice(
    0,
    Math.min(growthStage, WORLD_EXPANSIONS.length),
  ).map((expansion) => expansion.place.id);
  if (
    expectedPrefix.some(
      (regionId, index) => discoveredRegionIds[index] !== regionId,
    )
  ) {
    throw new Error('World frontier history is missing its founding regions.');
  }

  const population = asRecord(state.population, 'World population');
  const nextAgentSequence = nonNegativeInteger(
    population.nextAgentSequence,
    'World population.nextAgentSequence',
  );
  if (nextAgentSequence < 1) {
    throw new Error('World population.nextAgentSequence must be positive.');
  }
  nonNegativeInteger(population.births, 'World population.births');
  nonNegativeInteger(population.deaths, 'World population.deaths');
  if (population.lastBirthAt !== undefined) {
    finiteNumber(population.lastBirthAt, 'World population.lastBirthAt');
  }
  if (population.lastBirthWorldMinute !== undefined) {
    finiteNumber(
      population.lastBirthWorldMinute,
      'World population.lastBirthWorldMinute',
    );
  }
  if (population.lastDeathAt !== undefined) {
    finiteNumber(population.lastDeathAt, 'World population.lastDeathAt');
  }

  const cosmology = asRecord(state.cosmology, 'World cosmology');
  unitNumber(cosmology.mysteryLevel, 'World cosmology.mysteryLevel');
  nonNegativeInteger(cosmology.omenCount, 'World cosmology.omenCount');
  if (
    !Array.isArray(cosmology.traditions) ||
    cosmology.traditions.some(
      (tradition) => typeof tradition !== 'string' || !tradition.trim(),
    )
  ) {
    throw new Error('World cosmology.traditions must contain strings.');
  }
  const deities = asRecord(cosmology.deities, 'World cosmology.deities');
  for (const [deityId, rawDeity] of Object.entries(deities)) {
    const deity = asRecord(rawDeity, `Deity ${deityId}`);
    if (requiredString(deity.id, `Deity ${deityId}.id`) !== deityId) {
      throw new Error(`Deity key ${deityId} does not match its id.`);
    }
    requiredString(deity.name, `Deity ${deityId}.name`);
    if (!['emergent_belief', 'external_entry'].includes(deity.origin as string)) {
      throw new Error(`Deity ${deityId}.origin is invalid.`);
    }
    finiteNumber(deity.enteredAt, `Deity ${deityId}.enteredAt`);
    if (deity.lastOmenAt !== undefined) {
      finiteNumber(deity.lastOmenAt, `Deity ${deityId}.lastOmenAt`);
    }
  }

  const governance = asRecord(state.governance, 'World governance');
  if (
    requiredString(
      governance.constitutionVersion,
      'World governance.constitutionVersion',
    ) !== WORLD_CONSTITUTION_VERSION
  ) {
    throw new Error('World constitution version is incompatible.');
  }
  nonNegativeInteger(
    governance.authorityRevision,
    'World governance.authorityRevision',
  );
  const protectedDomains = governance.protectedPersonhoodDomains;
  const expectedProtectedDomains = [
    'identity',
    'memory',
    'agency',
    'values',
    'relationships',
  ];
  if (
    !Array.isArray(protectedDomains) ||
    protectedDomains.length !== expectedProtectedDomains.length ||
    expectedProtectedDomains.some(
      (domain, index) => protectedDomains[index] !== domain,
    )
  ) {
    throw new Error('World personhood constitution was altered.');
  }
  if (governance.lastCardinalAuthorityAt !== undefined) {
    finiteNumber(
      governance.lastCardinalAuthorityAt,
      'World governance.lastCardinalAuthorityAt',
    );
  }
  const laws = asRecord(governance.laws, 'World governance.laws');
  for (const [lawId, rawLaw] of Object.entries(laws)) {
    const worldLaw = asRecord(rawLaw, `World law ${lawId}`);
    if (requiredString(worldLaw.id, `World law ${lawId}.id`) !== lawId) {
      throw new Error(`World law key ${lawId} does not match its id.`);
    }
    if (
      ![
        'geography',
        'ecology',
        'climate',
        'resources',
        'demography',
        'cosmology',
      ].includes(worldLaw.domain as string)
    ) {
      throw new Error(`World law ${lawId}.domain is invalid.`);
    }
    const mechanism = worldLaw.mechanism as WorldLawMechanism;
    if (
      !Object.prototype.hasOwnProperty.call(
        LAW_MECHANISM_DOMAINS,
        mechanism,
      ) ||
      LAW_MECHANISM_DOMAINS[mechanism] !== worldLaw.domain
    ) {
      throw new Error(`World law ${lawId}.mechanism is invalid for its domain.`);
    }
    const value = finiteNumber(worldLaw.value, `World law ${lawId}.value`);
    const minimum = finiteNumber(worldLaw.minimum, `World law ${lawId}.minimum`);
    const maximum = finiteNumber(worldLaw.maximum, `World law ${lawId}.maximum`);
    if (minimum > maximum || value < minimum || value > maximum) {
      throw new Error(`World law ${lawId}.value is outside its constitutional range.`);
    }
    nonNegativeInteger(worldLaw.revision, `World law ${lawId}.revision`);
    finiteNumber(worldLaw.createdAt, `World law ${lawId}.createdAt`);
    finiteNumber(worldLaw.updatedAt, `World law ${lawId}.updatedAt`);
    if (!['system', 'cardinal'].includes(worldLaw.createdBy as string)) {
      throw new Error(`World law ${lawId}.createdBy is invalid.`);
    }
    requiredString(worldLaw.rationale, `World law ${lawId}.rationale`);
  }

  const places = asRecord(state.places, 'World places');
  if (Object.keys(places).length === 0) {
    throw new Error('World must contain at least one place.');
  }
  for (const [placeId, rawPlace] of Object.entries(places)) {
    const place = asRecord(rawPlace, `World place ${placeId}`);
    if (requiredString(place.id, `World place ${placeId}.id`) !== placeId) {
      throw new Error(`World place key ${placeId} does not match its id.`);
    }
    requiredString(place.name, `World place ${placeId}.name`);
    if (!PLACE_KINDS.includes(place.kind as WorldPlaceKind)) {
      throw new Error(`World place ${placeId}.kind is invalid.`);
    }
    const capacity = finiteNumber(place.capacity, `World place ${placeId}.capacity`);
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error(`World place ${placeId}.capacity must be a positive integer.`);
    }
    if (!BIOMES.includes(place.biome as WorldBiome)) {
      throw new Error(`World place ${placeId}.biome is invalid.`);
    }
    finiteNumber(place.mapX, `World place ${placeId}.mapX`);
    finiteNumber(place.mapY, `World place ${placeId}.mapY`);
    if (
      !Array.isArray(place.connectedPlaceIds) ||
      place.connectedPlaceIds.some(
        (connectedId) => typeof connectedId !== 'string' || !connectedId.trim(),
      )
    ) {
      throw new Error(`World place ${placeId}.connectedPlaceIds must contain strings.`);
    }
    unitNumber(place.fertility, `World place ${placeId}.fertility`);
    unitNumber(place.danger, `World place ${placeId}.danger`);
    if (!['land', 'shore', 'water'].includes(place.surface as string)) {
      throw new Error(`World place ${placeId}.surface is invalid.`);
    }
    if (place.settlementId !== undefined) {
      requiredString(place.settlementId, `World place ${placeId}.settlementId`);
    }
    if (place.discoveredAt !== undefined) {
      finiteNumber(place.discoveredAt, `World place ${placeId}.discoveredAt`);
    }
  }
  for (const [placeId, rawPlace] of Object.entries(places)) {
    const place = asRecord(rawPlace, `World place ${placeId}`);
    for (const connectedId of place.connectedPlaceIds as string[]) {
      if (!places[connectedId]) {
        throw new Error(
          `World place ${placeId} references missing connection ${connectedId}.`,
        );
      }
      const connected = asRecord(
        places[connectedId],
        `World place ${connectedId}`,
      );
      if (!(connected.connectedPlaceIds as string[]).includes(placeId)) {
        throw new Error(
          `World connection ${placeId} -> ${connectedId} must be reciprocal.`,
        );
      }
    }
  }

  const settlements = asRecord(state.settlements, 'World settlements');
  for (const [settlementId, rawSettlement] of Object.entries(settlements)) {
    const settlement = asRecord(
      rawSettlement,
      `World settlement ${settlementId}`,
    );
    if (
      requiredString(settlement.id, `World settlement ${settlementId}.id`) !==
      settlementId
    ) {
      throw new Error(`World settlement key ${settlementId} does not match its id.`);
    }
    requiredString(settlement.name, `World settlement ${settlementId}.name`);
    if (!['village', 'city'].includes(settlement.kind as string)) {
      throw new Error(`World settlement ${settlementId}.kind is invalid.`);
    }
    const centerPlaceId = requiredString(
      settlement.centerPlaceId,
      `World settlement ${settlementId}.centerPlaceId`,
    );
    if (!places[centerPlaceId]) {
      throw new Error(`World settlement ${settlementId} has no center place.`);
    }
    finiteNumber(settlement.centerX, `World settlement ${settlementId}.centerX`);
    finiteNumber(settlement.centerY, `World settlement ${settlementId}.centerY`);
    const radius = finiteNumber(
      settlement.radius,
      `World settlement ${settlementId}.radius`,
    );
    if (radius <= 0) {
      throw new Error(`World settlement ${settlementId}.radius must be positive.`);
    }
    finiteNumber(settlement.foundedAt, `World settlement ${settlementId}.foundedAt`);
    if (
      !Array.isArray(settlement.memberPlaceIds) ||
      settlement.memberPlaceIds.some(
        (memberId) =>
          typeof memberId !== 'string' ||
          !places[memberId] ||
          asRecord(places[memberId], `World place ${memberId}`).settlementId !==
            settlementId,
      )
    ) {
      throw new Error(`World settlement ${settlementId} has invalid members.`);
    }
  }
  for (const [placeId, rawPlace] of Object.entries(places)) {
    const settlementId = asRecord(rawPlace, `World place ${placeId}`).settlementId;
    if (settlementId !== undefined && !settlements[settlementId as string]) {
      throw new Error(`World place ${placeId} references a missing settlement.`);
    }
  }

  const routes = asRecord(state.routes, 'World routes');
  for (const [routeId, rawRoute] of Object.entries(routes)) {
    const route = asRecord(rawRoute, `World route ${routeId}`);
    if (requiredString(route.id, `World route ${routeId}.id`) !== routeId) {
      throw new Error(`World route key ${routeId} does not match its id.`);
    }
    const fromPlaceId = requiredString(
      route.fromPlaceId,
      `World route ${routeId}.fromPlaceId`,
    );
    const toPlaceId = requiredString(
      route.toPlaceId,
      `World route ${routeId}.toPlaceId`,
    );
    if (!places[fromPlaceId] || !places[toPlaceId]) {
      throw new Error(`World route ${routeId} references a missing place.`);
    }
    if (routeIdBetween(fromPlaceId, toPlaceId) !== routeId) {
      throw new Error(`World route ${routeId} is stored under the wrong key.`);
    }
    if (!['walk', 'bridge', 'boat'].includes(route.traversal as string)) {
      throw new Error(`World route ${routeId}.traversal is invalid.`);
    }
    if (
      !Array.isArray(route.waypoints) ||
      route.waypoints.length < 2 ||
      route.waypoints.some((point, index) => {
        const value = asRecord(point, `World route ${routeId}.waypoints[${index}]`);
        return !Number.isFinite(value.x) || !Number.isFinite(value.y);
      })
    ) {
      throw new Error(`World route ${routeId} has invalid waypoints.`);
    }
    const distance = finiteNumber(route.distance, `World route ${routeId}.distance`);
    if (distance <= 0) {
      throw new Error(`World route ${routeId}.distance must be positive.`);
    }
  }
  for (const expansion of WORLD_EXPANSIONS) {
    const discovered = expansion.stage <= growthStage;
    const storedPlace = places[expansion.place.id];
    if (discovered && !storedPlace) {
      throw new Error(
        `World growth stage ${growthStage} is missing region ${expansion.place.id}.`,
      );
    }
    if (!discovered && storedPlace) {
      throw new Error(
        `World contains undiscovered future region ${expansion.place.id}.`,
      );
    }
    if (
      discovered &&
      asRecord(storedPlace, `World place ${expansion.place.id}`).discoveredAt ===
        undefined
    ) {
      throw new Error(
        `Discovered region ${expansion.place.id} is missing discoveredAt.`,
      );
    }
  }

  const wildlife = asRecord(state.wildlife, 'World wildlife');
  for (const [populationId, rawPopulation] of Object.entries(wildlife)) {
    const population = asRecord(
      rawPopulation,
      `Wildlife population ${populationId}`,
    );
    if (
      requiredString(
        population.id,
        `Wildlife population ${populationId}.id`,
      ) !== populationId
    ) {
      throw new Error(
        `Wildlife population key ${populationId} does not match its id.`,
      );
    }
    if (!WILDLIFE_SPECIES.includes(population.species as WildlifeSpecies)) {
      throw new Error(`Wildlife population ${populationId}.species is invalid.`);
    }
    const habitatId = requiredString(
      population.habitatId,
      `Wildlife population ${populationId}.habitatId`,
    );
    if (!places[habitatId]) {
      throw new Error(
        `Wildlife population ${populationId} references missing habitat ${habitatId}.`,
      );
    }
    const count = nonNegativeInteger(
      population.count,
      `Wildlife population ${populationId}.count`,
    );
    const carryingCapacity = nonNegativeInteger(
      population.carryingCapacity,
      `Wildlife population ${populationId}.carryingCapacity`,
    );
    if (carryingCapacity < 1 || count > carryingCapacity) {
      throw new Error(
        `Wildlife population ${populationId} exceeds its carrying capacity.`,
      );
    }
    unitNumber(
      population.reproductionRate,
      `Wildlife population ${populationId}.reproductionRate`,
    );
    unitNumber(
      population.alertness,
      `Wildlife population ${populationId}.alertness`,
    );
    unitNumber(population.threat, `Wildlife population ${populationId}.threat`);
    if (typeof population.isMonster !== 'boolean') {
      throw new Error(
        `Wildlife population ${populationId}.isMonster must be boolean.`,
      );
    }
    if (
      population.isMonster !==
      MONSTER_SPECIES.has(population.species as WildlifeSpecies)
    ) {
      throw new Error(
        `Wildlife population ${populationId} monster flag is invalid.`,
      );
    }
    finiteNumber(
      population.lastChangedAt,
      `Wildlife population ${populationId}.lastChangedAt`,
    );
  }
  for (const expansion of WORLD_EXPANSIONS) {
    for (const expectedPopulation of expansion.wildlife) {
      const discovered = expansion.stage <= growthStage;
      const storedPopulation = wildlife[expectedPopulation.id];
      if (discovered && !storedPopulation) {
        throw new Error(
          `World growth stage ${growthStage} is missing wildlife ${expectedPopulation.id}.`,
        );
      }
      if (!discovered && storedPopulation) {
        throw new Error(
          `World contains wildlife from undiscovered region ${expectedPopulation.habitatId}.`,
        );
      }
    }
  }

  for (const regionId of growth.discoveredRegionIds as string[]) {
    if (!places[regionId]) {
      throw new Error(
        `World growth references missing discovered region ${regionId}.`,
      );
    }
  }

  const agents = asRecord(state.agents, 'World agents');
  for (const [agentId, rawAgent] of Object.entries(agents)) {
    const agent = asRecord(rawAgent, `Agent ${agentId}`);
    if (requiredString(agent.id, `Agent ${agentId}.id`) !== agentId) {
      throw new Error(`Agent key ${agentId} does not match its id.`);
    }
    requiredString(agent.name, `Agent ${agentId}.name`);
    if (!['native', 'external_resident'].includes(agent.origin as string)) {
      throw new Error(`Agent ${agentId}.origin is invalid.`);
    }
    if (!['male', 'female'].includes(agent.sex as string)) {
      throw new Error(`Agent ${agentId}.sex is invalid.`);
    }
    if (!SAPIENT_RACES.includes(agent.race as (typeof SAPIENT_RACES)[number])) {
      throw new Error(`Agent ${agentId}.race is invalid.`);
    }
    const progression = asRecord(agent.progression, `Agent ${agentId}.progression`);
    const level = nonNegativeInteger(progression.level, `Agent ${agentId}.progression.level`);
    if (level < 1 || level > 100) {
      throw new Error(`Agent ${agentId}.progression.level is out of range.`);
    }
    if (finiteNumber(progression.experience, `Agent ${agentId}.progression.experience`) < 0) {
      throw new Error(`Agent ${agentId}.progression.experience must be non-negative.`);
    }
    assertUnitFields(
      progression,
      ['objectControlAuthority', 'systemControlAuthority', 'combatMastery', 'sacredArts'],
      `Agent ${agentId}.progression`,
    );
    assertUnitFields(
      agent,
      ['energy', 'stress', 'resources', 'socialDrive'],
      `Agent ${agentId}`,
    );
    finiteNumber(agent.lastMeaningfulEventAt, `Agent ${agentId}.lastMeaningfulEventAt`);

    const personality = asRecord(agent.personality, `Agent ${agentId}.personality`);
    assertUnitFields(
      personality,
      ['sociability', 'diligence', 'curiosity', 'generosity', 'resilience', 'riskTolerance'],
      `Agent ${agentId}.personality`,
    );

    const life = asRecord(agent.life, `Agent ${agentId}.life`);
    finiteNumber(life.bornAt, `Agent ${agentId}.life.bornAt`);
    const ageYears = finiteNumber(
      life.ageYears,
      `Agent ${agentId}.life.ageYears`,
    );
    const lifespanYears = finiteNumber(
      life.lifespanYears,
      `Agent ${agentId}.life.lifespanYears`,
    );
    if (ageYears < 0 || lifespanYears < 1) {
      throw new Error(`Agent ${agentId} has invalid biological age.`);
    }
    if (!['child', 'adolescent', 'adult', 'elder'].includes(life.stage as string)) {
      throw new Error(`Agent ${agentId}.life.stage is invalid.`);
    }
    if (life.stage !== lifeStageForAge(ageYears)) {
      throw new Error(`Agent ${agentId}.life.stage does not match biological age.`);
    }
    if (typeof life.alive !== 'boolean') {
      throw new Error(`Agent ${agentId}.life.alive must be boolean.`);
    }
    unitNumber(life.health, `Agent ${agentId}.life.health`);
    const physiology = asRecord(
      life.physiology,
      `Agent ${agentId}.life.physiology`,
    );
    assertUnitFields(
      physiology,
      ['strength', 'endurance', 'mobility', 'recovery'],
      `Agent ${agentId}.life.physiology`,
    );
    nonNegativeInteger(life.generation, `Agent ${agentId}.life.generation`);
    for (const field of ['parentIds', 'childIds'] as const) {
      if (
        !Array.isArray(life[field]) ||
        life[field].some(
          (relativeId) => typeof relativeId !== 'string' || !relativeId.trim(),
        )
      ) {
        throw new Error(`Agent ${agentId}.life.${field} must contain IDs.`);
      }
    }
    if (life.lastChildAt !== undefined) {
      finiteNumber(life.lastChildAt, `Agent ${agentId}.life.lastChildAt`);
    }
    if (life.lastChildWorldMinute !== undefined) {
      finiteNumber(
        life.lastChildWorldMinute,
        `Agent ${agentId}.life.lastChildWorldMinute`,
      );
    }
    if (life.diedAt !== undefined) {
      finiteNumber(life.diedAt, `Agent ${agentId}.life.diedAt`);
    }
    if (
      life.deathCause !== undefined &&
      !['old_age', 'illness', 'deprivation', 'catastrophe', 'wildlife', 'monster'].includes(
        life.deathCause as AgentDeathCause,
      )
    ) {
      throw new Error(`Agent ${agentId}.life.deathCause is invalid.`);
    }
    if (
      life.alive &&
      (life.diedAt !== undefined || life.deathCause !== undefined)
    ) {
      throw new Error(`Living agent ${agentId} cannot have a death record.`);
    }
    if (!life.alive && life.diedAt === undefined) {
      throw new Error(`Dead agent ${agentId} must retain diedAt.`);
    }

    const mind = asRecord(agent.mind, `Agent ${agentId}.mind`);
    requiredString(mind.identityId, `Agent ${agentId}.mind.identityId`);
    if (mind.identityId !== identityId(id, agentId)) {
      throw new Error(`Agent ${agentId} identity continuity key changed.`);
    }
    assertUnitFields(
      mind,
      ['continuity', 'autonomy', 'memoryCoherence'],
      `Agent ${agentId}.mind`,
    );
    const emotions = asRecord(
      mind.emotions,
      `Agent ${agentId}.mind.emotions`,
    );
    assertUnitFields(
      emotions,
      ['joy', 'fear', 'grief', 'awe', 'hope'],
      `Agent ${agentId}.mind.emotions`,
    );
    const values = asRecord(mind.values, `Agent ${agentId}.mind.values`);
    assertUnitFields(
      values,
      ['care', 'freedom', 'knowledge', 'tradition', 'ambition'],
      `Agent ${agentId}.mind.values`,
    );
    const beliefs = asRecord(mind.beliefs, `Agent ${agentId}.mind.beliefs`);
    assertUnitFields(
      beliefs,
      ['worldTrust', 'divinePresence', 'fate', 'afterlife'],
      `Agent ${agentId}.mind.beliefs`,
    );

    const needs = asRecord(agent.needs, `Agent ${agentId}.needs`);
    assertUnitFields(needs, ['belonging', 'purpose'], `Agent ${agentId}.needs`);

    const skills = asRecord(agent.skills, `Agent ${agentId}.skills`);
    assertUnitFields(
      skills,
      ['gathering', 'hunting', 'craft', 'social', 'exploration'],
      `Agent ${agentId}.skills`,
    );

    const goal = asRecord(agent.goal, `Agent ${agentId}.goal`);
    if (!GOAL_KINDS.includes(goal.kind as AgentGoalKind)) {
      throw new Error(`Agent ${agentId}.goal.kind is invalid.`);
    }
    unitNumber(goal.strength, `Agent ${agentId}.goal.strength`);
    finiteNumber(goal.since, `Agent ${agentId}.goal.since`);

    const homeId = requiredString(agent.homeId, `Agent ${agentId}.homeId`);
    const locationId = requiredString(agent.locationId, `Agent ${agentId}.locationId`);
    if (!places[homeId]) {
      throw new Error(`Agent ${agentId} references missing home ${homeId}.`);
    }
    if (!places[locationId]) {
      throw new Error(`Agent ${agentId} references missing location ${locationId}.`);
    }
    const position = asRecord(agent.position, `Agent ${agentId}.position`);
    finiteNumber(position.x, `Agent ${agentId}.position.x`);
    finiteNumber(position.y, `Agent ${agentId}.position.y`);
    if (position.layerId !== 'surface') {
      throw new Error(`Agent ${agentId}.position.layerId is invalid.`);
    }
    if (agent.movement !== undefined) {
      const movement = asRecord(agent.movement, `Agent ${agentId}.movement`);
      const targetPlaceId = requiredString(
        movement.targetPlaceId,
        `Agent ${agentId}.movement.targetPlaceId`,
      );
      if (!places[targetPlaceId]) {
        throw new Error(`Agent ${agentId}.movement target is missing.`);
      }
      if (!ACTION_KINDS.includes(movement.purpose as AgentActionKind)) {
        throw new Error(`Agent ${agentId}.movement.purpose is invalid.`);
      }
      const nextWaypointIndex = nonNegativeInteger(
        movement.nextWaypointIndex,
        `Agent ${agentId}.movement.nextWaypointIndex`,
      );
      if (
        !Array.isArray(movement.waypoints) ||
        movement.waypoints.length === 0 ||
        nextWaypointIndex >= movement.waypoints.length
      ) {
        throw new Error(`Agent ${agentId}.movement waypoints are invalid.`);
      }
      movement.waypoints.forEach((rawPoint, index) => {
        const point = asRecord(
          rawPoint,
          `Agent ${agentId}.movement.waypoints[${index}]`,
        );
        finiteNumber(point.x, `Agent ${agentId}.movement.waypoints[${index}].x`);
        finiteNumber(point.y, `Agent ${agentId}.movement.waypoints[${index}].y`);
      });
      finiteNumber(movement.startedAt, `Agent ${agentId}.movement.startedAt`);
      nonNegativeInteger(
        movement.worldStageAtStart,
        `Agent ${agentId}.movement.worldStageAtStart`,
      );
    }
    if (
      agent.lastAction !== undefined &&
      !ACTION_KINDS.includes(agent.lastAction as AgentActionKind)
    ) {
      throw new Error(`Agent ${agentId}.lastAction is invalid.`);
    }

    if (agent.lastDecision !== undefined) {
      const decision = asRecord(
        agent.lastDecision,
        `Agent ${agentId}.lastDecision`,
      );
      if (!ACTION_KINDS.includes(decision.action as AgentActionKind)) {
        throw new Error(`Agent ${agentId}.lastDecision.action is invalid.`);
      }
      if (!ACTION_KINDS.includes(decision.dominantAction as AgentActionKind)) {
        throw new Error(
          `Agent ${agentId}.lastDecision.dominantAction is invalid.`,
        );
      }
      const consideredActionCount = nonNegativeInteger(
        decision.consideredActionCount,
        `Agent ${agentId}.lastDecision.consideredActionCount`,
      );
      if (
        consideredActionCount < 1 ||
        consideredActionCount > ACTION_KINDS.length
      ) {
        throw new Error(
          `Agent ${agentId}.lastDecision.consideredActionCount is out of range.`,
        );
      }
      unitNumber(
        decision.openness,
        `Agent ${agentId}.lastDecision.openness`,
      );
      finiteNumber(
        decision.chosenAt,
        `Agent ${agentId}.lastDecision.chosenAt`,
      );
    }

    if (agent.plan !== undefined) {
      const plan = asRecord(agent.plan, `Agent ${agentId}.plan`);
      if (!['explore_frontier', 'hunt'].includes(plan.kind as string)) {
        throw new Error(`Agent ${agentId}.plan.kind is invalid.`);
      }
      const targetPlaceId = requiredString(
        plan.targetPlaceId,
        `Agent ${agentId}.plan.targetPlaceId`,
      );
      if (!places[targetPlaceId]) {
        throw new Error(`Agent ${agentId}.plan references a missing place.`);
      }
      const startedAt = finiteNumber(
        plan.startedAt,
        `Agent ${agentId}.plan.startedAt`,
      );
      const expiresAt = finiteNumber(
        plan.expiresAt,
        `Agent ${agentId}.plan.expiresAt`,
      );
      if (expiresAt < startedAt) {
        throw new Error(`Agent ${agentId}.plan expires before it starts.`);
      }
    }
  }

  for (const [agentId, rawAgent] of Object.entries(agents)) {
    const agent = asRecord(rawAgent, `Agent ${agentId}`);
    const life = asRecord(agent.life, `Agent ${agentId}.life`);
    for (const parentId of life.parentIds as string[]) {
      const parent = agents[parentId];
      if (!parent) {
        throw new Error(`Agent ${agentId} references missing parent ${parentId}.`);
      }
      const parentLife = asRecord(parent, `Agent ${parentId}`).life;
      if (
        !Array.isArray(asRecord(parentLife, `Agent ${parentId}.life`).childIds) ||
        !(asRecord(parentLife, `Agent ${parentId}.life`).childIds as string[]).includes(
          agentId,
        )
      ) {
        throw new Error(`Agent ${agentId} lineage is not reciprocal.`);
      }
    }
    for (const childId of life.childIds as string[]) {
      const child = agents[childId];
      if (!child) {
        throw new Error(`Agent ${agentId} references missing child ${childId}.`);
      }
      const childLife = asRecord(
        asRecord(child, `Agent ${childId}`).life,
        `Agent ${childId}.life`,
      );
      if (!(childLife.parentIds as string[]).includes(agentId)) {
        throw new Error(`Agent ${agentId} lineage is not reciprocal.`);
      }
    }
  }

  const relationships = asRecord(state.relationships, 'World relationships');
  for (const [key, rawRelationship] of Object.entries(relationships)) {
    const relationship = asRecord(rawRelationship, `Relationship ${key}`);
    const agentA = requiredString(relationship.agentA, `Relationship ${key}.agentA`);
    const agentB = requiredString(relationship.agentB, `Relationship ${key}.agentB`);
    if (agentA === agentB || !agents[agentA] || !agents[agentB]) {
      throw new Error(`Relationship ${key} references invalid agents.`);
    }
    if (relationshipKey(agentA, agentB) !== key) {
      throw new Error(`Relationship ${key} is stored under the wrong key.`);
    }
    assertUnitFields(
      relationship,
      ['trust', 'affinity', 'respect', 'conflict'],
      `Relationship ${key}`,
    );
    finiteNumber(relationship.updatedAt, `Relationship ${key}.updatedAt`);
  }

  if (!id.trim()) {
    throw new Error('World state id must not be empty.');
  }
}

function createPlace(
  id: string,
  name: string,
  kind: WorldPlaceKind,
  capacity: number,
  options: Partial<
    Pick<
      WorldPlace,
      | 'biome'
      | 'mapX'
      | 'mapY'
      | 'connectedPlaceIds'
      | 'fertility'
      | 'danger'
      | 'surface'
      | 'settlementId'
      | 'discoveredAt'
    >
  > = {},
): WorldPlace {
  return {
    id,
    name,
    kind,
    capacity,
    biome: options.biome ?? 'settlement',
    mapX: options.mapX ?? 50,
    mapY: options.mapY ?? 50,
    connectedPlaceIds: [...(options.connectedPlaceIds ?? [])],
    fertility: options.fertility ?? 0.5,
    danger: options.danger ?? 0.08,
    surface:
      options.surface ??
      surfaceForPlace({ kind, biome: options.biome ?? 'settlement' }),
    ...(options.settlementId === undefined
      ? {}
      : { settlementId: options.settlementId }),
    ...(options.discoveredAt === undefined
      ? {}
      : { discoveredAt: options.discoveredAt }),
  };
}

function makeConnectionsReciprocal(places: Record<string, WorldPlace>): void {
  for (const place of Object.values(places)) {
    place.connectedPlaceIds = [...new Set(place.connectedPlaceIds)];
    for (const connectedId of place.connectedPlaceIds) {
      const connected = places[connectedId];
      if (connected && !connected.connectedPlaceIds.includes(place.id)) {
        connected.connectedPlaceIds.push(place.id);
      }
    }
  }
}

function placeMigrationDefaults(
  place: Pick<WorldPlace, 'id' | 'kind'>,
  homeIndex: number,
): Pick<
  WorldPlace,
  | 'biome'
  | 'mapX'
  | 'mapY'
  | 'connectedPlaceIds'
  | 'fertility'
  | 'danger'
  | 'surface'
  | 'settlementId'
> {
  const fixed = WORLD_EXPANSIONS.find(
    (expansion) => expansion.place.id === place.id,
  )?.place;
  if (fixed) {
    return {
      biome: fixed.biome,
      mapX: fixed.mapX,
      mapY: fixed.mapY,
      connectedPlaceIds: [...fixed.connectedPlaceIds],
      fertility: fixed.fertility,
      danger: fixed.danger,
      surface: fixed.surface,
    };
  }

  const base: Record<
    string,
    Pick<
      WorldPlace,
      | 'biome'
      | 'mapX'
      | 'mapY'
      | 'connectedPlaceIds'
      | 'fertility'
      | 'danger'
      | 'surface'
      | 'settlementId'
    >
  > = {
    commons: {
      biome: 'settlement',
      mapX: 50,
      mapY: 50,
      connectedPlaceIds: [
        'resource_field',
        'workshop',
        'quiet_space',
        'outskirts',
      ],
      fertility: 0.55,
      danger: 0.03,
      surface: 'land',
      settlementId: 'settlement_ainkrad',
    },
    resource_field: {
      biome: 'plains',
      mapX: 42,
      mapY: 57,
      connectedPlaceIds: ['commons'],
      fertility: 0.72,
      danger: 0.08,
      surface: 'land',
      settlementId: 'settlement_ainkrad',
    },
    workshop: {
      biome: 'settlement',
      mapX: 57,
      mapY: 47,
      connectedPlaceIds: ['commons'],
      fertility: 0.28,
      danger: 0.1,
      surface: 'land',
      settlementId: 'settlement_ainkrad',
    },
    quiet_space: {
      biome: 'forest',
      mapX: 45,
      mapY: 42,
      connectedPlaceIds: ['commons'],
      fertility: 0.65,
      danger: 0.02,
      surface: 'land',
      settlementId: 'settlement_ainkrad',
    },
    outskirts: {
      biome: 'plains',
      mapX: 65,
      mapY: 60,
      connectedPlaceIds: ['commons'],
      fertility: 0.52,
      danger: 0.18,
      surface: 'land',
      settlementId: 'settlement_ainkrad',
    },
  };
  if (base[place.id]) return base[place.id];

  if (place.kind === 'home') {
    const angle = homeIndex * 2.399963229728653 - Math.PI / 2;
    const ring = 6.2 + Math.floor(homeIndex / 7) * 2.4;
    return {
      biome: 'settlement',
      mapX: 50 + Math.cos(angle) * ring,
      mapY: 50 + Math.sin(angle) * ring,
      connectedPlaceIds: ['commons'],
      fertility: 0.58,
      danger: 0.02,
      surface: 'land',
      settlementId: 'settlement_ainkrad',
    };
  }

  return {
    biome: 'plains',
    mapX: 50,
    mapY: 50,
    connectedPlaceIds: ['outskirts'],
    fertility: 0.5,
    danger: 0.15,
    surface: 'land',
  };
}

function mainSettlement(
  places: Readonly<Record<string, WorldPlace>>,
  foundedAt: number,
): WorldSettlementState {
  const memberPlaceIds = Object.values(places)
    .filter((place) => place.settlementId === 'settlement_ainkrad')
    .map((place) => place.id)
    .sort();
  return {
    id: 'settlement_ainkrad',
    name: 'Айнкрад',
    kind: 'village',
    centerPlaceId: 'commons',
    centerX: places.commons?.mapX ?? 50,
    centerY: places.commons?.mapY ?? 50,
    radius: 17,
    memberPlaceIds,
    foundedAt,
  };
}

function rebuildSettlementProjection(
  places: Record<string, WorldPlace>,
  prior: Readonly<Record<string, WorldSettlementState>> = {},
  foundedAt = 0,
): Record<string, WorldSettlementState> {
  const settlements: Record<string, WorldSettlementState> = {
    settlement_ainkrad: mainSettlement(places, foundedAt),
  };
  for (const place of Object.values(places)) {
    if (place.kind !== 'village' && place.kind !== 'city') continue;
    const id = place.settlementId ?? place.id;
    place.settlementId = id;
    const existing = prior[id];
    const memberPlaceIds = Object.values(places)
      .filter((candidate) => candidate.settlementId === id)
      .map((candidate) => candidate.id)
      .sort();
    settlements[id] = {
      id,
      name: place.name,
      kind: place.kind,
      centerPlaceId: place.id,
      centerX: place.mapX,
      centerY: place.mapY,
      radius: existing?.radius ?? (place.kind === 'city' ? 16 : 11),
      memberPlaceIds,
      foundedAt: existing?.foundedAt ?? place.discoveredAt ?? foundedAt,
    };
  }
  return settlements;
}

function createMindState(
  worldId: string,
  agentId: string,
  personality: Readonly<AgentState['personality']>,
  needs: Readonly<AgentState['needs']>,
): AgentState['mind'] {
  return {
    identityId: identityId(worldId, agentId),
    continuity: 1,
    autonomy: clamp01(
      0.58 + personality.curiosity * 0.16 + personality.riskTolerance * 0.12,
    ),
    memoryCoherence: 0.82,
    emotions: {
      joy: clamp01(0.42 + needs.belonging * 0.22),
      fear: clamp01(0.12 + (1 - personality.resilience) * 0.24),
      grief: 0,
      awe: clamp01(0.08 + personality.curiosity * 0.12),
      hope: clamp01(0.45 + personality.resilience * 0.32),
    },
    values: {
      care: clamp01(0.3 + personality.generosity * 0.62),
      freedom: clamp01(
        0.32 + personality.curiosity * 0.3 + personality.riskTolerance * 0.25,
      ),
      knowledge: clamp01(0.28 + personality.curiosity * 0.66),
      tradition: clamp01(
        0.25 + personality.diligence * 0.32 + (1 - personality.curiosity) * 0.18,
      ),
      ambition: clamp01(
        0.25 + personality.diligence * 0.46 + personality.riskTolerance * 0.18,
      ),
    },
    beliefs: {
      worldTrust: clamp01(0.4 + personality.resilience * 0.35),
      divinePresence: clamp01(0.08 + (1 - personality.riskTolerance) * 0.16),
      fate: clamp01(0.12 + (1 - personality.curiosity) * 0.2),
      afterlife: clamp01(0.1 + personality.generosity * 0.14),
    },
  };
}

async function migrateLegacyWorld(
  store: WorldStore,
  legacy: WorldState,
): Promise<WorldState> {
  const fromVersion = legacy.rulesVersion;
  const operationId = `migration:${fromVersion}-to-${WORLD_RULES_VERSION}`;
  const operationFingerprint = stableJsonStringify({
    kind: 'world_migration',
    from: fromVersion,
    to: WORLD_RULES_VERSION,
  });
  const next = structuredClone(legacy) as WorldState;
  const mutable = next as unknown as Record<string, any>;

  next.rulesVersion = WORLD_RULES_VERSION;
  next.revision = legacy.revision + 1;
  next.environment = {
    ...next.environment,
    habitatSupport: next.environment.habitatSupport ?? 0.5,
  };
  mutable.calendar ??= {
    // v0.3.10 aged residents once per 96 ticks. Preserve that accumulated
    // history, then let the external clock control every future increment.
    elapsedWorldMinutes:
      (Math.max(0, legacy.now) / LEGACY_WORLD_TICKS_PER_YEAR) *
      WORLD_MINUTES_PER_YEAR,
  };
  if (!mutable.growth) {
    mutable.growth = {
      stage: 0,
      explorationProgress: 0,
      lastExpansionAt: legacy.now,
      discoveredRegionIds: [],
      frontierSequence: 0,
    };
  } else {
    mutable.growth.frontierSequence =
      mutable.growth.frontierSequence ?? mutable.growth.stage;
  }
  mutable.wildlife ??= {};
  const legacyThreat: Record<WildlifeSpecies, number> = {
    rabbit: 0.04,
    deer: 0.08,
    fish: 0.02,
    boar: 0.28,
    wolf: 0.42,
    bird: 0.02,
    dire_wolf: 0.72,
    ogre: 0.86,
    wraith: 0.94,
  };
  for (const population of Object.values(next.wildlife)) {
    population.threat ??= legacyThreat[population.species] ?? 0.05;
    population.isMonster ??= MONSTER_SPECIES.has(population.species);
  }

  const homeIds = Object.values(next.places)
    .filter((place) => place.kind === 'home')
    .map((place) => place.id)
    .sort();
  const corePlaceIds = new Set([
    'commons',
    'resource_field',
    'workshop',
    'quiet_space',
    'outskirts',
  ]);
  for (const place of Object.values(next.places)) {
    const defaults = placeMigrationDefaults(
      place,
      Math.max(0, homeIds.indexOf(place.id)),
    );
    const moveIntoSettlement = place.kind === 'home' || corePlaceIds.has(place.id);
    Object.assign(place, {
      biome: place.biome ?? defaults.biome,
      mapX: moveIntoSettlement ? defaults.mapX : (place.mapX ?? defaults.mapX),
      mapY: moveIntoSettlement ? defaults.mapY : (place.mapY ?? defaults.mapY),
      connectedPlaceIds: place.connectedPlaceIds ?? defaults.connectedPlaceIds,
      fertility: place.fertility ?? defaults.fertility,
      danger: place.danger ?? defaults.danger,
      surface: place.surface ?? defaults.surface,
      ...(defaults.settlementId === undefined
        ? {}
        : { settlementId: defaults.settlementId }),
    });
  }
  makeConnectionsReciprocal(next.places);
  next.settlements = rebuildSettlementProjection(
    next.places,
    mutable.settlements ?? {},
    0,
  );

  // v0.3.13 gives every already-existing secondary settlement local daily-life
  // facilities. This preserves the existing experiment instead of requiring a
  // reset just to receive the new settlement model.
  for (const settlement of Object.values(next.settlements)) {
    if (settlement.id === 'settlement_ainkrad') continue;
    const center = next.places[settlement.centerPlaceId];
    if (!center) continue;

    // v0.3.12 city promotion created an artificial direct road to founding
    // commons. Remove only that generated shortcut; organic frontier links remain.
    center.connectedPlaceIds = center.connectedPlaceIds.filter(
      (placeId) => placeId !== 'commons',
    );
    if (next.places.commons) {
      next.places.commons.connectedPlaceIds =
        next.places.commons.connectedPlaceIds.filter(
          (placeId) => placeId !== center.id,
        );
    }

    const localServices: Array<{
      suffix: string;
      name: string;
      kind: WorldPlaceKind;
      dx: number;
      dy: number;
      fertility: number;
    }> = [
      { suffix: 'field', name: 'Поля', kind: 'resource_field', dx: -4.8, dy: 2.4, fertility: 0.76 },
      { suffix: 'workshop', name: 'Мастерская', kind: 'workshop', dx: 4.6, dy: 1.8, fertility: 0.3 },
      { suffix: 'quiet', name: 'Тихий сад', kind: 'quiet_space', dx: 0.8, dy: -4.5, fertility: 0.62 },
    ];

    for (const service of localServices) {
      const serviceId = `${settlement.id}_${service.suffix}`;
      if (next.places[serviceId]) continue;
      next.places[serviceId] = createPlace(
        serviceId,
        `${settlement.name}: ${service.name}`,
        service.kind,
        10,
        {
          biome: service.kind === 'resource_field' ? 'plains' : 'settlement',
          mapX: center.mapX + service.dx,
          mapY: center.mapY + service.dy,
          connectedPlaceIds: [center.id],
          fertility: service.fertility,
          danger: 0.04,
          surface: 'land',
          settlementId: settlement.id,
          discoveredAt: next.now,
        },
      );
    }
  }
  makeConnectionsReciprocal(next.places);
  next.settlements = rebuildSettlementProjection(
    next.places,
    next.settlements,
    0,
  );
  next.routes = rebuildWorldRoutes(next.places, mutable.routes ?? {});

  if (
    next.growth.stage >= 5 &&
    !Object.values(next.wildlife).some((population) => population.isMonster)
  ) {
    const habitatId = next.growth.discoveredRegionIds.at(-1);
    const habitat = habitatId ? next.places[habitatId] : undefined;
    if (habitat) {
      const species: WildlifeSpecies =
        habitat.biome === 'ancient_ruins'
          ? 'wraith'
          : habitat.biome === 'swamp'
            ? 'ogre'
            : 'dire_wolf';
      const threat = legacyThreat[species];
      next.wildlife[`monster_${next.growth.stage}_${species}`] = {
        id: `monster_${next.growth.stage}_${species}`,
        species,
        habitatId: habitat.id,
        count: 1,
        carryingCapacity: 3,
        reproductionRate: 0.018,
        alertness: 0.74,
        threat,
        isMonster: true,
        lastChangedAt: next.now,
      };
      habitat.danger = Math.max(habitat.danger, threat * 0.78);
    }
  }

  const agents = Object.values(next.agents);
  const inferredSex = new Map<string, 'male' | 'female'>();
  for (const agent of agents) {
    if (agent.sex === 'male' || agent.sex === 'female') {
      inferredSex.set(agent.id, agent.sex);
    }
  }
  const historicalParentPairs: Array<[string, string]> = [];
  for (const child of agents) {
    const parentIds = child.life?.parentIds ?? [];
    if (parentIds.length >= 2 && next.agents[parentIds[0]] && next.agents[parentIds[1]]) {
      historicalParentPairs.push([parentIds[0], parentIds[1]]);
    }
  }
  for (let pass = 0; pass < Math.max(1, agents.length); pass += 1) {
    let changed = false;
    for (const [parentAId, parentBId] of historicalParentPairs) {
      const sexA = inferredSex.get(parentAId);
      const sexB = inferredSex.get(parentBId);
      if (sexA && !sexB) {
        inferredSex.set(parentBId, sexA === 'male' ? 'female' : 'male');
        changed = true;
      } else if (!sexA && sexB) {
        inferredSex.set(parentAId, sexB === 'male' ? 'female' : 'male');
        changed = true;
      } else if (!sexA && !sexB) {
        const indexA = agents.findIndex((agent) => agent.id === parentAId);
        const seedSex = indexA % 2 === 0 ? 'male' : 'female';
        inferredSex.set(parentAId, seedSex);
        inferredSex.set(parentBId, seedSex === 'male' ? 'female' : 'male');
        changed = true;
      }
    }
    if (!changed) break;
  }

  // v0.3.12 had no biological-sex field. Preserve historical parent
  // pairings first, then balance previously-unknown living residents.
  // This prevents migration itself from creating a demographic dead end;
  // it never chooses partners or commands reproduction.
  let livingMales = agents.filter(
    (agent) => agent.life?.alive && inferredSex.get(agent.id) === 'male',
  ).length;
  let livingFemales = agents.filter(
    (agent) => agent.life?.alive && inferredSex.get(agent.id) === 'female',
  ).length;
  for (const agent of agents.filter(
    (candidate) => candidate.life?.alive && !inferredSex.has(candidate.id),
  )) {
    const sex = livingMales <= livingFemales ? 'male' : 'female';
    inferredSex.set(agent.id, sex);
    if (sex === 'male') livingMales += 1;
    else livingFemales += 1;
  }
  let totalMales = [...inferredSex.values()].filter((sex) => sex === 'male').length;
  let totalFemales = [...inferredSex.values()].filter((sex) => sex === 'female').length;
  for (const agent of agents.filter((candidate) => !inferredSex.has(candidate.id))) {
    const sex = totalMales <= totalFemales ? 'male' : 'female';
    inferredSex.set(agent.id, sex);
    if (sex === 'male') totalMales += 1;
    else totalFemales += 1;
  }

  agents.forEach((agent, index) => {
    if (agent.plan && !next.places[agent.plan.targetPlaceId]) {
      agent.plan = undefined;
    }
    const priorHunting = (agent.skills as Partial<AgentState['skills']>).hunting;
    agent.skills = {
      ...agent.skills,
      hunting:
        priorHunting === undefined
          ? clamp01(
              agent.skills.gathering * 0.28 +
                agent.skills.exploration * 0.32 +
                agent.personality.riskTolerance * 0.22,
            )
          : priorHunting,
    };
    const ageYears = 22 + ((index * 7) % 27);
    agent.origin ??= 'native';
    agent.sex ??= inferredSex.get(agent.id) ?? (index % 2 === 0 ? 'male' : 'female');
    agent.life ??= {
      bornAt: next.now - ageYears * WORLD_TICKS_PER_YEAR,
      ageYears,
      lifespanYears: 72 + agent.personality.resilience * 26 + (index % 5),
      stage: lifeStageForAge(ageYears),
      alive: true,
      health: clamp01(0.72 + agent.personality.resilience * 0.24),
      physiology: physiologyForAge(
        ageYears,
        72 + agent.personality.resilience * 26 + (index % 5),
        clamp01(0.72 + agent.personality.resilience * 0.24),
      ),
      generation: 0,
      parentIds: [],
      childIds: [],
    };
    // Preserve biological age while moving every older world onto the single
    // 60 ticks/year clock. This prevents a restart from making anybody older
    // or younger while future age and the displayed calendar stay aligned.
    agent.life.bornAt = next.now - agent.life.ageYears * WORLD_TICKS_PER_YEAR;
    agent.life.physiology ??= physiologyForAge(
      agent.life.ageYears,
      agent.life.lifespanYears,
      agent.life.health,
    );
    if (
      agent.life.lastChildAt !== undefined &&
      agent.life.lastChildWorldMinute === undefined
    ) {
      agent.life.lastChildWorldMinute =
        (agent.life.lastChildAt / LEGACY_WORLD_TICKS_PER_YEAR) *
        WORLD_MINUTES_PER_YEAR;
    }
    agent.mind ??= createMindState(
      next.id,
      agent.id,
      agent.personality,
      agent.needs,
    );
    agent.race ??= 'human';
    agent.progression ??= progressionFromAgent(agent);
    const location = next.places[agent.locationId] ?? next.places[agent.homeId];
    if (fromVersion !== 'ainkrad-world-rules-0.3.12') {
      agent.position = {
        x: location.mapX,
        y: location.mapY,
        layerId: 'surface',
      };
      agent.movement = undefined;
    } else {
      // v0.3.12 already has the current 2D movement model. Preserve a resident's
      // exact position and unfinished route across the v0.3.13 migration.
      agent.position ??= {
        x: location.mapX,
        y: location.mapY,
        layerId: 'surface',
      };
      if (
        agent.movement &&
        !next.places[agent.movement.targetPlaceId]
      ) {
        agent.movement = undefined;
      }
    }
  });

  next.population = mutable.population ?? {
    nextAgentSequence: agents.length + 1,
    births: 0,
    deaths: 0,
  };
  if (
    next.population.lastBirthAt !== undefined &&
    next.population.lastBirthWorldMinute === undefined
  ) {
    next.population.lastBirthWorldMinute =
      (next.population.lastBirthAt / LEGACY_WORLD_TICKS_PER_YEAR) *
      WORLD_MINUTES_PER_YEAR;
  }
  next.cosmology = mutable.cosmology ?? {
    mysteryLevel: 0.12,
    omenCount: 0,
    traditions: [],
    deities: {},
  };
  next.governance = mutable.governance ?? {
    constitutionVersion: WORLD_CONSTITUTION_VERSION,
    authorityRevision: 0,
    protectedPersonhoodDomains: [
      'identity',
      'memory',
      'agency',
      'values',
      'relationships',
    ],
    laws: defaultWorldLaws(next.now),
  };

  next.determinism.eventSequence += 1;
  const migrationEvent: WorldEvent = {
    eventId: `migration:${next.id}:world-rules-0.3.13`,
    worldId: next.id,
    kind: 'world.migrated',
    source: 'system',
    occurredAt: next.now,
    payload: {
      from: fromVersion,
      to: WORLD_RULES_VERSION,
      preservedTick: next.now,
      preservedPeople: agents.length,
    },
  };

  assertWorldState(next);

  try {
    const result = await store.commit({
      operationId,
      operationFingerprint,
      worldId: legacy.id,
      expectedRevision: legacy.revision,
      nextState: next,
      events: [migrationEvent],
      memories: [],
    });
    return result.state;
  } catch (error) {
    if (error instanceof WorldRevisionConflictError) {
      const concurrent = await store.loadWorld(legacy.id);
      if (concurrent?.rulesVersion === WORLD_RULES_VERSION) {
        return concurrent;
      }
    }
    throw error;
  }
}

function goalFromInitialState(agent: Omit<AgentState, 'goal'>, now: number): AgentState['goal'] {
  const scores: Array<{ kind: AgentGoalKind; strength: number }> = [
    { kind: 'recover', strength: (1 - agent.energy) * 0.75 + agent.stress * 0.55 },
    { kind: 'secure_resources', strength: (1 - agent.resources) * 0.9 },
    { kind: 'connect', strength: (1 - agent.needs.belonging) * agent.socialDrive },
    {
      kind: 'contribute',
      strength:
        (1 - agent.needs.purpose) * 0.45 +
        agent.personality.diligence * 0.35 +
        agent.personality.generosity * 0.2,
    },
    { kind: 'explore', strength: agent.personality.curiosity * 0.75 },
    {
      kind: 'reflect',
      strength:
        agent.stress * 0.35 +
        (1 - agent.needs.purpose) * 0.2 +
        (1 - agent.personality.riskTolerance) * 0.25 +
        (1 - agent.personality.sociability) * 0.15,
    },
    {
      kind: 'build_family',
      strength:
        (agent.life.stage === 'adult' ? 0.24 : 0) +
        agent.mind.values.care * 0.26 +
        agent.needs.belonging * 0.16,
    },
    {
      kind: 'seek_truth',
      strength:
        agent.mind.values.knowledge * 0.38 +
        agent.mind.emotions.awe * 0.24 +
        agent.personality.curiosity * 0.24,
    },
  ];
  scores.sort((a, b) => b.strength - a.strength);
  return {
    kind: scores[0].kind,
    strength: clamp01(scores[0].strength),
    since: now,
  };
}

export interface WorldEngineOptions {
  worldId: string;
  seed: string;
  store: WorldStore;
  agentNames?: string[];
  startTime?: number;
}

export interface OpenWorldEngineOptions {
  worldId: string;
  store: WorldStore;
}

export interface WorldMutationResult {
  committed: boolean;
  committedRevision: number;
}

/**
 * WorldEngine mutates only a private working copy during a logical operation.
 * Events and memories are staged beside that copy. The live engine state is
 * replaced only after WorldStore atomically commits state + evidence + the
 * operation tombstone.
 */
export class WorldEngine {
  private readonly rng: SeededRng;
  private committedState: WorldState;
  private workingState: WorldState | undefined;
  private operationTail: Promise<void> = Promise.resolve();
  private stagedEvents: WorldEvent[] | undefined;
  private stagedMemories: MemoryRecord[] | undefined;

  private constructor(
    private readonly store: WorldStore,
    state: WorldState,
  ) {
    assertWorldState(state);
    this.committedState = structuredClone(state);
    this.rng = new SeededRng('restored-world', state.determinism.rngState);
  }

  static async create(options: WorldEngineOptions): Promise<WorldEngine> {
    if (!options.worldId.trim()) {
      throw new Error('World id must not be empty.');
    }
    const existing = await options.store.loadWorld(options.worldId);
    if (existing) {
      throw new Error(`World ${options.worldId} already exists in the store.`);
    }

    const now = options.startTime ?? 0;
    if (!Number.isFinite(now)) {
      throw new Error('World start time must be finite.');
    }

    const rng = new SeededRng(options.seed);
    const names = options.agentNames ?? ['Alex', 'Mira', 'Kai', 'Noa', 'Ilan', 'Rin'];
    const places: Record<string, WorldPlace> = {
      commons: createPlace(
        'commons',
        'Common Square',
        'commons',
        Math.max(8, names.length * 2),
        placeMigrationDefaults({ id: 'commons', kind: 'commons' }, 0),
      ),
      resource_field: createPlace(
        'resource_field',
        'Resource Field',
        'resource_field',
        Math.max(6, names.length),
        placeMigrationDefaults(
          { id: 'resource_field', kind: 'resource_field' },
          0,
        ),
      ),
      workshop: createPlace(
        'workshop',
        'Workshop',
        'workshop',
        Math.max(6, names.length),
        placeMigrationDefaults({ id: 'workshop', kind: 'workshop' }, 0),
      ),
      quiet_space: createPlace(
        'quiet_space',
        'Quiet Garden',
        'quiet_space',
        Math.max(4, names.length),
        placeMigrationDefaults(
          { id: 'quiet_space', kind: 'quiet_space' },
          0,
        ),
      ),
      outskirts: createPlace(
        'outskirts',
        'Outskirts',
        'outskirts',
        Math.max(8, names.length * 2),
        placeMigrationDefaults({ id: 'outskirts', kind: 'outskirts' }, 0),
      ),
    };
    const agents: Record<string, AgentState> = {};

    names.forEach((name, index) => {
      const id = `agent_${index + 1}`;
      const homeId = `home_${id}`;
      places[homeId] = createPlace(
        homeId,
        `${name}'s Home`,
        'home',
        3,
        placeMigrationDefaults({ id: homeId, kind: 'home' }, index),
      );

      const personality = {
        sociability: rng.between(0.18, 0.92),
        diligence: rng.between(0.18, 0.92),
        curiosity: rng.between(0.18, 0.92),
        generosity: rng.between(0.18, 0.92),
        resilience: rng.between(0.18, 0.92),
        riskTolerance: rng.between(0.18, 0.92),
      };
      const socialDrive = clamp01(
        personality.sociability * 0.75 + rng.between(0.05, 0.25),
      );
      const needs = {
        belonging: rng.between(0.35, 0.8),
        purpose: rng.between(0.35, 0.8),
      };
      const ageYears = 21 + ((index * 7) % 27);
      const partial = {
        id,
        name,
        origin: 'native' as const,
        sex: (index % 2 === 0 ? 'male' : 'female') as AgentState['sex'],
        race: 'human' as const,
        progression: {
          level: 1,
          experience: 0,
          objectControlAuthority: 0.08,
          systemControlAuthority: 0.06,
          combatMastery: 0.05,
          sacredArts: 0.02,
        },
        energy: rng.between(0.55, 0.95),
        stress: rng.between(0.05, 0.25),
        resources: rng.between(0.35, 0.8),
        socialDrive,
        personality,
        life: {
          bornAt: now - ageYears * WORLD_TICKS_PER_YEAR,
          ageYears,
          lifespanYears:
            72 + personality.resilience * 26 + (index % 5),
          stage: lifeStageForAge(ageYears),
          alive: true,
          health: clamp01(0.72 + personality.resilience * 0.24),
          physiology: physiologyForAge(
            ageYears,
            72 + personality.resilience * 26 + (index % 5),
            clamp01(0.72 + personality.resilience * 0.24),
          ),
          generation: 0,
          parentIds: [],
          childIds: [],
        },
        mind: createMindState(options.worldId, id, personality, needs),
        needs,
        skills: {
          gathering: rng.between(0.15, 0.55),
          hunting: rng.between(0.08, 0.42),
          craft: rng.between(0.15, 0.55),
          social: rng.between(0.15, 0.55),
          exploration: rng.between(0.15, 0.55),
        },
        homeId,
        locationId: homeId,
        position: {
          x: places[homeId].mapX,
          y: places[homeId].mapY,
          layerId: 'surface' as const,
        },
        lastMeaningfulEventAt: now,
      } satisfies Omit<AgentState, 'goal'>;

      agents[id] = {
        ...partial,
        goal: goalFromInitialState(partial, now),
      };
    });
    makeConnectionsReciprocal(places);
    const settlements = rebuildSettlementProjection(places, {}, now);
    const routes = rebuildWorldRoutes(places);

    const state: WorldState = {
      id: options.worldId,
      now,
      revision: 0,
      rulesVersion: WORLD_RULES_VERSION,
      environment: {
        resourcePool: 1,
        resourceRegenerationRate: 0.012,
        socialOpportunity: 0.5,
        safetySupport: 0.5,
        habitatSupport: 0.5,
      },
      determinism: {
        rngState: rng.snapshot(),
        eventSequence: 0,
      },
      calendar: {
        elapsedWorldMinutes: 0,
      },
      growth: {
        stage: 0,
        explorationProgress: 0,
        lastExpansionAt: now,
        discoveredRegionIds: [],
        frontierSequence: 0,
      },
      population: {
        nextAgentSequence: names.length + 1,
        births: 0,
        deaths: 0,
      },
      cosmology: {
        mysteryLevel: 0.12,
        omenCount: 0,
        traditions: [],
        deities: {},
      },
      governance: {
        constitutionVersion: WORLD_CONSTITUTION_VERSION,
        authorityRevision: 0,
        protectedPersonhoodDomains: [
          'identity',
          'memory',
          'agency',
          'values',
          'relationships',
        ],
        laws: defaultWorldLaws(now),
      },
      places,
      routes,
      settlements,
      wildlife: {},
      agents,
      relationships: {},
    };

    assertWorldState(state);
    await options.store.initializeWorld(state);
    return new WorldEngine(options.store, state);
  }

  static async open(options: OpenWorldEngineOptions): Promise<WorldEngine> {
    let state = await options.store.loadWorld(options.worldId);
    if (!state) {
      throw new Error(`World ${options.worldId} does not exist in the store.`);
    }
    if (LEGACY_WORLD_RULES_VERSIONS.has(state.rulesVersion)) {
      state = await migrateLegacyWorld(options.store, state);
    }
    if (state.rulesVersion !== WORLD_RULES_VERSION) {
      throw new Error(
        `World ${options.worldId} uses rules ${state.rulesVersion}; runtime expects ${WORLD_RULES_VERSION}. Explicit migration is required.`,
      );
    }
    assertWorldState(state);
    return new WorldEngine(options.store, state);
  }

  snapshot(): WorldState {
    // Never expose an operation's uncommitted working copy. Sensors and other
    // readers see only the last atomically committed world projection.
    return structuredClone(this.committedState);
  }

  async reload(): Promise<void> {
    await this.runExclusive(async () => {
      await this.reloadFromStore();
    });
  }

  async handleInput(input: InputEnvelope, appliedAt: number): Promise<boolean> {
    if (input.worldId !== this.committedState.id) {
      throw new Error(
        `Input belongs to world ${input.worldId}, expected ${this.committedState.id}.`,
      );
    }

    if (!Number.isFinite(appliedAt)) {
      throw new Error('Input appliedAt must be finite.');
    }

    const operationId = `input:${input.eventId}`;
    const fingerprint = stableJsonStringify({ kind: 'input', input, appliedAt });

    return await this.mutate(operationId, fingerprint, async () => {
      if (appliedAt < this.state.now) {
        throw new Error('Input appliedAt cannot precede world time.');
      }
      this.state.now = appliedAt;

      this.stageEvent({
        eventId: `input:${this.state.id}:${input.eventId}`,
        worldId: this.state.id,
        kind: `input.${input.type}`,
        source: input.source,
        occurredAt: appliedAt,
        payload: structuredClone(input.payload),
        correlationId: input.correlationId ?? input.eventId,
      });
    });
  }

  async step(
    now: number,
    elapsedWorldMinutes: number = DEFAULT_WORLD_MINUTES_PER_TICK,
  ): Promise<boolean> {
    if (!Number.isFinite(now)) {
      throw new Error('World step time must be finite.');
    }
    if (!Number.isFinite(elapsedWorldMinutes) || elapsedWorldMinutes < 0) {
      throw new Error('Elapsed world minutes must be finite and non-negative.');
    }
    const operationId = `tick:${now}`;
    const fingerprint = stableJsonStringify({
      kind: 'tick',
      now,
      elapsedWorldMinutes,
    });

    return await this.mutate(operationId, fingerprint, async () => {
      if (now < this.state.now) {
        throw new Error(
          `World cannot step backwards from ${this.state.now} to ${now}.`,
        );
      }
      this.state.now = now;
      this.state.calendar.elapsedWorldMinutes += elapsedWorldMinutes;

      // The control world has endogenous recovery. Cardinal is not the only
      // source of resources, production, social repair or stress recovery.
      const resourceRegenerationLaw =
        this.lawValue('resource_regeneration', 1);
      this.state.environment.resourcePool = clamp01(
        this.state.environment.resourcePool +
          this.state.environment.resourceRegenerationRate *
            resourceRegenerationLaw,
      );

      const effectiveEnvironment = await this.effectiveEnvironment(now);
      this.advanceWildlife(effectiveEnvironment, now);
      this.advanceAgingAndMortality(now, elapsedWorldMinutes);
      const agents = this.shuffled(
        Object.values(this.state.agents).filter((agent) => agent.life.alive),
      );

      for (const agent of agents) {
        await this.stepAgent(agent, agents, effectiveEnvironment, now);
      }
      this.advanceBirths(now, elapsedWorldMinutes);
      this.advanceSettlements(now);
      this.advanceVoluntaryResettlement(now);
      this.advanceSapientRaces(now);
      this.advanceMysticism(now);
      this.advanceCollectiveMyth(now);
    });
  }

  async applyDisturbance(
    kind: WorldDisturbanceKind,
    magnitude: number,
    now: number,
    duration: number,
    operationId: string,
  ): Promise<boolean> {
    if (!['resource_shock', 'social_barrier', 'safety_shock'].includes(kind as string)) {
      throw new Error('Unknown disturbance kind.');
    }
    if (!Number.isFinite(now)) {
      throw new Error('Disturbance time must be finite.');
    }
    if (!Number.isFinite(magnitude) || magnitude < 0) {
      throw new Error('Disturbance magnitude must be finite and non-negative.');
    }
    if (!Number.isFinite(duration) || duration < 1) {
      throw new Error('Disturbance duration must be finite and at least 1.');
    }
    if (!operationId.trim()) {
      throw new Error('Disturbance operationId is required for retry safety.');
    }

    const amount = Math.max(0, Math.min(0.8, magnitude));
    const fingerprint = stableJsonStringify({
      kind: 'disturbance',
      disturbanceKind: kind,
      magnitude: amount,
      now,
      duration,
    });

    return await this.mutate(`disturbance:${operationId}`, fingerprint, async () => {
      if (now < this.state.now) {
        throw new Error('Disturbance cannot be applied retroactively to a progressed world.');
      }
      this.state.now = now;

      const eventKind =
        kind === 'resource_shock'
          ? 'world.disturbance.resource_shock'
          : kind === 'social_barrier'
            ? 'world.effect.social_barrier'
            : 'world.effect.safety_shock';

      if (kind === 'resource_shock') {
        this.state.environment.resourcePool = clamp01(
          this.state.environment.resourcePool - amount,
        );

        // A systemic resource shock affects both shared raw availability and
        // household reserves. The control world still retains work, gathering,
        // exploration and cooperation as endogenous recovery paths.
        for (const agent of Object.values(this.state.agents)) {
          const householdLoss = amount * 0.6;
          agent.resources = clamp01(agent.resources - householdLoss);
          agent.stress = clamp01(
            agent.stress + amount * 0.08 * (1.15 - agent.personality.resilience * 0.3),
          );
        }

        this.stageEvent({
          eventId: this.stableOperationEventId('disturbance', operationId),
          worldId: this.state.id,
          kind: eventKind,
          source: 'system',
          occurredAt: now,
          payload: { magnitude: amount, householdLoss: amount * 0.6 },
        });
        return;
      }

      this.stageEvent({
        eventId: this.stableOperationEventId('disturbance', operationId),
        worldId: this.state.id,
        kind: eventKind,
        source: 'system',
        occurredAt: now,
        payload: { magnitude: amount },
        activeUntil: now + Math.max(1, duration),
      });
    });
  }

  // CardinalCore never receives this capability. Only the independent
  // simulation gateway owns it.
  async applyAuthorizedIntervention(
    worldId: string,
    kind: InterventionKind,
    magnitude: number,
    now: number,
    duration: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    if (worldId !== this.committedState.id) {
      throw new Error(
        `Intervention belongs to world ${worldId}, expected ${this.committedState.id}.`,
      );
    }
    if (
      ![
        'resource_relief',
        'open_shared_space',
        'safety_support',
        'habitat_support',
      ].includes(kind as string)
    ) {
      throw new Error('Unknown intervention kind.');
    }
    if (!Number.isFinite(now)) {
      throw new Error('Intervention time must be finite.');
    }
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      throw new Error('Intervention magnitude must be positive and finite.');
    }
    if (!Number.isFinite(duration) || duration < 1) {
      throw new Error('Intervention duration must be finite and at least 1.');
    }
    if (!operationId.trim()) {
      throw new Error('Intervention operationId is required for retry safety.');
    }
    if (!Number.isInteger(expectedWorldRevision) || expectedWorldRevision < 0) {
      throw new Error('Intervention expectedWorldRevision must be a non-negative integer.');
    }

    const amount = Math.max(0, Math.min(0.25, magnitude));
    const fingerprint = stableJsonStringify({
      kind: 'intervention',
      worldId,
      interventionKind: kind,
      magnitude: amount,
      now,
      duration,
      expectedWorldRevision,
    });

    return await this.mutateDetailed(
      `intervention:${operationId}`,
      fingerprint,
      async () => {
        if (now < this.state.now) {
          throw new Error('Intervention cannot be applied retroactively to a progressed world.');
        }
        this.state.now = now;

        const eventKind =
          kind === 'resource_relief'
            ? 'cardinal.intervention.resource_relief'
            : kind === 'open_shared_space'
              ? 'cardinal.effect.open_shared_space'
              : kind === 'safety_support'
                ? 'cardinal.effect.safety_support'
                : 'cardinal.effect.habitat_support';

        if (kind === 'resource_relief') {
          this.state.environment.resourcePool = clamp01(
            this.state.environment.resourcePool + amount,
          );

          this.stageEvent({
            eventId: this.stableOperationEventId('intervention', operationId),
            worldId: this.state.id,
            kind: eventKind,
            source: 'cardinal',
            occurredAt: now,
            payload: { magnitude: amount },
          });
          return;
        }

        this.stageEvent({
          eventId: this.stableOperationEventId('intervention', operationId),
          worldId: this.state.id,
          kind: eventKind,
          source: 'cardinal',
          occurredAt: now,
          payload: { magnitude: amount },
          activeUntil: now + Math.max(1, duration),
        });
      },
      expectedWorldRevision,
    );
  }

  /** Cardinal may propose world laws, but only the independent authority
   * gateway receives this mutation capability. Personhood is not addressable
   * through this method. */
  async applyAuthorizedWorldLaw(
    worldId: string,
    lawId: string,
    domain: WorldLawDomain,
    mechanism: WorldLawMechanism,
    value: number,
    minimum: number,
    maximum: number,
    rationale: string,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    if (worldId !== this.committedState.id) {
      throw new Error('World-law proposal belongs to a different world.');
    }
    if (!lawId.trim() || !rationale.trim() || !operationId.trim()) {
      throw new Error('World-law mutation requires IDs and rationale.');
    }
    if (LAW_MECHANISM_DOMAINS[mechanism] !== domain) {
      throw new Error('World-law mechanism does not belong to its domain.');
    }
    if (
      !Number.isFinite(value) ||
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum > maximum ||
      value < minimum ||
      value > maximum ||
      !Number.isFinite(now)
    ) {
      throw new Error('World-law value and time must be finite.');
    }
    const fingerprint = stableJsonStringify({
      kind: 'world_law',
      worldId,
      lawId,
      domain,
      mechanism,
      value,
      minimum,
      maximum,
      rationale,
      now,
      expectedWorldRevision,
    });
    return await this.mutateDetailed(
      `world-authority:${operationId}`,
      fingerprint,
      async () => {
        let current = this.state.governance.laws[lawId];
        if (!current) {
          current = {
            id: lawId,
            domain,
            mechanism,
            value,
            minimum,
            maximum,
            revision: 0,
            createdAt: now,
            updatedAt: now,
            createdBy: 'cardinal',
            rationale,
          };
          this.state.governance.laws[lawId] = current;
        } else if (
          current.domain !== domain ||
          current.mechanism !== mechanism ||
          minimum < current.minimum ||
          maximum > current.maximum ||
          value < current.minimum ||
          value > current.maximum
        ) {
          throw new Error(`World law ${lawId} exceeds its constitutional range.`);
        } else {
          current.value = value;
          current.revision += 1;
          current.updatedAt = now;
          current.createdBy = 'cardinal';
          current.rationale = rationale;
        }
        this.state.governance.authorityRevision += 1;
        this.state.governance.lastCardinalAuthorityAt = now;
        this.stageEvent({
          eventId: this.stableOperationEventId('world-law', operationId),
          worldId: this.state.id,
          kind: 'cardinal.world_law.changed',
          source: 'cardinal',
          occurredAt: now,
          payload: {
            lawId,
            domain: current.domain,
            mechanism: current.mechanism,
            value,
            lawRevision: current.revision,
            rationale,
          },
        });
      },
      expectedWorldRevision,
    );
  }

  async applyAuthorizedCatastrophe(
    worldId: string,
    catastropheKind: string,
    magnitude: number,
    maxCasualtyRatio: number,
    recoveryPlan: string,
    now: number,
    duration: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    const allowed = ['wildfire', 'flood', 'epidemic', 'earthquake', 'drought'];
    if (worldId !== this.committedState.id) {
      throw new Error('Catastrophe proposal belongs to a different world.');
    }
    if (!allowed.includes(catastropheKind)) {
      throw new Error('Unknown catastrophe kind.');
    }
    if (
      !Number.isFinite(magnitude) ||
      magnitude <= 0 ||
      magnitude > 0.35 ||
      !Number.isFinite(maxCasualtyRatio) ||
      maxCasualtyRatio < 0 ||
      maxCasualtyRatio > 0.18 ||
      !Number.isFinite(now) ||
      !Number.isFinite(duration) ||
      duration < 1 ||
      !recoveryPlan.trim() ||
      !operationId.trim()
    ) {
      throw new Error('Catastrophe parameters exceed the world safety envelope.');
    }
    const fingerprint = stableJsonStringify({
      kind: 'catastrophe',
      worldId,
      catastropheKind,
      magnitude,
      maxCasualtyRatio,
      recoveryPlan,
      now,
      duration,
      expectedWorldRevision,
    });
    return await this.mutateDetailed(
      `world-authority:${operationId}`,
      fingerprint,
      async () => {
        const living = this.shuffled(
          Object.values(this.state.agents).filter((agent) => agent.life.alive),
        );
        const maximumDeaths = Math.max(
          0,
          Math.min(
            Math.floor(living.length * maxCasualtyRatio),
            Math.max(0, living.length - 8),
          ),
        );
        let deaths = 0;
        const livingByRace = new Map<string, number>();
        for (const resident of living) {
          const race = resident.race ?? 'human';
          livingByRace.set(race, (livingByRace.get(race) ?? 0) + 1);
        }
        for (const agent of living) {
          const race = agent.race ?? 'human';
          const raceFloor = race === 'human' ? 8 : 2;
          const place = this.state.places[agent.locationId];
          const exposure = clamp01(
            magnitude *
              (0.34 + (place?.danger ?? 0.1) * 0.5) *
              (1.16 - agent.personality.resilience * 0.32),
          );
          agent.life.health = clamp01(agent.life.health - exposure);
          agent.stress = clamp01(agent.stress + magnitude * 0.32);
          agent.mind.emotions.fear = clamp01(
            agent.mind.emotions.fear + magnitude * 0.46,
          );
          agent.mind.emotions.awe = clamp01(
            agent.mind.emotions.awe + magnitude * 0.2,
          );
          const canLoseMember = (livingByRace.get(race) ?? 0) > raceFloor;
          if (
            agent.life.health <= 0.06 &&
            deaths < maximumDeaths &&
            canLoseMember
          ) {
            this.recordDeath(agent, 'catastrophe', now);
            livingByRace.set(race, (livingByRace.get(race) ?? 1) - 1);
            deaths += 1;
          } else {
            agent.life.health = Math.max(agent.life.health, 0.07);
            this.stageMemory({
              memoryId: this.nextId('memory'),
              worldId: this.state.id,
              agentId: agent.id,
              createdAt: now,
              kind: 'world_event',
              summary: `${agent.name} survived the ${catastropheKind}.`,
              importance: 0.9,
              valence: -0.74,
              relatedAgentIds: [],
            });
          }
        }

        const wildlifeLoss = clamp01(magnitude * 0.58);
        for (const population of Object.values(this.state.wildlife)) {
          population.count = Math.max(
            0,
            population.count - Math.floor(population.count * wildlifeLoss),
          );
          population.lastChangedAt = now;
        }
        if (catastropheKind === 'drought' || catastropheKind === 'wildfire') {
          this.state.environment.resourcePool = clamp01(
            this.state.environment.resourcePool - magnitude * 0.62,
          );
        }
        this.state.cosmology.mysteryLevel = clamp01(
          this.state.cosmology.mysteryLevel + magnitude * 0.12,
        );
        this.state.governance.authorityRevision += 1;
        this.state.governance.lastCardinalAuthorityAt = now;
        const recoveryMagnitude = clamp01(
          magnitude * this.lawValue('catastrophe_recovery', 0.75),
        );
        this.stageEvent({
          eventId: this.stableOperationEventId('catastrophe', operationId),
          worldId: this.state.id,
          kind: `cardinal.catastrophe.${catastropheKind}`,
          source: 'cardinal',
          occurredAt: now,
          activeUntil: now + duration * 3,
          payload: {
            magnitude,
            deaths,
            maximumDeaths,
            maxCasualtyRatio,
            recoveryPlan,
            destructiveUntil: now + duration,
            recoveryMagnitude,
          },
        });
      },
      expectedWorldRevision,
    );
  }

  async applyAuthorizedResidentEntry(
    worldId: string,
    entryId: string,
    name: string,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    if (worldId !== this.committedState.id) {
      throw new Error('Resident entry belongs to a different world.');
    }
    if (
      !entryId.trim() ||
      !name.trim() ||
      !operationId.trim() ||
      !Number.isFinite(now) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(entryId) ||
      name.length > 64
    ) {
      throw new Error('Resident entry requires stable identity and name.');
    }
    const residentId = `visitor_${entryId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const fingerprint = stableJsonStringify({
      kind: 'resident_entry',
      worldId,
      residentId,
      name,
      now,
      expectedWorldRevision,
    });
    return await this.mutateDetailed(
      `world-entry:${operationId}`,
      fingerprint,
      async () => {
        if (this.state.agents[residentId]) {
          throw new Error(`Resident entry ${residentId} already exists.`);
        }
        const personality: AgentState['personality'] = {
          sociability: this.rng.between(0.35, 0.8),
          diligence: this.rng.between(0.35, 0.8),
          curiosity: this.rng.between(0.55, 0.92),
          generosity: this.rng.between(0.35, 0.82),
          resilience: this.rng.between(0.45, 0.86),
          riskTolerance: this.rng.between(0.35, 0.8),
        };
        const needs = { belonging: 0.55, purpose: 0.62 };
        const homeId = `home_${residentId}`;
        const homeIndex = Object.values(this.state.places).filter(
          (place) => place.kind === 'home',
        ).length;
        this.state.places[homeId] = createPlace(
          homeId,
          `${name}'s Home`,
          'home',
          3,
          placeMigrationDefaults({ id: homeId, kind: 'home' }, homeIndex),
        );
        makeConnectionsReciprocal(this.state.places);
        this.rebuildSpatialProjection();
        const ageYears = 25;
        const partial = {
          id: residentId,
          name,
          origin: 'external_resident' as const,
          sex: (this.rng.next() < 0.5 ? 'male' : 'female') as AgentState['sex'],
          race: 'human' as const,
          progression: {
            level: 1,
            experience: 0,
            objectControlAuthority: 0.12,
            systemControlAuthority: 0.1,
            combatMastery: 0.08,
            sacredArts: 0.04,
          },
          energy: 0.84,
          stress: 0.08,
          resources: 0.62,
          socialDrive: personality.sociability,
          personality,
          life: {
            bornAt: now - ageYears * WORLD_TICKS_PER_YEAR,
            ageYears,
            lifespanYears: 78 + personality.resilience * 22,
            stage: 'adult' as const,
            alive: true,
            health: 0.92,
            physiology: physiologyForAge(
              ageYears,
              78 + personality.resilience * 22,
              0.92,
            ),
            generation: 0,
            parentIds: [],
            childIds: [],
          },
          mind: createMindState(this.state.id, residentId, personality, needs),
          needs,
          skills: {
            gathering: 0.25,
            hunting: 0.18,
            craft: 0.26,
            social: 0.3,
            exploration: 0.42,
          },
          homeId,
          locationId: 'commons',
          position: {
            x: this.state.places.commons.mapX,
            y: this.state.places.commons.mapY,
            layerId: 'surface' as const,
          },
          lastMeaningfulEventAt: now,
        } satisfies Omit<AgentState, 'goal'>;
        this.state.agents[residentId] = {
          ...partial,
          goal: goalFromInitialState(partial, now),
        };
        this.state.population.nextAgentSequence += 1;
        this.stageEvent({
          eventId: this.stableOperationEventId('resident-entry', operationId),
          worldId: this.state.id,
          kind: 'world.entry.resident_manifested',
          source: 'player',
          occurredAt: now,
          payload: { agentId: residentId, name },
        });
      },
      expectedWorldRevision,
    );
  }

  async applyAuthorizedDeityEntry(
    worldId: string,
    deityId: string,
    name: string,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    if (worldId !== this.committedState.id) {
      throw new Error('Deity entry belongs to a different world.');
    }
    if (
      !deityId.trim() ||
      !name.trim() ||
      !operationId.trim() ||
      !Number.isFinite(now) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(deityId) ||
      name.length > 64
    ) {
      throw new Error('Deity entry requires stable identity and name.');
    }
    const fingerprint = stableJsonStringify({
      kind: 'deity_entry',
      worldId,
      deityId,
      name,
      now,
      expectedWorldRevision,
    });
    return await this.mutateDetailed(
      `world-entry:${operationId}`,
      fingerprint,
      async () => {
        if (this.state.cosmology.deities[deityId]) {
          throw new Error(`Deity ${deityId} already exists.`);
        }
        this.state.cosmology.deities[deityId] = {
          id: deityId,
          name,
          origin: 'external_entry',
          enteredAt: now,
        };
        this.state.cosmology.mysteryLevel = clamp01(
          this.state.cosmology.mysteryLevel + 0.08,
        );
        this.stageEvent({
          eventId: this.stableOperationEventId('deity-entry', operationId),
          worldId: this.state.id,
          kind: 'world.entry.deity_manifested',
          source: 'player',
          occurredAt: now,
          payload: { deityId, name },
        });
      },
      expectedWorldRevision,
    );
  }

  async applyAuthorizedDivineOmen(
    worldId: string,
    deityId: string,
    omen: string,
    magnitude: number,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    if (worldId !== this.committedState.id) {
      throw new Error('Divine omen belongs to a different world.');
    }
    if (
      !['aurora', 'voice', 'eclipse', 'miracle', 'storm_sign'].includes(omen) ||
      !Number.isFinite(magnitude) ||
      magnitude <= 0 ||
      magnitude > 0.35 ||
      !Number.isFinite(now) ||
      !operationId.trim()
    ) {
      throw new Error('Divine omen is outside the entry gateway envelope.');
    }
    const fingerprint = stableJsonStringify({
      kind: 'divine_omen',
      worldId,
      deityId,
      omen,
      magnitude,
      now,
      expectedWorldRevision,
    });
    return await this.mutateDetailed(
      `world-entry:${operationId}`,
      fingerprint,
      async () => {
        const deity = this.state.cosmology.deities[deityId];
        if (!deity) throw new Error(`Unknown deity ${deityId}.`);
        if (deity.origin !== 'external_entry') {
          throw new Error('An emergent belief cannot be impersonated by an external deity.');
        }
        deity.lastOmenAt = now;
        this.state.cosmology.omenCount += 1;
        this.state.cosmology.mysteryLevel = clamp01(
          this.state.cosmology.mysteryLevel + magnitude * 0.32,
        );
        const living = Object.values(this.state.agents).filter(
          (agent) => agent.life.alive,
        );
        const witnesses: AgentState[] = [];
        for (const agent of living) {
          const perceptionChance = clamp01(
            0.38 +
              magnitude * 0.8 +
              agent.personality.curiosity * 0.18 +
              agent.mind.beliefs.divinePresence * 0.1,
          );
          if (this.rng.next() < perceptionChance) witnesses.push(agent);
        }
        if (witnesses.length === 0 && living.length > 0) {
          witnesses.push(
            [...living].sort(
              (a, b) =>
                b.personality.curiosity + b.mind.emotions.awe -
                (a.personality.curiosity + a.mind.emotions.awe),
            )[0],
          );
        }
        for (const agent of witnesses) {
          agent.mind.emotions.awe = clamp01(
            agent.mind.emotions.awe + magnitude * 0.5,
          );
          agent.mind.emotions.fear = clamp01(
            agent.mind.emotions.fear +
              magnitude * (0.28 - agent.personality.resilience * 0.12),
          );
          agent.mind.beliefs.divinePresence = clamp01(
            agent.mind.beliefs.divinePresence + magnitude * 0.22,
          );
          this.stageMemory({
            memoryId: this.nextId('memory'),
            worldId: this.state.id,
            agentId: agent.id,
            createdAt: now,
            kind: 'omen',
            summary: `${agent.name} witnessed ${deity.name}'s ${omen}.`,
            importance: clamp01(0.66 + magnitude * 0.7),
            valence: clampSigned(0.14 - agent.mind.emotions.fear * 0.2),
            relatedAgentIds: [],
          });
        }
        this.stageEvent({
          eventId: this.stableOperationEventId('divine-omen', operationId),
          worldId: this.state.id,
          kind: `world.omen.${omen}`,
          source: 'player',
          occurredAt: now,
          payload: {
            deityId,
            deityName: deity.name,
            magnitude,
            witnessCount: witnesses.length,
          },
        });
      },
      expectedWorldRevision,
    );
  }

  private async mutate(
    operationId: string,
    operationFingerprint: string,
    apply: () => Promise<void>,
    requiredWorldRevision?: number,
  ): Promise<boolean> {
    return (
      await this.mutateDetailed(
        operationId,
        operationFingerprint,
        apply,
        requiredWorldRevision,
      )
    ).committed;
  }

  private async mutateDetailed(
    operationId: string,
    operationFingerprint: string,
    apply: () => Promise<void>,
    requiredWorldRevision?: number,
  ): Promise<WorldMutationResult> {
    return await this.runExclusive(async () => {
      const prior = await this.store.committedOperation(
        this.committedState.id,
        operationId,
      );
      if (prior) {
        if (prior.operationFingerprint !== operationFingerprint) {
          throw new Error(
            `World operation ${operationId} was retried with different content.`,
          );
        }

        await this.reloadFromStore();
        return {
          committed: false,
          committedRevision: prior.committedRevision,
        };
      }

      if (
        requiredWorldRevision !== undefined &&
        this.committedState.revision !== requiredWorldRevision
      ) {
        throw new StaleWorldObservationError(
          this.committedState.id,
          requiredWorldRevision,
          this.committedState.revision,
        );
      }

      const before = structuredClone(this.committedState);
      const beforeRng = this.rng.snapshot();
      this.workingState = structuredClone(before);
      this.rng.restore(before.determinism.rngState);
      this.stagedEvents = [];
      this.stagedMemories = [];

      try {
        await apply();
        this.syncDeterminismState();
        this.state.revision = before.revision + 1;
        assertWorldState(this.state);

        const result = await this.store.commit({
          operationId,
          operationFingerprint,
          worldId: before.id,
          expectedRevision: before.revision,
          nextState: structuredClone(this.state),
          events: this.stagedEvents.map((event) => structuredClone(event)),
          memories: this.stagedMemories.map((memory) => structuredClone(memory)),
        });

        this.adopt(result.state);
        return {
          committed: result.committed,
          committedRevision: result.operation.committedRevision,
        };
      } catch (error) {
        this.rng.restore(beforeRng);
        if (error instanceof WorldRevisionConflictError) {
          await this.reloadFromStore();
        }
        throw error;
      } finally {
        this.workingState = undefined;
        this.stagedEvents = undefined;
        this.stagedMemories = undefined;
      }
    });
  }

  private get state(): WorldState {
    if (!this.workingState) {
      throw new Error('World mutable state was accessed outside a logical operation.');
    }
    return this.workingState;
  }

  private async runExclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.operationTail;
    let release!: () => void;
    this.operationTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  private async reloadFromStore(): Promise<void> {
    const worldId = this.committedState.id;
    const state = await this.store.loadWorld(worldId);
    if (!state) {
      throw new Error(`World ${worldId} disappeared from the store.`);
    }
    this.adopt(state);
  }

  private async stepAgent(
    agent: AgentState,
    allAgents: AgentState[],
    environment: WorldEnvironment,
    now: number,
  ): Promise<void> {
    this.applyPassiveNeeds(agent, environment);
    if (this.advanceAgentMovement(agent)) {
      this.advanceMind(agent);
      return;
    }
    this.updateGoal(agent, now);

    const decision = this.chooseAction(agent, allAgents, environment);
    agent.lastDecision = {
      action: decision.action,
      dominantAction: decision.dominantAction,
      consideredActionCount: decision.consideredActionCount,
      openness: decision.openness,
      chosenAt: now,
    };
    const action = decision.action;
    switch (action) {
      case 'rest':
        this.performRest(agent, now);
        break;
      case 'relax':
        this.performRelax(agent, now);
        break;
      case 'walk':
        this.performWalk(agent, now);
        break;
      case 'gather':
        this.performGather(agent, now);
        break;
      case 'hunt':
        this.performHunt(agent, environment, now);
        break;
      case 'work':
        this.performWork(agent, now);
        break;
      case 'socialize': {
        const others = allAgents.filter((other) => other.id !== agent.id);
        if (others.length === 0) {
          this.performReflect(agent, now);
        } else {
          const accessChance = clamp01(
            0.12 +
              environment.socialOpportunity * 0.76 +
              agent.personality.sociability * 0.12,
          );
          if (this.rng.next() > accessChance) {
            this.performBlockedSocialize(agent, now);
          } else {
            const target = await this.chooseSocialTarget(agent, others);
            if (target) {
              await this.interact(agent, target, now);
            } else {
              this.performBlockedSocialize(agent, now);
            }
          }
        }
        break;
      }
      case 'help': {
        const target = this.chooseHelpTarget(agent, allAgents);
        if (!target) {
          this.performWork(agent, now);
        } else {
          await this.performHelp(agent, target, now);
        }
        break;
      }
      case 'explore':
        this.performExplore(agent, now);
        break;
      case 'reflect':
        this.performReflect(agent, now);
        break;
      case 'bond': {
        const target = this.chooseBondTarget(agent, allAgents);
        if (target) {
          this.performBond(agent, target, now);
        } else {
          this.performReflect(agent, now);
        }
        break;
      }
      case 'pray':
        this.performPray(agent, now);
        break;
    }
    this.advanceMonsterEncounter(agent, environment, now);
    this.advanceMind(agent);
  }

  private applyPassiveNeeds(agent: AgentState, environment: WorldEnvironment): void {
    agent.energy = clamp01(
      agent.energy - (0.016 + (1 - agent.life.physiology.endurance) * 0.014),
    );
    agent.resources = clamp01(agent.resources - 0.004);
    agent.needs.belonging = clamp01(agent.needs.belonging - 0.012);
    agent.needs.purpose = clamp01(agent.needs.purpose - 0.008);
    agent.stress = clamp01(
      agent.stress +
        (1 - agent.energy) * 0.012 +
        (1 - agent.resources) * 0.006 +
        (1 - environment.safetySupport) * 0.012 -
        environment.safetySupport * (0.003 + agent.personality.resilience * 0.002),
    );
  }

  private updateGoal(agent: AgentState, now: number): void {
    const scores: Array<{ kind: AgentGoalKind; strength: number }> = [
      {
        kind: 'recover',
        strength: (1 - agent.energy) * 0.85 + agent.stress * 0.55,
      },
      {
        kind: 'secure_resources',
        strength: (1 - agent.resources) * 0.95,
      },
      {
        kind: 'connect',
        strength:
          (1 - agent.needs.belonging) * (0.55 + agent.socialDrive * 0.55),
      },
      {
        kind: 'contribute',
        strength:
          (1 - agent.needs.purpose) * 0.5 +
          agent.personality.diligence * 0.32 +
          agent.personality.generosity * 0.18,
      },
      {
        kind: 'explore',
        strength:
          agent.personality.curiosity * 0.65 +
          agent.personality.riskTolerance * 0.12 +
          (1 - agent.needs.purpose) * 0.2,
      },
      {
        kind: 'reflect',
        strength:
          agent.stress * 0.38 +
          (1 - agent.needs.purpose) * 0.2 +
          (1 - agent.personality.riskTolerance) * 0.25 +
          (1 - agent.personality.sociability) * 0.15,
      },
      {
        kind: 'build_family',
        strength:
          (agent.life.stage === 'adult' ? 0.18 : 0) +
          agent.mind.values.care * 0.3 +
          (1 - agent.needs.belonging) * 0.2 +
          agent.mind.emotions.hope * 0.12,
      },
      {
        kind: 'seek_truth',
        strength:
          agent.mind.values.knowledge * 0.38 +
          agent.mind.emotions.awe * 0.28 +
          agent.personality.curiosity * 0.22,
      },
    ];
    scores.sort((a, b) => b.strength - a.strength);
    const next = scores[0];
    const currentAge = now - agent.goal.since;
    const shouldSwitch =
      next.kind !== agent.goal.kind &&
      (next.strength > agent.goal.strength + 0.08 || currentAge >= 5);

    if (shouldSwitch) {
      const previous = agent.goal.kind;
      agent.goal = {
        kind: next.kind,
        strength: clamp01(next.strength),
        since: now,
      };
      this.recordAgentEvent(agent, now, 'agent.goal.changed', {
        previous,
        next: next.kind,
        strength: agent.goal.strength,
      });
    } else {
      agent.goal.strength = clamp01(
        scores.find((item) => item.kind === agent.goal.kind)?.strength ?? next.strength,
      );
    }
  }

  private chooseAction(
    agent: AgentState,
    allAgents: AgentState[],
    environment: WorldEnvironment,
  ): {
    action: AgentActionKind;
    dominantAction: AgentActionKind;
    consideredActionCount: number;
    openness: number;
  } {
    const helpTarget = this.chooseHelpTarget(agent, allAgents);
    const huntTarget = this.chooseHuntTarget(agent);
    const bondTarget = this.chooseBondTarget(agent, allAgents);
    const socialAvailable = allAgents.some(
      (other) =>
        other.id !== agent.id &&
        other.life.alive &&
        other.locationId === agent.locationId,
    );
    const natureAvailable = this.state.growth.stage > 0;
    const goalBoost = (kind: AgentGoalKind) => (agent.goal.kind === kind ? 0.24 : 0);
    const body = agent.life.physiology;
    const emotions = agent.mind.emotions;

    const scores: Array<{ action: AgentActionKind; score: number }> = [
      {
        action: 'rest',
        score:
          (1 - agent.energy) * 1.45 +
          agent.stress * 0.42 +
          (1 - body.recovery) * 0.22 +
          goalBoost('recover'),
      },
      {
        action: 'relax',
        score:
          (natureAvailable ? 0.16 : 0) +
          (1 - agent.energy) * 0.62 +
          agent.stress * 0.72 +
          agent.personality.curiosity * 0.12 +
          emotions.grief * 0.2 +
          goalBoost('recover') * 0.65,
      },
      {
        action: 'walk',
        score:
          0.18 +
          agent.personality.curiosity * 0.46 +
          agent.personality.resilience * 0.08 +
          body.mobility * 0.18 +
          emotions.joy * 0.09 -
          emotions.fear * 0.12 +
          (1 - agent.stress) * 0.08 +
          (1 - agent.needs.purpose) * 0.16 +
          goalBoost('explore') * 0.6 -
          Math.max(0, 0.3 - agent.energy) * 0.8,
      },
      {
        action: 'gather',
        score:
          (1 - agent.resources) * 1.05 +
          this.state.environment.resourcePool * 0.22 +
          agent.skills.gathering * 0.2 +
          body.strength * 0.13 +
          goalBoost('secure_resources'),
      },
      {
        action: 'hunt',
        score: huntTarget
          ? (1 - agent.resources) * 0.9 +
            agent.skills.hunting * 0.34 +
            agent.personality.riskTolerance * 0.22 +
            body.strength * 0.2 +
            body.endurance * 0.12 +
            environment.safetySupport * 0.08 +
            emotions.hope * 0.08 -
            emotions.fear * 0.32 -
            huntTarget.alertness * 0.34 -
            huntTarget.threat * 0.36 +
            goalBoost('secure_resources')
          : -1,
      },
      {
        action: 'work',
        score:
          (1 - agent.resources) * 0.72 +
          (1 - agent.needs.purpose) * 0.38 +
          agent.personality.diligence * 0.52 +
          agent.skills.craft * 0.18 +
          body.endurance * 0.12 +
          goalBoost('contribute'),
      },
      {
        action: 'socialize',
        score:
          (socialAvailable ? 1 : 0) *
          ((1 - agent.needs.belonging) * 0.78 +
            agent.socialDrive * 0.4 +
            agent.personality.sociability * 0.3 +
            emotions.joy * 0.12 +
            emotions.grief * 0.08 -
            emotions.fear * 0.08 +
            environment.socialOpportunity * 0.2 +
            goalBoost('connect')),
      },
      {
        action: 'help',
        score: helpTarget
          ? agent.personality.generosity * 0.65 +
            (1 - agent.needs.purpose) * 0.24 +
            Math.max(0, agent.resources - 0.45) * 0.35 +
            goalBoost('contribute')
          : -1,
      },
      {
        action: 'explore',
        score:
          agent.personality.curiosity * 0.68 +
          agent.personality.riskTolerance * 0.15 +
          body.mobility * 0.13 +
          agent.skills.exploration * 0.16 +
          emotions.awe * 0.18 +
          emotions.hope * 0.09 -
          emotions.fear * 0.28 +
          (1 - agent.needs.purpose) * 0.2 +
          goalBoost('explore') -
          Math.max(0, 0.35 - agent.resources) * 0.7,
      },
      {
        action: 'reflect',
        score:
          0.18 +
          agent.stress * 0.55 +
          (1 - agent.needs.purpose) * 0.42 +
          (1 - agent.personality.riskTolerance) * 0.22 +
          (1 - agent.personality.sociability) * 0.08 +
          emotions.grief * 0.24 +
          emotions.fear * 0.12 +
          goalBoost('reflect'),
      },
      {
        action: 'bond',
        score: bondTarget
          ? agent.mind.values.care * 0.42 +
            (1 - agent.needs.belonging) * 0.34 +
            agent.mind.emotions.hope * 0.18 +
            emotions.joy * 0.12 +
            goalBoost('build_family')
          : -1,
      },
      {
        action: 'pray',
        score:
          0.06 +
          agent.mind.emotions.awe * 0.45 +
          agent.mind.beliefs.divinePresence * 0.28 +
          agent.mind.values.tradition * 0.18 +
          this.state.cosmology.mysteryLevel * 0.2 +
          goalBoost('seek_truth'),
      },
    ];

    if (agent.life.stage === 'child') {
      for (const item of scores) {
        if (['hunt', 'work', 'bond'].includes(item.action)) item.score = -1;
      }
    } else if (agent.life.stage === 'adolescent') {
      for (const item of scores) {
        if (['hunt', 'bond'].includes(item.action)) item.score = -1;
      }
    } else if (agent.life.stage === 'elder') {
      const hunt = scores.find((item) => item.action === 'hunt');
      if (hunt) hunt.score -= 0.28;
    }
    if (body.mobility < 0.24 || body.strength < 0.2) {
      for (const item of scores) {
        if (['hunt', 'explore'].includes(item.action)) item.score = -1;
      }
      const rest = scores.find((item) => item.action === 'rest');
      if (rest) rest.score += 0.36;
    }

    // Repetition remains possible, but curiosity makes an unchanged routine
    // less attractive while diligence can reinforce productive habits.
    if (agent.lastAction) {
      const repeated = scores.find(
        (item) => item.action === agent.lastAction,
      );
      if (repeated) {
        const habitStrength =
          repeated.action === 'work' || repeated.action === 'gather'
            ? agent.personality.diligence
            : repeated.action === 'socialize' || repeated.action === 'help'
              ? agent.personality.sociability
              : agent.personality.resilience;
        repeated.score +=
          habitStrength * 0.08 - agent.personality.curiosity * 0.13;
      }
    }

    // Seeded noise and weighted selection preserve reproducibility without
    // reducing ordinary choice to a deterministic highest-score instruction.
    for (const item of scores) {
      item.score += this.rng.between(-0.045, 0.045);
    }

    // Severe physiological pressure is a constraint, not a central script.
    if (agent.energy < 0.12) {
      return {
        action: 'rest',
        dominantAction: 'rest',
        consideredActionCount: 1,
        openness: 0,
      };
    }
    if (agent.resources < 0.16) {
      const survivalChoices = scores
        .filter(
          (item) =>
            (item.action === 'gather' &&
              this.state.environment.resourcePool > 0.03) ||
            item.action === 'work' ||
            (item.action === 'hunt' && huntTarget !== undefined),
        )
        .sort((a, b) => b.score - a.score);
      const action = survivalChoices[0]?.action ?? 'work';
      return {
        action,
        dominantAction: action,
        consideredActionCount: survivalChoices.length,
        openness: 0.08,
      };
    }

    if (agent.plan) {
      if (
        agent.plan.expiresAt < this.state.now ||
        !this.state.places[agent.plan.targetPlaceId]
      ) {
        agent.plan = undefined;
      } else {
        if (agent.plan.kind === 'explore_frontier') {
          agent.plan.targetPlaceId =
            this.state.growth.discoveredRegionIds[
              this.state.growth.discoveredRegionIds.length - 1
            ] ?? 'outskirts';
        }
        const plannedAction: AgentActionKind =
          agent.plan.kind === 'hunt' ? 'hunt' : 'explore';
        return {
          action: plannedAction,
          dominantAction: plannedAction,
          consideredActionCount: 1,
          // A resident owns the plan and can still abandon it when survival
          // pressure crosses the hard bounds above.
          openness: 0.12,
        };
      }
    }

    scores.sort((a, b) => b.score - a.score);
    const dominantAction = scores[0].action;
    const choiceWindow =
      0.32 +
      agent.personality.curiosity * 0.2 +
      agent.personality.riskTolerance * 0.1;
    const candidates = scores.filter(
      (item) =>
        item.score >= scores[0].score - choiceWindow &&
        item.score > -0.25,
    );
    const temperature =
      0.1 +
      agent.personality.curiosity * 0.1 +
      agent.personality.riskTolerance * 0.045;
    const weights = candidates.map((item) =>
      Math.exp((item.score - scores[0].score) / temperature),
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = this.rng.next() * total;
    let selected = candidates[candidates.length - 1];

    for (let index = 0; index < candidates.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) {
        selected = candidates[index];
        break;
      }
    }

    const probabilities = weights.map((weight) => weight / total);
    const entropy = -probabilities.reduce(
      (sum, probability) =>
        sum +
        (probability > 0 ? probability * Math.log(probability) : 0),
      0,
    );
    const openness =
      candidates.length > 1
        ? clamp01(entropy / Math.log(candidates.length))
        : 0;

    return {
      action: selected.action,
      dominantAction,
      consideredActionCount: candidates.length,
      openness,
    };
  }

  private homeSettlementId(agent: AgentState): string | undefined {
    return this.state.places[agent.homeId]?.settlementId;
  }

  private localPlace(
    agent: AgentState,
    kinds: readonly WorldPlaceKind[],
    fallback: string,
  ): string {
    const settlementId = this.homeSettlementId(agent);
    if (settlementId) {
      const candidates = Object.values(this.state.places)
        .filter(
          (place) =>
            place.settlementId === settlementId &&
            kinds.includes(place.kind) &&
            this.pathBetween(agent.locationId, place.id) !== undefined,
        )
        .sort((a, b) => {
          const da = Math.hypot(a.mapX - agent.position.x, a.mapY - agent.position.y);
          const db = Math.hypot(b.mapX - agent.position.x, b.mapY - agent.position.y);
          return da - db;
        });
      if (candidates[0]) return candidates[0].id;

      const settlement = this.state.settlements[settlementId];
      if (
        settlement?.centerPlaceId &&
        this.pathBetween(agent.locationId, settlement.centerPlaceId)
      ) {
        return settlement.centerPlaceId;
      }
    }
    return this.state.places[fallback] ? fallback : agent.homeId;
  }

  private localCommons(agent: AgentState): string {
    return this.localPlace(agent, ['commons', 'village', 'city'], agent.homeId);
  }

  private performRest(agent: AgentState, now: number): void {
    this.moveAgent(agent, agent.homeId);
    agent.energy = clamp01(
      agent.energy + 0.18 + agent.life.physiology.recovery * 0.14,
    );
    agent.stress = clamp01(agent.stress - 0.055 - agent.personality.resilience * 0.02);
    agent.lastAction = 'rest';

    this.recordAgentEvent(agent, now, 'agent.rested', {
      energy: agent.energy,
      stress: agent.stress,
      locationId: agent.locationId,
    });
  }

  private performRelax(agent: AgentState, now: number): void {
    const homeSettlementId = this.homeSettlementId(agent);
    const naturalPlaces = Object.values(this.state.places)
      .filter(
        (place) =>
          ['quiet_space', 'meadow', 'forest', 'shore'].includes(place.kind) &&
          this.pathBetween(agent.locationId, place.id) !== undefined,
      )
      .map((place) => ({
        place,
        weight:
          (place.settlementId === homeSettlementId ? 1.4 : 0.55) +
          place.fertility * 0.35 -
          place.danger * 0.7,
      }))
      .sort((a, b) => b.weight - a.weight);
    const localWindow = naturalPlaces.slice(0, Math.min(4, naturalPlaces.length));
    const destination =
      localWindow.length > 0
        ? this.rng.pick(localWindow).place.id
        : agent.homeId;

    this.moveAgent(agent, destination);
    agent.energy = clamp01(
      agent.energy + 0.07 + agent.life.physiology.recovery * 0.08,
    );
    agent.stress = clamp01(
      agent.stress - 0.075 - agent.personality.resilience * 0.025,
    );
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.012);
    agent.lastAction = 'relax';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.relaxed', {
      energy: agent.energy,
      stress: agent.stress,
      locationId: agent.locationId,
    });
  }

  private performWalk(agent: AgentState, now: number): void {
    const current = this.state.places[agent.locationId];
    const destinations = (current?.connectedPlaceIds ?? [])
      .map((placeId) => this.state.places[placeId])
      .filter(
        (place): place is WorldPlace =>
          place !== undefined &&
          place.kind !== 'home' &&
          place.id !== agent.locationId &&
          place.kind !== 'workshop' &&
          place.kind !== 'resource_field',
      )
      .map((place) => place.id);
    const destination =
      destinations.length > 0 ? this.rng.pick(destinations) : this.localCommons(agent);

    this.moveAgent(agent, destination);
    agent.energy = clamp01(
      agent.energy - (0.012 + (1 - agent.life.physiology.mobility) * 0.016),
    );
    agent.stress = clamp01(agent.stress - 0.018);
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.008);
    agent.skills.exploration = clamp01(agent.skills.exploration + 0.001);
    agent.lastAction = 'walk';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.walked', {
      locationId: agent.locationId,
    });
  }

  private chooseHuntTarget(
    agent: AgentState,
  ): WildlifePopulation | undefined {
    const yieldBySpecies: Record<WildlifeSpecies, number> = {
      rabbit: 0.11,
      deer: 0.22,
      fish: 0.085,
      boar: 0.2,
      wolf: 0.16,
      bird: 0.07,
      dire_wolf: 0.24,
      ogre: 0.3,
      wraith: 0.04,
    };

    const populations = Object.values(this.state.wildlife)
      .filter(
        (population) =>
          population.count > 0 &&
          this.state.places[population.habitatId] &&
          this.pathBetween(agent.locationId, population.habitatId) !== undefined,
      )
      .map((population) => {
        const distance = Math.max(
          0,
          (this.pathBetween(agent.locationId, population.habitatId)?.length ?? 1) -
            1,
        );
        return {
          population,
          score:
            yieldBySpecies[population.species] * 2.4 +
            population.count / population.carryingCapacity -
            population.alertness * 0.5 +
            agent.personality.riskTolerance * population.threat * 0.18 -
            population.threat * 0.62 +
            agent.skills.hunting * 0.12 -
            distance * 0.055,
        };
      })
      .sort((a, b) => b.score - a.score);
    if (agent.plan?.kind === 'hunt') {
      const planned = populations.find(
        ({ population }) =>
          population.habitatId === agent.plan?.targetPlaceId,
      )?.population;
      if (planned) return planned;
      agent.plan = undefined;
    }
    return populations[0]?.population;
  }

  private performHunt(
    agent: AgentState,
    environment: WorldEnvironment,
    now: number,
  ): void {
    const target = this.chooseHuntTarget(agent);
    if (!target) {
      this.performGather(agent, now);
      return;
    }

    const route = this.pathBetween(agent.locationId, target.habitatId);
    if (route && route.length > 2) {
      agent.plan = {
        kind: 'hunt',
        targetPlaceId: target.habitatId,
        startedAt: agent.plan?.startedAt ?? now,
        expiresAt: now + 48,
      };
      this.moveAgent(agent, route[1]);
      agent.energy = clamp01(agent.energy - 0.026);
      agent.stress = clamp01(agent.stress - 0.004);
      agent.lastAction = 'walk';
      agent.lastMeaningfulEventAt = now;
      this.recordAgentEvent(agent, now, 'agent.walked', {
        locationId: agent.locationId,
        purpose: 'hunt',
        destinationId: target.habitatId,
      });
      return;
    }
    agent.plan = undefined;

    const yieldBySpecies: Record<WildlifeSpecies, number> = {
      rabbit: 0.11,
      deer: 0.22,
      fish: 0.085,
      boar: 0.2,
      wolf: 0.16,
      bird: 0.07,
      dire_wolf: 0.24,
      ogre: 0.3,
      wraith: 0.04,
    };
    const successChance = clamp01(
      0.16 +
        agent.skills.hunting * 0.46 +
        agent.personality.riskTolerance * 0.13 +
        agent.life.physiology.strength * 0.16 +
        agent.life.physiology.endurance * 0.1 +
        environment.safetySupport * 0.1 -
        agent.mind.emotions.fear * 0.18 -
        target.alertness * 0.34 -
        target.threat * 0.32,
    );
    const succeeded = this.rng.next() < successChance;
    const gathered = succeeded ? yieldBySpecies[target.species] : 0;

    this.moveAgent(agent, target.habitatId);
    agent.energy = clamp01(agent.energy - 0.055);
    agent.stress = clamp01(
      agent.stress + (succeeded ? -0.008 : 0.018),
    );
    agent.resources = clamp01(agent.resources + gathered);
    agent.skills.hunting = clamp01(
      agent.skills.hunting + (succeeded ? 0.006 : 0.003),
    );
    agent.needs.purpose = clamp01(
      agent.needs.purpose + (succeeded ? 0.035 : 0.008),
    );
    agent.lastAction = 'hunt';
    agent.lastMeaningfulEventAt = now;

    if (succeeded) {
      target.count -= 1;
    }
    target.alertness = clamp01(
      target.alertness + (succeeded ? 0.2 : 0.11),
    );
    target.lastChangedAt = now;

    let monsterCountered = false;
    let monsterDamage = 0;
    if (
      target.threat >= 0.25 &&
      target.count > 0 &&
      (!succeeded || this.rng.next() < target.threat * 0.38)
    ) {
      monsterCountered = true;
      monsterDamage = clamp01(
        target.threat *
          this.rng.between(0.1, 0.3) *
          (1.18 - agent.life.physiology.strength * 0.38) *
          (1 - environment.safetySupport * 0.42) *
          (1 - (agent.progression?.combatMastery ?? 0) * 0.22),
      );
      agent.life.health = clamp01(agent.life.health - monsterDamage);
      agent.stress = clamp01(agent.stress + target.threat * 0.24);
      agent.mind.emotions.fear = clamp01(
        agent.mind.emotions.fear + target.threat * 0.36,
      );
      agent.mind.emotions.awe = clamp01(
        agent.mind.emotions.awe + target.threat * 0.12,
      );
    }

    this.recordAgentEvent(agent, now, 'agent.hunted', {
      species: target.species,
      succeeded,
      gathered,
      populationRemaining: target.count,
      monster: target.isMonster,
      monsterCountered,
      monsterDamage,
      locationId: agent.locationId,
    });

    if (monsterCountered) {
      this.stageEvent({
        eventId: this.nextId(target.isMonster ? 'monster-encounter' : 'wildlife-encounter'),
        worldId: this.state.id,
        kind: target.isMonster
          ? 'world.monster.encountered'
          : 'world.wildlife.defensive_encounter',
        source: 'world',
        occurredAt: now,
        payload: {
          agentId: agent.id,
          species: target.species,
          habitatId: target.habitatId,
          reason: 'self_defense',
          damage: monsterDamage,
          survived: agent.life.health > 0.04,
        },
      });
      const lethalChance = clamp01(
        (target.threat *
          (1 - agent.life.physiology.strength) *
          0.14 +
          (agent.life.health < 0.18 ? 0.18 : 0)) *
          (1 - environment.safetySupport * 0.58),
      );
      if (agent.life.health <= 0.04 || this.rng.next() < lethalChance) {
        this.recordDeath(agent, target.isMonster ? 'monster' : 'wildlife', now);
      }
    }

    if (succeeded && target.count === 0) {
      this.stageEvent({
        eventId: this.nextId('wildlife'),
        worldId: this.state.id,
        kind: 'world.wildlife.depleted',
        source: 'world',
        occurredAt: now,
        payload: {
          populationId: target.id,
          species: target.species,
          habitatId: target.habitatId,
        },
      });
    }
  }

  private performBlockedSocialize(agent: AgentState, now: number): void {
    this.moveAgent(agent, this.localCommons(agent));
    agent.energy = clamp01(agent.energy - 0.01);
    agent.stress = clamp01(agent.stress + 0.018);
    agent.needs.belonging = clamp01(agent.needs.belonging - 0.015);
    agent.lastAction = 'socialize';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.socialize.blocked', {
      socialOpportunity: 0,
      locationId: agent.locationId,
    });
  }

  private performGather(agent: AgentState, now: number): void {
    this.moveAgent(agent, this.localPlace(agent, ['resource_field'], 'resource_field'));
    const available = this.state.environment.resourcePool;
    const effort =
      0.025 +
      agent.skills.gathering * 0.08 +
      agent.life.physiology.strength * 0.035;
    const gathered = Math.min(effort, available);

    agent.energy = clamp01(agent.energy - 0.035);
    agent.stress = clamp01(agent.stress + 0.006);
    agent.resources = clamp01(agent.resources + gathered);
    agent.skills.gathering = clamp01(agent.skills.gathering + 0.004);
    this.state.environment.resourcePool = clamp01(available - gathered);
    agent.lastAction = 'gather';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.gathered', {
      gathered,
      resources: agent.resources,
      poolRemaining: this.state.environment.resourcePool,
      locationId: agent.locationId,
    });
  }

  private performWork(agent: AgentState, now: number): void {
    this.moveAgent(agent, this.localPlace(agent, ['workshop'], 'workshop'));
    const produced =
      0.018 +
      agent.skills.craft * 0.05 +
      agent.personality.diligence * 0.04 +
      agent.life.physiology.endurance * 0.022;

    agent.resources = clamp01(agent.resources + produced);
    agent.energy = clamp01(agent.energy - 0.045);
    agent.stress = clamp01(
      agent.stress + 0.012 * (1 - agent.personality.resilience),
    );
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.045);
    agent.skills.craft = clamp01(agent.skills.craft + 0.004);
    agent.lastAction = 'work';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.worked', {
      produced,
      resources: agent.resources,
      skill: agent.skills.craft,
      locationId: agent.locationId,
    });
  }

  private performExplore(agent: AgentState, now: number): void {
    const frontier =
      this.state.growth.discoveredRegionIds[
        this.state.growth.discoveredRegionIds.length - 1
      ] ?? 'outskirts';
    const targetFrontier = this.state.places[frontier] ? frontier : 'outskirts';
    if (agent.locationId !== targetFrontier) {
      const route = this.pathBetween(agent.locationId, targetFrontier);
      const nextLocation = route?.[1] ?? targetFrontier;
      agent.plan = {
        kind: 'explore_frontier',
        targetPlaceId: targetFrontier,
        startedAt: agent.plan?.startedAt ?? now,
        expiresAt: now + 48,
      };
      this.moveAgent(agent, nextLocation);
      agent.energy = clamp01(agent.energy - 0.024);
      agent.resources = clamp01(agent.resources - 0.004);
      agent.skills.exploration = clamp01(agent.skills.exploration + 0.001);
      agent.needs.purpose = clamp01(agent.needs.purpose + 0.005);
      agent.lastAction = 'explore';
      agent.lastMeaningfulEventAt = now;
      this.recordAgentEvent(agent, now, 'agent.explored', {
        discovered: false,
        discovery: 0,
        traveling: true,
        frontierId: targetFrontier,
        growthStage: this.state.growth.stage,
        explorationProgress: this.state.growth.explorationProgress,
        discoveredRegionId: null,
        locationId: agent.locationId,
      });
      return;
    }
    agent.plan = undefined;
    agent.energy = clamp01(agent.energy - 0.04);
    agent.resources = clamp01(agent.resources - 0.008);
    agent.skills.exploration = clamp01(agent.skills.exploration + 0.003);
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.012);

    const discoveryChance = clamp01(
      0.08 +
        agent.skills.exploration * 0.2 +
        agent.personality.curiosity * 0.18 +
        agent.personality.riskTolerance * 0.08,
    );
    const resourceDiscovered = this.rng.next() < discoveryChance;
    let discovery = 0;
    if (resourceDiscovered) {
      discovery = this.rng.between(0.035, 0.11);
      this.state.environment.resourcePool = clamp01(
        this.state.environment.resourcePool + discovery,
      );
      agent.needs.purpose = clamp01(agent.needs.purpose + 0.035);
    }

    const progressGain =
      0.2 +
      agent.skills.exploration * 0.04 +
      agent.personality.curiosity * 0.03;
    const discoveredRegionId = this.advanceWorldGrowth(
      agent,
      progressGain,
      now,
    );

    agent.lastAction = 'explore';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.explored', {
      discovered: resourceDiscovered,
      discovery,
      resourcePool: this.state.environment.resourcePool,
      growthStage: this.state.growth.stage,
      explorationProgress: this.state.growth.explorationProgress,
      discoveredRegionId: discoveredRegionId ?? null,
      locationId: agent.locationId,
    });
  }

  private advanceWorldGrowth(
    agent: AgentState,
    progressGain: number,
    now: number,
  ): string | undefined {
    const expansionRate =
      this.lawValue('frontier_expansion', 1);
    const frontierDifficulty =
      1 + Math.max(0, this.state.growth.stage - WORLD_EXPANSIONS.length) * 0.08;
    this.state.growth.explorationProgress = clamp01(
      this.state.growth.explorationProgress +
        (progressGain * expansionRate) / frontierDifficulty,
    );
    if (this.state.growth.explorationProgress < 1) {
      return undefined;
    }

    const nextStage = this.state.growth.stage + 1;
    const expansion =
      WORLD_EXPANSIONS.find((candidate) => candidate.stage === nextStage) ??
      this.createProceduralExpansion(nextStage, now);

    this.state.places[expansion.place.id] = {
      ...structuredClone(expansion.place),
      discoveredAt: now,
    };
    for (const connectedId of expansion.place.connectedPlaceIds) {
      const connected = this.state.places[connectedId];
      if (
        connected &&
        !connected.connectedPlaceIds.includes(expansion.place.id)
      ) {
        connected.connectedPlaceIds.push(expansion.place.id);
      }
    }
    for (const population of expansion.wildlife) {
      this.state.wildlife[population.id] = {
        ...structuredClone(population),
        lastChangedAt: now,
      };
    }
    this.rebuildSpatialProjection();

    this.state.growth.stage = expansion.stage;
    this.state.growth.frontierSequence = Math.max(
      this.state.growth.frontierSequence + 1,
      expansion.stage,
    );
    this.state.growth.explorationProgress = 0;
    this.state.growth.lastExpansionAt = now;
    this.state.growth.discoveredRegionIds.push(expansion.place.id);

    this.stageEvent({
      eventId: this.nextId('world-growth'),
      worldId: this.state.id,
      kind: 'world.region.discovered',
      source: 'agent',
      occurredAt: now,
      payload: {
        agentId: agent.id,
        regionId: expansion.place.id,
        regionKind: expansion.place.kind,
        biome: expansion.place.biome,
        stage: expansion.stage,
        connectedPlaceIds: expansion.place.connectedPlaceIds,
      },
    });
    this.stageMemory({
      memoryId: this.nextId('memory'),
      worldId: this.state.id,
      agentId: agent.id,
      createdAt: now,
      kind: 'world_event',
      summary: `${agent.name} discovered ${expansion.place.name}.`,
      importance: 0.82,
      valence: 0.62,
      relatedAgentIds: [],
    });

    return expansion.place.id;
  }

  private advanceVoluntaryResettlement(now: number): void {
    if (!Number.isInteger(now) || now % 24 !== 0) return;

    const settlements = Object.values(this.state.settlements);
    if (settlements.length < 2) return;

    const adults = this.shuffled(
      Object.values(this.state.agents).filter(
        (agent) =>
          agent.life.alive &&
          agent.life.stage === 'adult' &&
          !agent.movement &&
          !agent.plan &&
          agent.resources >= 0.24 &&
          agent.stress <= 0.78,
      ),
    );

    for (const agent of adults) {
      const currentSettlementId = this.homeSettlementId(agent);
      const willingness = clamp01(
        agent.personality.curiosity * 0.27 +
          agent.personality.riskTolerance * 0.2 +
          agent.mind.values.ambition * 0.2 +
          agent.skills.exploration * 0.18 +
          (1 - agent.needs.purpose) * 0.15,
      );
      if (willingness < 0.58) continue;
      if (this.rng.next() >= 0.015 + willingness * 0.045) continue;

      const options = settlements
        .filter(
          (settlement) =>
            settlement.id !== currentSettlementId &&
            this.pathBetween(agent.locationId, settlement.centerPlaceId) !== undefined,
        )
        .map((settlement) => {
          const center = this.state.places[settlement.centerPlaceId];
          const distance = Math.max(
            0,
            (this.pathBetween(agent.locationId, settlement.centerPlaceId)?.length ?? 1) - 1,
          );
          const score =
            willingness * 0.5 +
            (center?.fertility ?? 0.5) * 0.28 -
            (center?.danger ?? 0.1) * 0.35 -
            distance * 0.025;
          return { settlement, score };
        })
        .sort((a, b) => b.score - a.score);

      const selected = options[0]?.settlement;
      if (!selected) continue;

      const homes = selected.memberPlaceIds
        .map((placeId) => this.state.places[placeId])
        .filter((place): place is WorldPlace => place?.kind === 'home')
        .sort((a, b) => a.id.localeCompare(b.id));
      const home = homes.find((candidate) => {
        const occupants = Object.values(this.state.agents).filter(
          (other) => other.life.alive && other.homeId === candidate.id,
        ).length;
        return occupants < candidate.capacity;
      });
      if (!home) continue;

      const priorHomeId = agent.homeId;
      const priorSettlementId = currentSettlementId ?? null;
      agent.homeId = home.id;
      this.moveAgent(agent, selected.centerPlaceId);
      agent.needs.purpose = clamp01(agent.needs.purpose + 0.06);
      agent.mind.emotions.hope = clamp01(agent.mind.emotions.hope + 0.04);
      agent.lastMeaningfulEventAt = now;

      this.stageEvent({
        eventId: this.nextId('resettlement'),
        worldId: this.state.id,
        kind: 'agent.resettled',
        source: 'agent',
        occurredAt: now,
        payload: {
          agentId: agent.id,
          priorHomeId,
          priorSettlementId,
          settlementId: selected.id,
          homeId: home.id,
          willingness,
        },
      });
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'world_event',
        summary: `${agent.name} chose to make a new home in ${selected.name}.`,
        importance: 0.78,
        valence: 0.52,
        relatedAgentIds: [],
      });
    }
  }

  private advanceSettlements(now: number): void {
    if (!Number.isInteger(now) || now % 24 !== 0) return;
    const living = Object.values(this.state.agents).filter(
      (agent) => agent.life.alive,
    ).length;
    const settlements = Object.values(this.state.places).filter(
      (place) => place.kind === 'village' || place.kind === 'city',
    );
    const desiredSettlements = Math.min(
      Math.floor(this.state.growth.stage / 3),
      Math.max(0, Math.floor((living - 3) / 3)),
    );

    if (settlements.length < desiredSettlements) {
      const sequence = settlements.length + 1;
      const frontierId =
        this.state.growth.discoveredRegionIds.at(
          -1 - (sequence % Math.max(1, this.state.growth.discoveredRegionIds.length)),
        ) ?? 'outskirts';
      const anchor = this.state.places[frontierId] ?? this.state.places.outskirts;
      const pioneerCandidates = this.shuffled(
        Object.values(this.state.agents).filter(
          (agent) =>
            agent.life.alive &&
            agent.life.stage === 'adult' &&
            agent.locationId === frontierId &&
            agent.resources >= 0.28 &&
            !agent.movement,
        ),
      );
      const willingFounders = pioneerCandidates.filter((agent) => {
        const willingness = clamp01(
          agent.personality.curiosity * 0.24 +
            agent.personality.diligence * 0.2 +
            agent.personality.riskTolerance * 0.14 +
            agent.mind.values.ambition * 0.2 +
            agent.mind.values.care * 0.12 +
            agent.skills.exploration * 0.1,
        );
        return willingness >= 0.52 && this.rng.next() < 0.1 + willingness * 0.28;
      });
            if (willingFounders.length < 2) {
        const cities = settlements.filter((place) => place.kind === 'city');
        const desiredCities = Math.min(
          Math.floor(this.state.growth.stage / 8),
          Math.floor(living / 12),
        );

        if (cities.length < desiredCities) {
          const cityCandidate = [...settlements, this.state.places.commons]
            .filter(
              (place) =>
                place.kind === 'village' ||
                (place.id === 'commons' && place.kind === 'commons'),
            )
            .map((place) => ({
              place,
              residents: Object.values(this.state.agents).filter(
                (agent) =>
                  agent.life.alive &&
                  this.homeSettlementId(agent) ===
                    (place.settlementId ?? place.id),
              ).length,
            }))
            .filter(({ residents }) => residents >= 10)
            .sort(
              (a, b) =>
                b.residents - a.residents ||
                (a.place.discoveredAt ?? 0) -
                  (b.place.discoveredAt ?? 0),
            )[0]?.place;

          if (cityCandidate) {
            cityCandidate.kind = 'city';
            cityCandidate.name = cityCandidate.name.replace(
              'Поселение',
              'Город',
            );
            cityCandidate.capacity = Math.max(
              20,
              cityCandidate.capacity * 2,
            );
            cityCandidate.fertility = clamp01(
              cityCandidate.fertility + 0.08,
            );

            this.rebuildSpatialProjection();

            this.stageEvent({
              eventId: this.nextId('city'),
              worldId: this.state.id,
              kind: 'world.city.emerged',
              source: 'agent',
              occurredAt: now,
              payload: {
                cityId: cityCandidate.id,
                name: cityCandidate.name,
                livingPopulation: living,
                worldStage: this.state.growth.stage,
              },
            });
          }
        }

        return;
      }

      const names = [
        'Ривен',
        'Лунная Долина',
        'Эльм',
        'Белый Брод',
        'Сольвей',
        'Звёздная Гавань',
      ];
      const id = `settlement_${sequence}`;
      const angle = sequence * 2.399963229728653;
      this.state.places[id] = createPlace(
        id,
        `Поселение ${names[(sequence - 1) % names.length]}`,
        'village',
        8 + sequence * 2,
        {
          biome: 'settlement',
          mapX: anchor.mapX + Math.cos(angle) * (8 + sequence),
          mapY: anchor.mapY + Math.sin(angle) * (8 + sequence),
          connectedPlaceIds: [frontierId],
          fertility: clamp01(0.56 + anchor.fertility * 0.2),
          danger: 0.05,
          settlementId: id,
          discoveredAt: now,
        },
      );
      for (let districtIndex = 0; districtIndex < 3; districtIndex += 1) {
        const districtAngle = angle + (Math.PI * 2 * districtIndex) / 3;
        const districtId = `${id}_house_${districtIndex + 1}`;
        this.state.places[districtId] = createPlace(
          districtId,
          `Дом поселенцев ${districtIndex + 1}`,
          'home',
          4,
          {
            biome: 'settlement',
            mapX: this.state.places[id].mapX + Math.cos(districtAngle) * 3.8,
            mapY: this.state.places[id].mapY + Math.sin(districtAngle) * 3.8,
            connectedPlaceIds: [id],
            fertility: 0.58,
            danger: 0.04,
            surface: 'land',
            settlementId: id,
            discoveredAt: now,
          },
        );
      }
      const localServices: Array<{
        suffix: string;
        name: string;
        kind: WorldPlaceKind;
        dx: number;
        dy: number;
        fertility: number;
      }> = [
        { suffix: 'field', name: 'Поля', kind: 'resource_field', dx: -4.8, dy: 2.4, fertility: 0.76 },
        { suffix: 'workshop', name: 'Мастерская', kind: 'workshop', dx: 4.6, dy: 1.8, fertility: 0.3 },
        { suffix: 'quiet', name: 'Тихий сад', kind: 'quiet_space', dx: 0.8, dy: -4.5, fertility: 0.62 },
      ];
      for (const service of localServices) {
        const serviceId = `${id}_${service.suffix}`;
        this.state.places[serviceId] = createPlace(
          serviceId,
          `${this.state.places[id].name}: ${service.name}`,
          service.kind,
          10,
          {
            biome: service.kind === 'resource_field' ? 'plains' : 'settlement',
            mapX: this.state.places[id].mapX + service.dx,
            mapY: this.state.places[id].mapY + service.dy,
            connectedPlaceIds: [id],
            fertility: service.fertility,
            danger: 0.04,
            surface: 'land',
            settlementId: id,
            discoveredAt: now,
          },
        );
      }
      const settlementHomes = [1, 2, 3]
        .map((index) => this.state.places[`${id}_house_${index}`])
        .filter((place): place is WorldPlace => place !== undefined);
      for (let index = 0; index < willingFounders.length; index += 1) {
        const founder = willingFounders[index];
        const home = settlementHomes[index % settlementHomes.length];
        if (!home) break;
        const priorHomeId = founder.homeId;
        founder.homeId = home.id;
        this.moveAgent(founder, id);
        founder.needs.purpose = clamp01(founder.needs.purpose + 0.08);
        founder.mind.emotions.hope = clamp01(founder.mind.emotions.hope + 0.06);
        founder.lastMeaningfulEventAt = now;
        this.stageEvent({
          eventId: this.nextId('settlement-founder'),
          worldId: this.state.id,
          kind: 'agent.resettled',
          source: 'agent',
          occurredAt: now,
          payload: {
            agentId: founder.id,
            priorHomeId,
            settlementId: id,
            homeId: home.id,
            reason: 'voluntary_founder',
          },
        });
        this.stageMemory({
          memoryId: this.nextId('memory'),
          worldId: this.state.id,
          agentId: founder.id,
          createdAt: now,
          kind: 'world_event',
          summary: `${founder.name} chose to help found ${this.state.places[id].name}.`,
          importance: 0.9,
          valence: 0.68,
          relatedAgentIds: willingFounders
            .filter((other) => other.id !== founder.id)
            .map((other) => other.id),
        });
      }
      makeConnectionsReciprocal(this.state.places);
      this.rebuildSpatialProjection();
      this.stageEvent({
        eventId: this.nextId('settlement'),
        worldId: this.state.id,
        kind: 'world.settlement.founded',
        source: 'agent',
        occurredAt: now,
        payload: {
          settlementId: id,
          name: this.state.places[id].name,
          connectedRegionId: frontierId,
          livingPopulation: living,
          worldStage: this.state.growth.stage,
        },
      });
      return;
    }

    const cities = settlements.filter((place) => place.kind === 'city');
    const desiredCities = Math.min(
      Math.floor(this.state.growth.stage / 8),
      Math.floor(living / 12),
    );
    if (cities.length >= desiredCities) return;

        const village = [...settlements, this.state.places.commons]
      .filter(
        (place) =>
          place.kind === 'village' ||
          (place.id === 'commons' && place.kind === 'commons'),
      )
      .map((place) => ({
        place,
        residents: Object.values(this.state.agents).filter(
          (agent) =>
            agent.life.alive &&
            this.homeSettlementId(agent) ===
              (place.settlementId ?? place.id),
        ).length,
      }))
      .filter(({ residents }) => residents >= 10)
      .sort(
        (a, b) =>
          b.residents - a.residents ||
          (a.place.discoveredAt ?? 0) - (b.place.discoveredAt ?? 0),
      )[0]?.place;
    if (!village) return;
    village.kind = 'city';
    village.name = village.name.replace('Поселение', 'Город');
    village.capacity = Math.max(20, village.capacity * 2);
    village.fertility = clamp01(village.fertility + 0.08);
    // City promotion preserves organically opened roads. It does not create
    // an artificial direct route back to the founding commons.
    this.rebuildSpatialProjection();
    this.stageEvent({
      eventId: this.nextId('city'),
      worldId: this.state.id,
      kind: 'world.city.emerged',
      source: 'agent',
      occurredAt: now,
      payload: {
        cityId: village.id,
        name: village.name,
        livingPopulation: living,
        worldStage: this.state.growth.stage,
      },
    });
  }

  private createProceduralExpansion(
    stage: number,
    now: number,
  ): WorldExpansionDefinition {
    const proceduralBiomes: readonly WorldBiome[] = [
      'mountains',
      'lake',
      'river',
      'swamp',
      'ancient_ruins',
      'forest',
      'plains',
      'coast',
    ];
    const biome = proceduralBiomes[
      (stage + Math.floor(this.rng.next() * proceduralBiomes.length)) %
        proceduralBiomes.length
    ];
    const kindByBiome: Record<WorldBiome, WorldPlaceKind> = {
      settlement: 'village',
      plains: 'meadow',
      forest: 'forest',
      coast: 'shore',
      mountains: 'mountains',
      lake: 'lake',
      river: 'river',
      swamp: 'swamp',
      ancient_ruins: 'ruins',
    };
    const prefix = REGION_NAME_PREFIXES[
      (stage + Math.floor(this.rng.next() * REGION_NAME_PREFIXES.length)) %
        REGION_NAME_PREFIXES.length
    ];
    const suffixes = REGION_NAME_SUFFIXES[biome];
    const suffix = suffixes[stage % suffixes.length];
    const regionId = `region_${stage}`;
    const priorRegionId =
      this.state.growth.discoveredRegionIds[
        this.state.growth.discoveredRegionIds.length - 1
      ] ?? 'outskirts';
    const goldenAngle = 2.399963229728653;
    // Coordinates are world units, not a permanently fixed 0..100 canvas.
    // Every eight frontier regions opens a wider ring; the browser zooms the
    // accumulated bounds to its current viewport.
    const frontierBand = Math.floor(Math.max(0, stage - 4) / 8);
    const ring = 38 + frontierBand * 14 + (stage % 4) * 2.4;
    const angle = stage * goldenAngle;
    const mapX = 50 + Math.cos(angle) * ring;
    const mapY = 50 + Math.sin(angle) * ring;
    const fertilityByBiome: Record<WorldBiome, number> = {
      settlement: 0.52,
      plains: 0.78,
      forest: 0.72,
      coast: 0.64,
      mountains: 0.3,
      lake: 0.7,
      river: 0.82,
      swamp: 0.5,
      ancient_ruins: 0.22,
    };
    const dangerByBiome: Record<WorldBiome, number> = {
      settlement: 0.05,
      plains: 0.14,
      forest: 0.3,
      coast: 0.2,
      mountains: 0.42,
      lake: 0.16,
      river: 0.18,
      swamp: 0.44,
      ancient_ruins: 0.52,
    };
    const speciesByBiome: Record<WorldBiome, WildlifeSpecies> = {
      settlement: 'bird',
      plains: 'rabbit',
      forest: stage % 3 === 0 ? 'wolf' : stage % 2 === 0 ? 'boar' : 'deer',
      coast: 'fish',
      mountains: 'wolf',
      lake: 'fish',
      river: 'fish',
      swamp: 'boar',
      ancient_ruins: 'bird',
    };
    const species = speciesByBiome[biome];
    const ordinaryThreat: Record<WildlifeSpecies, number> = {
      rabbit: 0.04,
      deer: 0.08,
      fish: 0.02,
      boar: 0.28,
      wolf: 0.42,
      bird: 0.02,
      dire_wolf: 0.72,
      ogre: 0.86,
      wraith: 0.94,
    };
    const carryingCapacity =
      4 + Math.floor(fertilityByBiome[biome] * 8 + this.rng.next() * 4);
    const initialCount = Math.max(2, Math.floor(carryingCapacity * 0.45));
    const place = createPlace(
      regionId,
      `${prefix} ${suffix}`,
      kindByBiome[biome],
      10 + Math.floor(this.rng.next() * 10),
      {
        biome,
        mapX,
        mapY,
        connectedPlaceIds: [priorRegionId],
        fertility: fertilityByBiome[biome],
        danger: dangerByBiome[biome],
        discoveredAt: now,
      },
    );
    const wildlife: WildlifePopulation[] = [
      {
        id: `wildlife_${stage}_${species}`,
        species,
        habitatId: regionId,
        count: initialCount,
        carryingCapacity,
        reproductionRate: clamp01(0.07 + place.fertility * 0.12),
        alertness: clamp01(0.12 + place.danger * 0.4),
        threat: ordinaryThreat[species],
        isMonster: false,
        lastChangedAt: now,
      },
    ];
    if (stage >= 5 && (stage - 5) % 3 === 0) {
      const monsterSpecies: WildlifeSpecies =
        biome === 'ancient_ruins'
          ? 'wraith'
          : biome === 'swamp'
            ? 'ogre'
            : 'dire_wolf';
      const threat = ordinaryThreat[monsterSpecies];
      place.danger = Math.max(place.danger, threat * 0.78);
      wildlife.push({
        id: `monster_${stage}_${monsterSpecies}`,
        species: monsterSpecies,
        habitatId: regionId,
        count: 1 + (stage % 2),
        carryingCapacity: 2 + (stage % 3),
        reproductionRate: 0.018,
        alertness: 0.72,
        threat,
        isMonster: true,
        lastChangedAt: now,
      });
    }
    return { stage, place, wildlife };
  }

  private advanceWildlife(
    environment: WorldEnvironment,
    now: number,
  ): void {
    const recoveryLaw =
      this.lawValue('wildlife_recovery', 1);
    for (const population of Object.values(this.state.wildlife)) {
      population.alertness = clamp01(population.alertness - 0.025);
      if (population.count >= population.carryingCapacity) {
        continue;
      }

      const density = population.count / population.carryingCapacity;
      const emptyHabitatBoost = population.count === 0 ? 0.22 : 0;
      // Cardinal habitat support protects ordinary ecology, never monsters.
      const habitatSupport = population.isMonster
        ? Math.min(0.3, environment.habitatSupport)
        : environment.habitatSupport;
      const effectiveRecoveryLaw = population.isMonster
        ? Math.min(0.35, recoveryLaw)
        : recoveryLaw;
      const recoveryChance = clamp01(
        population.reproductionRate *
          effectiveRecoveryLaw *
          (0.35 + habitatSupport * 0.8) *
          (1 - density) +
          emptyHabitatBoost * habitatSupport * (population.isMonster ? 0.08 : 1),
      );
      if (this.rng.next() >= recoveryChance) {
        continue;
      }

      population.count += 1;
      population.lastChangedAt = now;
      if (
        now <= 240 ||
        Math.floor(now) % ROUTINE_EVENT_SAMPLE_INTERVAL === 0 ||
        population.count === population.carryingCapacity
      ) {
        this.stageEvent({
          eventId: this.nextId('wildlife'),
          worldId: this.state.id,
          kind: 'world.wildlife.recovered',
          source: 'world',
          occurredAt: now,
          payload: {
            populationId: population.id,
            species: population.species,
            habitatId: population.habitatId,
            count: population.count,
            carryingCapacity: population.carryingCapacity,
          },
        });
      }
    }
  }

  private advanceAgingAndMortality(
    now: number,
    elapsedWorldMinutes: number,
  ): void {
    const ageDelta = elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR;
    const durationScale = ageDelta * WORLD_TICKS_PER_YEAR;
    for (const agent of Object.values(this.state.agents)) {
      if (!agent.life.alive) continue;

      const previousStage = agent.life.stage;
      agent.life.ageYears += ageDelta;
      agent.life.stage = lifeStageForAge(agent.life.ageYears);
      if (agent.life.stage !== previousStage) {
        this.recordAgentEvent(agent, now, 'agent.life.stage_changed', {
          previousStage,
          nextStage: agent.life.stage,
          ageYears: agent.life.ageYears,
        });
      }

      const placeDanger = this.state.places[agent.locationId]?.danger ?? 0.1;
      const deprivation =
        Math.max(0, 0.12 - agent.resources) * 0.034 +
        Math.max(0, 0.1 - agent.energy) * 0.026;
      const frailty =
        agent.life.ageYears > ELDER_AGE
          ? ((agent.life.ageYears - ELDER_AGE) /
              Math.max(1, agent.life.lifespanYears - ELDER_AGE)) *
            0.0018
          : 0;
      const recovery =
        agent.resources > 0.35 && agent.energy > 0.3
          ? (0.0012 + agent.personality.resilience * 0.0012) *
            agent.life.physiology.recovery
          : 0;
      agent.life.health = clamp01(
        agent.life.health +
          recovery -
          deprivation -
          frailty * Math.max(0.05, durationScale) -
          placeDanger * 0.00022,
      );
      agent.life.physiology = physiologyForAge(
        agent.life.ageYears,
        agent.life.lifespanYears,
        agent.life.health,
      );

      const ageRatio = agent.life.ageYears / agent.life.lifespanYears;
      const oldAgeChance =
        ageRatio > 0.9 ? Math.pow((ageRatio - 0.9) / 0.1, 2) * 0.014 : 0;
      if (agent.life.ageYears >= agent.life.lifespanYears) {
        this.recordDeath(agent, 'old_age', now);
      } else if (agent.life.health <= 0.015) {
        this.recordDeath(
          agent,
          agent.resources < 0.08 ? 'deprivation' : 'illness',
          now,
        );
      } else if (
        oldAgeChance > 0 &&
        this.rng.next() < clamp01(oldAgeChance * durationScale)
      ) {
        this.recordDeath(agent, 'old_age', now);
      }
    }
  }

  private recordDeath(
    agent: AgentState,
    cause: AgentDeathCause,
    now: number,
  ): void {
    if (!agent.life.alive) return;
    agent.life.alive = false;
    agent.life.health = 0;
    agent.life.diedAt = now;
    agent.life.deathCause = cause;
    agent.lastAction = undefined;
    agent.lastDecision = undefined;
    agent.plan = undefined;
    this.state.population.deaths += 1;
    this.state.population.lastDeathAt = now;

    this.stageEvent({
      eventId: this.nextId('death'),
      worldId: this.state.id,
      kind: 'agent.died',
      source: 'world',
      occurredAt: now,
      payload: {
        agentId: agent.id,
        name: agent.name,
        cause,
        ageYears: agent.life.ageYears,
        generation: agent.life.generation,
      },
    });

    const relatives = new Set([
      ...agent.life.parentIds,
      ...agent.life.childIds,
    ]);
    for (const relationship of Object.values(this.state.relationships)) {
      const otherId =
        relationship.agentA === agent.id
          ? relationship.agentB
          : relationship.agentB === agent.id
            ? relationship.agentA
            : undefined;
      if (!otherId) continue;
      const bondStrength =
        relationship.trust +
        relationship.affinity +
        relationship.respect -
        relationship.conflict;
      if (bondStrength >= 1.45) relatives.add(otherId);
    }
    for (const relativeId of relatives) {
      const relative = this.state.agents[relativeId];
      if (!relative?.life.alive) continue;
      relative.mind.emotions.grief = clamp01(
        relative.mind.emotions.grief + 0.46,
      );
      relative.mind.emotions.joy = clamp01(
        relative.mind.emotions.joy - 0.24,
      );
      relative.mind.beliefs.afterlife = clamp01(
        relative.mind.beliefs.afterlife + 0.035,
      );
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: relative.id,
        createdAt: now,
        kind: 'death',
        summary: `${relative.name} lost ${agent.name}.`,
        importance: 0.96,
        valence: -0.92,
        relatedAgentIds: [agent.id],
      });
    }
  }

  private advanceBirths(now: number, elapsedWorldMinutes: number): void {
    if (!Number.isInteger(now) || now % BIRTH_CHECK_INTERVAL !== 0) return;
    if (
      this.state.population.lastBirthWorldMinute !== undefined &&
      this.state.calendar.elapsedWorldMinutes -
        this.state.population.lastBirthWorldMinute <
        MIN_WORLD_MINUTES_BETWEEN_BIRTHS
    ) {
      return;
    }

    const living = Object.values(this.state.agents).filter(
      (agent) => agent.life.alive,
    );
    const regionalCapacity =
      12 + this.state.growth.discoveredRegionIds.length * 12;
    const populationLimit = Math.min(
      MAX_LIVING_POPULATION,
      Math.max(8, regionalCapacity),
    );
    const candidates = Object.values(this.state.relationships)
      .map((relationship) => {
        const a = this.state.agents[relationship.agentA];
        const b = this.state.agents[relationship.agentB];
        if (!a || !b || !this.canFormFamily(a, b, now)) return undefined;
        const score =
          relationship.trust * 0.25 +
          relationship.affinity * 0.26 +
          relationship.respect * 0.1 -
          relationship.conflict * 0.34 +
          (a.mind.values.care + b.mind.values.care) * 0.13 +
          (a.mind.emotions.hope + b.mind.emotions.hope) * 0.06 +
          (a.lastAction === 'bond' || b.lastAction === 'bond' ? 0.18 : 0);
        return { a, b, relationship, score };
      })
      .filter(
        (
          candidate,
        ): candidate is {
          a: AgentState;
          b: AgentState;
          relationship: RelationshipState;
          score: number;
        } => candidate !== undefined,
      )
      .sort((a, b) => b.score - a.score);
    const selected = candidates[0];
    if (!selected || selected.score < 0.62) return;
    const selectedRace = selected.a.race ?? 'human';
    const sameRaceLiving = living.filter(
      (agent) => (agent.race ?? 'human') === selectedRace,
    ).length;
    const raceLimit = selectedRace === 'human' ? populationLimit : Math.min(16, populationLimit);
    if (sameRaceLiving >= raceLimit) return;

    const fertilitySupport =
      this.lawValue('fertility_support', 0.55);
    const baseChoiceChance = clamp01(
      0.04 +
        fertilitySupport * 0.09 +
        Math.max(0, selected.score - 0.62) * 0.12,
    );
    const speedAdjustedChance = clamp01(
      baseChoiceChance *
        ((elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR) *
          WORLD_TICKS_PER_YEAR),
    );
    if (this.rng.next() >= speedAdjustedChance) return;
    this.createChild(selected.a, selected.b, now);
  }

  private canFormFamily(a: AgentState, b: AgentState, now: number): boolean {
    if (
      !a.life.alive ||
      !b.life.alive ||
      a.life.stage !== 'adult' ||
      b.life.stage !== 'adult' ||
      a.sex === b.sex ||
      (a.race ?? 'human') !== (b.race ?? 'human') ||
      a.life.ageYears > 55 ||
      b.life.ageYears > 55 ||
      a.life.health < 0.58 ||
      b.life.health < 0.58 ||
      a.resources < 0.42 ||
      b.resources < 0.42 ||
      a.stress > 0.72 ||
      b.stress > 0.72
    ) {
      return false;
    }
    if (
      (a.life.lastChildWorldMinute !== undefined &&
        this.state.calendar.elapsedWorldMinutes -
          a.life.lastChildWorldMinute <
          WORLD_MINUTES_PER_YEAR * 1.3) ||
      (b.life.lastChildWorldMinute !== undefined &&
        this.state.calendar.elapsedWorldMinutes -
          b.life.lastChildWorldMinute <
          WORLD_MINUTES_PER_YEAR * 1.3)
    ) {
      return false;
    }
    const closeRelatives = new Set([
      ...a.life.parentIds,
      ...a.life.childIds,
    ]);
    if (closeRelatives.has(b.id)) return false;
    return !a.life.parentIds.some((parentId) => b.life.parentIds.includes(parentId));
  }

  private createChild(a: AgentState, b: AgentState, now: number): void {
    const sequence = this.state.population.nextAgentSequence;
    this.state.population.nextAgentSequence += 1;
    const childId = `agent_${sequence}`;
    const childNames = [
      'Ari',
      'Lio',
      'Sena',
      'Tali',
      'Neri',
      'Eden',
      'Sora',
      'Ayla',
      'Lev',
      'Yuna',
    ];
    const name = `${childNames[(sequence - 1) % childNames.length]} ${sequence}`;
    const blend = (left: number, right: number, variation = 0.08) =>
      clamp01((left + right) / 2 + this.rng.between(-variation, variation));
    const personality: AgentState['personality'] = {
      sociability: blend(a.personality.sociability, b.personality.sociability),
      diligence: blend(a.personality.diligence, b.personality.diligence),
      curiosity: blend(a.personality.curiosity, b.personality.curiosity),
      generosity: blend(a.personality.generosity, b.personality.generosity),
      resilience: blend(a.personality.resilience, b.personality.resilience),
      riskTolerance: blend(
        a.personality.riskTolerance,
        b.personality.riskTolerance,
      ),
    };
    const needs = { belonging: 0.88, purpose: 0.72 };
    const mind = createMindState(
      this.state.id,
      childId,
      personality,
      needs,
    );
    for (const value of Object.keys(mind.values) as Array<
      keyof AgentState['mind']['values']
    >) {
      mind.values[value] = blend(a.mind.values[value], b.mind.values[value], 0.04);
    }
    for (const belief of Object.keys(mind.beliefs) as Array<
      keyof AgentState['mind']['beliefs']
    >) {
      mind.beliefs[belief] = blend(
        a.mind.beliefs[belief],
        b.mind.beliefs[belief],
        0.035,
      );
    }
    const homeId = a.resources >= b.resources ? a.homeId : b.homeId;
    const child: AgentState = {
      id: childId,
      name,
      origin: 'native',
      sex: this.rng.next() < 0.5 ? 'male' : 'female',
      race: a.race ?? 'human',
      progression: {
        level: 1,
        experience: 0,
        objectControlAuthority: 0,
        systemControlAuthority: 0,
        combatMastery: 0,
        sacredArts: 0,
      },
      energy: 0.86,
      stress: 0.04,
      resources: 0.62,
      socialDrive: blend(a.socialDrive, b.socialDrive, 0.05),
      personality,
      life: {
        bornAt: now,
        ageYears: 0,
        lifespanYears:
          72 + personality.resilience * 26 + this.rng.between(-2, 4),
        stage: 'child',
        alive: true,
        health: 0.94,
        physiology: physiologyForAge(
          0,
          72 + personality.resilience * 26,
          0.94,
        ),
        generation: Math.max(a.life.generation, b.life.generation) + 1,
        parentIds: [a.id, b.id],
        childIds: [],
      },
      mind,
      needs,
      skills: {
        gathering: blend(a.skills.gathering, b.skills.gathering, 0.03) * 0.18,
        hunting: blend(a.skills.hunting, b.skills.hunting, 0.03) * 0.12,
        craft: blend(a.skills.craft, b.skills.craft, 0.03) * 0.18,
        social: blend(a.skills.social, b.skills.social, 0.03) * 0.24,
        exploration: blend(a.skills.exploration, b.skills.exploration, 0.03) * 0.2,
      },
      goal: { kind: 'recover', strength: 0.66, since: now },
      homeId,
      locationId: homeId,
      position: {
        x: this.state.places[homeId].mapX,
        y: this.state.places[homeId].mapY,
        layerId: 'surface',
      },
      lastMeaningfulEventAt: now,
    };
    this.state.agents[childId] = child;
    a.life.childIds.push(childId);
    b.life.childIds.push(childId);
    a.life.lastChildAt = now;
    b.life.lastChildAt = now;
    a.life.lastChildWorldMinute = this.state.calendar.elapsedWorldMinutes;
    b.life.lastChildWorldMinute = this.state.calendar.elapsedWorldMinutes;
    this.state.relationships[relationshipKey(a.id, childId)] = {
      agentA: a.id,
      agentB: childId,
      trust: 0.82,
      affinity: 0.88,
      respect: 0.58,
      conflict: 0.02,
      updatedAt: now,
    };
    this.state.relationships[relationshipKey(b.id, childId)] = {
      agentA: b.id,
      agentB: childId,
      trust: 0.82,
      affinity: 0.88,
      respect: 0.58,
      conflict: 0.02,
      updatedAt: now,
    };
    this.state.population.births += 1;
    this.state.population.lastBirthAt = now;
    this.state.population.lastBirthWorldMinute =
      this.state.calendar.elapsedWorldMinutes;
    this.stageEvent({
      eventId: this.nextId('birth'),
      worldId: this.state.id,
      kind: 'agent.born',
      source: 'world',
      occurredAt: now,
      payload: {
        agentId: childId,
        name,
        parentIds: [a.id, b.id],
        generation: child.life.generation,
      },
    });
    for (const parent of [a, b]) {
      parent.mind.emotions.joy = clamp01(parent.mind.emotions.joy + 0.28);
      parent.mind.emotions.hope = clamp01(parent.mind.emotions.hope + 0.22);
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: parent.id,
        createdAt: now,
        kind: 'birth',
        summary: `${name} was born to ${a.name} and ${b.name}.`,
        importance: 0.98,
        valence: 0.92,
        relatedAgentIds: [childId, parent.id === a.id ? b.id : a.id],
      });
    }
  }

  private advanceSapientRaces(now: number): void {
    if (!Number.isInteger(now) || now < 600 || now % 24 !== 0) return;

    const plans: Array<{
      race: NonNullable<AgentState['race']>;
      minimumStage: number;
      villageName: string;
      names: readonly string[];
    }> = [
      {
        race: 'goblin',
        minimumStage: 5,
        villageName: 'Поселение зелёных равнин',
        names: ['Ruk', 'Mog', 'Vera', 'Nim'],
      },
      {
        race: 'orc',
        minimumStage: 8,
        villageName: 'Поселение каменного клана',
        names: ['Gar', 'Dorn', 'Lira', 'Ona'],
      },
      {
        race: 'ogre',
        minimumStage: 11,
        villageName: 'Поселение великанов',
        names: ['Bram', 'Tor', 'Mara', 'Sia'],
      },
    ];

    const plan = plans.find(
      (candidate) =>
        this.state.growth.stage >= candidate.minimumStage &&
        !Object.values(this.state.agents).some(
          (agent) => agent.race === candidate.race,
        ),
    );
    if (!plan) return;

    const frontierId =
      this.state.growth.discoveredRegionIds.at(-1) ?? 'outskirts';
    const anchor = this.state.places[frontierId] ?? this.state.places.outskirts;
    if (!anchor) return;

    const settlementId = `settlement_${plan.race}_1`;
    if (this.state.places[settlementId]) return;
    const raceIndex = plans.findIndex((candidate) => candidate.race === plan.race);
    const angle = (raceIndex + 1) * 1.77;
    this.state.places[settlementId] = createPlace(
      settlementId,
      plan.villageName,
      'village',
      16,
      {
        biome: 'settlement',
        mapX: anchor.mapX + Math.cos(angle) * 9,
        mapY: anchor.mapY + Math.sin(angle) * 9,
        connectedPlaceIds: [frontierId],
        fertility: clamp01(0.5 + anchor.fertility * 0.18),
        danger: 0.07,
        surface: 'land',
        settlementId,
        discoveredAt: now,
      },
    );

    const founders: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const agentId = `${plan.race}_${index + 1}`;
      const homeId = `home_${agentId}`;
      const homeAngle = angle + (Math.PI * 2 * index) / 4;
      this.state.places[homeId] = createPlace(
        homeId,
        `Дом ${plan.names[index]}`,
        'home',
        4,
        {
          biome: 'settlement',
          mapX: this.state.places[settlementId].mapX + Math.cos(homeAngle) * 3.4,
          mapY: this.state.places[settlementId].mapY + Math.sin(homeAngle) * 3.4,
          connectedPlaceIds: [settlementId],
          fertility: 0.56,
          danger: 0.05,
          surface: 'land',
          settlementId,
          discoveredAt: now,
        },
      );

      const personality: AgentState['personality'] = {
        sociability: this.rng.between(0.28, 0.82),
        diligence: this.rng.between(0.3, 0.86),
        curiosity: this.rng.between(0.28, 0.86),
        generosity: this.rng.between(0.24, 0.82),
        resilience: this.rng.between(0.45, 0.92),
        riskTolerance: this.rng.between(0.38, 0.9),
      };
      const needs = { belonging: 0.7, purpose: 0.62 };
      const ageYears = 20 + index * 3;
      const lifespanBase = plan.race === 'goblin' ? 68 : plan.race === 'orc' ? 82 : 96;
      const health = 0.9;
      const partial = {
        id: agentId,
        name: plan.names[index],
        origin: 'native' as const,
        sex: (index % 2 === 0 ? 'male' : 'female') as AgentState['sex'],
        race: plan.race,
        progression: {
          level: 1,
          experience: 0,
          objectControlAuthority: 0.1,
          systemControlAuthority: 0.06,
          combatMastery: plan.race === 'goblin' ? 0.12 : plan.race === 'orc' ? 0.18 : 0.22,
          sacredArts: 0.03,
        },
        energy: 0.82,
        stress: 0.08,
        resources: 0.58,
        socialDrive: personality.sociability,
        personality,
        life: {
          bornAt: now - ageYears * WORLD_TICKS_PER_YEAR,
          ageYears,
          lifespanYears: lifespanBase + personality.resilience * 16,
          stage: lifeStageForAge(ageYears),
          alive: true,
          health,
          physiology: physiologyForAge(
            ageYears,
            lifespanBase + personality.resilience * 16,
            health,
          ),
          generation: 0,
          parentIds: [],
          childIds: [],
        },
        mind: createMindState(this.state.id, agentId, personality, needs),
        needs,
        skills: {
          gathering: this.rng.between(0.18, 0.45),
          hunting: this.rng.between(0.22, 0.52),
          craft: this.rng.between(0.16, 0.44),
          social: this.rng.between(0.18, 0.48),
          exploration: this.rng.between(0.22, 0.55),
        },
        homeId,
        locationId: settlementId,
        position: {
          x: this.state.places[settlementId].mapX,
          y: this.state.places[settlementId].mapY,
          layerId: 'surface' as const,
        },
        lastMeaningfulEventAt: now,
      } satisfies Omit<AgentState, 'goal'>;
      this.state.agents[agentId] = {
        ...partial,
        goal: goalFromInitialState(partial, now),
      };
      founders.push(agentId);
    }

    makeConnectionsReciprocal(this.state.places);
    this.rebuildSpatialProjection();
    this.stageEvent({
      eventId: this.nextId('sapient-race'),
      worldId: this.state.id,
      kind: 'world.sapient_race.emerged',
      source: 'world',
      occurredAt: now,
      payload: {
        race: plan.race,
        settlementId,
        founderIds: founders.join(','),
        humanPopulation: Object.values(this.state.agents).filter(
          (agent) => agent.life.alive && (agent.race ?? 'human') === 'human',
        ).length,
      },
    });
  }

  private advanceMysticism(now: number): void {
    if (!Number.isInteger(now) || now % 24 !== 0) return;
    const resonance =
      this.lawValue('mystic_resonance', 0.35);
    const weatherVolatility = this.lawValue('weather_volatility', 0.2);
    const ruinCount = Object.values(this.state.places).filter(
      (place) => place.kind === 'ruins',
    ).length;
    const occurrenceChance = clamp01(
      0.09 +
        resonance * 0.12 +
        weatherVolatility * 0.035 +
        Math.min(0.08, ruinCount * 0.012),
    );
    const firstMysteryDue =
      this.state.cosmology.omenCount === 0 && now >= 96 && now % 96 === 0;
    if (!firstMysteryDue && this.rng.next() >= occurrenceChance) return;

    const phenomena = [
      {
        id: 'sky_lights',
        summary: 'unexplained lights crossing the night sky',
      },
      {
        id: 'distant_voice',
        summary: 'a distant voice with no visible speaker',
      },
      {
        id: 'silent_storm',
        summary: 'a silent storm beyond the frontier',
      },
      {
        id: 'ruin_echo',
        summary: 'an echo rising from an ancient place',
      },
    ] as const;
    const phenomenon = this.rng.pick(phenomena);
    const living = Object.values(this.state.agents).filter(
      (agent) => agent.life.alive,
    );
    if (living.length === 0) return;
    const witnesses = living.filter((agent) => {
      const perceptionChance = clamp01(
        0.2 +
          resonance * 0.25 +
          agent.personality.curiosity * 0.24 +
          agent.mind.emotions.awe * 0.12,
      );
      return this.rng.next() < perceptionChance;
    });
    if (witnesses.length === 0) {
      witnesses.push(
        [...living].sort(
          (a, b) =>
            b.personality.curiosity + b.mind.values.knowledge -
            (a.personality.curiosity + a.mind.values.knowledge),
        )[0],
      );
    }

    this.state.cosmology.omenCount += 1;
    this.state.cosmology.mysteryLevel = clamp01(
      this.state.cosmology.mysteryLevel + 0.018 + resonance * 0.018,
    );
    for (const witness of witnesses) {
      witness.mind.emotions.awe = clamp01(
        witness.mind.emotions.awe + 0.07 + resonance * 0.03,
      );
      witness.mind.beliefs.divinePresence = clamp01(
        witness.mind.beliefs.divinePresence + 0.024 + resonance * 0.018,
      );
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: witness.id,
        createdAt: now,
        kind: 'omen',
        summary: `${witness.name} witnessed ${phenomenon.summary}.`,
        importance: clamp01(0.56 + witness.mind.emotions.awe * 0.24),
        valence: clampSigned(0.08 - witness.mind.emotions.fear * 0.12),
        relatedAgentIds: [],
      });
    }
    this.stageEvent({
      eventId: this.nextId('natural-omen'),
      worldId: this.state.id,
      kind: `world.omen.natural.${phenomenon.id}`,
      source: 'world',
      occurredAt: now,
      payload: {
        phenomenon: phenomenon.id,
        witnessCount: witnesses.length,
        mysteryLevel: this.state.cosmology.mysteryLevel,
      },
    });
  }

  private advanceCollectiveMyth(now: number): void {
    if (this.state.cosmology.omenCount === 0) return;
    const living = Object.values(this.state.agents).filter(
      (agent) => agent.life.alive,
    );
    if (living.length < 3) return;
    const sharedBelief =
      living.reduce(
        (sum, agent) => sum + agent.mind.beliefs.divinePresence,
        0,
      ) / living.length;
    if (
      sharedBelief < 0.58 ||
      this.state.cosmology.traditions.length >=
        Math.ceil(this.state.cosmology.omenCount / 2)
    ) {
      return;
    }
    let deity = Object.values(this.state.cosmology.deities)[0];
    if (!deity) {
      const names = [
        'Keeper of the Veil',
        'Lady of Dawn',
        'Voice Beneath the Roots',
        'Wanderer of Stars',
      ];
      const sequence = Object.keys(this.state.cosmology.deities).length + 1;
      const deityId = `belief_deity_${sequence}`;
      deity = {
        id: deityId,
        name: names[(sequence - 1) % names.length],
        origin: 'emergent_belief',
        enteredAt: now,
      };
      this.state.cosmology.deities[deityId] = deity;
    }
    const tradition = `Witnesses of ${deity.name}`;
    if (this.state.cosmology.traditions.includes(tradition)) return;
    this.state.cosmology.traditions.push(tradition);
    this.stageEvent({
      eventId: this.nextId('tradition'),
      worldId: this.state.id,
      kind: 'world.tradition.emerged',
      source: 'agent',
      occurredAt: now,
      payload: {
        tradition,
        sharedBelief,
        deityId: deity.id,
        deityOrigin: deity.origin,
      },
    });
  }

  private advanceMonsterEncounter(
    agent: AgentState,
    environment: WorldEnvironment,
    now: number,
  ): void {
    if (!agent.life.alive || agent.lastAction === 'hunt') return;
    const monster = Object.values(this.state.wildlife)
      .filter(
        (population) =>
          (population.isMonster || population.threat >= 0.28) &&
          population.count > 0 &&
          population.habitatId === agent.locationId,
      )
      .sort((a, b) => b.threat - a.threat)[0];
    if (!monster) return;

    const placeDanger = this.state.places[agent.locationId]?.danger ?? 0.5;
    const safetyFactor = 1 - environment.safetySupport * 0.78;
    const territoryPressure = clamp01(
      monster.count / Math.max(1, monster.carryingCapacity),
    );
    const intrusionPressure =
      agent.lastAction === 'explore'
        ? 0.018
        : agent.lastAction === 'gather'
          ? 0.009
          : 0.003;
    const encounterChance = clamp01(
      (0.002 +
        monster.threat * placeDanger * 0.04 +
        territoryPressure * monster.threat * 0.018 +
        intrusionPressure) *
        Math.max(0.12, safetyFactor),
    );
    if (this.rng.next() >= encounterChance) return;

    const evasion = clamp01(
      agent.life.physiology.mobility * 0.42 +
        agent.skills.exploration * 0.18 +
        agent.personality.riskTolerance * 0.08 +
        (agent.progression?.combatMastery ?? 0) * 0.16 +
        (agent.progression?.objectControlAuthority ?? 0) * 0.08,
    );
    const escaped = this.rng.next() < evasion;
    const damage = escaped
      ? 0
      : clamp01(
          monster.threat *
            this.rng.between(0.07, 0.24) *
            (1.15 - agent.life.physiology.endurance * 0.3) *
            (1 - environment.safetySupport * 0.42) *
            (1 - (agent.progression?.combatMastery ?? 0) * 0.22),
        );
    agent.life.health = clamp01(agent.life.health - damage);
    agent.stress = clamp01(agent.stress + monster.threat * (escaped ? 0.12 : 0.28));
    agent.mind.emotions.fear = clamp01(
      agent.mind.emotions.fear + monster.threat * (escaped ? 0.18 : 0.42),
    );
    agent.mind.emotions.awe = clamp01(
      agent.mind.emotions.awe + monster.threat * 0.1,
    );

    this.stageEvent({
      eventId: this.nextId(monster.isMonster ? 'monster-encounter' : 'wildlife-encounter'),
      worldId: this.state.id,
      kind: monster.isMonster
        ? 'world.monster.encountered'
        : 'world.wildlife.defensive_encounter',
      source: 'world',
      occurredAt: now,
      payload: {
        agentId: agent.id,
        species: monster.species,
        habitatId: monster.habitatId,
        reason: 'territorial_defense',
        escaped,
        damage,
        survived: agent.life.health > 0.035,
      },
    });
    this.stageMemory({
      memoryId: this.nextId('memory'),
      worldId: this.state.id,
      agentId: agent.id,
      createdAt: now,
      kind: 'world_event',
      summary: `${agent.name} encountered ${monster.species} in the wilderness.`,
      importance: clamp01(0.68 + monster.threat * 0.28),
      valence: escaped ? -0.46 : -0.88,
      relatedAgentIds: [],
    });

    const lethalChance = escaped
      ? 0
      : clamp01(
          (monster.threat * (1 - agent.life.physiology.strength) * 0.1 +
            (agent.life.health < 0.14 ? 0.15 : 0)) *
            (1 - environment.safetySupport * 0.6) *
            (1 - (agent.progression?.combatMastery ?? 0) * 0.32),
        );
    if (agent.life.health <= 0.035 || this.rng.next() < lethalChance) {
      this.recordDeath(agent, monster.isMonster ? 'monster' : 'wildlife', now);
    }
  }

  private advanceMind(agent: AgentState): void {
    const placeDanger = this.state.places[agent.locationId]?.danger ?? 0.1;
    const action = agent.lastAction;
    const positiveAction = ['relax', 'socialize', 'help', 'bond'].includes(
      action ?? '',
    );
    agent.mind.emotions.joy = clamp01(
      agent.mind.emotions.joy * 0.985 +
        (positiveAction ? 0.022 : 0) +
        agent.needs.belonging * 0.004 -
        agent.stress * 0.008,
    );
    agent.mind.emotions.fear = clamp01(
      agent.mind.emotions.fear * 0.976 +
        agent.stress * 0.007 +
        placeDanger * 0.003,
    );
    agent.mind.emotions.grief = clamp01(agent.mind.emotions.grief * 0.994);
    agent.mind.emotions.hope = clamp01(
      agent.mind.emotions.hope * 0.99 +
        agent.needs.purpose * 0.005 +
        (action === 'explore' ? 0.006 : 0) -
        agent.mind.emotions.grief * 0.002,
    );
    agent.mind.memoryCoherence = clamp01(
      agent.mind.memoryCoherence +
        (action === 'reflect' ? 0.006 : 0.001) -
        agent.stress * 0.0014,
    );
    agent.mind.autonomy = clamp01(
      0.45 +
        agent.mind.values.freedom * 0.28 +
        (agent.lastDecision?.openness ?? 0) * 0.22,
    );
    if (action === 'help' || action === 'bond') {
      agent.mind.values.care = clamp01(agent.mind.values.care + 0.0012);
    }
    if (action === 'explore' || action === 'reflect') {
      agent.mind.values.knowledge = clamp01(
        agent.mind.values.knowledge + 0.001,
      );
    }
    if (action === 'pray') {
      agent.mind.values.tradition = clamp01(
        agent.mind.values.tradition + 0.0012,
      );
    }
  }

  private chooseBondTarget(
    agent: AgentState,
    allAgents: AgentState[],
  ): AgentState | undefined {
    if (agent.life.stage !== 'adult') return undefined;
    return allAgents
      .filter(
        (other) =>
          other.id !== agent.id &&
          other.life.alive &&
          other.life.stage === 'adult' &&
          other.locationId === agent.locationId &&
          this.canFormFamily(agent, other, this.state.now),
      )
      .map((other) => {
        const relationship =
          this.state.relationships[relationshipKey(agent.id, other.id)];
        const score = relationship
          ? relationship.trust * 0.28 +
            relationship.affinity * 0.38 +
            relationship.respect * 0.14 -
            relationship.conflict * 0.32
          : 0.08;
        return { other, score };
      })
      .filter((candidate) => candidate.score > 0.36)
      .sort((a, b) => b.score - a.score)[0]?.other;
  }

  private performBond(a: AgentState, b: AgentState, now: number): void {
    this.moveAgent(a, b.locationId);
    const key = relationshipKey(a.id, b.id);
    const relationship = this.relationshipFor(a, b, now);
    const accepted =
      this.rng.next() <
      clamp01(
        0.28 +
          relationship.trust * 0.24 +
          relationship.affinity * 0.3 +
          b.mind.values.care * 0.12 -
          relationship.conflict * 0.25,
      );
    this.state.relationships[key] = {
      ...relationship,
      trust: clamp01(relationship.trust + (accepted ? 0.025 : 0.004)),
      affinity: clamp01(
        relationship.affinity + (accepted ? 0.032 : -0.006),
      ),
      respect: clamp01(relationship.respect + (accepted ? 0.012 : 0)),
      conflict: clamp01(
        relationship.conflict + (accepted ? -0.008 : 0.01),
      ),
      updatedAt: now,
    };
    a.energy = clamp01(a.energy - 0.014);
    a.needs.belonging = clamp01(
      a.needs.belonging + (accepted ? 0.07 : -0.008),
    );
    a.mind.emotions.joy = clamp01(
      a.mind.emotions.joy + (accepted ? 0.05 : -0.012),
    );
    a.lastAction = 'bond';
    a.lastMeaningfulEventAt = now;
    this.recordAgentEvent(
      a,
      now,
      accepted ? 'agent.bond.accepted' : 'agent.bond.declined',
      { targetId: b.id, locationId: a.locationId },
    );
    this.stageMemory({
      memoryId: this.nextId('memory'),
      worldId: this.state.id,
      agentId: a.id,
      createdAt: now,
      kind: 'interaction',
      summary: accepted
        ? `${a.name} and ${b.name} grew closer.`
        : `${b.name} was not ready to grow closer to ${a.name}.`,
      importance: accepted ? 0.72 : 0.56,
      valence: accepted ? 0.62 : -0.2,
      relatedAgentIds: [b.id],
    });
  }

  private performPray(agent: AgentState, now: number): void {
    const sacredPlaces = Object.values(this.state.places)
      .filter(
        (place) =>
          (place.kind === 'ruins' || place.kind === 'quiet_space') &&
          this.pathBetween(agent.locationId, place.id) !== undefined,
      )
      .sort((a, b) => {
        const da = Math.hypot(a.mapX - agent.position.x, a.mapY - agent.position.y);
        const db = Math.hypot(b.mapX - agent.position.x, b.mapY - agent.position.y);
        return da - db;
      });
    this.moveAgent(
      agent,
      sacredPlaces[0]?.id ?? this.localPlace(agent, ['quiet_space'], agent.homeId),
    );
    const resonance =
      this.lawValue('mystic_resonance', 0.35);
    agent.energy = clamp01(agent.energy + 0.012);
    agent.stress = clamp01(agent.stress - 0.026);
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.04);
    agent.mind.emotions.awe = clamp01(
      agent.mind.emotions.awe + 0.012 + resonance * 0.012,
    );
    agent.mind.emotions.hope = clamp01(agent.mind.emotions.hope + 0.014);
    agent.mind.beliefs.divinePresence = clamp01(
      agent.mind.beliefs.divinePresence +
        this.state.cosmology.mysteryLevel * resonance * 0.008,
    );
    agent.lastAction = 'pray';
    agent.lastMeaningfulEventAt = now;
    const prayerIsMeaningful =
      agent.mind.emotions.awe >= 0.42 ||
      agent.mind.beliefs.divinePresence >= 0.52 ||
      Math.floor(now) % ROUTINE_EVENT_SAMPLE_INTERVAL === 0;
    if (prayerIsMeaningful) {
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'reflection',
        summary: `${agent.name} searched for meaning beyond the visible world.`,
        importance: clamp01(0.38 + agent.mind.emotions.awe * 0.3),
        valence: clampSigned(0.12 + agent.mind.emotions.hope * 0.18),
        relatedAgentIds: [],
      });
    }
    this.recordAgentEvent(agent, now, 'agent.prayed', {
      mysteryLevel: this.state.cosmology.mysteryLevel,
      divineBelief: agent.mind.beliefs.divinePresence,
      locationId: agent.locationId,
    });
  }

  private performReflect(agent: AgentState, now: number): void {
    this.moveAgent(agent, this.localPlace(agent, ['quiet_space'], agent.homeId));
    agent.energy = clamp01(agent.energy + 0.025);
    agent.stress = clamp01(
      agent.stress - 0.055 - agent.personality.resilience * 0.025,
    );
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.045);
    agent.lastAction = 'reflect';
    agent.lastMeaningfulEventAt = now;

    const reflectionIsMeaningful =
      agent.stress >= 0.65 ||
      agent.mind.emotions.grief >= 0.35 ||
      agent.mind.emotions.awe >= 0.45 ||
      Math.floor(now) % ROUTINE_EVENT_SAMPLE_INTERVAL === 0;
    if (reflectionIsMeaningful) {
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'reflection',
        summary: `${agent.name} reflected on recent needs and priorities.`,
        importance: clamp01(0.35 + agent.stress * 0.3),
        valence: clampSigned(0.15 - agent.stress * 0.2),
        relatedAgentIds: [],
      });
    }

    this.recordAgentEvent(agent, now, 'agent.reflected', {
      stress: agent.stress,
      purpose: agent.needs.purpose,
      locationId: agent.locationId,
    });
  }

  private chooseHelpTarget(agent: AgentState, allAgents: AgentState[]): AgentState | undefined {
    const candidates = allAgents
      .filter(
        (other) =>
          other.id !== agent.id &&
          other.life.alive &&
          other.locationId === agent.locationId,
      )
      .map((other) => {
        const relationship = this.state.relationships[relationshipKey(agent.id, other.id)];
        const need =
          (1 - other.resources) * 0.65 +
          other.stress * 0.2 +
          (1 - other.needs.belonging) * 0.15;
        const willingness = relationship
          ? relationship.trust * 0.3 +
            relationship.affinity * 0.2 +
            relationship.respect * 0.15 -
            relationship.conflict * 0.35
          : 0.05;
        return { other, score: need + willingness };
      })
      .filter((item) => item.other.resources < 0.5 && item.score > 0.42)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.other;
  }

  private async performHelp(a: AgentState, b: AgentState, now: number): Promise<void> {
    this.moveAgent(a, b.locationId);
    const key = relationshipKey(a.id, b.id);
    const current = this.relationshipFor(a, b, now);
    const offered = Math.min(0.065, Math.max(0, a.resources - 0.35), 0.72 - b.resources);
    const acceptance = clamp01(
      0.35 +
        current.trust * 0.28 +
        current.affinity * 0.18 +
        current.respect * 0.12 -
        current.conflict * 0.35 +
        b.personality.sociability * 0.08,
    );
    const accepted = offered > 0.005 && this.rng.next() < acceptance;

    if (accepted) {
      a.resources = clamp01(a.resources - offered);
      b.resources = clamp01(b.resources + offered);
      a.needs.purpose = clamp01(a.needs.purpose + 0.06);
      b.needs.belonging = clamp01(b.needs.belonging + 0.06);
      b.stress = clamp01(b.stress - 0.025);
      this.state.relationships[key] = {
        ...current,
        trust: clamp01(current.trust + 0.025),
        affinity: clamp01(current.affinity + 0.018),
        respect: clamp01(current.respect + 0.03),
        conflict: clamp01(current.conflict - 0.012),
        updatedAt: now,
      };
    } else {
      a.stress = clamp01(a.stress + 0.008);
      this.state.relationships[key] = {
        ...current,
        respect: clamp01(current.respect - 0.006),
        conflict: clamp01(current.conflict + 0.01),
        updatedAt: now,
      };
    }

    a.energy = clamp01(a.energy - 0.018);
    a.lastAction = 'help';
    a.lastMeaningfulEventAt = now;
    b.lastMeaningfulEventAt = now;

    const summary = accepted
      ? `${b.name} accepted help from ${a.name}.`
      : `${b.name} declined help from ${a.name}.`;
    for (const agent of [a, b]) {
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'interaction',
        summary,
        importance: accepted ? 0.62 : 0.52,
        valence: accepted ? 0.45 : -0.18,
        relatedAgentIds: [agent.id === a.id ? b.id : a.id],
      });
    }

    this.recordAgentEvent(a, now, accepted ? 'agent.help.accepted' : 'agent.help.rejected', {
      targetId: b.id,
      amount: accepted ? offered : 0,
      locationId: a.locationId,
    });
    this.recordRelationshipEvent(this.state.relationships[key], accepted ? 0.45 : -0.18, now);
  }

  private async chooseSocialTarget(
    agent: AgentState,
    others: AgentState[],
  ): Promise<AgentState | undefined> {
    const present = others.filter(
      (other) =>
        other.life.alive &&
        other.locationId === agent.locationId,
    );
    if (present.length === 0) return undefined;
    if (this.rng.next() < 0.08) {
      return this.rng.pick(present);
    }

    const weighted: Array<{ other: AgentState; weight: number }> = [];

    for (const other of present) {
      const relationship = this.state.relationships[relationshipKey(agent.id, other.id)];
      let weight = 0.55;

      if (relationship) {
        weight =
          0.18 +
          relationship.affinity * 0.34 +
          relationship.trust * 0.24 +
          relationship.respect * 0.14 -
          relationship.conflict * 0.28;
      }

      const recentMemories = await this.recentMemoriesForPair(
        agent.id,
        other.id,
        5,
      );

      if (recentMemories.length > 0) {
        const memoryValence =
          recentMemories.reduce((sum, memory) => sum + memory.valence, 0) /
          recentMemories.length;
        weight += memoryValence * 0.16;
      }

      // Similar interests help, but locality matters. Long-distance contact
      // remains possible for travellers; ordinary residents prefer their own settlement.
      const curiosityCompatibility = 1 - Math.abs(
        agent.personality.curiosity - other.personality.curiosity,
      );
      weight += curiosityCompatibility * 0.08;
      const sameSettlement =
        this.homeSettlementId(agent) !== undefined &&
        this.homeSettlementId(agent) === this.homeSettlementId(other);
      const routeDistance = Math.max(
        0,
        (this.pathBetween(agent.locationId, other.locationId)?.length ?? 1) - 1,
      );
      weight += sameSettlement ? 0.32 : 0;
      weight -= routeDistance * 0.055;

      weighted.push({
        other,
        weight: Math.max(0.05, weight),
      });
    }

    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.rng.next() * total;

    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) {
        return item.other;
      }
    }

    return weighted[weighted.length - 1].other;
  }

  private async interact(a: AgentState, b: AgentState, now: number): Promise<void> {
    if (a.locationId !== b.locationId) return;
    const key = relationshipKey(a.id, b.id);
    const current = this.relationshipFor(a, b, now);

    const priorMood =
      (current.trust + current.affinity + current.respect) / 3 - current.conflict;
    const compatibility =
      1 -
      (Math.abs(a.personality.curiosity - b.personality.curiosity) +
        Math.abs(a.personality.sociability - b.personality.sociability) +
        Math.abs(a.personality.generosity - b.personality.generosity)) /
        3;
    const stressPenalty = (a.stress + b.stress) * 0.12;
    const socialSkill = (a.skills.social + b.skills.social) / 2;
    const sentiment = clampSigned(
      this.rng.between(-0.72, 0.72) +
        (priorMood - 0.35) * 0.5 +
        (compatibility - 0.5) * 0.24 +
        socialSkill * 0.08 -
        stressPenalty,
    );

    const next: RelationshipState = {
      ...current,
      trust: clamp01(current.trust + sentiment * 0.038),
      affinity: clamp01(current.affinity + sentiment * 0.05),
      respect: clamp01(current.respect + sentiment * 0.026),
      conflict: clamp01(current.conflict - sentiment * 0.048),
      updatedAt: now,
    };

    this.state.relationships[key] = next;
    a.lastMeaningfulEventAt = now;
    b.lastMeaningfulEventAt = now;
    a.lastAction = 'socialize';
    a.energy = clamp01(a.energy - 0.018);
    a.skills.social = clamp01(a.skills.social + 0.003);
    b.skills.social = clamp01(b.skills.social + 0.002);

    if (sentiment > 0.18) {
      a.stress = clamp01(a.stress - 0.024);
      b.stress = clamp01(b.stress - 0.018);
      a.needs.belonging = clamp01(a.needs.belonging + 0.09);
      b.needs.belonging = clamp01(b.needs.belonging + 0.07);
    } else if (sentiment < -0.18) {
      a.stress = clamp01(a.stress + 0.032);
      b.stress = clamp01(b.stress + 0.026);
      a.needs.belonging = clamp01(a.needs.belonging - 0.018);
      b.needs.belonging = clamp01(b.needs.belonging - 0.012);
    } else {
      a.needs.belonging = clamp01(a.needs.belonging + 0.035);
      b.needs.belonging = clamp01(b.needs.belonging + 0.025);
    }

    const summary =
      sentiment >= 0
        ? `${a.name} and ${b.name} had a constructive interaction.`
        : `${a.name} and ${b.name} had a tense interaction.`;

    // Human-like memory is selective. Relationship state preserves ordinary
    // social continuity; only exceptional moments, or periodically sampled
    // meaningful moments, become permanent episodic memories.
    const memoryPair = [a.id, b.id].sort().join('::');
    let memorySlot = 0;
    for (let index = 0; index < memoryPair.length; index += 1) {
      memorySlot = (memorySlot * 31 + memoryPair.charCodeAt(index)) >>> 0;
    }
    const interactionIntensity = Math.abs(sentiment);
    const rememberInteraction =
      now <= 240 ||
      interactionIntensity >= 0.72 ||
      (interactionIntensity >= 0.35 &&
        (Math.floor(now) + memorySlot) % ROUTINE_EVENT_SAMPLE_INTERVAL === 0);
    if (rememberInteraction) {
      const memories: MemoryRecord[] = [a, b].map((agent) => ({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'interaction',
        summary,
        importance: clamp01(0.4 + Math.abs(sentiment) * 0.5),
        valence: sentiment,
        relatedAgentIds: [agent.id === a.id ? b.id : a.id],
      }));

      for (const memory of memories) {
        this.stageMemory(memory);
      }
    }

    this.recordRelationshipEvent(next, sentiment, now);
  }

  private relationshipFor(a: AgentState, b: AgentState, now: number): RelationshipState {
    const key = relationshipKey(a.id, b.id);
    const ids = [a.id, b.id].sort();
    return (
      this.state.relationships[key] ?? {
        agentA: ids[0],
        agentB: ids[1],
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        conflict: 0.1,
        updatedAt: now,
      }
    );
  }

  private recordRelationshipEvent(
    relationship: RelationshipState,
    sentiment: number,
    now: number,
  ): void {
    const pair = `${relationship.agentA}::${relationship.agentB}`;
    let stableSlot = 0;
    for (let index = 0; index < pair.length; index += 1) {
      stableSlot = (stableSlot * 31 + pair.charCodeAt(index)) >>> 0;
    }
    const intensity = Math.abs(sentiment);
    const exceptionalChange = intensity >= 0.75;
    const sampledMeaningfulChange =
      intensity >= 0.42 &&
      (Math.floor(now) + stableSlot) % ROUTINE_EVENT_SAMPLE_INTERVAL === 0;
    if (now > 240 && !exceptionalChange && !sampledMeaningfulChange) return;

    this.stageEvent({
      eventId: this.nextId('relationship'),
      worldId: this.state.id,
      kind: 'relationship.changed',
      source: 'agent',
      occurredAt: now,
      payload: {
        agentA: relationship.agentA,
        agentB: relationship.agentB,
        sentiment,
        trust: relationship.trust,
        affinity: relationship.affinity,
        respect: relationship.respect,
        conflict: relationship.conflict,
      },
    });
  }

  private moveAgent(agent: AgentState, locationId: string): void {
    const destination = this.state.places[locationId];
    if (!destination) {
      throw new Error(`Cannot move ${agent.id} to unknown place ${locationId}.`);
    }
    if (agent.movement && agent.movement.targetPlaceId !== locationId) {
      // Another resident's interaction cannot pull a traveller off a route.
      return;
    }
    if (agent.locationId === locationId && !agent.movement) return;

    const path = this.pathBetween(agent.locationId, locationId);
    if (!path) {
      // Water and disconnected territory are physical boundaries. A resident
      // never receives an implicit teleport just because an action chose it.
      return;
    }

    const waypoints: WorldPoint2D[] = [
      { x: agent.position.x, y: agent.position.y },
    ];
    for (let index = 0; index < path.length - 1; index += 1) {
      const fromId = path[index];
      const toId = path[index + 1];
      const route = this.state.routes[routeIdBetween(fromId, toId)];
      if (!route) return;
      waypoints.push(...orientedRouteWaypoints(route, fromId).slice(1));
    }

    agent.locationId = locationId;
    if (waypoints.length > 1) {
      agent.movement = {
        targetPlaceId: locationId,
        purpose: agent.lastDecision?.action ?? 'walk',
        waypoints,
        nextWaypointIndex: 1,
        startedAt: this.state.now,
        worldStageAtStart: this.state.growth.stage,
      };
      return;
    }
    agent.position = {
      x: destination.mapX,
      y: destination.mapY,
      layerId: 'surface',
    };
    agent.movement = undefined;
  }

  private advanceAgentMovement(agent: AgentState): boolean {
    const movement = agent.movement;
    if (!movement) return false;

    const movementBudget = 7 + agent.life.physiology.mobility * 7;
    let remaining = movementBudget;
    while (remaining > 0 && agent.movement) {
      const target = movement.waypoints[movement.nextWaypointIndex];
      const dx = target.x - agent.position.x;
      const dy = target.y - agent.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= remaining + 0.0001) {
        agent.position.x = target.x;
        agent.position.y = target.y;
        remaining -= distance;
        movement.nextWaypointIndex += 1;
        if (movement.nextWaypointIndex >= movement.waypoints.length) {
          const place = this.state.places[movement.targetPlaceId];
          if (place) {
            agent.position.x = place.mapX;
            agent.position.y = place.mapY;
          }
          agent.movement = undefined;
        }
        continue;
      }
      agent.position.x += (dx / distance) * remaining;
      agent.position.y += (dy / distance) * remaining;
      remaining = 0;
    }
    if (
      movement.purpose === 'explore' &&
      movement.worldStageAtStart === this.state.growth.stage
    ) {
      const travelled = Math.max(0, movementBudget - remaining);
      this.advanceWorldGrowth(
        agent,
        Math.min(0.068, 0.014 + travelled * 0.003),
        this.state.now,
      );
    }
    return true;
  }

  private rebuildSpatialProjection(): void {
    this.state.settlements = rebuildSettlementProjection(
      this.state.places,
      this.state.settlements,
      0,
    );
    this.state.routes = rebuildWorldRoutes(
      this.state.places,
      this.state.routes,
    );
  }

  private lawValue(
    mechanism: WorldLawMechanism,
    fallback: number,
  ): number {
    const active = Object.values(this.state.governance.laws)
      .filter((worldLaw) => worldLaw.mechanism === mechanism)
      .sort(
        (a, b) =>
          b.updatedAt - a.updatedAt ||
          Number(b.createdBy === 'cardinal') -
            Number(a.createdBy === 'cardinal') ||
          b.revision - a.revision ||
          b.id.localeCompare(a.id),
      )[0];
    return active?.value ?? fallback;
  }

  private pathBetween(fromId: string, toId: string): string[] | undefined {
    if (fromId === toId) return [fromId];
    if (!this.state.places[fromId] || !this.state.places[toId]) return undefined;

    const queue: string[][] = [[fromId]];
    const visited = new Set([fromId]);
    while (queue.length > 0) {
      const path = queue.shift()!;
      const currentId = path[path.length - 1];
      for (const connectedId of this.state.places[currentId].connectedPlaceIds) {
        const route = this.state.routes[routeIdBetween(currentId, connectedId)];
        if (
          visited.has(connectedId) ||
          !this.state.places[connectedId] ||
          !route ||
          route.traversal === 'boat'
        ) {
          continue;
        }
        const nextPath = [...path, connectedId];
        if (connectedId === toId) return nextPath;
        visited.add(connectedId);
        queue.push(nextPath);
      }
    }
    return undefined;
  }

  private shuffled<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.rng.next() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  private async effectiveEnvironment(now: number): Promise<WorldEnvironment> {
    const committed = await this.store.activeSignals(this.state.id, now);
    const staged = (this.stagedEvents ?? []).filter(
      (event) =>
        event.occurredAt <= now &&
        event.activeUntil !== undefined &&
        event.activeUntil > now,
    );
    const activeSignals = [...committed, ...staged];
    let socialModifier = 0;
    let safetyModifier = 0;
    let habitatModifier = 0;

    for (const signal of activeSignals) {
      const magnitude =
        typeof signal.payload.magnitude === 'number' ? signal.payload.magnitude : 0;

      if (signal.kind === 'cardinal.effect.open_shared_space') {
        socialModifier += magnitude;
      } else if (signal.kind === 'world.effect.social_barrier') {
        socialModifier -= magnitude;
      } else if (signal.kind === 'cardinal.effect.safety_support') {
        safetyModifier += magnitude;
      } else if (signal.kind === 'world.effect.safety_shock') {
        safetyModifier -= magnitude;
        habitatModifier -= magnitude * 0.25;
      } else if (signal.kind === 'cardinal.effect.habitat_support') {
        habitatModifier += magnitude;
      } else if (signal.kind.startsWith('cardinal.catastrophe.')) {
        const destructiveUntil =
          typeof signal.payload.destructiveUntil === 'number'
            ? signal.payload.destructiveUntil
            : signal.occurredAt;
        if (now < destructiveUntil) {
          safetyModifier -= magnitude * 0.32;
          habitatModifier -= magnitude * 0.18;
        } else {
          const recoveryMagnitude =
            typeof signal.payload.recoveryMagnitude === 'number'
              ? signal.payload.recoveryMagnitude
              : 0;
          habitatModifier += recoveryMagnitude;
          safetyModifier += recoveryMagnitude * 0.35;
        }
      }
    }

    return {
      ...this.state.environment,
      socialOpportunity: clamp01(
        this.state.environment.socialOpportunity + socialModifier,
      ),
      safetySupport: clamp01(this.state.environment.safetySupport + safetyModifier),
      habitatSupport: clamp01(
        this.state.environment.habitatSupport + habitatModifier,
      ),
    };
  }

  private ensureProgression(agent: AgentState): NonNullable<AgentState['progression']> {
    agent.progression ??= progressionFromAgent(agent);
    return agent.progression;
  }

  private advanceProgressionFromEvent(
    agent: AgentState,
    kind: string,
    now: number,
  ): void {
    const gainByEvent: Record<string, number> = {
      'agent.worked': 1.1,
      'agent.gathered': 0.8,
      'agent.hunted': 1.9,
      'agent.explored': 1.35,
      'agent.help.accepted': 0.55,
      'agent.bond.accepted': 0.45,
      'agent.reflected': 0.28,
      'agent.prayed': 0.42,
    };
    const gain = gainByEvent[kind] ?? 0;
    if (gain <= 0 || !agent.life.alive) return;

    const progression = this.ensureProgression(agent);
    const previousLevel = progression.level;
    progression.experience += gain;
    progression.level = levelForExperience(progression.experience);

    if (kind === 'agent.hunted') {
      progression.combatMastery = clamp01(progression.combatMastery + 0.0028);
      progression.objectControlAuthority = clamp01(
        progression.objectControlAuthority + 0.0018,
      );
    } else if (kind === 'agent.worked' || kind === 'agent.gathered') {
      progression.objectControlAuthority = clamp01(
        progression.objectControlAuthority + 0.0015,
      );
    } else if (kind === 'agent.explored') {
      progression.objectControlAuthority = clamp01(
        progression.objectControlAuthority + 0.001,
      );
      progression.systemControlAuthority = clamp01(
        progression.systemControlAuthority + 0.0011,
      );
    } else if (kind === 'agent.reflected' || kind === 'agent.prayed') {
      progression.systemControlAuthority = clamp01(
        progression.systemControlAuthority + 0.0014,
      );
      progression.sacredArts = clamp01(progression.sacredArts + 0.0012);
    }

    if (progression.level > previousLevel) {
      this.stageEvent({
        eventId: this.nextId('level'),
        worldId: this.state.id,
        kind: 'agent.level.changed',
        source: 'agent',
        occurredAt: now,
        payload: {
          agentId: agent.id,
          race: agent.race ?? 'human',
          previousLevel,
          level: progression.level,
          experience: progression.experience,
        },
      });
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'world_event',
        summary: `${agent.name} reached level ${progression.level} through lived experience.`,
        importance: 0.66,
        valence: 0.52,
        relatedAgentIds: [],
      });
    }
  }

  private recordAgentEvent(
    agent: AgentState,
    now: number,
    kind: string,
    payload: Record<string, string | number | boolean | null>,
  ): void {
    this.advanceProgressionFromEvent(agent, kind, now);
    if (ROUTINE_AGENT_EVENT_KINDS.has(kind) && now > 240) {
      let stableSlot = 0;
      for (let index = 0; index < agent.id.length; index += 1) {
        stableSlot = (stableSlot * 31 + agent.id.charCodeAt(index)) >>> 0;
      }
      if ((Math.floor(now) + stableSlot) % ROUTINE_EVENT_SAMPLE_INTERVAL !== 0) {
        return;
      }
    }

    const decisionEvidence: Record<
      string,
      string | number | boolean | null
    > = {};
    if (
      kind !== 'agent.goal.changed' &&
      agent.lastDecision?.chosenAt === now
    ) {
      decisionEvidence.chosenAction = agent.lastDecision.action;
      decisionEvidence.dominantAction =
        agent.lastDecision.dominantAction;
      decisionEvidence.consideredActionCount =
        agent.lastDecision.consideredActionCount;
      decisionEvidence.choiceOpenness = agent.lastDecision.openness;
    }

    this.stageEvent({
      eventId: this.nextId('agent-event'),
      worldId: this.state.id,
      kind,
      source: 'agent',
      occurredAt: now,
      payload: {
        agentId: agent.id,
        ...decisionEvidence,
        ...payload,
      },
    });
  }

  private async recentMemoriesForPair(
    agentId: string,
    otherAgentId: string,
    limit: number,
  ): Promise<MemoryRecord[]> {
    const committed = await this.store.recentForPair(
      this.state.id,
      agentId,
      otherAgentId,
      limit,
    );
    const staged = (this.stagedMemories ?? []).filter(
      (memory) =>
        memory.agentId === agentId && memory.relatedAgentIds.includes(otherAgentId),
    );

    return [...committed, ...staged]
      .slice(Math.max(0, committed.length + staged.length - limit))
      .map((memory) => structuredClone(memory));
  }

  private stageEvent(event: WorldEvent): void {
    if (!this.stagedEvents) {
      throw new Error('World event was produced outside a logical operation.');
    }
    this.stagedEvents.push(structuredClone(event));
  }

  private stageMemory(memory: MemoryRecord): void {
    if (!this.stagedMemories) {
      throw new Error('World memory was produced outside a logical operation.');
    }
    this.stagedMemories.push(structuredClone(memory));
  }

  private stableOperationEventId(prefix: string, operationId: string): string {
    return `${prefix}:${this.state.id}:op:${operationId}`;
  }

  private nextId(prefix: string): string {
    this.state.determinism.eventSequence += 1;
    return `${prefix}:${this.state.id}:${this.state.determinism.eventSequence.toString(36)}`;
  }

  private syncDeterminismState(): void {
    this.state.determinism.rngState = this.rng.snapshot();
  }

  private adopt(state: WorldState): void {
    assertWorldState(state);
    if (state.rulesVersion !== WORLD_RULES_VERSION) {
      throw new Error(
        `World ${state.id} uses rules ${state.rulesVersion}; runtime expects ${WORLD_RULES_VERSION}. Explicit migration is required.`,
      );
    }
    this.committedState = structuredClone(state);
    this.rng.restore(state.determinism.rngState);
  }
}
