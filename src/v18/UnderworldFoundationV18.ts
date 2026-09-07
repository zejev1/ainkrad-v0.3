import type { AgentState, WorldState } from '../world/types';
import type {
  V18LifeRhythmState,
  V18LanguageKnowledgeState,
  V18LivelihoodState,
  V18PlanetaryGeographyState,
  V18SettlementLifecycleState,
  WorldV18State,
} from './types';
import {
  initialLifeRhythmV18,
  initialLivelihoodV18,
  LIVELIHOOD_KINDS_V18,
} from './LivelihoodAndRhythmV18';
import {
  assertSecretLibraryStateV18,
  createSecretLibraryStateV18,
  repairSecretLibraryStateV18,
} from './SecretLibraryV18';

export const WORLD_RULES_VERSION_V18 = 'ainkrad-world-rules-0.3.18';
export const WORLD_V18_SCHEMA_VERSION = 'v18' as const;
export const MAX_RECENT_CONVERSATIONS_V18 = 96;
export const MAX_TEACHERS_PER_LANGUAGE_V18 = 12;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const EARTH_SIZED_PLANET_V18: V18PlanetaryGeographyState = {
  shape: 'sphere',
  radiusKm: 6_371,
  circumferenceKm: 40_075,
  coordinateUnitMetres: 100,
  minMapX: -200_375,
  maxMapX: 200_375,
  minMapY: -100_075,
  maxMapY: 100_075,
  surfaceOnlyUntilTechnology: true,
};

/**
 * Existing Ainkrad people have already communicated for years. Migration
 * therefore represents that evidenced capability instead of pretending they
 * were mute. Cyrillic literacy starts much lower and must grow through later
 * teaching and writing practice.
 */
export function initialRussianKnowledgeV18(
  agent: Readonly<AgentState>,
): V18LanguageKnowledgeState {
  const ageFactor = clamp01(agent.life.ageYears / 12);
  const social = agent.skills.social;
  const knowledge = agent.mind.values.knowledge;
  const spokenComprehension = clamp01(
    0.04 + ageFactor * 0.38 + social * 0.24 + knowledge * 0.1,
  );
  const spokenExpression = clamp01(
    0.025 + ageFactor * 0.32 + social * 0.27 + agent.personality.sociability * 0.09,
  );
  const vocabulary = clamp01(
    0.02 + ageFactor * 0.28 + knowledge * 0.24 + agent.personality.curiosity * 0.08,
  );
  const cyrillicLiteracy = clamp01(
    Math.max(0, ageFactor - 0.42) *
      (0.05 + knowledge * 0.13 + agent.skills.craft * 0.045),
  );

  return {
    languageId: 'ru',
    spokenComprehension,
    spokenExpression,
    vocabulary,
    cyrillicLiteracy,
    conversationCount: 0,
    teachingCount: 0,
    writtenRecordCount: 0,
    teacherIds: [],
  };
}

export function ensureRussianKnowledgeV18(
  state: WorldState,
  agent: Readonly<AgentState>,
): V18LanguageKnowledgeState {
  const v18 = ensureWorldV18State(state);
  const existing = v18.languageByAgentId[agent.id];
  if (existing) return existing;
  const created = initialRussianKnowledgeV18(agent);
  v18.languageByAgentId[agent.id] = created;
  return created;
}

function settlementResidentCount(
  state: Readonly<WorldState>,
  settlementId: string,
): number {
  return Object.values(state.agents).filter(
    (agent) =>
      agent.life.alive &&
      state.places[agent.homeId]?.settlementId === settlementId,
  ).length;
}

