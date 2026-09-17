import type {
  AgentState,
  V15WorldItemState,
  V15WeaponKind,
  V21AppliedKnowledgeState,
  V21BodyRegion,
  V21BodyState,
  V21BodySystemKind,
  V21ChildSupervisionState,
  V21DiseaseState,
  V21ItemPhysicalState,
  V21MaterialDefinition,
  V21PhysicalMaterialKind,
  V21WoundKind,
  WorldState,
  WorldV21State,
} from '../world/types';
import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';
import { worldWeatherV21 } from './WeatherV21';

export const EMBODIED_WORLD_VERSION_V21 = 'v21-embodied-world' as const;
export const MAX_WOUNDS_PER_BODY_V21 = 12;
export const MAX_DISEASES_PER_BODY_V21 = 6;

const DAY = 24 * 60;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const MATERIAL_CATALOG: Record<V21PhysicalMaterialKind, V21MaterialDefinition> = {
  wood: { kind: 'wood', density: 0.34, hardness: 0.3, toughness: 0.55, flexibility: 0.5, waterResistance: 0.24, heatResistance: 0.2, corrosionRisk: 0.28 },
  stone: { kind: 'stone', density: 0.72, hardness: 0.7, toughness: 0.3, flexibility: 0.02, waterResistance: 0.94, heatResistance: 0.86, corrosionRisk: 0.04 },
  iron: { kind: 'iron', density: 0.94, hardness: 0.8, toughness: 0.72, flexibility: 0.18, waterResistance: 0.28, heatResistance: 0.78, corrosionRisk: 0.7 },
  fiber: { kind: 'fiber', density: 0.12, hardness: 0.04, toughness: 0.32, flexibility: 0.96, waterResistance: 0.12, heatResistance: 0.08, corrosionRisk: 0.18 },
  leather: { kind: 'leather', density: 0.22, hardness: 0.15, toughness: 0.58, flexibility: 0.82, waterResistance: 0.42, heatResistance: 0.14, corrosionRisk: 0.2 },
  bone: { kind: 'bone', density: 0.42, hardness: 0.54, toughness: 0.34, flexibility: 0.12, waterResistance: 0.62, heatResistance: 0.28, corrosionRisk: 0.1 },
  ceramic: { kind: 'ceramic', density: 0.58, hardness: 0.76, toughness: 0.16, flexibility: 0.01, waterResistance: 0.96, heatResistance: 0.94, corrosionRisk: 0.02 },
};

const BODY_SYSTEMS: readonly V21BodySystemKind[] = [
  'skin',
  'musculoskeletal',
  'circulatory',
  'respiratory',
  'digestive',
  'nervous',
  'immune',
];

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stableUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function emptyKnowledge(agentId: string): V21AppliedKnowledgeState {
  return {
    agentId,
    homeTheory: 0,
    familyTheory: 0,
    weatherTheory: 0,
    foundingPrimerLessons: 0,
    foundingPrimerPageIndex: 0,
    foundingPrimerWordOffset: 0,
    foundingPrimerWordsRead: 0,
    foundingPrimerCompletedReadings: 0,
    anatomyTheory: 0,
    woundTheory: 0,
    diseaseTheory: 0,
    materialTheory: 0,
    diagnosisPractice: 0,
    treatmentPractice: 0,
    materialPractice: 0,
    swimmingTheory: 0,
    swimmingPractice: 0,
    swimmingLessonsGiven: 0,
    verifiedObservations: 0,
  };
}

function emptyBody(world: Readonly<WorldState>, agent: Readonly<AgentState>): V21BodyState {
  const health = clamp01(agent.life.health);
  return {
    agentId: agent.id,
    systems: {
      skin: health,
      musculoskeletal: clamp01(health * 0.55 + agent.life.physiology.mobility * 0.45),
      circulatory: health,
      respiratory: clamp01(health * 0.62 + agent.life.physiology.endurance * 0.38),
      digestive: health,
      nervous: clamp01(health * 0.74 + agent.mind.continuity * 0.26),
      immune: clamp01(health * 0.62 + agent.life.physiology.recovery * 0.38),
    },
    wounds: [],
    diseases: [],
    pain: 0,
    mobilityScale: 1,
    recoveryScale: 1,
    lastAdvancedWorldMinute: world.calendar.elapsedWorldMinutes,
    nextWoundSequence: 1,
    nextDiseaseSequence: 1,
  };
}

