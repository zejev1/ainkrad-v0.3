/**
 * Ainkrad v18 — NPC access to the Secret Library.
 *
 * Этот модуль соединяет:
 * NPC -> Тайная библиотека -> внешний gateway -> реальный человеческий текст.
 *
 * Он НЕ меняет старые файлы Ainkrad.
 * Он НЕ даёт NPC прямой интернет-доступ.
 * NPC работает только через Хранителя библиотеки.
 */

import type {
  SecretLibraryStateV18,
  SecretLibraryVisitorV18,
} from './SecretLibraryV18';

import {
  canAgentEnterSecretLibraryV18,
  recordLearnedKnowledgeV18,
  recordSecretLibraryStudyV18,
} from './SecretLibraryV18';

import {
  fetchRealHumanTextV18,
  searchRealHumanTextsV18,
  type SecretLibraryExternalTextV18,
  type SecretLibrarySearchResultV18,
  type SecretLibrarySourceLanguageV18,
} from './SecretLibraryGatewayV18';

export interface SecretLibraryNpcMindV18 {
  agentId: string;

  /**
   * Базовые способности NPC.
   * Значения 0..1.
   */
  intelligence: number;
  curiosity: number;
  literacy: number;
  memory: number;
  concentration: number;

  /**
   * Что NPC хочет сейчас узнать.
   */
  currentQuestion?: string;

  /**
   * Что он уже пытался изучать.
   */
  studiedTopics: string[];

  /**
   * Реально усвоенные сведения.
   */
  acquiredKnowledge: SecretLibraryAcquiredKnowledgeV18[];
}

export interface SecretLibraryAcquiredKnowledgeV18 {
  id: string;

  topic: string;

  sourceTitle: string;

  sourceUrl: string;

  learnedAtWorldMinute: number;

  /**
   * 0..1 — насколько хорошо NPC понял материал.
   */
  understanding: number;

  /**
   * Краткое содержание того,
   * что NPC вынес из прочитанного.
   */
  rememberedText: string;
}

export interface SecretLibraryReadingSessionV18 {
  agentId: string;

  query: string;

  searchResults: SecretLibrarySearchResultV18[];

  selectedTitle?: string;

  activeText?: SecretLibraryExternalTextV18;

  startedAtWorldMinute: number;

  lastStudyWorldMinute: number;

  totalStudyMinutes: number;

  completed: boolean;
}

export interface SecretLibraryNpcAccessStateV18 {
  mindsByAgentId: Record<
    string,
    SecretLibraryNpcMindV18
  >;

  sessionsByAgentId: Record<
    string,
    SecretLibraryReadingSessionV18
  >;
}

