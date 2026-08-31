import type {
  AgentActionKind,
  AgentState,
  WorldPlace,
  WorldState,
} from '../world/types';
import type {
  V18LifeRhythmState,
  V18LivelihoodKind,
  V18LivelihoodStage,
  V18LivelihoodState,
} from './types';

export const LIVELIHOOD_KINDS_V18: readonly Exclude<
  V18LivelihoodKind,
  'undecided'
>[] = [
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
  'teacher',
  'scribe',
  'guard',
  'spiritual_keeper',
] as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function emptyPractice(): V18LivelihoodState['practiceByKind'] {
  return Object.fromEntries(
    LIVELIHOOD_KINDS_V18.map((kind) => [kind, 0]),
  ) as V18LivelihoodState['practiceByKind'];
}

export function initialLivelihoodV18(agentId: string): V18LivelihoodState {
  return {
    agentId,
    primary: 'undecided',
    stage: 'observing',
    practiceByKind: emptyPractice(),
    totalPractice: 0,
    mentorIds: [],
    changeCount: 0,
  };
}

export function initialLifeRhythmV18(
  agent: Readonly<AgentState>,
): V18LifeRhythmState {
  return {
    agentId: agent.id,
    satiety: clamp01(0.48 + agent.resources * 0.38),
    mealsConsumed: 0,
    missedMealQuanta: 0,
    repeatedActionCount: 0,
    productiveActionCount: 0,
    outsideSettlementActionCount: 0,
  };
}

export function ensureLivelihoodV18(
  state: WorldState,
  agent: Readonly<AgentState>,
): V18LivelihoodState {
  const v18 = state.v18;
  if (!v18) throw new Error('World v18 state is required for livelihood evidence.');
  return (v18.livelihoodByAgentId[agent.id] ??= initialLivelihoodV18(agent.id));
}

export function ensureLifeRhythmV18(
  state: WorldState,
  agent: Readonly<AgentState>,
): V18LifeRhythmState {
  const v18 = state.v18;
  if (!v18) throw new Error('World v18 state is required for life rhythm evidence.');
  return (v18.lifeRhythmByAgentId[agent.id] ??= initialLifeRhythmV18(agent));
}

function livelihoodStage(
  agent: Readonly<AgentState>,
  practice: number,
): V18LivelihoodStage {
  if (practice < 6) return 'observing';
  if (agent.life.stage === 'child' || practice < 30) return 'apprentice';
  if (practice < 100) return 'practitioner';
  return 'master';
}

function inferredPractice(
  action: AgentActionKind,
  place: Readonly<WorldPlace> | undefined,
): Exclude<V18LivelihoodKind, 'undecided'> | undefined {
  switch (action) {
    case 'gather': {
      if (place?.kind === 'resource_field') return 'farmer';
      if (place?.kind === 'forest' || place?.kind === 'swamp') {
        return 'woodcutter';
      }
      if (place?.kind === 'mountains' || place?.kind === 'ruins') {
        return 'miner';
      }
      return 'forager';
    }
    case 'hunt':
      return place?.kind === 'shore' ||
        place?.kind === 'lake' ||
        place?.kind === 'river'
        ? 'fisher'
        : 'hunter';
    case 'work':
      return 'artisan';
    case 'help':
      return 'caregiver';
    case 'explore':
      return 'scout';
    case 'pray':
      return 'spiritual_keeper';
    default:
      return undefined;
  }
}

function vocationalFit(
  agent: Readonly<AgentState>,
  kind: Exclude<V18LivelihoodKind, 'undecided'>,
): number {
  switch (kind) {
    case 'farmer':
      return clamp01(agent.personality.diligence * 0.62 + agent.mind.values.care * 0.38);
    case 'forager':
      return clamp01(agent.personality.curiosity * 0.52 + agent.personality.diligence * 0.48);
    case 'woodcutter':
      return clamp01(agent.personality.diligence * 0.5 + agent.life.physiology.strength * 0.5);
    case 'miner':
      return clamp01(agent.personality.diligence * 0.46 + agent.life.physiology.endurance * 0.34 + agent.mind.values.ambition * 0.2);
    case 'fisher':
      return clamp01(agent.personality.diligence * 0.38 + agent.personality.resilience * 0.34 + agent.personality.curiosity * 0.28);
    case 'hunter':
      return clamp01(agent.personality.riskTolerance * 0.55 + agent.life.physiology.strength * 0.45);
    case 'artisan':
    case 'smith':
    case 'builder':
      return clamp01(agent.personality.diligence * 0.6 + agent.mind.values.ambition * 0.4);
    case 'caregiver':
      return clamp01(agent.personality.generosity * 0.55 + agent.mind.values.care * 0.45);
    case 'scout':
      return clamp01(agent.personality.curiosity * 0.5 + agent.mind.values.freedom * 0.5);
    case 'teacher':
      return clamp01(agent.personality.generosity * 0.35 + agent.personality.sociability * 0.3 + agent.mind.values.knowledge * 0.35);
    case 'scribe':
      return clamp01(agent.mind.values.knowledge * 0.62 + agent.personality.diligence * 0.38);
    case 'guard':
      return clamp01(agent.mind.values.care * 0.45 + agent.personality.riskTolerance * 0.3 + agent.life.physiology.strength * 0.25);
    case 'spiritual_keeper':
      return clamp01(agent.mind.values.tradition * 0.58 + agent.mind.emotions.awe * 0.42);
  }
}

