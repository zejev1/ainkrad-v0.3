import type { AgentState, RelationshipState, WorldState } from '../world/types';
import {
  ensureRussianKnowledgeV18,
  ensureWorldV18State,
  MAX_RECENT_CONVERSATIONS_V18,
  MAX_TEACHERS_PER_LANGUAGE_V18,
} from './UnderworldFoundationV18';
import type {
  V18ConversationEvidence,
  V18ConversationRecord,
  V18ConversationTone,
  V18ConversationTopic,
  V18LanguageKnowledgeState,
} from './types';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function resourceBand(
  resources: number,
): V18ConversationEvidence['speakerResourceBand'] {
  if (resources < 0.34) return 'scarce';
  if (resources < 0.7) return 'enough';
  return 'secure';
}

function stressBand(
  stress: number,
): V18ConversationEvidence['speakerStressBand'] {
  if (stress < 0.35) return 'calm';
  if (stress < 0.7) return 'strained';
  return 'overwhelmed';
}

function toneForSentiment(sentiment: number): V18ConversationTone {
  if (sentiment >= 0.22) return 'warm';
  if (sentiment <= -0.2) return 'tense';
  return 'neutral';
}

function weightedTopic(
  state: Readonly<WorldState>,
  speaker: Readonly<AgentState>,
  listener: Readonly<AgentState>,
  relationship: Readonly<RelationshipState>,
  sentiment: number,
  roll: number,
): V18ConversationTopic {
  const settlementId = state.places[speaker.homeId]?.settlementId;
  const lifecycle = settlementId
    ? state.v18?.settlementLifecycleById[settlementId]
    : undefined;
  const candidates: Array<{ topic: V18ConversationTopic; weight: number }> = [
    { topic: 'daily_life', weight: 0.25 + speaker.personality.sociability * 0.2 },
    {
      topic: 'family',
      weight:
        0.04 +
        (speaker.goal.kind === 'build_family' ? 0.7 : 0) +
        speaker.mind.values.care * 0.12,
    },
    {
      topic: 'work',
      weight:
        0.08 +
        (['work', 'gather', 'hunt'].includes(speaker.lastAction ?? '') ? 0.52 : 0) +
        speaker.personality.diligence * 0.12,
    },
    {
      topic: 'resources',
      weight:
        0.05 +
        (1 - speaker.resources) * 0.48 +
        (lifecycle?.resourcePressure ?? 0) * 0.38,
    },
    {
      topic: 'travel',
      weight:
        0.04 +
        speaker.personality.curiosity * 0.18 +
        (speaker.goal.kind === 'explore' || speaker.lastAction === 'explore'
          ? 0.64
          : 0),
    },
    {
      topic: 'danger',
      weight:
        0.03 +
        speaker.mind.emotions.fear * 0.42 +
        speaker.stress * 0.2 +
        (lifecycle?.dangerPressure ?? 0) * 0.4,
    },
    {
      topic: 'learning',
      weight:
        0.04 +
        speaker.mind.values.knowledge * 0.24 +
        speaker.personality.curiosity * 0.12,
    },
    {
      topic: 'belief',
      weight:
        0.025 +
        speaker.mind.emotions.awe * 0.28 +
        speaker.mind.beliefs.divinePresence * 0.16 +
        (speaker.goal.kind === 'seek_truth' ? 0.5 : 0),
    },
    {
      topic: 'settlement',
      weight:
        0.05 +
        (lifecycle?.departurePressure ?? 0) * 0.5 +
        speaker.mind.values.ambition * 0.13,
    },
    {
      topic: 'conflict',
      weight:
        0.015 +
        relationship.conflict * 0.55 +
        Math.max(0, -sentiment) * 0.48,
    },
  ];
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let cursor = clamp01(roll) * total;
  for (const candidate of candidates) {
    cursor -= candidate.weight;
    if (cursor <= 0) return candidate.topic;
  }
  return candidates[candidates.length - 1].topic;
}