function weaponComposition(kind: V15WeaponKind | undefined): V21ItemPhysicalState['materials'] {
  if (!kind) return { stone: 0.4, wood: 0.5, fiber: 0.1 };
  if (kind.startsWith('stone_')) return { stone: 0.42, wood: 0.48, fiber: 0.1 };
  if (kind === 'forged_spear') return { iron: 0.34, wood: 0.58, leather: 0.08 };
  return { iron: 0.28, wood: 0.62, fiber: 0.1 };
}

function emptyItemPhysics(
  item: Pick<V15WorldItemState, 'id' | 'weaponKind' | 'bookId'>,
): V21ItemPhysicalState {
  const isBook = Boolean(item.bookId);
  const materials: V21ItemPhysicalState['materials'] = isBook
    ? { fiber: 0.72, leather: 0.18, wood: 0.1 }
    : weaponComposition(item.weaponKind);
  const metal = materials.iron ?? 0;
  const stone = materials.stone ?? 0;
  return {
    itemId: item.id,
    materials,
    massKg: isBook
      ? 0.82
      : 0.5 + (materials.wood ?? 0) * 1.2 + stone * 2.1 + metal * 2.8,
    integrity: 1,
    edge: isBook ? 0.03 : clamp01(0.28 + stone * 0.72 + metal * 0.9),
    contamination: 0,
  };
}

export function createEmbodiedWorldV21(world: Readonly<WorldState>): WorldV21State {
  const state: WorldV21State = {
    version: EMBODIED_WORLD_VERSION_V21,
    bodiesByAgentId: {},
    appliedKnowledgeByAgentId: {},
    itemPhysicsByItemId: {},
    materialCatalog: structuredClone(MATERIAL_CATALOG),
    childSupervisionByChildId: {},
    lastAdvancedWorldMinute: world.calendar.elapsedWorldMinutes,
  };
  for (const agent of Object.values(world.agents)) {
    if (!agent.life.alive) continue;
    state.bodiesByAgentId[agent.id] = emptyBody(world, agent);
    state.appliedKnowledgeByAgentId[agent.id] = emptyKnowledge(agent.id);
  }
  for (const item of Object.values(world.v15?.items ?? {})) {
    state.itemPhysicsByItemId[item.id] = emptyItemPhysics(item);
  }
  return state;
}

/** An action touches its own bodies/items, not a migration of the entire world.
 * Full repair still runs at load and embodied-world advancement boundaries. */
export function ensureAgentEmbodiedWorldV21(world: WorldState, agentId?: string): WorldV21State {
  const state = (world.v21 ??= createEmbodiedWorldV21(world));
  state.bodiesByAgentId ??= {};
  state.appliedKnowledgeByAgentId ??= {};
  state.itemPhysicsByItemId ??= {};
  state.materialCatalog ??= structuredClone(MATERIAL_CATALOG);
  state.childSupervisionByChildId ??= {};
  const agent = agentId ? world.agents[agentId] : undefined;
  if (agent?.life.alive) {
    state.bodiesByAgentId[agent.id] ??= emptyBody(world, agent);
    const knowledge = (state.appliedKnowledgeByAgentId[agent.id] ??= emptyKnowledge(agent.id));
    knowledge.homeTheory ??= 0;
    knowledge.familyTheory ??= 0;
    knowledge.weatherTheory ??= 0;
    knowledge.swimmingTheory ??= 0;
    knowledge.swimmingPractice ??= 0;
    knowledge.swimmingLessonsGiven ??= 0;
    knowledge.foundingPrimerLessons ??= 0;
    knowledge.foundingPrimerPageIndex ??= 0;
    knowledge.foundingPrimerWordOffset ??= 0;
    knowledge.foundingPrimerWordsRead ??= 0;
    knowledge.foundingPrimerCompletedReadings ??= 0;
  }
  return state;
}

