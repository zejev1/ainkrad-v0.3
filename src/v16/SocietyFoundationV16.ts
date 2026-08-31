import type {
  AgentActionKind,
  AgentLifeStage,
  AgentRace,
  AgentState,
  V16RaceFamilyOpportunityState,
  V16RemainsState,
  V16LocalFamilyOpportunityState,
  V16MaterialKind,
  V16ResidentEvidenceState,
  V16SettlementEvidenceState,
  V16SettlementEconomyState,
  V16SettlementPracticeKind,
  V16SettlementRelationEvidenceState,
  V16SettlementResourceState,
  WorldState,
  WorldV16State,
} from '../world/types';

export const WORLD_RULES_VERSION_V16 = 'ainkrad-world-rules-0.3.16';

export const SAPIENT_RACES_V16 = [
  'human',
  'goblin',
  'orc',
  'ogre',
] as const satisfies readonly AgentRace[];

/**
 * This is only a mobile-runtime safety stop, not the world's demographic
 * carrying capacity. Normal family opportunities are bounded by homes that
 * residents actually built plus a small temporary household reserve.
 */
export const TECHNICAL_POPULATION_SAFETY_CEILING_V16 = 1_024;
export const FAMILY_HOUSING_TRANSITION_RESERVE_V16 = 6;

export interface SapientRaceLifeProfileV16 {
  childUntilAge: number;
  adultAtAge: number;
  elderAtAge: number;
  maximumReproductiveAge: number;
  minimumReproductiveHealth: number;
  raceBirthSpacingWorldMinutes: number;
  lifespanScale: number;
}

const WORLD_MINUTES_PER_YEAR = 525_600;

/**
 * Physiology changes feasible life windows, never morality, profession,
 * affection or an obligation to reproduce.
 */
export const SAPIENT_RACE_LIFE_PROFILES_V16: Readonly<
  Record<AgentRace, SapientRaceLifeProfileV16>
> = {
  human: {
    childUntilAge: 12,
    adultAtAge: 18,
    elderAtAge: 62,
    maximumReproductiveAge: 55,
    minimumReproductiveHealth: 0.58,
    raceBirthSpacingWorldMinutes: WORLD_MINUTES_PER_YEAR * 0.8,
    lifespanScale: 1,
  },
  goblin: {
    childUntilAge: 10,
    adultAtAge: 16,
    elderAtAge: 52,
    maximumReproductiveAge: 48,
    minimumReproductiveHealth: 0.56,
    raceBirthSpacingWorldMinutes: WORLD_MINUTES_PER_YEAR * 0.68,
    lifespanScale: 0.82,
  },
  orc: {
    childUntilAge: 12,
    adultAtAge: 18,
    elderAtAge: 68,
    maximumReproductiveAge: 61,
    minimumReproductiveHealth: 0.58,
    raceBirthSpacingWorldMinutes: WORLD_MINUTES_PER_YEAR * 0.86,
    lifespanScale: 1.08,
  },
  ogre: {
    childUntilAge: 14,
    adultAtAge: 20,
    elderAtAge: 78,
    maximumReproductiveAge: 70,
    minimumReproductiveHealth: 0.6,
    raceBirthSpacingWorldMinutes: WORLD_MINUTES_PER_YEAR * 1.05,
    lifespanScale: 1.24,
  },
};

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

// A mutable WorldEngine transaction calls the small ensure helpers many
// thousands of times during long catch-up runs. The additive schema sweep is
// needed once for each cloned working state, not once per resident action.
// WeakSet keeps this runtime-only fact outside persisted world data.
const runtimeValidatedWorldsV16 = new WeakSet<WorldState>();

export function lifeStageForRaceV16(
  race: AgentRace,
  ageYears: number,
): AgentLifeStage {
  const profile = SAPIENT_RACE_LIFE_PROFILES_V16[race];
  if (ageYears < profile.childUntilAge) return 'child';
  if (ageYears < profile.adultAtAge) return 'adolescent';
  if (ageYears < profile.elderAtAge) return 'adult';
  return 'elder';
}

const ALLOWED_ACTIONS_BY_CAPABILITY_V16 = new Map<
  string,
  ReadonlySet<AgentActionKind>
>();

/**
 * Capability grows with the body. This is a physical safety envelope, not a
 * compulsory schedule: an available action remains a resident choice.
 */
export function allowedActionsForAgeV16(
  race: AgentRace,
  ageYears: number,
): ReadonlySet<AgentActionKind> {
  const profile = SAPIENT_RACE_LIFE_PROFILES_V16[race];
  const relativeAge = ageYears / profile.adultAtAge;
  let capabilityMask = 1;
  if (relativeAge >= 0.17) capabilityMask |= 1 << 1;
  if (relativeAge >= 0.25) capabilityMask |= 1 << 2;
  if (relativeAge >= 0.32) capabilityMask |= 1 << 3;
  if (relativeAge >= 0.42) capabilityMask |= 1 << 4;
  if (relativeAge >= 0.48) capabilityMask |= 1 << 5;
  if (ageYears >= profile.childUntilAge) capabilityMask |= 1 << 6;
  if (relativeAge >= 0.78) capabilityMask |= 1 << 7;
  if (ageYears >= profile.adultAtAge) capabilityMask |= 1 << 8;
  const cacheKey = `${race}:${capabilityMask}`;
  const cached = ALLOWED_ACTIONS_BY_CAPABILITY_V16.get(cacheKey);
  if (cached) return cached;

  const actions = new Set<AgentActionKind>(['rest']);

  if ((capabilityMask & (1 << 1)) !== 0) actions.add('socialize');
  if ((capabilityMask & (1 << 2)) !== 0) {
    actions.add('relax');
    actions.add('reflect');
  }
  if ((capabilityMask & (1 << 3)) !== 0) {
    actions.add('walk');
    actions.add('pray');
  }
  if ((capabilityMask & (1 << 4)) !== 0) actions.add('help');
  if ((capabilityMask & (1 << 5)) !== 0) {
    // From roughly eight to ten human years this means supervised, physically
    // limited chores and apprenticeship—not adult output or hazardous labour.
    actions.add('gather');
    actions.add('work');
  }
  if ((capabilityMask & (1 << 6)) !== 0) {
    actions.add('explore');
  }
  if ((capabilityMask & (1 << 7)) !== 0) actions.add('hunt');
  if ((capabilityMask & (1 << 8)) !== 0) actions.add('bond');
  ALLOWED_ACTIONS_BY_CAPABILITY_V16.set(cacheKey, actions);
  return actions;
}