function firstCommitmentPractice(
  kind: Exclude<V18LivelihoodKind, 'undecided'>,
): number {
  switch (kind) {
    case 'guard':
      return 3;
    case 'hunter':
    case 'caregiver':
    case 'teacher':
    case 'scribe':
    case 'fisher':
      return 5;
    case 'spiritual_keeper':
      return 7;
    case 'scout':
      return 9;
    default:
      return 12;
  }
}

function minimumVocationalFit(
  kind: Exclude<V18LivelihoodKind, 'undecided'>,
): number {
  return [
    'farmer',
    'forager',
    'woodcutter',
    'miner',
    'artisan',
    'smith',
    'builder',
    'scout',
  ].includes(kind)
    ? 0.58
    : 0.53;
}

export interface LivelihoodPracticeInputV18 {
  action: AgentActionKind;
  placeId: string;
  choiceRoll: number;
  professionHint?: Exclude<V18LivelihoodKind, 'undecided'>;
  mentorId?: string;
  amount?: number;
}

/**
 * Records completed practice, then lets the resident decide whether that lived
 * pattern has become (or replaced) a livelihood. No population quota or
 * Cardinal signal participates in the choice.
 */
export function recordLivelihoodPracticeV18(
  state: WorldState,
  agent: AgentState,
  input: Readonly<LivelihoodPracticeInputV18>,
): V18LivelihoodState {
  const livelihood = ensureLivelihoodV18(state, agent);
  const place = state.places[input.placeId];
  const kind =
    input.professionHint ?? inferredPractice(input.action, place);
  if (!kind) return livelihood;

  const amount = Math.max(0.1, Math.min(2, input.amount ?? 1));
  // This is lived vocational momentum rather than an irreversible lifetime
  // high score. Old experience remains in totalPractice, while recent years
  // can genuinely change a resident's livelihood.
  for (const candidate of LIVELIHOOD_KINDS_V18) {
    livelihood.practiceByKind[candidate] *=
      candidate === kind ? 0.9995 : 0.9975;
  }
  livelihood.practiceByKind[kind] = Math.min(
    140,
    livelihood.practiceByKind[kind] + amount,
  );
  livelihood.totalPractice += amount;
  livelihood.lastPracticedWorldMinute = state.calendar.elapsedWorldMinutes;
  livelihood.lastWorkplaceId = input.placeId;
  if (
    input.mentorId &&
    input.mentorId !== agent.id &&
    state.agents[input.mentorId] &&
    !livelihood.mentorIds.includes(input.mentorId)
  ) {
    livelihood.mentorIds.push(input.mentorId);
    livelihood.mentorIds = livelihood.mentorIds.slice(-12);
  }

  const ranked = LIVELIHOOD_KINDS_V18.map((candidate) => ({
    kind: candidate,
    practice: livelihood.practiceByKind[candidate],
  })).sort(
    (left, right) =>
      right.practice - left.practice || left.kind.localeCompare(right.kind),
  );
  const strongest = ranked[0];
  const currentPractice =
    livelihood.primary === 'undecided'
      ? 0
      : livelihood.practiceByKind[livelihood.primary];
  const practicedKindEvidence = livelihood.practiceByKind[kind];
  const fit = vocationalFit(agent, kind);
  const commitmentChance = clamp01(
    0.035 +
      practicedKindEvidence * 0.018 +
      fit * 0.22 +
      agent.mind.values.ambition * 0.05,
  );
  const canChooseFirst =
    livelihood.primary === 'undecided' &&
    practicedKindEvidence >= firstCommitmentPractice(kind) &&
    fit >= minimumVocationalFit(kind) &&
    clamp01(input.choiceRoll) < commitmentChance;
  const alternativeClearlyLived =
    livelihood.primary !== 'undecided' &&
    kind !== livelihood.primary &&
    practicedKindEvidence >= Math.max(8, firstCommitmentPractice(kind)) &&
    practicedKindEvidence >= currentPractice * 0.6 + 2;
  const changeChance = clamp01(
    0.08 +
      agent.mind.values.freedom * 0.18 +
      agent.personality.curiosity * 0.12 +
      agent.mind.values.ambition * 0.08,
  );
  const canChange =
    alternativeClearlyLived &&
    clamp01(input.choiceRoll) < changeChance * (0.55 + fit * 0.45);

  if (canChooseFirst || canChange) {
    if (livelihood.primary !== 'undecided') livelihood.changeCount += 1;
    livelihood.primary = kind;
    livelihood.chosenWorldMinute = state.calendar.elapsedWorldMinutes;
  }
  const primaryPractice =
    livelihood.primary === 'undecided'
      ? strongest.practice
      : livelihood.practiceByKind[livelihood.primary];
  livelihood.stage = livelihoodStage(agent, primaryPractice);
  return livelihood;
}