export function ensureEmbodiedWorldV21(world: WorldState): WorldV21State {
  const state = (world.v21 ??= createEmbodiedWorldV21(world));
  state.version = EMBODIED_WORLD_VERSION_V21;
  state.bodiesByAgentId ??= {};
  state.appliedKnowledgeByAgentId ??= {};
  state.itemPhysicsByItemId ??= {};
  state.materialCatalog ??= structuredClone(MATERIAL_CATALOG);
  state.childSupervisionByChildId ??= {};
  state.lastAdvancedWorldMinute = Math.max(
    0,
    finite(state.lastAdvancedWorldMinute, world.calendar.elapsedWorldMinutes),
  );
  for (const agent of Object.values(world.agents)) {
    if (!agent.life.alive) {
      delete state.bodiesByAgentId[agent.id];
      delete state.appliedKnowledgeByAgentId[agent.id];
      delete state.childSupervisionByChildId[agent.id];
      continue;
    }
    state.bodiesByAgentId[agent.id] ??= emptyBody(world, agent);
    const knowledge = (state.appliedKnowledgeByAgentId[agent.id] ??=
      emptyKnowledge(agent.id));
    knowledge.homeTheory ??= 0;
    knowledge.familyTheory ??= 0;
    knowledge.weatherTheory ??= 0;
    knowledge.swimmingTheory ??= 0;
    knowledge.swimmingPractice ??= 0;
    knowledge.swimmingLessonsGiven ??= 0;
    knowledge.foundingPrimerLessons ??= 0;
    knowledge.foundingPrimerPageIndex ??= 0;
    knowledge.foundingPrimerWordOffset ??= 0;
    knowledge.foundingPrimerWordsRead ??= 0;
    knowledge.foundingPrimerCompletedReadings ??= 0;
  }
  for (const item of Object.values(world.v15?.items ?? {})) {
    const physics = (state.itemPhysicsByItemId[item.id] ??=
      emptyItemPhysics(item));
    if (item.bookId && !physics.materials.leather) {
      const bookPhysics = emptyItemPhysics(item);
      physics.materials = bookPhysics.materials;
      physics.massKg = bookPhysics.massKg;
      physics.edge = bookPhysics.edge;
    }
  }
  for (const itemId of Object.keys(state.itemPhysicsByItemId)) {
    if (!world.v15?.items[itemId]) delete state.itemPhysicsByItemId[itemId];
  }
  return state;
}

function ensureDisease(
  body: V21BodyState,
  kind: V21DiseaseState['kind'],
  worldMinute: number,
  severity: number,
  contagiousness: number,
): V21DiseaseState {
  const existing = body.diseases.find((disease) => disease.kind === kind);
  if (existing) {
    existing.severity = Math.max(existing.severity, severity);
    existing.lastObservedWorldMinute = worldMinute;
    return existing;
  }
  const disease: V21DiseaseState = {
    id: `disease:${body.agentId}:${body.nextDiseaseSequence++}`,
    kind,
    severity: clamp01(severity),
    contagiousness: clamp01(contagiousness),
    startedWorldMinute: worldMinute,
    lastObservedWorldMinute: worldMinute,
  };
  body.diseases.push(disease);
  body.diseases = body.diseases
    .sort((left, right) => right.severity - left.severity)
    .slice(0, MAX_DISEASES_PER_BODY_V21);
  return disease;
}

function refreshSupervision(world: WorldState, state: WorldV21State): void {
  const now = world.calendar.elapsedWorldMinutes;
  for (const child of Object.values(world.agents)) {
    if (!child.life.alive || child.life.ageYears >= 13) {
      delete state.childSupervisionByChildId[child.id];
      continue;
    }
    const guardians = child.life.parentIds
      .map((id) => world.agents[id])
      .filter((parent): parent is AgentState => Boolean(parent?.life.alive));
    const existing = state.childSupervisionByChildId[child.id];
    const physicallyObserved = guardians.some(
      (parent) => parent.locationId === child.locationId,
    );
    state.childSupervisionByChildId[child.id] = {
      childId: child.id,
      guardianIds: guardians.map((parent) => parent.id).slice(0, 4),
      lastKnownPlaceId: physicallyObserved || !existing
        ? child.locationId
        : existing.lastKnownPlaceId,
      lastObservedWorldMinute: physicallyObserved || !existing
        ? now
        : existing.lastObservedWorldMinute,
      deferredRemoteTrips: existing?.deferredRemoteTrips ?? 0,
    };
  }
}

