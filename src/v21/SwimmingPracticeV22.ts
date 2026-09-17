import type { AgentState, WorldState } from '../world/types';
import { ensureAgentEmbodiedWorldV21 } from './EmbodiedWorldV21';
import { RULID_BEACH_ID, RULID_SETTLEMENT_ID, RULID_SHIPYARD_ID } from '../world/RulidMaritimeInfrastructure';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export interface SwimmingProfileV22 {
  theory: number;
  practice: number;
  lessonsGiven: number;
}

export interface SwimmingAttemptV22 {
  attempted: boolean;
  fatal: boolean;
  risk: number;
  supervised: boolean;
  practiceBefore: number;
  practiceAfter: number;
}

function knowledge(world: WorldState, agentId: string) {
  const state = ensureAgentEmbodiedWorldV21(world, agentId);
  const record = state.appliedKnowledgeByAgentId[agentId];
  if (!record) return undefined;
  record.swimmingTheory ??= 0;
  record.swimmingPractice ??= 0;
  record.swimmingLessonsGiven ??= 0;
  return record;
}

export function swimmingProfileV22(world: WorldState, agentId: string): SwimmingProfileV22 {
  const record = knowledge(world, agentId);
  return {
    theory: record?.swimmingTheory ?? 0,
    practice: record?.swimmingPractice ?? 0,
    lessonsGiven: record?.swimmingLessonsGiven ?? 0,
  };
}

/**
 * Explicit one-person bootstrap requested for Rulid. It is idempotent and
 * persisted: the world never replaces a dead instructor with a freshly
 * fabricated master. Everyone else must learn by physical social contact and
 * then practice with their own body.
 */
export function ensureRulidSwimmingBootstrap(world: WorldState): boolean {
  const state = ensureAgentEmbodiedWorldV21(world);
  if (state.rulidSwimmingBootstrapAgentId) return false;
  if (!world.places[RULID_BEACH_ID] || !world.places[RULID_SHIPYARD_ID]) return false;

  const candidates = Object.values(world.agents)
    .filter(agent => agent.life.alive && (agent.race ?? 'human') === 'human' &&
      agent.life.ageYears >= 18 && world.places[agent.homeId]?.settlementId === RULID_SETTLEMENT_ID)
    .sort((a,b) => {
      const score = (agent: AgentState) =>
        agent.life.physiology.endurance * 0.4 + agent.skills.social * 0.25 +
        agent.personality.diligence * 0.2 + agent.personality.resilience * 0.15;
      return score(b) - score(a) || a.id.localeCompare(b.id);
    });
  const instructor = candidates[0];
  if (!instructor) return false;

  const record = knowledge(world, instructor.id)!;
  record.swimmingTheory = Math.max(record.swimmingTheory ?? 0, 0.92);
  record.swimmingPractice = Math.max(record.swimmingPractice ?? 0, 0.74);
  record.swimmingLessonsGiven ??= 0;
  state.rulidSwimmingBootstrapAgentId = instructor.id;
  instructor.knownPlaceIds = [...new Set([
    ...(instructor.knownPlaceIds ?? []),
    RULID_BEACH_ID,
    RULID_SHIPYARD_ID,
  ])];
  return true;
}

/** Theory can be taught face-to-face. Bodily swimming practice cannot. */
export function shareSwimmingKnowledgeV22(
  world: WorldState,
  teacher: AgentState,
  student: AgentState,
): boolean {
  if (!teacher.life.alive || !student.life.alive || teacher.id === student.id ||
      teacher.movement || student.movement || teacher.locationId !== student.locationId) return false;
  const source = knowledge(world, teacher.id), target = knowledge(world, student.id);
  if (!source || !target || (source.swimmingTheory ?? 0) < 0.42 || (source.swimmingPractice ?? 0) < 0.28) return false;

  const before = target.swimmingTheory ?? 0;
  const ceiling = Math.min(0.72, (source.swimmingTheory ?? 0) * 0.78);
  const gain = Math.max(0, ceiling - before) * (0.16 + teacher.skills.social * 0.12);
  if (gain <= 0.0001) return false;

  target.swimmingTheory = clamp(before + gain);
  source.swimmingLessonsGiven = (source.swimmingLessonsGiven ?? 0) + 1;
  if ((teacher.knownPlaceIds ?? []).includes(RULID_BEACH_ID)) {
    student.knownPlaceIds = [...new Set([...(student.knownPlaceIds ?? []), RULID_BEACH_ID])];
  }
  return true;
}