export function livelihoodActionAffinityV18(
  state: Readonly<WorldState>,
  agentId: string,
  action: AgentActionKind,
): number {
  const livelihood = state.v18?.livelihoodByAgentId[agentId];
  if (!livelihood || livelihood.primary === 'undecided') return 0;
  const matches =
    (['farmer', 'forager', 'woodcutter', 'miner'].includes(livelihood.primary) && action === 'gather') ||
    (['fisher', 'hunter'].includes(livelihood.primary) && action === 'hunt') ||
    (['artisan', 'smith', 'builder'].includes(livelihood.primary) && action === 'work') ||
    (livelihood.primary === 'caregiver' && action === 'help') ||
    (livelihood.primary === 'scout' && ['explore', 'walk'].includes(action)) ||
    (livelihood.primary === 'teacher' && action === 'socialize') ||
    (livelihood.primary === 'scribe' && action === 'reflect') ||
    (livelihood.primary === 'guard' && ['hunt', 'explore'].includes(action)) ||
    (livelihood.primary === 'spiritual_keeper' && action === 'pray');
  if (!matches) return 0;
  const base = livelihood.stage === 'master'
    ? 0.16
    : livelihood.stage === 'practitioner'
      ? 0.1
      : livelihood.stage === 'apprentice'
        ? 0.05
        : 0.02;
  return livelihood.primary === 'scout' ? base * 0.55 : base;
}

export function recordLifeRhythmActionV18(
  state: WorldState,
  agent: AgentState,
  action: AgentActionKind,
): void {
  const rhythm = ensureLifeRhythmV18(state, agent);
  rhythm.repeatedActionCount =
    rhythm.lastAction === action ? rhythm.repeatedActionCount + 1 : 1;
  rhythm.lastAction = action;
  if (['gather', 'hunt', 'work', 'help', 'explore'].includes(action)) {
    rhythm.productiveActionCount += 1;
    rhythm.lastProductiveWorldMinute = state.calendar.elapsedWorldMinutes;
  }
  const homeSettlementId = state.places[agent.homeId]?.settlementId;
  const currentSettlementId = state.places[agent.locationId]?.settlementId;
  if (!homeSettlementId || currentSettlementId !== homeSettlementId) {
    rhythm.outsideSettlementActionCount += 1;
    rhythm.lastOutsideSettlementWorldMinute =
      state.calendar.elapsedWorldMinutes;
  }
}

export function repetitionPenaltyV18(
  state: Readonly<WorldState>,
  agentId: string,
  action: AgentActionKind,
): number {
  const rhythm = state.v18?.lifeRhythmByAgentId[agentId];
  if (!rhythm || rhythm.lastAction !== action) return 0;
  const excess = Math.max(0, rhythm.repeatedActionCount - 1);
  const rate = action === 'socialize' || action === 'pray' ? 0.1 : 0.035;
  return Math.min(action === 'socialize' || action === 'pray' ? 0.55 : 0.2, excess * rate);
}

export function recordMealV18(
  state: WorldState,
  agent: Readonly<AgentState>,
  satietyGain: number,
): void {
  const rhythm = ensureLifeRhythmV18(state, agent);
  rhythm.satiety = clamp01(rhythm.satiety + Math.max(0, satietyGain));
  rhythm.mealsConsumed += 1;
  rhythm.missedMealQuanta = 0;
  rhythm.lastMealWorldMinute = state.calendar.elapsedWorldMinutes;
}

export function missMealV18(
  state: WorldState,
  agent: Readonly<AgentState>,
  satietyLoss: number,
): V18LifeRhythmState {
  const rhythm = ensureLifeRhythmV18(state, agent);
  rhythm.satiety = clamp01(rhythm.satiety - Math.max(0, satietyLoss));
  if (rhythm.satiety < 0.34) rhythm.missedMealQuanta += 1;
  return rhythm;
}
