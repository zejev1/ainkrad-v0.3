import type { AgentActionKind, AgentDecisionState, AgentState } from './types';

type DecisionEvidence = Pick<
  AgentDecisionState,
  'action' | 'dominantAction' | 'consideredActionCount' | 'openness'
>;

export interface ResidentDecisionReflection {
  innerThought: string;
  deliberationWorldMinutes: number;
}

const intention: Record<AgentActionKind, string> = {
  rest: 'Сейчас мне нужна передышка, поэтому я восстановлю силы.',
  relax: 'Я ненадолго уйду туда, где тише, и дам мыслям успокоиться.',
  walk: 'Я пройдусь и посмотрю, что изменилось вокруг.',
  gather: 'Пора пополнить припасы собственным трудом.',
  hunt: 'Я попробую добыть пищу, но не стану пренебрегать опасностью.',
  work: 'Я возьмусь за полезное дело и доведу ближайшую часть до конца.',
  socialize: 'Мне стоит поговорить с теми, кто сейчас рядом.',
  help: 'Я помогу тому, кому сейчас тяжелее, чем мне.',
  explore: 'Я выйду за знакомые места и сам проверю, что находится дальше.',
  reflect: 'Мне нужно спокойно связать увиденное с тем, что я уже знаю.',
  bond: 'Я хочу стать ближе, но не буду решать за другого человека.',
  pray: 'Я побуду в тишине и попробую понять, во что действительно верю.',
};

const alternative: Record<AgentActionKind, string> = {
  rest: 'остановиться и отдохнуть',
  relax: 'уйти от дел и успокоиться',
  walk: 'просто пройтись рядом',
  gather: 'заняться припасами',
  hunt: 'отправиться на охоту',
  work: 'остаться за работой',
  socialize: 'искать разговора',
  help: 'помочь кому-то рядом',
  explore: 'уйти дальше знакомых мест',
  reflect: 'сначала всё обдумать',
  bond: 'искать близости',
  pray: 'искать ответ в вере',
};

function immediateConcern(agent: Readonly<AgentState>): string {
  if (agent.energy < 0.3) return 'Я устал, и это нельзя игнорировать.';
  if (agent.resources < 0.28) return 'Припасов мало; нужно помнить о завтрашнем дне.';
  if (agent.mind.emotions.fear > 0.58) return 'Мне тревожно, поэтому я сначала замечу риск, а не стану храбриться.';
  if (agent.mind.emotions.grief > 0.52) return 'Грусть всё ещё со мной и влияет на то, сколько сил я могу отдать делу.';
  if (agent.needs.belonging < 0.35) return 'Мне не хватает близости с другими, хотя я не хочу цепляться за них из страха.';
  if (agent.needs.purpose < 0.35) return 'Мне важно снова почувствовать, ради чего я действую.';
  if (agent.mind.emotions.hope > 0.62) return 'Я надеюсь на хороший исход, но одной надежды недостаточно.';
  return 'Я сверяю желание с силами, обстоятельствами и тем, что уже пережил.';
}

function personalValue(agent: Readonly<AgentState>): string {
  const values = agent.mind.values;
  const strongest = (Object.entries(values) as Array<[keyof typeof values, number]>)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  switch (strongest) {
    case 'care': return 'Мне важно не причинить лишнего вреда ни себе, ни близким.';
    case 'freedom': return 'Я хочу выбрать это сам, а не потому, что от меня ждут удобного ответа.';
    case 'knowledge': return 'Мне нужны наблюдения и собственный опыт, а не только догадки.';
    case 'tradition': return 'Я помню привычный порядок, но всё равно сопоставляю его с нынешней ситуацией.';
    case 'ambition': return 'Мне хочется продвинуться дальше, но цена решения тоже имеет значение.';
    default: return 'Это решение должно оставаться моим.';
  }
}

function deliberationMinutes(
  agent: Readonly<AgentState>,
  decision: DecisionEvidence,
): number {
  const urgent = agent.energy < 0.12 || agent.resources < 0.1;
  if (urgent) return 0.2 + decision.openness * 0.2;

  const consequential = new Set<AgentActionKind>([
    'hunt', 'explore', 'bond', 'reflect', 'pray',
  ]).has(decision.action);
  const base = consequential ? 1.4 : 0.2;
  const ambiguity = decision.openness * (consequential ? 4.2 : 0.24);
  const pressure = agent.stress * (consequential ? 1.1 : 0.08);
  const breadth = Math.min(
    consequential ? 0.35 : 0.12,
    Math.max(0, decision.consideredActionCount - 1) * (consequential ? 0.025 : 0.012),
  );
  const result = base + ambiguity + pressure + breadth;
  return Number(Math.min(consequential ? 8 : 0.75, Math.max(0.2, result)).toFixed(2));
}

/**
 * Turns the same evidence used by autonomous choice into a resident's private
 * first-person reflection. It does not choose an action or alter preferences.
 */
export function residentDecisionReflection(
  agent: Readonly<AgentState>,
  decision: DecisionEvidence,
): ResidentDecisionReflection {
  const contrast = decision.action === decision.dominantAction
    ? 'Тянуть с обычным решением больше незачем.'
    : `Сначала очевиднее казалось ${alternative[decision.dominantAction]}, но сейчас я выбираю иначе.`;
  return {
    innerThought: `${immediateConcern(agent)} ${personalValue(agent)} ${contrast} ${intention[decision.action]}`,
    deliberationWorldMinutes: deliberationMinutes(agent, decision),
  };
}
