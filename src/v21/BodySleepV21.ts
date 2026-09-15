import type { AgentState, V21BodyState, WorldPlaceKind, WorldState, WorldV21State } from '../world/types';
import { cancelLearningAttempt } from '../world/learning/ResidentLearning';
import { ensureAgentEmbodiedWorldV21 } from './EmbodiedWorldV21';
import { worldWeatherV21 } from './WeatherV21';

// Sleep is a body constraint, not a Cardinal decision. Expensive context is
// captured once when sleep begins; sleeping itself is a timestamp comparison.
const SIX_HOURS = 6 * 60;
const FATIGUE_SIGNAL_THRESHOLD = 0.10;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export interface BodySleepStateV21 {
  status: 'sleeping';
  startedWorldMinute: number;
  wakesAtWorldMinute: number;
  forced: boolean;
  quality: number;
  targetEnergy: number;
  placeId: string;
}

type SleepAwareBody = V21BodyState & {
  sleep?: BodySleepStateV21;
  lastFatigueSignalPercent?: number;
};

type SleepAwareWorldV21 = WorldV21State & {
  nextSleepWakeWorldMinute?: number;
};

function sleepWorld(world: Readonly<WorldState>): SleepAwareWorldV21 | undefined {
  return world.v21 as SleepAwareWorldV21 | undefined;
}

function existingSleepBody(world: Readonly<WorldState>, agentId: string): SleepAwareBody | undefined {
  return sleepWorld(world)?.bodiesByAgentId?.[agentId] as SleepAwareBody | undefined;
}

/** Hot-path lookup: O(1) once the embodied world exists. */
function sleepBody(world: WorldState, agent: Readonly<AgentState>): SleepAwareBody {
  return existingSleepBody(world, agent.id) ??
    (ensureAgentEmbodiedWorldV21(world, agent.id).bodiesByAgentId[agent.id] as SleepAwareBody);
}

function hasSleepingKit(world: Readonly<WorldState>, agent: Readonly<AgentState>): boolean {
  // Inventory is scanned once at sleep start, never while asleep.
  return Object.values(world.v15?.items ?? {}).some((item) => {
    if (item.ownerAgentId !== agent.id) return false;
    const text = `${item.name} ${item.description}`.toLowerCase();
    return text.includes('sleeping bag') || text.includes('bedroll') ||
      text.includes('спальник') || text.includes('постель') || text.includes('одеяло');
  });
}

function isSheltered(kind: WorldPlaceKind | undefined): boolean {
  return kind !== undefined && ['home', 'workshop', 'library', 'village', 'city'].includes(kind);
}

function sleepQualityV21(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
  forced: boolean,
): number {
  const place = world.places[agent.locationId];
  const weather = worldWeatherV21(world);
  const recovery = clamp01(agent.life.physiology.recovery);
  const ownHome = agent.locationId === agent.homeId;
  const sheltered = isSheltered(place?.kind);
  const kit = hasSleepingKit(world, agent);
  const weatherPenalty = (1 - weather.comfort) * (sheltered ? 0.04 : 0.18);

  if (ownHome) return 1;
  if (sheltered) return clamp01(0.86 + recovery * 0.1 - weatherPenalty);
  if (kit) return clamp01(0.91 + recovery * 0.09 - weatherPenalty * 0.45);
  if (forced) {
    const urbanGround = ['commons', 'outskirts', 'construction_site', 'resource_field'].includes(place?.kind ?? '');
    const base = urbanGround ? 0.5 : 0.46;
    return clamp01(base + recovery * 0.08 - weatherPenalty * 0.7);
  }
  return clamp01(0.68 + recovery * 0.1 - weatherPenalty * 0.55);
}

function resetInterruptedActivity(world: WorldState, agent: AgentState): void {
  agent.movement = undefined;
  agent.plan = undefined;
  const rhythm = world.v18?.lifeRhythmByAgentId[agent.id];
  if (rhythm) {
    rhythm.pendingArrivalAction = undefined;
    rhythm.pendingArrivalPlaceId = undefined;
    rhythm.pendingArrivalWorldMinute = undefined;
  }
  cancelLearningAttempt(agent, world.calendar.elapsedWorldMinutes);
}

export function isBodySleepingV21(world: Readonly<WorldState>, agentId: string): boolean {
  return existingSleepBody(world, agentId)?.sleep?.status === 'sleeping';
}

export function bodyFatigueSignalPercentV21(
  world: WorldState,
  agent: Readonly<AgentState>,
): number | undefined {
  const body = sleepBody(world, agent);
  if (agent.energy > FATIGUE_SIGNAL_THRESHOLD) {
    body.lastFatigueSignalPercent = undefined;
    return undefined;
  }
  if (agent.energy <= 0) return 0;
  const percent = Math.max(1, Math.min(10, Math.ceil(agent.energy * 100 - 1e-9)));
  const previous = body.lastFatigueSignalPercent;
  if (previous === undefined || percent < previous) body.lastFatigueSignalPercent = percent;
  return body.lastFatigueSignalPercent;
}