export function productiveCapacityScaleV16(
  race: AgentRace,
  ageYears: number,
): number {
  const profile = SAPIENT_RACE_LIFE_PROFILES_V16[race];
  const start = profile.adultAtAge * 0.36;
  if (ageYears < start) return 0;
  if (ageYears >= profile.adultAtAge) return 1;
  return Math.max(
    0.18,
    Math.min(1, (ageYears - start) / Math.max(1, profile.adultAtAge - start)),
  );
}

/**
 * A settlement can briefly outgrow its completed beds while a household is
 * building the next home. The reserve is deliberately small and cannot grow
 * unless a real settlement and real houses exist.
 */
export function settlementFamilyCapacityV16(
  state: Readonly<WorldState>,
  settlementId: string,
): number {
  const settlement = state.settlements[settlementId];
  if (!settlement) return 0;
  const housingCapacity = settlement.memberPlaceIds
    .map((placeId) => state.places[placeId])
    .filter((place) => place?.kind === 'home')
    .reduce((sum, place) => sum + place.capacity, 0);
  return Math.max(
    0,
    Math.floor(housingCapacity + FAMILY_HOUSING_TRANSITION_RESERVE_V16),
  );
}

/**
 * Demographic room follows the physical world instead of a fixed population
 * quota. Building homes and founding settlements expands it; worker ticks do
 * not. The high technical ceiling remains an emergency guard only.
 */
export function worldPopulationCapacityV16(
  state: Readonly<WorldState>,
): number {
  const physicalCapacity = Object.keys(state.settlements).reduce(
    (sum, settlementId) =>
      sum + settlementFamilyCapacityV16(state, settlementId),
    0,
  );
  return Math.min(
    TECHNICAL_POPULATION_SAFETY_CEILING_V16,
    Math.max(24, physicalCapacity),
  );
}

function emptyResidentEvidence(
  agentId: string,
  worldMinutes: number,
): V16ResidentEvidenceState {
  return {
    agentId,
    firstObservedWorldMinute: worldMinutes,
    lastObservedWorldMinute: worldMinutes,
    recordedDecisionCount: 0,
    actionCounts: {},
    placeVisitCounts: {},
    contactCounts: {},
    constructiveContactCounts: {},
    tenseContactCounts: {},
    helpGivenCounts: {},
    helpReceivedCounts: {},
    burialCareCount: 0,
    conflictParticipationCount: 0,
  };
}

const EMPTY_PRACTICES: Readonly<Record<V16SettlementPracticeKind, number>> = {
  gathering: 0,
  hunting: 0,
  craft: 0,
  care: 0,
  teaching: 0,
  exploration: 0,
  social: 0,
  ritual: 0,
};

function emptySettlementEvidence(
  settlementId: string,
  worldMinutes: number,
): V16SettlementEvidenceState {
  return {
    settlementId,
    evidenceCount: 0,
    lastEvidenceWorldMinute: worldMinutes,
    practiceCounts: { ...EMPTY_PRACTICES },
  };
}

function emptySettlementResources(
  state: Readonly<WorldState>,
  settlementId: string,
  worldMinutes: number,
): V16SettlementResourceState {
  const localPlaces = Object.values(state.places).filter(
    (place) => place.settlementId === settlementId,
  );
  const productivePlaces = localPlaces.filter(
    (place) => place.kind === 'resource_field',
  );
  const fertilitySource =
    productivePlaces.length > 0 ? productivePlaces : localPlaces;
  const localFertility = clamp01(
    fertilitySource.length > 0
      ? fertilitySource.reduce((sum, place) => sum + place.fertility, 0) /
          fertilitySource.length
      : 0.62,
  );
  const residents = Object.values(state.agents).filter(
    (agent) =>
      agent.life.alive &&
      state.places[agent.homeId]?.settlementId === settlementId,
  );
  const meanPersonalResources =
    residents.length > 0
      ? residents.reduce((sum, agent) => sum + agent.resources, 0) /
        residents.length
      : 0.35;
  const legacy = state.v15?.renewableResources;
  const preserveLegacyPrimary =
    settlementId === 'settlement_ainkrad' && legacy !== undefined;

  return {
    settlementId,
    storedResources: preserveLegacyPrimary
      ? clamp01(legacy.storedResources)
      : clamp01(0.08 + meanPersonalResources * 0.36),
    renewableBase: preserveLegacyPrimary
      ? clamp01(legacy.renewableBase)
      : clamp01(0.76 + localFertility * 0.22),
    fertility: preserveLegacyPrimary
      ? clamp01(legacy.fertility)
      : clamp01(0.5 + localFertility * 0.44),
    lastRecoveredWorldMinute: worldMinutes,
  };
}