export function recordDeferredChildTripV21(
  world: WorldState,
  child: Readonly<AgentState>,
): void {
  const state = ensureAgentEmbodiedWorldV21(world, child.id);
  const record: V21ChildSupervisionState =
    (state.childSupervisionByChildId[child.id] ??= {
      childId: child.id,
      guardianIds: child.life.parentIds.filter((id) => world.agents[id]?.life.alive),
      lastKnownPlaceId: child.locationId,
      lastObservedWorldMinute: world.calendar.elapsedWorldMinutes,
      deferredRemoteTrips: 0,
    });
  record.deferredRemoteTrips += 1;
}

/** A child keeps ordinary local freedom. Starting a distant journey before
 * thirteen requires a living parent who is physically present and has already
 * chosen the same destination; this is accompaniment, not an imposed plan. */
export function youngChildMayTravelToV21(
  world: Readonly<WorldState>,
  child: Readonly<AgentState>,
  destinationId: string,
): boolean {
  if (child.life.ageYears >= 13 || destinationId === child.homeId) return true;
  const homeSettlementId = world.places[child.homeId]?.settlementId;
  const destination = world.places[destinationId];
  if (
    homeSettlementId &&
    destination?.settlementId === homeSettlementId &&
    destination.danger < 0.58
  ) return true;
  return child.life.parentIds.some((parentId) => {
    const parent = world.agents[parentId];
    return Boolean(
      parent?.life.alive &&
      parent.life.ageYears >= 16 &&
      parent.locationId === child.locationId &&
      (parent.movement?.targetPlaceId === destinationId ||
        parent.plan?.targetPlaceId === destinationId),
    );
  });
}

export function recordTraumaV21(
  world: WorldState,
  agent: Readonly<AgentState>,
  severityInput: number,
  source: V21BodyState['wounds'][number]['source'],
  discriminator: string,
): void {
  if (severityInput <= 0 || !agent.life.alive) return;
  const state = ensureAgentEmbodiedWorldV21(world, agent.id);
  const body = state.bodiesByAgentId[agent.id] ??= emptyBody(world, agent);
  const roll = stableUnit(`${world.id}:${agent.id}:${discriminator}:${body.nextWoundSequence}`);
  const kinds: V21WoundKind[] = source === 'monster' || source === 'wildlife'
    ? ['puncture', 'cut', 'blunt_trauma']
    : source === 'dungeon'
      ? ['cut', 'puncture', 'blunt_trauma', 'fracture']
      : ['blunt_trauma', 'cut', 'fracture'];
  const regions: V21BodyRegion[] = ['arm', 'leg', 'torso', 'head'];
  const kind = kinds[Math.min(kinds.length - 1, Math.floor(roll * kinds.length))];
  const region = regions[Math.min(regions.length - 1, Math.floor(((roll * 7.13) % 1) * regions.length))];
  const severity = clamp01(severityInput * (0.72 + ((roll * 11.7) % 1) * 0.56));
  const wound = {
    id: `wound:${agent.id}:${body.nextWoundSequence++}`,
    kind,
    region,
    severity,
    bleeding: clamp01(severity * (kind === 'cut' || kind === 'puncture' ? 0.72 : 0.16)),
    contamination: clamp01(severity * (source === 'monster' || source === 'wildlife' ? 0.68 : 0.34)),
    pain: clamp01(severity * (kind === 'fracture' ? 1 : 0.78)),
    mobilityPenalty: clamp01(severity * (region === 'leg' || kind === 'fracture' ? 0.82 : 0.22)),
    causedWorldMinute: world.calendar.elapsedWorldMinutes,
    source,
  } satisfies V21BodyState['wounds'][number];
  body.wounds.push(wound);
  body.wounds = body.wounds
    .sort((left, right) => right.severity - left.severity || right.causedWorldMinute - left.causedWorldMinute)
    .slice(0, MAX_WOUNDS_PER_BODY_V21);
}