/** Body signal only: it raises sleep salience without choosing for the mind. */
export function bodyFatigueDecisionBoostV21(world: WorldState, agent: Readonly<AgentState>): number {
  const signal = bodyFatigueSignalPercentV21(world, agent);
  if (signal === undefined || signal <= 0) return 0;
  return 0.22 + (10 - signal) * 0.045;
}

/** Below 10% the body becomes progressively less capable of locomotion. */
export function bodyFatigueMobilityScaleV21(agent: Readonly<AgentState>): number {
  if (agent.energy > FATIGUE_SIGNAL_THRESHOLD) return 1;
  if (agent.energy <= 0) return 0;
  const normalized = agent.energy / FATIGUE_SIGNAL_THRESHOLD;
  return 0.16 + normalized * 0.44;
}

export function startBodySleepV21(
  world: WorldState,
  agent: AgentState,
  forced: boolean,
): boolean {
  if (!agent.life.alive) return false;
  const body = sleepBody(world, agent);
  if (body.sleep?.status === 'sleeping') return true;

  // Weather/equipment/comfort are captured once; no recomputation while sleeping.
  const quality = sleepQualityV21(world, agent, forced);
  const now = world.calendar.elapsedWorldMinutes;
  const wakesAtWorldMinute = now + SIX_HOURS;
  body.sleep = {
    status: 'sleeping',
    startedWorldMinute: now,
    wakesAtWorldMinute,
    forced,
    quality,
    targetEnergy: quality,
    placeId: agent.locationId,
  };
  const v21 = sleepWorld(world);
  if (v21) {
    v21.nextSleepWakeWorldMinute = Math.min(
      v21.nextSleepWakeWorldMinute ?? Number.POSITIVE_INFINITY,
      wakesAtWorldMinute,
    );
  }
  resetInterruptedActivity(world, agent);
  agent.lastAction = 'rest';
  return true;
}

function wakeBodyAtV21(agent: AgentState, body: SleepAwareBody): void {
  const sleep = body.sleep;
  if (!sleep) return;
  agent.energy = Math.max(agent.energy, sleep.targetEnergy);
  agent.stress = clamp01(agent.stress - (0.05 + sleep.quality * 0.1));
  body.sleep = undefined;
  if (agent.energy > FATIGUE_SIGNAL_THRESHOLD) body.lastFatigueSignalPercent = undefined;
}

/** Physical gate used at semantic decisions. O(1) for an existing body. */
export function advanceBodySleepV21(world: WorldState, agent: AgentState): boolean {
  if (!agent.life.alive) return false;
  const body = sleepBody(world, agent);
  bodyFatigueSignalPercentV21(world, agent);

  if (!body.sleep && agent.energy <= 0) startBodySleepV21(world, agent, true);
  if (!body.sleep) return false;
  if (world.calendar.elapsedWorldMinutes < body.sleep.wakesAtWorldMinute) return true;
  wakeDueSleepingBodiesV21(world, world.calendar.elapsedWorldMinutes);
  return isBodySleepingV21(world, agent.id);
}

/** O(1) read used to partition physical time exactly at the next wake. */
export function nextBodyWakeWorldMinuteV21(world: Readonly<WorldState>): number | undefined {
  return sleepWorld(world)?.nextSleepWakeWorldMinute;
}

/**
 * Runs only when the cached next wake deadline is reached. It scans bodies once,
 * wakes everybody due, and recomputes the next deadline. No logs, clones or RNG.
 */
export function wakeDueSleepingBodiesV21(world: WorldState, throughWorldMinute: number): number {
  const v21 = sleepWorld(world);
  if (!v21 || v21.nextSleepWakeWorldMinute === undefined ||
      v21.nextSleepWakeWorldMinute > throughWorldMinute) return 0;

  let woke = 0;
  let nextWake = Number.POSITIVE_INFINITY;
  for (const [agentId, rawBody] of Object.entries(v21.bodiesByAgentId)) {
    const body = rawBody as SleepAwareBody;
    const sleep = body.sleep;
    if (!sleep) continue;
    if (sleep.wakesAtWorldMinute <= throughWorldMinute) {
      const agent = world.agents[agentId];
      if (agent?.life.alive) {
        wakeBodyAtV21(agent, body);
        woke += 1;
      } else {
        body.sleep = undefined;
      }
    } else {
      nextWake = Math.min(nextWake, sleep.wakesAtWorldMinute);
    }
  }
  v21.nextSleepWakeWorldMinute = Number.isFinite(nextWake) ? nextWake : undefined;
  return woke;
}

export function bodySleepStateV21(
  world: Readonly<WorldState>,
  agentId: string,
): BodySleepStateV21 | undefined {
  return existingSleepBody(world, agentId)?.sleep;
}