export function deriveSettlementLifecycleV18(
  state: Readonly<WorldState>,
  settlementId: string,
  prior?: Readonly<V18SettlementLifecycleState>,
  residentCountOverride?: number,
): V18SettlementLifecycleState {
  const settlement = state.settlements[settlementId];
  if (!settlement) {
    throw new Error(`Cannot derive lifecycle for missing settlement ${settlementId}.`);
  }
  const residentCount = residentCountOverride ??
    settlementResidentCount(state, settlementId);
  const economy = state.v16?.settlementEconomyById[settlementId];
  const resources = state.v16?.settlementResourcesById[settlementId];
  const memberPlaces = settlement.memberPlaceIds
    .map((placeId) => state.places[placeId])
    .filter((place) => place !== undefined);
  const housingCapacity = memberPlaces
    .filter((place) => place.kind === 'home')
    .reduce((sum, place) => sum + place.capacity, 0);
  const averageDanger = memberPlaces.length === 0
    ? 0
    : memberPlaces.reduce((sum, place) => sum + place.danger, 0) /
      memberPlaces.length;
  const foodSecurity = economy
    ? Math.min(1, economy.stocks.food / Math.max(1, residentCount * 0.18))
    : resources?.storedResources ?? 0.5;
  const resourcePressure = clamp01(
    1 - (foodSecurity * 0.58 + (resources?.renewableBase ?? 0.5) * 0.42),
  );
  const housingPressure = residentCount === 0
    ? 0
    : clamp01((residentCount + 2 - housingCapacity) / Math.max(4, housingCapacity));
  const dangerPressure = clamp01(averageDanger);
  const departurePressure = clamp01(
    resourcePressure * 0.45 + housingPressure * 0.27 + dangerPressure * 0.28,
  );
  const status = residentCount === 0
    ? prior?.status === 'ruins'
      ? 'ruins'
      : 'abandoned'
    : departurePressure >= 0.66
      ? 'declining'
      : prior?.controllerSettlementId
        ? 'occupied'
        : 'inhabited';

  return {
    settlementId,
    status,
    residentCount,
    resourcePressure,
    housingPressure,
    dangerPressure,
    departurePressure,
    lastAppraisedWorldMinute: state.calendar.elapsedWorldMinutes,
    ...(residentCount === 0
      ? { abandonedWorldMinute: prior?.abandonedWorldMinute ?? state.calendar.elapsedWorldMinutes }
      : {}),
    ...(prior?.ruinedWorldMinute === undefined
      ? {}
      : { ruinedWorldMinute: prior.ruinedWorldMinute }),
    ...(prior?.controllerSettlementId === undefined
      ? {}
      : { controllerSettlementId: prior.controllerSettlementId }),
    lastStatusReason:
      residentCount === 0
        ? 'no_living_residents'
        : resourcePressure >= Math.max(housingPressure, dangerPressure)
          ? 'resource_pressure'
          : housingPressure >= dangerPressure
            ? 'housing_pressure'
            : 'danger_pressure',
  };
}

export function createWorldV18State(
  state: Readonly<WorldState>,
  migratedFromRulesVersion: string,
): WorldV18State {
  const languageByAgentId = Object.fromEntries(
    Object.values(state.agents).map((agent) => [
      agent.id,
      initialRussianKnowledgeV18(agent),
    ]),
  );
  const settlementLifecycleById = Object.fromEntries(
    Object.keys(state.settlements).map((settlementId) => [
      settlementId,
      deriveSettlementLifecycleV18(state, settlementId),
    ]),
  );
  const livelihoodByAgentId: Record<string, V18LivelihoodState> =
    Object.fromEntries(
      Object.values(state.agents).map((agent) => [
        agent.id,
        initialLivelihoodV18(agent.id),
      ]),
    );
  const lifeRhythmByAgentId: Record<string, V18LifeRhythmState> =
    Object.fromEntries(
      Object.values(state.agents).map((agent) => [
        agent.id,
        initialLifeRhythmV18(agent),
      ]),
    );
  return {
    version: WORLD_V18_SCHEMA_VERSION,
    migratedFromRulesVersion,
    languageByAgentId,
    recentConversations: [],
    settlementLifecycleById,
    expeditionsById: {},
    livelihoodByAgentId,
    lifeRhythmByAgentId,
    nextExpeditionSequence: 1,
    planetaryGeography: { ...EARTH_SIZED_PLANET_V18 },
    secretLibrary: createSecretLibraryStateV18(
      state.calendar.elapsedWorldMinutes,
    ),
  };
}