export function recordEmbodiedReadingV21(
  world: WorldState,
  agent: Readonly<AgentState>,
  category: string,
  knowledgeId: string,
  understanding: number,
): void {
  const state = ensureAgentEmbodiedWorldV21(world, agent.id);
  const knowledge = state.appliedKnowledgeByAgentId[agent.id] ??= emptyKnowledge(agent.id);
  const gain = clamp01(understanding) * (0.003 + stableUnit(knowledgeId) * 0.003);
  if (category === 'medicine') {
    knowledge.anatomyTheory = clamp01(knowledge.anatomyTheory + gain * 0.7);
    knowledge.woundTheory = clamp01(knowledge.woundTheory + gain);
    knowledge.diseaseTheory = clamp01(knowledge.diseaseTheory + gain * 0.75);
  } else if (category === 'biology') {
    knowledge.anatomyTheory = clamp01(knowledge.anatomyTheory + gain);
    knowledge.diseaseTheory = clamp01(knowledge.diseaseTheory + gain * 0.45);
  } else if (['chemistry', 'physics', 'craft', 'metallurgy', 'construction', 'engineering'].includes(category)) {
    knowledge.materialTheory = clamp01(knowledge.materialTheory + gain);
  }
  knowledge.lastLearnedWorldMinute = world.calendar.elapsedWorldMinutes;
}

export function recordCarePracticeV21(
  world: WorldState,
  caregiver: Readonly<AgentState>,
  patient: Readonly<AgentState>,
): { treated: boolean; improvement: number } {
  if (caregiver.locationId !== patient.locationId || caregiver.movement || patient.movement || !caregiver.life.alive || !patient.life.alive) {
    return { treated: false, improvement: 0 };
  }
  const state = ensureAgentEmbodiedWorldV21(world, caregiver.id);
  const body = state.bodiesByAgentId[patient.id] ??= emptyBody(world, patient);
  const knowledge = state.appliedKnowledgeByAgentId[caregiver.id] ??= emptyKnowledge(caregiver.id);
  const wound = [...body.wounds].sort(
    (left, right) => right.bleeding + right.contamination + right.severity -
      (left.bleeding + left.contamination + left.severity),
  )[0];
  const disease = [...body.diseases].sort((left, right) => right.severity - left.severity)[0];
  if (!wound && !disease) return { treated: false, improvement: 0 };
  const practicalAbility = clamp01(
    knowledge.woundTheory * 0.2 +
      knowledge.diseaseTheory * 0.12 +
      knowledge.diagnosisPractice * 0.2 +
      knowledge.treatmentPractice * 0.34 +
      caregiver.skills.social * 0.08 +
      caregiver.personality.diligence * 0.06,
  );
  let improvement = 0;
  if (wound) {
    const cleanliness = clamp01(0.18 + knowledge.woundTheory * 0.36 + practicalAbility * 0.42);
    const bleedingReduced = Math.min(wound.bleeding, 0.015 + practicalAbility * 0.09);
    const contaminationReduced = Math.min(wound.contamination, cleanliness * 0.055);
    wound.bleeding -= bleedingReduced;
    wound.contamination -= contaminationReduced;
    wound.lastTreatedWorldMinute = world.calendar.elapsedWorldMinutes;
    improvement += bleedingReduced + contaminationReduced * 0.5;
  }
  if (disease && practicalAbility >= 0.18) {
    const reduction = Math.min(disease.severity, 0.004 + practicalAbility * 0.018);
    disease.severity -= reduction;
    improvement += reduction;
  }
  knowledge.verifiedObservations += 1;
  knowledge.diagnosisPractice = clamp01(knowledge.diagnosisPractice + 0.0025);
  knowledge.treatmentPractice = clamp01(
    knowledge.treatmentPractice + 0.0015 + improvement * 0.035,
  );
  knowledge.lastLearnedWorldMinute = world.calendar.elapsedWorldMinutes;
  return { treated: improvement > 0, improvement };
}