function utterancesForTopic(
  topic: V18ConversationTopic,
  tone: V18ConversationTone,
  speaker: Readonly<AgentState>,
  listener: Readonly<AgentState>,
  placeName: string,
  lifecycleDeparturePressure: number,
): { utterance: string; reply: string } {
  const tenseReply = `Я услышал тебя, ${speaker.name}, но мне нужно подумать.`;
  switch (topic) {
    case 'family':
      return {
        utterance: `Я думаю о семье, ${listener.name}, но такое решение нельзя принимать за другого.`,
        reply:
          tone === 'warm'
            ? 'Спасибо, что говоришь об этом честно. Давай не будем спешить.'
            : tenseReply,
      };
    case 'work':
      return {
        utterance: `Сегодня у меня много работы возле «${placeName}». Я хочу закончить её хорошо.`,
        reply:
          tone === 'tense'
            ? 'Сейчас я не готов помогать, но позже можем поговорить снова.'
            : 'Если понадобится помощь, скажи. Я сам решу, смогу ли присоединиться.',
      };
    case 'resources':
      return {
        utterance:
          speaker.resources < 0.34
            ? 'Мои запасы почти кончились. Нужно найти честный способ добыть ещё.'
            : 'Запасов пока хватает, но я всё равно слежу, как быстро они уходят.',
        reply:
          tone === 'tense'
            ? 'Я не хочу спорить о запасах. Сначала нужно узнать точные остатки.'
            : 'Посмотрим на поля и склад. Тогда каждый сможет решить, что делать.',
      };
    case 'travel':
      return {
        utterance: `Меня тянет узнать, что находится за дорогами от «${placeName}».`,
        reply:
          listener.personality.riskTolerance >= 0.5
            ? 'Мне тоже интересно, но без припасов и безопасного пути я не пойду.'
            : 'Я предпочту остаться здесь, пока дорога не станет безопаснее.',
      };
    case 'danger':
      return {
        utterance: 'Здесь стало тревожно. Я не хочу выходить далеко без подготовки.',
        reply:
          tone === 'warm'
            ? 'Я понимаю. Давай предупредим остальных, а решать каждый будет сам.'
            : tenseReply,
      };
    case 'learning':
      return {
        utterance: 'Я хочу лучше говорить по-русски и научиться писать кириллицей.',
        reply:
          tone === 'tense'
            ? 'Сейчас мне трудно учиться вместе, но я не запрещаю тебе продолжать.'
            : 'Давай разберём несколько слов и букв вместе.',
      };
    case 'belief':
      return {
        utterance: 'Иногда я думаю, есть ли смысл за пределами того, что мы видим.',
        reply:
          listener.mind.values.tradition >= 0.5
            ? 'Я помню старые рассказы, но верить или нет каждый должен сам.'
            : 'Я не знаю ответа. Можно наблюдать и не притворяться, будто мы уверены.',
      };
    case 'settlement':
      return lifecycleDeparturePressure >= 0.5
        ? {
            utterance: 'Я думаю, не поискать ли другое место. Но уходить или оставаться каждый должен решить сам.',
            reply:
              listener.personality.curiosity + listener.personality.riskTolerance >= 1.05
                ? 'Я готов сначала разведать путь, но обещать переселение пока не буду.'
                : 'Я пока остаюсь здесь. Это место всё ещё многое для меня значит.',
          }
        : {
            utterance: 'Здесь пока хватает нужного, и я не вижу причины уходить прямо сейчас.',
            reply: 'Я тоже не хочу уходить только ради самого движения.',
          };
    case 'conflict':
      return {
        utterance: 'Мне не нравится, как складывается наш разговор. Я хочу, чтобы мою позицию услышали.',
        reply:
          tone === 'tense'
            ? 'Я слышу тебя, но не согласен. Вернёмся к этому, когда станет спокойнее.'
            : 'Давай разберём причину, а не будем превращать несогласие во вражду.',
      };
    case 'daily_life':
    default:
      return {
        utterance:
          tone === 'warm'
            ? `Рад тебя видеть, ${listener.name}. Как проходит твой день?`
            : tone === 'tense'
              ? `${listener.name}, я хочу поговорить спокойно, даже если мы сейчас не согласны.`
              : `${listener.name}, расскажи, чем ты сегодня занят.`,
        reply:
          tone === 'warm'
            ? `Я тоже рад тебя видеть, ${speaker.name}. Пока занимаюсь своими делами.`
            : 'День идёт обычно. Если будет что-то важное, я скажу прямо.',
      };
  }
}