export function ensureWorldV18State(state: WorldState): WorldV18State {
  state.v18 ??= createWorldV18State(
    state,
    state.rulesVersion || WORLD_RULES_VERSION_V18,
  );
  return state.v18;
}

/** Add missing additive fields only; never replace persisted evidence. */
export function repairWorldV18AdditiveSchema(
  state: WorldState,
  migratedFromRulesVersion: string,
): WorldV18State {
  const v18 = ensureWorldV18State(state);
  v18.version = WORLD_V18_SCHEMA_VERSION;
  v18.migratedFromRulesVersion ||= migratedFromRulesVersion;
  v18.languageByAgentId ??= {};
  v18.recentConversations ??= [];
  v18.settlementLifecycleById ??= {};
  v18.expeditionsById ??= {};
  v18.livelihoodByAgentId ??= {};
  v18.lifeRhythmByAgentId ??= {};
  v18.nextExpeditionSequence ??= 1;
  v18.planetaryGeography ??= { ...EARTH_SIZED_PLANET_V18 };
  const persistedSecretLibrary = (
    v18 as WorldV18State & { secretLibrary?: unknown }
  ).secretLibrary;
  v18.secretLibrary = repairSecretLibraryStateV18(
    persistedSecretLibrary,
    state.calendar.elapsedWorldMinutes,
    state.agents,
  );

  for (const agent of Object.values(state.agents)) {
    const language = ensureRussianKnowledgeV18(state, agent);
    language.languageId = 'ru';
    language.conversationCount ??= 0;
    language.teachingCount ??= 0;
    language.writtenRecordCount ??= 0;
    language.teacherIds ??= [];
    language.teacherIds = [...new Set(language.teacherIds)]
      .filter((id) => id !== agent.id && state.agents[id] !== undefined)
      .slice(0, MAX_TEACHERS_PER_LANGUAGE_V18);
    const livelihood = (v18.livelihoodByAgentId[agent.id] ??=
      initialLivelihoodV18(agent.id));
    livelihood.agentId = agent.id;
    livelihood.primary ??= 'undecided';
    livelihood.stage ??= 'observing';
    livelihood.practiceByKind ??= initialLivelihoodV18(agent.id).practiceByKind;
    for (const kind of LIVELIHOOD_KINDS_V18) {
      livelihood.practiceByKind[kind] ??= 0;
    }
    livelihood.totalPractice ??= Object.values(
      livelihood.practiceByKind,
    ).reduce((sum, count) => sum + count, 0);
    livelihood.mentorIds ??= [];
    livelihood.mentorIds = [...new Set(livelihood.mentorIds)]
      .filter((id) => id !== agent.id && state.agents[id] !== undefined)
      .slice(-12);
    livelihood.changeCount ??= 0;
    livelihood.mappedPlaceIds ??= [];
    livelihood.mappedPlaceIds = [...new Set(livelihood.mappedPlaceIds)]
      .filter((placeId) => state.places[placeId] !== undefined)
      .slice(-128);
    livelihood.longJourneyCount ??= 0;
    livelihood.defensePracticeCount ??= 0;

    const rhythm = (v18.lifeRhythmByAgentId[agent.id] ??=
      initialLifeRhythmV18(agent));
    rhythm.agentId = agent.id;
    rhythm.satiety ??= clamp01(0.48 + agent.resources * 0.38);
    rhythm.mealsConsumed ??= 0;
    rhythm.missedMealQuanta ??= 0;
    rhythm.repeatedActionCount ??= 0;
    rhythm.productiveActionCount ??= 0;
    rhythm.outsideSettlementActionCount ??= 0;
  }
  for (const agentId of Object.keys(v18.languageByAgentId)) {
    if (!state.agents[agentId]) delete v18.languageByAgentId[agentId];
  }
  for (const agentId of Object.keys(v18.livelihoodByAgentId)) {
    if (!state.agents[agentId]) delete v18.livelihoodByAgentId[agentId];
  }
  for (const agentId of Object.keys(v18.lifeRhythmByAgentId)) {
    if (!state.agents[agentId]) delete v18.lifeRhythmByAgentId[agentId];
  }
  for (const settlementId of Object.keys(state.settlements)) {
    v18.settlementLifecycleById[settlementId] = deriveSettlementLifecycleV18(
      state,
      settlementId,
      v18.settlementLifecycleById[settlementId],
    );
  }
  v18.recentConversations = v18.recentConversations
    .filter(
      (conversation) =>
        state.agents[conversation.speakerId] !== undefined &&
        state.agents[conversation.listenerId] !== undefined &&
        state.places[conversation.placeId] !== undefined,
    )
    .slice(-MAX_RECENT_CONVERSATIONS_V18);
  return v18;
}