export function recordItemUseV21(
  world: WorldState,
  itemId: string | undefined,
  load: number,
  contamination = 0,
  actorId?: string,
): void {
  if (!itemId || !world.v15?.items[itemId]) return;
  const state = ensureAgentEmbodiedWorldV21(world, actorId);
  const item = world.v15.items[itemId];
  const physics = state.itemPhysicsByItemId[itemId] ??=
    emptyItemPhysics(item);
  if (item.bookId && !physics.materials.leather) {
    const bookPhysics = emptyItemPhysics(item);
    physics.materials = bookPhysics.materials;
    physics.massKg = bookPhysics.massKg;
    physics.edge = bookPhysics.edge;
  }
  const toughness = Object.entries(physics.materials).reduce(
    (sum, [kind, share]) => sum +
      (state.materialCatalog[kind as V21PhysicalMaterialKind]?.toughness ?? 0.2) * (share ?? 0),
    0,
  );
  const wear = Math.max(0, load) * (0.002 + (1 - toughness) * 0.006);
  physics.integrity = clamp01(physics.integrity - wear);
  physics.contamination = clamp01(physics.contamination + contamination);
  physics.lastUsedWorldMinute = world.calendar.elapsedWorldMinutes;
  item.reliability = Math.min(item.reliability, clamp01(0.35 + physics.integrity * 0.65));
  item.effectiveness = Math.min(item.effectiveness, clamp01(0.3 + physics.integrity * 0.5 + physics.edge * 0.2));
  if (actorId && state.appliedKnowledgeByAgentId[actorId]) {
    const knowledge = state.appliedKnowledgeByAgentId[actorId];
    knowledge.materialPractice = clamp01(
      knowledge.materialPractice + Math.min(0.004, wear * 0.32),
    );
    knowledge.verifiedObservations += 1;
    knowledge.lastLearnedWorldMinute = world.calendar.elapsedWorldMinutes;
  }
}

export function recordMaterialPracticeV21(
  world: WorldState,
  agentId: string,
  amount: number,
): void {
  if (amount <= 0 || !world.agents[agentId]?.life.alive) return;
  const state = ensureAgentEmbodiedWorldV21(world, agentId);
  const knowledge = state.appliedKnowledgeByAgentId[agentId] ??= emptyKnowledge(agentId);
  knowledge.materialPractice = clamp01(
    knowledge.materialPractice + Math.min(0.006, amount * 0.0015),
  );
  knowledge.verifiedObservations += 1;
  knowledge.lastLearnedWorldMinute = world.calendar.elapsedWorldMinutes;
}

export function bodyMobilityScaleV21(
  world: Readonly<WorldState>,
  agentId: string,
): number {
  return world.v21?.bodiesByAgentId[agentId]?.mobilityScale ?? 1;
}

export function bodyRecoveryScaleV21(
  world: Readonly<WorldState>,
  agentId: string,
): number {
  return world.v21?.bodiesByAgentId[agentId]?.recoveryScale ?? 1;
}

export function bodyCareNeedV21(
  world: Readonly<WorldState>,
  agentId: string,
): number {
  const body = world.v21?.bodiesByAgentId[agentId];
  if (!body) return 0;
  return clamp01(
    body.wounds.reduce(
      (sum, wound) => sum + wound.severity * 0.42 + wound.bleeding * 0.5 + wound.contamination * 0.24,
      0,
    ) +
      body.diseases.reduce((sum, disease) => sum + disease.severity * 0.5, 0),
  );
}

export function careActionAffinityV21(
  world: Readonly<WorldState>,
  agentId: string,
): number {
  const knowledge = world.v21?.appliedKnowledgeByAgentId[agentId];
  if (!knowledge) return 0;
  return clamp01(
    knowledge.woundTheory * 0.18 +
      knowledge.diseaseTheory * 0.14 +
      knowledge.diagnosisPractice * 0.28 +
      knowledge.treatmentPractice * 0.4,
  ) * 0.2;
}