function clamp01V18(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function createSecretLibraryNpcAccessStateV18():
  SecretLibraryNpcAccessStateV18 {
  return {
    mindsByAgentId: {},
    sessionsByAgentId: {},
  };
}

export function createSecretLibraryNpcMindV18(
  agentId: string,
  intelligence = 0.5,
  curiosity = 0.5,
  literacy = 0.5,
  memory = 0.5,
  concentration = 0.5,
): SecretLibraryNpcMindV18 {
  return {
    agentId,

    intelligence: clamp01V18(intelligence),
    curiosity: clamp01V18(curiosity),
    literacy: clamp01V18(literacy),
    memory: clamp01V18(memory),
    concentration: clamp01V18(concentration),

    studiedTopics: [],
    acquiredKnowledge: [],
  };
}

export function ensureSecretLibraryNpcMindV18(
  state: SecretLibraryNpcAccessStateV18,
  agentId: string,
): SecretLibraryNpcMindV18 {
  const existing = state.mindsByAgentId[agentId];

  if (existing) {
    return existing;
  }

  const created =
    createSecretLibraryNpcMindV18(agentId);

  state.mindsByAgentId[agentId] = created;

  return created;
}

/**
 * NPC формулирует вопрос.
 *
 * Например:
 * "как увеличить урожай"
 * "как строить каменные мосты"
 * "как лечить переломы"
 * "как вести торговый учёт"
 *
 * Gateway ищет не ответ ИИ, а реальные человеческие тексты.
 */
export async function askSecretLibraryV18(
  library: Readonly<SecretLibraryStateV18>,
  npcState: SecretLibraryNpcAccessStateV18,
  agentId: string,
  question: string,
  currentWorldMinute: number,
  language: SecretLibrarySourceLanguageV18 = 'en',
): Promise<SecretLibrarySearchResultV18[]> {
  if (
    !canAgentEnterSecretLibraryV18(
      library,
      agentId,
      currentWorldMinute,
    )
  ) {
    throw new Error(
      `Agent ${agentId} has no active Secret Library access.`,
    );
  }

  const cleanQuestion = question.trim();

  if (!cleanQuestion) {
    return [];
  }

  const mind =
    ensureSecretLibraryNpcMindV18(
      npcState,
      agentId,
    );

  mind.currentQuestion = cleanQuestion;

  if (
    !mind.studiedTopics.includes(cleanQuestion)
  ) {
    mind.studiedTopics.push(cleanQuestion);
  }

  const results =
    await searchRealHumanTextsV18(
      cleanQuestion,
      language,
      10,
    );

  npcState.sessionsByAgentId[agentId] = {
    agentId,

    query: cleanQuestion,

    searchResults: results,

    startedAtWorldMinute:
      currentWorldMinute,

    lastStudyWorldMinute:
      currentWorldMinute,

    totalStudyMinutes: 0,

    completed: false,
  };

  return results;
}

/**
 * NPC выбирает найденную книгу / текст.
 */
export async function selectSecretLibraryTextV18(
  library: Readonly<SecretLibraryStateV18>,
  npcState: SecretLibraryNpcAccessStateV18,
  agentId: string,
  pageTitle: string,
  currentWorldMinute: number,
  language: SecretLibrarySourceLanguageV18 = 'en',
): Promise<SecretLibraryExternalTextV18> {
  if (
    !canAgentEnterSecretLibraryV18(
      library,
      agentId,
      currentWorldMinute,
    )
  ) {
    throw new Error(
      `Agent ${agentId} has no active Secret Library access.`,
    );
  }

  const session =
    npcState.sessionsByAgentId[agentId];

  if (!session) {
    throw new Error(
      `Agent ${agentId} has no active search session.`,
    );
  }

  const text =
    await fetchRealHumanTextV18(
      pageTitle,
      language,
    );

  session.selectedTitle =
    text.title;

  session.activeText =
    text;

  session.lastStudyWorldMinute =
    currentWorldMinute;

  return text;
}

/**
 * NPC реально проводит время за чтением.
 */
export function studySecretLibraryTextV18(
  library: SecretLibraryStateV18,
  npcState: SecretLibraryNpcAccessStateV18,
  agentId: string,
  studyMinutes: number,
  currentWorldMinute: number,
): boolean {
  if (studyMinutes <= 0) {
    return false;
  }

  if (
    !canAgentEnterSecretLibraryV18(
      library,
      agentId,
      currentWorldMinute,
    )
  ) {
    return false;
  }

  const session =
    npcState.sessionsByAgentId[agentId];

  if (
    !session ||
    !session.activeText ||
    session.completed
  ) {
    return false;
  }

  const recorded =
    recordSecretLibraryStudyV18(
      library,
      agentId,
      studyMinutes,
    );

  if (!recorded) {
    return false;
  }

  session.totalStudyMinutes +=
    studyMinutes;

  session.lastStudyWorldMinute =
    currentWorldMinute;

  return true;
}

/**
 * Простая модель понимания.
 *
 * Пока без магии:
 * больше времени + грамотность + интеллект +
 * память + концентрация = больше понимания.
 */
export function calculateSecretLibraryUnderstandingV18(
  mind: Readonly<SecretLibraryNpcMindV18>,
  studyMinutes: number,
): number {
  const timeFactor =
    clamp01V18(studyMinutes / 240);

  const cognitiveFactor =
    clamp01V18(
      mind.intelligence * 0.30 +
      mind.literacy * 0.30 +
      mind.memory * 0.18 +
      mind.concentration * 0.14 +
      mind.curiosity * 0.08,
    );

  return clamp01V18(
    timeFactor * cognitiveFactor,
  );
}

/**
 * Берём небольшой фрагмент текста,
 * который можно считать тем,
 * что NPC реально удержал в памяти.
 *
 * Это временная реализация.
 * Позже можно сделать более умное смысловое извлечение.
 */
function buildRememberedTextV18(
  fullText: string,
  understanding: number,
): string {
  if (!fullText) {
    return '';
  }

  const maxLength =
    Math.max(
      200,
      Math.floor(
        2500 * understanding,
      ),
    );

  return fullText
    .slice(0, maxLength)
    .trim();
}

/**
 * Завершить изучение текущего текста.
 *
 * Знание появляется у NPC только здесь —
 * после реального времени чтения.
 */
export function finishSecretLibraryStudyV18(
  library: SecretLibraryStateV18,
  npcState: SecretLibraryNpcAccessStateV18,
  agentId: string,
  currentWorldMinute: number,
): SecretLibraryAcquiredKnowledgeV18 | null {
  const session =
    npcState.sessionsByAgentId[agentId];

  const mind =
    npcState.mindsByAgentId[agentId];

  if (
    !session ||
    !mind ||
    !session.activeText ||
    session.completed
  ) {
    return null;
  }

  const understanding =
    calculateSecretLibraryUnderstandingV18(
      mind,
      session.totalStudyMinutes,
    );

  /**
   * Слишком слабое понимание:
   * NPC читал, но полезного знания не вынес.
   */
  if (understanding < 0.08) {
    session.completed = true;
    return null;
  }

  const knowledgeId =
    [
      'secret-library',
      agentId,
      currentWorldMinute,
      mind.acquiredKnowledge.length + 1,
    ].join('-');

  const acquired:
    SecretLibraryAcquiredKnowledgeV18 = {
      id: knowledgeId,

      topic: session.query,

      sourceTitle:
        session.activeText.title,

      sourceUrl:
        session.activeText.sourceUrl,

      learnedAtWorldMinute:
        currentWorldMinute,

      understanding,

      rememberedText:
        buildRememberedTextV18(
          session.activeText.text,
          understanding,
        ),
    };

  mind.acquiredKnowledge.push(
    acquired,
  );

  session.completed = true;

  /**
   * Попытка записать факт обучения
   * также в состояние самой библиотеки.
   *
   * Если такого knowledgeId в библиотечном каталоге
   * нет, это не ломает личное знание NPC.
   */
  recordLearnedKnowledgeV18(
    library,
    agentId,
    knowledgeId,
  );

  return acquired;
}

/**
 * Получить все знания конкретного NPC,
 * полученные в Тайной библиотеке.
 */
export function getNpcSecretLibraryKnowledgeV18(
  npcState: Readonly<SecretLibraryNpcAccessStateV18>,
  agentId: string,
): readonly SecretLibraryAcquiredKnowledgeV18[] {
  return (
    npcState.mindsByAgentId[agentId]
      ?.acquiredKnowledge ?? []
  );
}

/**
 * NPC НЕ получает функцию fetch.
 *
 * Это отдельная явная гарантия архитектуры.
 */
export function npcHasDirectInternetAccessV18(): false {
  return false;
}

/**
 * NPC может распоряжаться уже усвоенным знанием
 * как хочет: применять, преподавать, обсуждать,
 * передавать детям и другим NPC.
 *
 * Библиотека больше этим не управляет.
 */
export function npcMayUseLearnedKnowledgeFreelyV18(): true {
  return true;
}