function emptySettlementEconomy(
  state: Readonly<WorldState>,
  settlementId: string,
): V16SettlementEconomyState {
  const residents = Object.values(state.agents).filter(
    (agent) =>
      agent.life.alive &&
      state.places[agent.homeId]?.settlementId === settlementId,
  );
  const localResources = state.v16?.settlementResourcesById?.[settlementId];
  const stored =
    localResources?.storedResources ??
    state.v15?.renewableResources.storedResources ??
    0.35;
  const storageCapacity = settlementEconomyCapacityV16(state, settlementId);
  return {
    settlementId,
    stocks: {
      food: Math.min(
        storageCapacity.food,
        Math.max(0.5, stored * 1.2 + residents.length * 0.08),
      ),
      wood: Math.min(
        storageCapacity.wood,
        Math.max(0.45, residents.length * 0.08),
      ),
      stone: Math.min(
        storageCapacity.stone,
        Math.max(0.3, residents.length * 0.055),
      ),
      metal: 0,
      fuel: Math.min(
        storageCapacity.fuel,
        Math.max(0.16, residents.length * 0.025),
      ),
    },
    storageCapacity,
    farmingTools: 0,
    constructionTools: 0,
    harvestEvents: 0,
    harvestEventsByMaterial: {
      food: 0,
      wood: 0,
      stone: 0,
      metal: 0,
      fuel: 0,
    },
    constructionEvents: 0,
    toolsCreated: 0,
  };
}

/**
 * Physical stock is bounded by the settlement's people and actual buildings.
 * This prevents an immortal scalar warehouse while still allowing capacity to
 * grow when residents build more homes and workshops.
 */
export function settlementEconomyCapacityV16(
  state: Readonly<WorldState>,
  settlementId: string,
): Record<V16MaterialKind, number> {
  const settlement = state.settlements[settlementId];
  const residents = Object.values(state.agents).filter(
    (agent) =>
      agent.life.alive &&
      state.places[agent.homeId]?.settlementId === settlementId,
  ).length;
  const places = settlement?.memberPlaceIds
    .map((placeId) => state.places[placeId])
    .filter((place): place is NonNullable<typeof place> => place !== undefined) ?? [];
  const homes = places.filter((place) => place.kind === 'home').length;
  const workshops = places.filter((place) => place.kind === 'workshop').length;
  return {
    food: 2.4 + residents * 0.22 + homes * 0.55 + workshops * 0.4,
    wood: 2.6 + residents * 0.16 + homes * 0.7 + workshops * 0.65,
    stone: 3.2 + residents * 0.14 + homes * 0.55 + workshops * 0.8,
    metal: 0.6 + residents * 0.035 + workshops * 0.4,
    fuel: 1.8 + residents * 0.1 + homes * 0.25 + workshops * 0.3,
  };
}

export function refreshSettlementEconomyCapacityV16(
  state: Readonly<WorldState>,
  economy: V16SettlementEconomyState,
): void {
  economy.storageCapacity = settlementEconomyCapacityV16(
    state,
    economy.settlementId,
  );
  for (const material of [
    'food',
    'wood',
    'stone',
    'metal',
    'fuel',
  ] as const) {
    economy.stocks[material] = Math.max(
      0,
      Math.min(economy.storageCapacity[material], economy.stocks[material]),
    );
  }
}

function latestKnownBirthWorldMinute(
  state: Readonly<WorldState>,
  race: AgentRace,
): number | undefined {
  const values = Object.values(state.agents)
    .filter((agent) => (agent.race ?? 'human') === race)
    .flatMap((agent) =>
      agent.life.lastChildWorldMinute === undefined
        ? []
        : [agent.life.lastChildWorldMinute],
    );
  if (race === 'human' && state.population.lastBirthWorldMinute !== undefined) {
    values.push(state.population.lastBirthWorldMinute);
  }
  return values.length === 0 ? undefined : Math.max(...values);
}

export function localFamilyOpportunityKeyV16(
  settlementId: string,
  race: AgentRace,
): string {
  return `${settlementId}::${race}`;
}

function latestKnownLocalBirthWorldMinute(
  state: Readonly<WorldState>,
  settlementId: string,
  race: AgentRace,
): number | undefined {
  const values = Object.values(state.agents)
    .filter(
      (agent) =>
        (agent.race ?? 'human') === race &&
        state.places[agent.homeId]?.settlementId === settlementId,
    )
    .flatMap((agent) =>
      agent.life.lastChildWorldMinute === undefined
        ? []
        : [agent.life.lastChildWorldMinute],
    );
  return values.length === 0 ? undefined : Math.max(...values);
}

function emptyLocalFamilyOpportunity(
  state: Readonly<WorldState>,
  settlementId: string,
  race: AgentRace,
  worldMinutes: number,
): V16LocalFamilyOpportunityState {
  const lastBirthWorldMinute = latestKnownLocalBirthWorldMinute(
    state,
    settlementId,
    race,
  );
  return {
    id: localFamilyOpportunityKeyV16(settlementId, race),
    settlementId,
    race,
    createdWorldMinute: worldMinutes,
    opportunityChecks: 0,
    eligiblePairChecks: 0,
    voluntaryIntimacyChoices: 0,
    voluntaryChildChoices: 0,
    birthsSinceTracking: 0,
    ...(lastBirthWorldMinute === undefined ? {} : { lastBirthWorldMinute }),
  };
}