export function swimmingPracticeDestinationV22(
  world: WorldState,
  agent: Readonly<AgentState>,
): string | undefined {
  if (!agent.life.alive || agent.life.ageYears < 13 || agent.movement ||
      !(agent.knownPlaceIds ?? []).includes(RULID_BEACH_ID) || !world.places[RULID_BEACH_ID]) return;
  const record = knowledge(world, agent.id);
  if (!record) return;
  const interest = agent.personality.curiosity * 0.38 + agent.personality.riskTolerance * 0.28 +
    (record.swimmingTheory ?? 0) * 0.34;
  return interest >= 0.24 ? RULID_BEACH_ID : undefined;
}

/**
 * One voluntary, local lesson at the beach. Theory lowers risk but does not
 * substitute for bodily practice. A failed exposure is genuinely fatal; the
 * engine records the death through the normal mortality pipeline.
 */
export function attemptSwimmingPracticeV22(
  world: WorldState,
  agent: AgentState,
  choiceRoll: number,
  dangerRoll: number,
): SwimmingAttemptV22 {
  const record = knowledge(world, agent.id);
  const before = record?.swimmingPractice ?? 0;
  const empty = { attempted:false, fatal:false, risk:0, supervised:false, practiceBefore:before, practiceAfter:before };
  if (!record || !agent.life.alive || agent.movement || agent.locationId !== RULID_BEACH_ID ||
      agent.life.ageYears < 13) return empty;

  const willingness = clamp(
    0.08 + agent.personality.curiosity * 0.28 + agent.personality.riskTolerance * 0.22 +
    (record.swimmingTheory ?? 0) * 0.34 + before * 0.08,
  );
  if (choiceRoll > willingness) return empty;

  const supervisor = Object.values(world.agents).find(other => {
    if (other.id === agent.id || !other.life.alive || other.movement || other.locationId !== RULID_BEACH_ID) return false;
    const profile = knowledge(world, other.id);
    return (profile?.swimmingPractice ?? 0) >= 0.55 && (profile?.swimmingTheory ?? 0) >= 0.55;
  });
  const supervised = Boolean(supervisor);

  const endurance = agent.life.physiology.endurance;
  const health = agent.life.health;
  let risk = 0.012 +
    0.16 * (1 - before) * (1 - before) +
    0.065 * (1 - (record.swimmingTheory ?? 0)) +
    0.045 * (1 - endurance) +
    0.035 * (1 - health);
  if (agent.life.ageYears < 16) risk *= 1.35;
  if (supervised) risk *= 0.28;
  risk = clamp(Math.min(0.36, risk));

  if (dangerRoll < risk) {
    agent.energy = Math.max(0, agent.energy - 0.2);
    agent.stress = 1;
    return { attempted:true, fatal:true, risk, supervised, practiceBefore:before, practiceAfter:before };
  }

  const gain = (0.018 + (record.swimmingTheory ?? 0) * 0.022 + endurance * 0.014) *
    (supervised ? 1.18 : 1);
  record.swimmingPractice = clamp(before + gain * (1 - before * 0.55));
  record.swimmingTheory = clamp((record.swimmingTheory ?? 0) + 0.004 * (1 - (record.swimmingTheory ?? 0)));
  agent.energy = clamp(agent.energy - 0.035);
  agent.stress = clamp(agent.stress - 0.01);
  return {
    attempted:true,
    fatal:false,
    risk,
    supervised,
    practiceBefore:before,
    practiceAfter:record.swimmingPractice,
  };
}