function assertUnit(value: number, path: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${path} must be finite and within 0..1.`);
  }
}

export function assertWorldV18State(state: Readonly<WorldState>): void {
  const v18 = state.v18;
  if (!v18 || v18.version !== WORLD_V18_SCHEMA_VERSION) {
    throw new Error('World v18 state is missing or has an invalid version.');
  }
  if (!v18.migratedFromRulesVersion.trim()) {
    throw new Error('World v18 migratedFromRulesVersion must not be empty.');
  }
  assertSecretLibraryStateV18(state);
  if (!Number.isInteger(v18.nextExpeditionSequence) || v18.nextExpeditionSequence < 1) {
    throw new Error('World v18 nextExpeditionSequence must be an integer >= 1.');
  }
  const planet = v18.planetaryGeography;
  if (
    !planet ||
    planet.shape !== 'sphere' ||
    planet.radiusKm !== 6_371 ||
    planet.circumferenceKm !== 40_075 ||
    planet.coordinateUnitMetres !== 100 ||
    planet.surfaceOnlyUntilTechnology !== true ||
    !Number.isFinite(planet.minMapX) ||
    !Number.isFinite(planet.maxMapX) ||
    !Number.isFinite(planet.minMapY) ||
    !Number.isFinite(planet.maxMapY) ||
    planet.minMapX >= planet.maxMapX ||
    planet.minMapY >= planet.maxMapY
  ) {
    throw new Error('World v18 Earth-sized planetary geography is invalid.');
  }
  for (const place of Object.values(state.places)) {
    if (
      place.mapX < planet.minMapX ||
      place.mapX > planet.maxMapX ||
      place.mapY < planet.minMapY ||
      place.mapY > planet.maxMapY
    ) {
      throw new Error(`World place ${place.id} lies outside the finite planet.`);
    }
    for (const point of place.boundaryPolygon ?? []) {
      if (
        point.x < planet.minMapX ||
        point.x > planet.maxMapX ||
        point.y < planet.minMapY ||
        point.y > planet.maxMapY
      ) {
        throw new Error(`World place ${place.id} boundary lies outside the finite planet.`);
      }
    }
  }
  if (v18.recentConversations.length > MAX_RECENT_CONVERSATIONS_V18) {
    throw new Error('World v18 conversation window exceeds its bounded limit.');
  }
  for (const [agentId, language] of Object.entries(v18.languageByAgentId)) {
    if (!state.agents[agentId]) {
      throw new Error(`World v18 language references missing agent ${agentId}.`);
    }
    if (language.languageId !== 'ru') {
      throw new Error(`World v18 language for ${agentId} is not Russian.`);
    }
    for (const field of [
      'spokenComprehension',
      'spokenExpression',
      'vocabulary',
      'cyrillicLiteracy',
    ] as const) {
      assertUnit(language[field], `World v18 language ${agentId}.${field}`);
    }
    for (const field of [
      'conversationCount',
      'teachingCount',
      'writtenRecordCount',
    ] as const) {
      if (!Number.isInteger(language[field]) || language[field] < 0) {
        throw new Error(`World v18 language ${agentId}.${field} is invalid.`);
      }
    }
    if (
      !Array.isArray(language.teacherIds) ||
      language.teacherIds.length > MAX_TEACHERS_PER_LANGUAGE_V18 ||
      language.teacherIds.some((teacherId) => !state.agents[teacherId])
    ) {
      throw new Error(`World v18 language ${agentId} has invalid teachers.`);
    }
  }
  for (const agentId of Object.keys(state.agents)) {
    if (!v18.languageByAgentId[agentId]) {
      throw new Error(`World v18 is missing language state for ${agentId}.`);
    }
    const livelihood = v18.livelihoodByAgentId[agentId];
    if (!livelihood || livelihood.agentId !== agentId) {
      throw new Error(`World v18 is missing livelihood state for ${agentId}.`);
    }
    if (
      !['undecided', ...LIVELIHOOD_KINDS_V18].includes(livelihood.primary) ||
      !['observing', 'apprentice', 'practitioner', 'master'].includes(
        livelihood.stage,
      )
    ) {
      throw new Error(`World v18 livelihood for ${agentId} is invalid.`);
    }
    for (const kind of LIVELIHOOD_KINDS_V18) {
      const practice = livelihood.practiceByKind[kind];
      if (!Number.isFinite(practice) || practice < 0) {
        throw new Error(`World v18 livelihood ${agentId}.${kind} is invalid.`);
      }
    }
    if (
      !Array.isArray(livelihood.mappedPlaceIds) ||
      livelihood.mappedPlaceIds.length > 128 ||
      livelihood.mappedPlaceIds.some((placeId) => !state.places[placeId]) ||
      !Number.isInteger(livelihood.longJourneyCount) ||
      livelihood.longJourneyCount < 0 ||
      !Number.isInteger(livelihood.defensePracticeCount) ||
      livelihood.defensePracticeCount < 0
    ) {
      throw new Error(`World v18 livelihood journey evidence for ${agentId} is invalid.`);
    }
    const rhythm = v18.lifeRhythmByAgentId[agentId];
    if (!rhythm || rhythm.agentId !== agentId) {
      throw new Error(`World v18 is missing life rhythm for ${agentId}.`);
    }
    assertUnit(rhythm.satiety, `World v18 life rhythm ${agentId}.satiety`);
    for (const field of [
      'mealsConsumed',
      'missedMealQuanta',
      'repeatedActionCount',
      'productiveActionCount',
      'outsideSettlementActionCount',
    ] as const) {
      if (!Number.isInteger(rhythm[field]) || rhythm[field] < 0) {
        throw new Error(`World v18 life rhythm ${agentId}.${field} is invalid.`);
      }
    }
  }
  for (const conversation of v18.recentConversations) {
    if (
      !conversation.id.trim() ||
      !state.agents[conversation.speakerId] ||
      !state.agents[conversation.listenerId] ||
      !state.places[conversation.placeId] ||
      !conversation.utterance.trim() ||
      !conversation.reply.trim() ||
      !Number.isFinite(conversation.worldMinute)
    ) {
      throw new Error(`World v18 conversation ${conversation.id} is invalid.`);
    }
    assertUnit(conversation.audibility, `World v18 conversation ${conversation.id}.audibility`);
  }
  for (const settlementId of Object.keys(state.settlements)) {
    const lifecycle = v18.settlementLifecycleById[settlementId];
    if (!lifecycle || lifecycle.settlementId !== settlementId) {
      throw new Error(`World v18 is missing lifecycle for ${settlementId}.`);
    }
    for (const field of [
      'resourcePressure',
      'housingPressure',
      'dangerPressure',
      'departurePressure',
    ] as const) {
      assertUnit(lifecycle[field], `World v18 settlement ${settlementId}.${field}`);
    }
  }
}