export function createWorldV16State(
  state: Readonly<WorldState>,
  migratedFromRulesVersion: string,
): WorldV16State {
  const worldMinutes = state.calendar.elapsedWorldMinutes;
  const residentEvidenceByAgentId = Object.fromEntries(
    Object.keys(state.agents)
      .sort()
      .map((agentId) => [
        agentId,
        emptyResidentEvidence(agentId, worldMinutes),
      ]),
  );
  const settlementEvidenceById = Object.fromEntries(
    Object.keys(state.settlements)
      .sort()
      .map((settlementId) => [
        settlementId,
        emptySettlementEvidence(settlementId, worldMinutes),
      ]),
  );
  const raceFamilyOpportunityByRace = Object.fromEntries(
    SAPIENT_RACES_V16.map((race) => {
      const lastBirthWorldMinute = latestKnownBirthWorldMinute(state, race);
      const value: V16RaceFamilyOpportunityState = {
        race,
        opportunityChecks: 0,
        eligiblePairChecks: 0,
        voluntaryIntimacyChoices: 0,
        voluntaryChildChoices: 0,
        birthsSinceTracking: 0,
        ...(lastBirthWorldMinute === undefined
          ? {}
          : { lastBirthWorldMinute }),
      };
      return [race, value];
    }),
  ) as Record<AgentRace, V16RaceFamilyOpportunityState>;
  const localFamilyOpportunityByKey = Object.fromEntries(
    Object.keys(state.settlements)
      .sort()
      .flatMap((settlementId) =>
        SAPIENT_RACES_V16.map((race) => {
          const opportunity = emptyLocalFamilyOpportunity(
            state,
            settlementId,
            race,
            worldMinutes,
          );
          return [opportunity.id, opportunity] as const;
        }),
      ),
  );
  const settlementResourcesById = Object.fromEntries(
    Object.keys(state.settlements)
      .sort()
      .map((settlementId) => [
        settlementId,
        emptySettlementResources(state, settlementId, worldMinutes),
      ]),
  );
  const settlementEconomyById = Object.fromEntries(
    Object.keys(state.settlements)
      .sort()
      .map((settlementId) => [
        settlementId,
        emptySettlementEconomy(state, settlementId),
      ]),
  );
  const remainsById = Object.fromEntries(
    Object.values(state.agents)
      .filter((agent) => !agent.life.alive)
      .map((agent) => {
        const telemetry = state.v15?.deathTelemetry
          .filter((death) => death.agentId === agent.id)
          .sort((left, right) => right.worldMinutes - left.worldMinutes)[0];
        const deathWorldMinute = Math.max(
          0,
          Math.min(worldMinutes, telemetry?.worldMinutes ?? worldMinutes),
        );
        const remains: V16RemainsState = {
          id: `remains:${agent.id}`,
          agentId: agent.id,
          race: agent.race ?? 'human',
          deathWorldMinute,
          deathPlaceId: telemetry?.locationId ?? agent.locationId,
          currentPlaceId: telemetry?.locationId ?? agent.locationId,
          ...(state.places[agent.homeId]?.settlementId
            ? { homeSettlementId: state.places[agent.homeId].settlementId }
            : {}),
          status: 'historical_unknown',
          contaminationRisk: 0,
          buriedByAgentIds: [],
        };
        return [remains.id, remains] as const;
      }),
  );

  return {
    version: 'v16',
    migratedFromRulesVersion,
    createdWorldMinute: worldMinutes,
    residentEvidenceByAgentId,
    raceFamilyOpportunityByRace,
    localFamilyOpportunityByKey,
    settlementEvidenceById,
    settlementResourcesById,
    settlementEconomyById,
    remainsById,
    burialSitesBySettlementId: {},
    settlementRelations: {},
  };
}

/**
 * Repairs only fields that were added while v0.3.16 recovery builds were
 * already in use. Existing evidence, stocks, residents, relationships and
 * world-time coordinates always win. Invalid values are deliberately left for
 * the strict world validator to reject instead of being silently rewritten.
 *
 * This is intentionally separate from ensureWorldV16State because it builds a
 * complete template and therefore belongs on the one-time world-open path,
 * not inside every resident decision.
 */