function addTeacher(
  knowledge: V18LanguageKnowledgeState,
  teacherId: string,
): void {
  if (knowledge.teacherIds.includes(teacherId)) return;
  knowledge.teacherIds.push(teacherId);
  knowledge.teacherIds = knowledge.teacherIds.slice(
    -MAX_TEACHERS_PER_LANGUAGE_V18,
  );
}

function learnFromConversation(
  learner: V18LanguageKnowledgeState,
  teacher: V18LanguageKnowledgeState,
  learnerId: string,
  teacherId: string,
  topic: V18ConversationTopic,
  worldMinute: number,
): void {
  const spokenGap = Math.max(
    0,
    teacher.spokenExpression - learner.spokenComprehension,
  );
  const vocabularyGap = Math.max(0, teacher.vocabulary - learner.vocabulary);
  learner.spokenComprehension = clamp01(
    learner.spokenComprehension + 0.0012 + spokenGap * 0.003,
  );
  learner.spokenExpression = clamp01(
    learner.spokenExpression + 0.0008 + vocabularyGap * 0.0015,
  );
  learner.vocabulary = clamp01(
    learner.vocabulary + 0.0007 + vocabularyGap * 0.002,
  );
  learner.lastConversationWorldMinute = worldMinute;
  learner.conversationCount += 1;
  if (spokenGap > 0.04 || vocabularyGap > 0.04) {
    addTeacher(learner, teacherId);
    teacher.teachingCount += 1;
  }
  if (
    topic === 'learning' &&
    teacher.cyrillicLiteracy > learner.cyrillicLiteracy + 0.03
  ) {
    learner.cyrillicLiteracy = clamp01(
      learner.cyrillicLiteracy +
        0.001 +
        (teacher.cyrillicLiteracy - learner.cyrillicLiteracy) * 0.004,
    );
    learner.lastLiteracyPracticeWorldMinute = worldMinute;
    addTeacher(learner, teacherId);
  }
  if (learnerId === teacherId) {
    throw new Error('A resident cannot be their own language teacher.');
  }
}

export interface RecordConversationV18Input {
  id: string;
  state: WorldState;
  speaker: AgentState;
  listener: AgentState;
  relationship: RelationshipState;
  sentiment: number;
  topicRoll: number;
  audibilityRoll: number;
  placeOccupancy: number;
}

