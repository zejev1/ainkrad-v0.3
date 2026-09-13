import type { AgentActionKind, AgentState, WorldState } from '../world/types';
import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';
import { ensureEmbodiedWorldV21 } from './EmbodiedWorldV21';

export const FOUNDING_PRIMER_ID_V21 = 'artifact:founding-primer-v21';
export const FOUNDING_PRIMER_ACTIVE_YEARS_V21 = 100;
const STUDY_INTERVAL = 30 * 1_440;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const FOUNDING_PRIMER_TOPICS_V21 = [
  'дом как укрытие, имущество и место возвращения',
  'семья, родство, забота, личные границы и взаимная ответственность',
  'уход за ребёнком без лишения его личности',
  'ремонт жилья, пожарная безопасность и уважение права отсутствующего владельца',
  'сезоны, дождь, снег, гроза, холод и безопасное поведение в пути',
] as const;

const primerIdForSettlement = (settlementId: string): string =>
  settlementId === 'settlement_ainkrad'
    ? FOUNDING_PRIMER_ID_V21
    : `${FOUNDING_PRIMER_ID_V21}:${settlementId}`;

export function ensureFoundingPrimerV21(world: WorldState): void {
  const v15 = world.v15;
  if (!v15) return;
  for (const settlement of Object.values(world.settlements)) {
    const id = primerIdForSettlement(settlement.id);
    if (v15.items[id]) continue;
    v15.items[id] = {
      id,
      kind: 'artifact',
      name: 'Основы дома, семьи и жизни в мире',
      createdWorldMinute: world.calendar.elapsedWorldMinutes,
      locationId: settlement.centerPlaceId,
      quality: 1,
      effectiveness: 0.88,
      reliability: 0.96,
      description: FOUNDING_PRIMER_TOPICS_V21.join('. '),
    };
  }
}

export function foundingPrimerEligibleV21(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
): boolean {
  const worldAge = world.calendar.elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR;
  return agent.life.alive && agent.life.ageYears >= 5 &&
    agent.life.ageYears < 18 && worldAge < FOUNDING_PRIMER_ACTIVE_YEARS_V21;
}

/**
 * Compulsory childhood education is a short lesson inside an already lived
 * safe activity. It changes comprehension through repeated study, never the
 * agent's chosen action, values, relationships or destination.
 */
export function studyFoundingPrimerV21(
  world: WorldState,
  agent: AgentState,
  action: AgentActionKind,
): { studied: boolean; lesson: number; firstLesson: boolean } {
  ensureFoundingPrimerV21(world);
  if (!foundingPrimerEligibleV21(world, agent)) {
    return { studied: false, lesson: 0, firstLesson: false };
  }
  if (!['rest', 'relax', 'socialize', 'help', 'reflect', 'work'].includes(action)) {
    return { studied: false, lesson: 0, firstLesson: false };
  }
  const place = world.places[agent.locationId];
  if (!place?.settlementId && agent.locationId !== agent.homeId) {
    return { studied: false, lesson: 0, firstLesson: false };
  }
  const settlementId = place?.settlementId ??
    world.places[agent.homeId]?.settlementId;
  if (
    !settlementId ||
    !world.v15?.items[primerIdForSettlement(settlementId)]
  ) {
    return { studied: false, lesson: 0, firstLesson: false };
  }
  const knowledge = ensureEmbodiedWorldV21(world)
    .appliedKnowledgeByAgentId[agent.id];
  const now = world.calendar.elapsedWorldMinutes;
  if (
    knowledge.lastPrimerWorldMinute !== undefined &&
    now - knowledge.lastPrimerWorldMinute < STUDY_INTERVAL
  ) {
    return { studied: false, lesson: 0, firstLesson: false };
  }
  const firstLesson = knowledge.foundingPrimerLessons === 0;
  const aptitude = world.v15?.knowledgeByAgentId[agent.id]?.aptitude.household ?? 0.5;
  const lesson = 0.004 + aptitude * 0.004;
  knowledge.homeTheory = clamp01(knowledge.homeTheory + lesson);
  knowledge.familyTheory = clamp01(knowledge.familyTheory + lesson * 0.92);
  knowledge.weatherTheory = clamp01(knowledge.weatherTheory + lesson * 0.84);
  knowledge.foundingPrimerLessons += 1;
  knowledge.lastPrimerWorldMinute = now;
  knowledge.lastLearnedWorldMinute = now;
  const general = world.v15?.knowledgeByAgentId[agent.id];
  if (general) {
    general.household = clamp01(general.household + lesson * 0.24);
    general.survival = clamp01(general.survival + lesson * 0.18);
    general.verifiedLearningSessions += 1;
    general.lastLearningWorldMinute = now;
  }
  return { studied: true, lesson, firstLesson };
}