export function repairWorldV16AdditiveSchema(
  state: WorldState,
  migratedFromRulesVersion = state.rulesVersion,
): WorldV16State {
  state.v16 ??= createWorldV16State(state, migratedFromRulesVersion);
  const v16 = state.v16;
  const template = createWorldV16State(state, migratedFromRulesVersion);

  v16.version ??= template.version;
  v16.migratedFromRulesVersion ??= template.migratedFromRulesVersion;
  v16.createdWorldMinute ??= template.createdWorldMinute;
  v16.residentEvidenceByAgentId ??= {};
  v16.raceFamilyOpportunityByRace ??=
    {} as WorldV16State['raceFamilyOpportunityByRace'];
  v16.localFamilyOpportunityByKey ??= {};
  v16.settlementEvidenceById ??= {};
  v16.settlementResourcesById ??= {};
  v16.settlementEconomyById ??= {};
  v16.remainsById ??= template.remainsById;
  v16.burialSitesBySettlementId ??= {};
  v16.settlementRelations ??= {};

  for (const [agentId, defaults] of Object.entries(
    template.residentEvidenceByAgentId,
  )) {
    const evidence = (v16.residentEvidenceByAgentId[agentId] ??= defaults);
    evidence.agentId ??= defaults.agentId;
    evidence.firstObservedWorldMinute ??= defaults.firstObservedWorldMinute;
    evidence.lastObservedWorldMinute ??= defaults.lastObservedWorldMinute;
    evidence.recordedDecisionCount ??= defaults.recordedDecisionCount;
    evidence.actionCounts ??= {};
    evidence.placeVisitCounts ??= {};
    evidence.contactCounts ??= {};
    evidence.constructiveContactCounts ??= {};
    evidence.tenseContactCounts ??= {};
    evidence.helpGivenCounts ??= {};
    evidence.helpReceivedCounts ??= {};
    evidence.burialCareCount ??= 0;
    evidence.conflictParticipationCount ??= 0;
  }

  for (const race of SAPIENT_RACES_V16) {
    const defaults = template.raceFamilyOpportunityByRace[race];
    const opportunity = (v16.raceFamilyOpportunityByRace[race] ??= defaults);
    opportunity.race ??= defaults.race;
    opportunity.opportunityChecks ??= 0;
    opportunity.eligiblePairChecks ??= 0;
    opportunity.voluntaryIntimacyChoices ??= 0;
    opportunity.voluntaryChildChoices ??= 0;
    opportunity.birthsSinceTracking ??= 0;
  }

  for (const [key, defaults] of Object.entries(
    template.localFamilyOpportunityByKey,
  )) {
    const opportunity = (v16.localFamilyOpportunityByKey[key] ??= defaults);
    opportunity.id ??= defaults.id;
    opportunity.settlementId ??= defaults.settlementId;
    opportunity.race ??= defaults.race;
    opportunity.createdWorldMinute ??= defaults.createdWorldMinute;
    opportunity.opportunityChecks ??= 0;
    opportunity.eligiblePairChecks ??= 0;
    opportunity.voluntaryIntimacyChoices ??= 0;
    opportunity.voluntaryChildChoices ??= 0;
    opportunity.birthsSinceTracking ??= 0;
  }

  for (const settlementId of Object.keys(state.settlements)) {
    const evidenceDefaults = template.settlementEvidenceById[settlementId];
    const evidence = (v16.settlementEvidenceById[settlementId] ??=
      evidenceDefaults);
    evidence.settlementId ??= settlementId;
    evidence.evidenceCount ??= 0;
    evidence.lastEvidenceWorldMinute ??=
      evidenceDefaults.lastEvidenceWorldMinute;
    evidence.practiceCounts ??=
      {} as V16SettlementEvidenceState['practiceCounts'];
    for (const [practice, count] of Object.entries(
      evidenceDefaults.practiceCounts,
    ) as Array<[V16SettlementPracticeKind, number]>) {
      evidence.practiceCounts[practice] ??= count;
    }

    const resourceDefaults = template.settlementResourcesById[settlementId];
    const resources = (v16.settlementResourcesById[settlementId] ??=
      resourceDefaults);
    resources.settlementId ??= settlementId;
    resources.storedResources ??= resourceDefaults.storedResources;
    resources.renewableBase ??= resourceDefaults.renewableBase;
    resources.fertility ??= resourceDefaults.fertility;
    resources.lastRecoveredWorldMinute ??=
      resourceDefaults.lastRecoveredWorldMinute;

    const economyDefaults = template.settlementEconomyById[settlementId];
    const economy = (v16.settlementEconomyById[settlementId] ??=
      economyDefaults);
    economy.settlementId ??= settlementId;
    economy.stocks ??= {} as V16SettlementEconomyState['stocks'];
    economy.storageCapacity ??=
      {} as V16SettlementEconomyState['storageCapacity'];
    economy.harvestEventsByMaterial ??=
      {} as V16SettlementEconomyState['harvestEventsByMaterial'];
    for (const material of [
      'food',
      'wood',
      'stone',
      'metal',
      'fuel',
    ] as const) {
      economy.storageCapacity[material] ??=
        economyDefaults.storageCapacity[material];
      economy.stocks[material] ??= Math.min(
        economyDefaults.stocks[material],
        economy.storageCapacity[material],
      );
      economy.harvestEventsByMaterial[material] ??= 0;
    }
    economy.farmingTools ??= 0;
    economy.constructionTools ??= 0;
    economy.harvestEvents ??= 0;
    economy.constructionEvents ??= 0;
    economy.toolsCreated ??= 0;
  }

  for (const relation of Object.values(v16.settlementRelations)) {
    relation.hostility ??= 0;
    relation.activeWar ??= false;
    relation.conflictRounds ??= 0;
    relation.resourceRaids ??= 0;
    relation.landDisputes ??= 0;
    relation.casualties ??= 0;
  }

  return v16;
}