export function advanceEmbodiedWorldV21(world: WorldState): WorldV21State {
  const state = ensureEmbodiedWorldV21(world);
  const now = world.calendar.elapsedWorldMinutes;
  const elapsed = Math.max(0, now - state.lastAdvancedWorldMinute);
  if (elapsed < DAY) return state;
  const days = Math.min(62, elapsed / DAY);
  const weather = worldWeatherV21(world, now);
  refreshSupervision(world, state);
  const contagiousByPlace = new Map<string, number>();
  const residentsByPlace = new Map<string, number>();
  for (const body of Object.values(state.bodiesByAgentId)) {
    const agent = world.agents[body.agentId];
    if (!agent?.life.alive) continue;
    const pressure = body.diseases.reduce(
      (sum, disease) => sum + disease.severity * disease.contagiousness,
      0,
    );
    contagiousByPlace.set(
      agent.locationId,
      (contagiousByPlace.get(agent.locationId) ?? 0) + pressure,
    );
    residentsByPlace.set(
      agent.locationId,
      (residentsByPlace.get(agent.locationId) ?? 0) + 1,
    );
  }
  for (const agent of Object.values(world.agents)) {
    if (!agent.life.alive) continue;
    const body = state.bodiesByAgentId[agent.id] ??= emptyBody(world, agent);
    const knowledge = state.appliedKnowledgeByAgentId[agent.id] ??= emptyKnowledge(agent.id);
    const rhythm = world.v18?.lifeRhythmByAgentId[agent.id];
    const currentPlace = world.places[agent.locationId];
    const nourishment = clamp01((rhythm?.satiety ?? agent.resources) * 0.7 + agent.resources * 0.3);
    const recovery = clamp01(
      agent.life.physiology.recovery * 0.58 +
        body.systems.immune * 0.25 +
        nourishment * 0.17,
    );
    let bleedingHarm = 0;
    for (const wound of body.wounds) {
      bleedingHarm += wound.bleeding * days * 0.0012;
      const treated = wound.lastTreatedWorldMinute !== undefined;
      wound.bleeding = clamp01(wound.bleeding - days * (treated ? 0.012 : 0.004));
      wound.contamination = clamp01(
        wound.contamination - days * recovery * (treated ? 0.006 : 0.0015),
      );
      const healing = days * recovery * (1 - wound.contamination * 0.72) *
        (wound.kind === 'fracture' ? 0.0012 : 0.0035);
      wound.severity = clamp01(wound.severity - healing);
      wound.pain = clamp01(wound.pain - healing * 1.25);
      wound.mobilityPenalty = clamp01(wound.mobilityPenalty - healing * 0.9);
      if (wound.contamination * wound.severity > 0.14) {
        ensureDisease(
          body,
          'wound_infection',
          now,
          wound.contamination * wound.severity * 0.6,
          0,
        );
      }
    }
    body.wounds = body.wounds.filter(
      (wound) => wound.severity > 0.006 || wound.contamination > 0.012,
    );
    if (nourishment < 0.16) {
      ensureDisease(body, 'malnutrition', now, (0.16 - nourishment) * 2.4, 0);
    }
    const localExposure = contagiousByPlace.get(agent.locationId) ?? 0;
    const crowding = clamp01(
      (residentsByPlace.get(agent.locationId) ?? 1) /
        Math.max(1, world.places[agent.locationId]?.capacity ?? 1),
    );
    if (
      crowding > 0.7 &&
      stableUnit(`${world.id}:${agent.id}:crowding:${Math.floor(now / (90 * DAY))}`) <
        (crowding - 0.7) * 0.035
    ) {
      ensureDisease(body, 'respiratory', now, 0.035 + crowding * 0.045, 0.32);
    }
    if (
      localExposure > 0.08 &&
      stableUnit(`${world.id}:${agent.id}:exposure:${Math.floor(now / (30 * DAY))}`) <
        clamp01(localExposure * (1 - body.systems.immune) * 0.24)
    ) {
      ensureDisease(body, 'respiratory', now, 0.04 + localExposure * 0.06, 0.35);
    }
    const sheltered = currentPlace &&
      ['home', 'workshop', 'village', 'city'].includes(currentPlace.kind);
    if (
      !sheltered &&
      weather.severity > 0.48 &&
      stableUnit(`${world.id}:${agent.id}:weather:${Math.floor(now / (30 * DAY))}`) <
        weather.severity * 0.045
    ) {
      ensureDisease(
        body,
        'respiratory',
        now,
        0.025 + weather.severity * 0.06,
        0.08,
      );
    }
    const place = currentPlace;
    if (
      place?.biome === 'swamp' &&
      stableUnit(`${world.id}:${agent.id}:water:${Math.floor(now / (90 * DAY))}`) < 0.035
    ) {
      ensureDisease(body, 'digestive', now, 0.06, 0.12);
    }
    let diseaseHarm = 0;
    for (const disease of body.diseases) {
      const appliedCare = clamp01(
        knowledge.diseaseTheory * 0.12 + knowledge.treatmentPractice * 0.25,
      );
      const naturalChange =
        disease.kind === 'malnutrition' && nourishment >= 0.35
          ? -0.008 * days
          : (0.48 - recovery - appliedCare) * disease.severity * 0.006 * days;
      disease.severity = clamp01(disease.severity + naturalChange);
      disease.lastObservedWorldMinute = now;
      diseaseHarm += disease.severity * days * 0.00045;
    }
    body.diseases = body.diseases.filter((disease) => disease.severity > 0.008);
    const woundLoad = body.wounds.reduce((sum, wound) => sum + wound.severity, 0);
    const diseaseLoad = body.diseases.reduce((sum, disease) => sum + disease.severity, 0);
    body.pain = clamp01(body.wounds.reduce((sum, wound) => sum + wound.pain, 0));
    body.mobilityScale = clamp01(
      1 - body.wounds.reduce((sum, wound) => sum + wound.mobilityPenalty, 0) -
        diseaseLoad * 0.12 - body.pain * 0.08,
    );
    body.recoveryScale = clamp01(recovery * (1 - diseaseLoad * 0.14));
    body.systems.skin = clamp01(1 - woundLoad * 0.18);
    body.systems.musculoskeletal = clamp01(1 - body.wounds
      .filter((wound) => wound.kind === 'fracture' || wound.kind === 'blunt_trauma')
      .reduce((sum, wound) => sum + wound.severity * 0.36, 0));
    body.systems.circulatory = clamp01(1 - body.wounds.reduce((sum, wound) => sum + wound.bleeding * 0.42, 0));
    body.systems.respiratory = clamp01(1 - body.diseases
      .filter((disease) => disease.kind === 'respiratory')
      .reduce((sum, disease) => sum + disease.severity * 0.5, 0));
    body.systems.digestive = clamp01(1 - body.diseases
      .filter((disease) => disease.kind === 'digestive' || disease.kind === 'malnutrition')
      .reduce((sum, disease) => sum + disease.severity * 0.45, 0));
    body.systems.immune = clamp01(
      agent.life.physiology.recovery * 0.52 + nourishment * 0.28 + agent.life.health * 0.2 - diseaseLoad * 0.1,
    );
    body.systems.nervous = clamp01(1 - body.pain * 0.18 - diseaseLoad * 0.08);
    agent.life.health = clamp01(agent.life.health - bleedingHarm - diseaseHarm);
    body.lastAdvancedWorldMinute = now;
  }
  state.lastAdvancedWorldMinute = now;
  return state;
}

export function assertEmbodiedWorldV21(world: Readonly<WorldState>): void {
  const state = world.v21;
  if (!state) return;
  if (state.version !== EMBODIED_WORLD_VERSION_V21) {
    throw new Error('Embodied world version is invalid.');
  }
  if (Object.keys(state.bodiesByAgentId).length > Object.keys(world.agents).length) {
    throw new Error('Embodied world contains stale body records.');
  }
  for (const [agentId, body] of Object.entries(state.bodiesByAgentId)) {
    if (!world.agents[agentId]?.life.alive || body.agentId !== agentId) {
      throw new Error(`Body ${agentId} has no living resident.`);
    }
    if (body.wounds.length > MAX_WOUNDS_PER_BODY_V21 || body.diseases.length > MAX_DISEASES_PER_BODY_V21) {
      throw new Error(`Body ${agentId} exceeds a bounded medical history.`);
    }
    for (const system of BODY_SYSTEMS) {
      if (!Number.isFinite(body.systems[system]) || body.systems[system] < 0 || body.systems[system] > 1) {
        throw new Error(`Body ${agentId}.${system} is invalid.`);
      }
    }
  }
}