export function recordRussianConversationV18(
  input: RecordConversationV18Input,
): V18ConversationRecord {
  const {
    id,
    state,
    speaker,
    listener,
    relationship,
    sentiment,
    topicRoll,
    audibilityRoll,
    placeOccupancy,
  } = input;
  if (speaker.id === listener.id || speaker.locationId !== listener.locationId) {
    throw new Error('A conversation requires two co-located residents.');
  }
  const worldMinute = state.calendar.elapsedWorldMinutes;
  const speakerLanguage = ensureRussianKnowledgeV18(state, speaker);
  const listenerLanguage = ensureRussianKnowledgeV18(state, listener);
  const topic = weightedTopic(
    state,
    speaker,
    listener,
    relationship,
    sentiment,
    topicRoll,
  );
  const tone = toneForSentiment(sentiment);
  const place = state.places[speaker.locationId];
  const settlementId = state.places[speaker.homeId]?.settlementId;
  const lifecycleDeparturePressure = settlementId
    ? state.v18?.settlementLifecycleById[settlementId]?.departurePressure ?? 0
    : 0;
  const rendered = utterancesForTopic(
    topic,
    tone,
    speaker,
    listener,
    place?.name ?? speaker.locationId,
    lifecycleDeparturePressure,
  );
  const occupancy = Math.max(2, Math.floor(placeOccupancy));
  const privacy = clamp01(
    (place?.kind === 'home' ? 0.52 : 0.12) +
      relationship.trust * 0.08 -
      Math.min(0.22, Math.max(0, occupancy - 2) * 0.035),
  );
  const audibility = clamp01(
    0.28 +
      Math.abs(sentiment) * 0.24 +
      Math.min(0.24, Math.max(0, occupancy - 2) * 0.03) -
      privacy,
  );
  const record: V18ConversationRecord = {
    id,
    worldMinute,
    placeId: speaker.locationId,
    speakerId: speaker.id,
    listenerId: listener.id,
    topic,
    tone,
    utterance: rendered.utterance,
    reply: rendered.reply,
    evidence: {
      speakerGoal: speaker.goal.kind,
      speakerAction: speaker.lastAction ?? 'socialize',
      speakerResourceBand: resourceBand(speaker.resources),
      speakerStressBand: stressBand(speaker.stress),
      relationshipSentiment: sentiment,
      ...(settlementId === undefined ? {} : { settlementId }),
      ...(speaker.movement?.targetPlaceId === undefined
        ? {}
        : { referencedPlaceId: speaker.movement.targetPlaceId }),
    },
    audibility,
    observerAudible: clamp01(audibilityRoll) < audibility,
  };

  learnFromConversation(
    listenerLanguage,
    speakerLanguage,
    listener.id,
    speaker.id,
    topic,
    worldMinute,
  );
  learnFromConversation(
    speakerLanguage,
    listenerLanguage,
    speaker.id,
    listener.id,
    topic,
    worldMinute,
  );

  const v18 = ensureWorldV18State(state);
  v18.recentConversations.push(record);
  v18.recentConversations = v18.recentConversations.slice(
    -MAX_RECENT_CONVERSATIONS_V18,
  );
  return record;
}

export interface CyrillicWritingPracticeResultV18 {
  practiced: boolean;
  text?: string;
  literacyBefore: number;
  literacyAfter: number;
}

export function practiceCyrillicWritingV18(
  state: WorldState,
  agent: AgentState,
  roll: number,
): CyrillicWritingPracticeResultV18 {
  const knowledge = ensureRussianKnowledgeV18(state, agent);
  const literacyBefore = knowledge.cyrillicLiteracy;
  const readiness = clamp01(
    knowledge.spokenComprehension * 0.3 +
      knowledge.vocabulary * 0.28 +
      agent.mind.values.knowledge * 0.24 +
      agent.personality.diligence * 0.18,
  );
  if (roll >= 0.03 + readiness * 0.14) {
    return { practiced: false, literacyBefore, literacyAfter: literacyBefore };
  }
  knowledge.cyrillicLiteracy = clamp01(
    knowledge.cyrillicLiteracy + 0.0015 + readiness * 0.0025,
  );
  knowledge.lastLiteracyPracticeWorldMinute =
    state.calendar.elapsedWorldMinutes;
  knowledge.writtenRecordCount += 1;
  const text = knowledge.cyrillicLiteracy < 0.12
    ? 'А Б В Г Д'
    : knowledge.cyrillicLiteracy < 0.35
      ? `${agent.name} учится писать.`
      : `Запись ${agent.name}: ${state.places[agent.locationId]?.name ?? agent.locationId}.`;
  return {
    practiced: true,
    text,
    literacyBefore,
    literacyAfter: knowledge.cyrillicLiteracy,
  };
}