export function ensureWorldV16State(
  state: WorldState,
  migratedFromRulesVersion = state.rulesVersion,
): WorldV16State {
  state.v16 ??= createWorldV16State(state, migratedFromRulesVersion);
  if (runtimeValidatedWorldsV16.has(state)) return state.v16;
  // Recovery checkpoints produced during the additive v16 work may predate
  // settlement-local resources. Fill the new map in place without resetting
  // residents, RNG, evidence, Cardinal history or any existing v16 counters.
  state.v16.settlementResourcesById ??= {};
  state.v16.settlementEconomyById ??= {};
  state.v16.remainsById ??= {};
  state.v16.burialSitesBySettlementId ??= {};
  for (const evidence of Object.values(state.v16.residentEvidenceByAgentId)) {
    evidence.burialCareCount ??= 0;
    evidence.conflictParticipationCount ??= 0;
  }
  for (const relation of Object.values(state.v16.settlementRelations)) {
    relation.hostility ??= 0;
    relation.activeWar ??= false;
    relation.conflictRounds ??= 0;
    relation.resourceRaids ??= 0;
    relation.landDisputes ??= 0;
    relation.casualties ??= 0;
  }
  for (const settlementId of Object.keys(state.settlements)) {
    state.v16.settlementResourcesById[settlementId] ??=
      emptySettlementResources(
        state,
        settlementId,
        state.calendar.elapsedWorldMinutes,
      );
    state.v16.settlementEconomyById[settlementId] ??=
      emptySettlementEconomy(state, settlementId);
    const economy = state.v16.settlementEconomyById[settlementId];
    economy.harvestEventsByMaterial ??= {
      food: 0,
      wood: 0,
      stone: 0,
      metal: 0,
      fuel: 0,
    };
    if (!economy.storageCapacity) {
      refreshSettlementEconomyCapacityV16(
        state,
        economy,
      );
    }
  }
  runtimeValidatedWorldsV16.add(state);
  return state.v16;
}

export function ensureResidentEvidenceV16(
  state: WorldState,
  agentId: string,
): V16ResidentEvidenceState {
  const v16 = ensureWorldV16State(state);
  v16.residentEvidenceByAgentId[agentId] ??= emptyResidentEvidence(
    agentId,
    state.calendar.elapsedWorldMinutes,
  );
  return v16.residentEvidenceByAgentId[agentId];
}

export function ensureSettlementEvidenceV16(
  state: WorldState,
  settlementId: string,
): V16SettlementEvidenceState {
  const v16 = ensureWorldV16State(state);
  v16.settlementEvidenceById[settlementId] ??= emptySettlementEvidence(
    settlementId,
    state.calendar.elapsedWorldMinutes,
  );
  for (const race of SAPIENT_RACES_V16) {
    const key = localFamilyOpportunityKeyV16(settlementId, race);
    v16.localFamilyOpportunityByKey[key] ??= emptyLocalFamilyOpportunity(
      state,
      settlementId,
      race,
      state.calendar.elapsedWorldMinutes,
    );
  }
  v16.settlementResourcesById[settlementId] ??= emptySettlementResources(
    state,
    settlementId,
    state.calendar.elapsedWorldMinutes,
  );
  v16.settlementEconomyById[settlementId] ??= emptySettlementEconomy(
    state,
    settlementId,
  );
  return v16.settlementEvidenceById[settlementId];
}

export function ensureSettlementResourcesV16(
  state: WorldState,
  settlementId: string,
): V16SettlementResourceState {
  const v16 = ensureWorldV16State(state);
  v16.settlementResourcesById[settlementId] ??= emptySettlementResources(
    state,
    settlementId,
    state.calendar.elapsedWorldMinutes,
  );
  return v16.settlementResourcesById[settlementId];
}

export function ensureSettlementEconomyV16(
  state: WorldState,
  settlementId: string,
): V16SettlementEconomyState {
  const v16 = ensureWorldV16State(state);
  v16.settlementEconomyById[settlementId] ??= emptySettlementEconomy(
    state,
    settlementId,
  );
  const economy = v16.settlementEconomyById[settlementId];
  economy.harvestEventsByMaterial ??= {
    food: 0,
    wood: 0,
    stone: 0,
    metal: 0,
    fuel: 0,
  };
  if (!economy.storageCapacity) {
    refreshSettlementEconomyCapacityV16(state, economy);
  }
  return economy;
}

export function ensureLocalFamilyOpportunityV16(
  state: WorldState,
  settlementId: string,
  race: AgentRace,
): V16LocalFamilyOpportunityState {
  const v16 = ensureWorldV16State(state);
  const key = localFamilyOpportunityKeyV16(settlementId, race);
  v16.localFamilyOpportunityByKey[key] ??= emptyLocalFamilyOpportunity(
    state,
    settlementId,
    race,
    state.calendar.elapsedWorldMinutes,
  );
  return v16.localFamilyOpportunityByKey[key];
}

function incrementCounter(
  record: Record<string, number>,
  key: string,
  amount = 1,
): boolean {
  const addedKey = record[key] === undefined;
  record[key] = Math.max(0, (record[key] ?? 0) + amount);
  return addedKey;
}

function retainStrongestCounters(
  record: Record<string, number>,
  maximumEntries: number,
): void {
  let keys = Object.keys(record);
  while (keys.length > maximumEntries) {
    let weakestKey = keys[0];
    for (let index = 1; index < keys.length; index += 1) {
      const candidateKey = keys[index];
      const candidateValue = record[candidateKey];
      const weakestValue = record[weakestKey];
      if (
        candidateValue < weakestValue ||
        (candidateValue === weakestValue &&
          candidateKey.localeCompare(weakestKey) > 0)
      ) {
        weakestKey = candidateKey;
      }
    }
    delete record[weakestKey];
    keys = Object.keys(record);
  }
}

function practiceForAction(
  action: AgentActionKind,
): V16SettlementPracticeKind | undefined {
  switch (action) {
    case 'gather':
      return 'gathering';
    case 'hunt':
      return 'hunting';
    case 'work':
      return 'craft';
    case 'help':
      return 'care';
    case 'explore':
    case 'walk':
      return 'exploration';
    case 'socialize':
    case 'bond':
      return 'social';
    case 'pray':
      return 'ritual';
    default:
      return undefined;
  }
}

export function recordSettlementPracticeEvidenceV16(
  state: WorldState,
  settlementId: string | undefined,
  practice: V16SettlementPracticeKind,
  worldMinutes = state.calendar.elapsedWorldMinutes,
): void {
  if (!settlementId || !state.settlements[settlementId]) return;
  const evidence = ensureSettlementEvidenceV16(state, settlementId);
  evidence.practiceCounts[practice] += 1;
  evidence.evidenceCount += 1;
  evidence.lastEvidenceWorldMinute = worldMinutes;
}

/**
 * Records one decision only when the resident actually made it. The technical
 * chosenAt field is used solely as an idempotency key; preferences are counted
 * as semantic actions and stamped in canonical world minutes.
 */
export function recordResidentActionEvidenceV16(
  state: WorldState,
  agent: Readonly<AgentState>,
): void {
  const decisionAt = agent.lastDecision?.chosenAt;
  if (decisionAt === undefined || !agent.lastAction) return;
  const evidence = ensureResidentEvidenceV16(state, agent.id);
  if (
    evidence.lastRecordedDecisionAt !== undefined &&
    decisionAt <= evidence.lastRecordedDecisionAt
  ) {
    return;
  }

  const worldMinutes = state.calendar.elapsedWorldMinutes;
  evidence.lastRecordedDecisionAt = decisionAt;
  evidence.lastObservedWorldMinute = worldMinutes;
  evidence.recordedDecisionCount += 1;
  evidence.actionCounts[agent.lastAction] =
    (evidence.actionCounts[agent.lastAction] ?? 0) + 1;
  if (incrementCounter(evidence.placeVisitCounts, agent.locationId)) {
    retainStrongestCounters(evidence.placeVisitCounts, 24);
  }

  const practice = practiceForAction(agent.lastAction);
  const settlementId = state.places[agent.locationId]?.settlementId;
  if (practice) {
    recordSettlementPracticeEvidenceV16(
      state,
      settlementId,
      practice,
      worldMinutes,
    );
  }
}

export type V16ContactEvidenceKind =
  | 'social'
  | 'bond_accepted'
  | 'bond_declined'
  | 'help_accepted'
  | 'help_declined'
  | 'teaching';

function settlementRelationKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

function emptySettlementRelation(
  settlementA: string,
  settlementB: string,
  worldMinutes: number,
): V16SettlementRelationEvidenceState {
  const [left, right] = [settlementA, settlementB].sort();
  return {
    id: settlementRelationKey(left, right),
    settlementA: left,
    settlementB: right,
    contactEvents: 0,
    familiarity: 0,
    trust: 0.5,
    fear: 0,
    grievance: 0,
    obligation: 0,
    cooperation: 0,
    hostility: 0,
    activeWar: false,
    conflictRounds: 0,
    resourceRaids: 0,
    landDisputes: 0,
    casualties: 0,
    lastEvidenceWorldMinute: worldMinutes,
  };
}

export function ensureSettlementRelationV16(
  state: WorldState,
  settlementA: string,
  settlementB: string,
): V16SettlementRelationEvidenceState {
  const v16 = ensureWorldV16State(state);
  const key = settlementRelationKey(settlementA, settlementB);
  v16.settlementRelations[key] ??= emptySettlementRelation(
    settlementA,
    settlementB,
    state.calendar.elapsedWorldMinutes,
  );
  return v16.settlementRelations[key];
}

export function recordBurialCareEvidenceV16(
  state: WorldState,
  agentId: string,
): void {
  const evidence = ensureResidentEvidenceV16(state, agentId);
  evidence.burialCareCount += 1;
  evidence.lastObservedWorldMinute = state.calendar.elapsedWorldMinutes;
}

export function recordConflictParticipationEvidenceV16(
  state: WorldState,
  agentId: string,
): void {
  const evidence = ensureResidentEvidenceV16(state, agentId);
  evidence.conflictParticipationCount += 1;
  evidence.lastObservedWorldMinute = state.calendar.elapsedWorldMinutes;
}

export function recordDeathRemainsV16(
  state: WorldState,
  agent: Readonly<AgentState>,
): V16RemainsState {
  const v16 = ensureWorldV16State(state);
  const id = `remains:${agent.id}`;
  v16.remainsById[id] ??= {
    id,
    agentId: agent.id,
    race: agent.race ?? 'human',
    deathWorldMinute: state.calendar.elapsedWorldMinutes,
    deathPlaceId: agent.locationId,
    currentPlaceId: agent.locationId,
    ...(state.places[agent.homeId]?.settlementId
      ? { homeSettlementId: state.places[agent.homeId].settlementId }
      : {}),
    status: 'unburied',
    contaminationRisk: 0,
    buriedByAgentIds: [],
  };
  return v16.remainsById[id];
}

function homeSettlementId(
  state: Readonly<WorldState>,
  agent: Readonly<AgentState>,
): string | undefined {
  return state.places[agent.homeId]?.settlementId;
}

export function recordResidentContactEvidenceV16(
  state: WorldState,
  actor: Readonly<AgentState>,
  other: Readonly<AgentState>,
  kind: V16ContactEvidenceKind,
  sentiment: number,
  resourceAmount = 0,
): void {
  const worldMinutes = state.calendar.elapsedWorldMinutes;
  const actorEvidence = ensureResidentEvidenceV16(state, actor.id);
  const otherEvidence = ensureResidentEvidenceV16(state, other.id);
  if (incrementCounter(actorEvidence.contactCounts, other.id)) {
    retainStrongestCounters(actorEvidence.contactCounts, 32);
  }
  if (incrementCounter(otherEvidence.contactCounts, actor.id)) {
    retainStrongestCounters(otherEvidence.contactCounts, 32);
  }

  if (sentiment >= 0) {
    if (incrementCounter(actorEvidence.constructiveContactCounts, other.id)) {
      retainStrongestCounters(actorEvidence.constructiveContactCounts, 32);
    }
    if (incrementCounter(otherEvidence.constructiveContactCounts, actor.id)) {
      retainStrongestCounters(otherEvidence.constructiveContactCounts, 32);
    }
  } else {
    if (incrementCounter(actorEvidence.tenseContactCounts, other.id)) {
      retainStrongestCounters(actorEvidence.tenseContactCounts, 32);
    }
    if (incrementCounter(otherEvidence.tenseContactCounts, actor.id)) {
      retainStrongestCounters(otherEvidence.tenseContactCounts, 32);
    }
  }
  if (kind === 'help_accepted') {
    if (incrementCounter(actorEvidence.helpGivenCounts, other.id)) {
      retainStrongestCounters(actorEvidence.helpGivenCounts, 24);
    }
    if (incrementCounter(otherEvidence.helpReceivedCounts, actor.id)) {
      retainStrongestCounters(otherEvidence.helpReceivedCounts, 24);
    }
  }
  for (const evidence of [actorEvidence, otherEvidence]) {
    evidence.lastObservedWorldMinute = worldMinutes;
  }

  const settlementA = homeSettlementId(state, actor);
  const settlementB = homeSettlementId(state, other);
  if (!settlementA || !settlementB || settlementA === settlementB) return;
  const v16 = ensureWorldV16State(state);
  const key = settlementRelationKey(settlementA, settlementB);
  const relation =
    v16.settlementRelations[key] ??
    emptySettlementRelation(settlementA, settlementB, worldMinutes);
  relation.contactEvents += 1;
  relation.familiarity = clamp01(relation.familiarity + 0.018);
  relation.trust = clamp01(
    relation.trust + Math.max(-0.03, Math.min(0.03, sentiment * 0.025)),
  );
  relation.fear = clamp01(
    relation.fear + (sentiment < -0.3 ? Math.abs(sentiment) * 0.012 : -0.002),
  );
  relation.grievance = clamp01(
    relation.grievance + (sentiment < 0 ? Math.abs(sentiment) * 0.02 : -0.004),
  );
  if (kind === 'help_accepted') {
    relation.obligation = clamp01(
      relation.obligation + Math.max(0.006, resourceAmount * 0.22),
    );
    relation.cooperation = clamp01(relation.cooperation + 0.026);
  } else if (kind === 'teaching' || kind === 'bond_accepted') {
    relation.cooperation = clamp01(relation.cooperation + 0.016);
  }
  relation.lastEvidenceWorldMinute = worldMinutes;
  v16.settlementRelations[key] = relation;
}

export function recordRaceOpportunityCheckV16(
  state: WorldState,
  race: AgentRace,
  eligiblePairCount: number,
): V16RaceFamilyOpportunityState {
  const record = ensureWorldV16State(state).raceFamilyOpportunityByRace[race];
  record.opportunityChecks += 1;
  record.eligiblePairChecks += Math.max(0, eligiblePairCount);
  record.lastOpportunityWorldMinute = state.calendar.elapsedWorldMinutes;
  return record;
}

export function recordLocalFamilyOpportunityCheckV16(
  state: WorldState,
  settlementId: string,
  race: AgentRace,
  eligiblePairCount: number,
): V16LocalFamilyOpportunityState {
  const record = ensureLocalFamilyOpportunityV16(state, settlementId, race);
  record.opportunityChecks += 1;
  record.eligiblePairChecks += Math.max(0, eligiblePairCount);
  record.lastOpportunityWorldMinute = state.calendar.elapsedWorldMinutes;
  return record;
}

export function recordRaceFamilyChoiceV16(
  state: WorldState,
  race: AgentRace,
  choice: 'intimacy' | 'child' | 'birth',
): void {
  const record = ensureWorldV16State(state).raceFamilyOpportunityByRace[race];
  if (choice === 'intimacy') record.voluntaryIntimacyChoices += 1;
  if (choice === 'child') record.voluntaryChildChoices += 1;
  if (choice === 'birth') {
    record.birthsSinceTracking += 1;
    record.lastBirthWorldMinute = state.calendar.elapsedWorldMinutes;
  }
}

export function recordLocalFamilyChoiceV16(
  state: WorldState,
  settlementId: string,
  race: AgentRace,
  choice: 'intimacy' | 'child' | 'birth',
): void {
  const record = ensureLocalFamilyOpportunityV16(state, settlementId, race);
  if (choice === 'intimacy') record.voluntaryIntimacyChoices += 1;
  if (choice === 'child') record.voluntaryChildChoices += 1;
  if (choice === 'birth') {
    record.birthsSinceTracking += 1;
    record.lastBirthWorldMinute = state.calendar.elapsedWorldMinutes;
  }
}
