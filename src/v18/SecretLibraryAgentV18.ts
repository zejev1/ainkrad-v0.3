/**
 * Ainkrad v18 — Secret Library autonomous agent.
 *
 * Этот файл собирает все ранее созданные модули Тайной библиотеки
 * в один автономный цикл:
 *
 * новый игровой год
 * -> открыть месячное окно
 * -> выбрать до 5 NPC
 * -> допустить их к библиотеке
 * -> дать им искать реальные человеческие тексты
 * -> читать
 * -> усваивать знания
 * -> закрыть библиотеку до следующего года
 *
 * Старые файлы Ainkrad этот модуль не меняет.
 */

import {
  createSecretLibraryV18,
  openSecretLibraryForYearV18,
  enterSecretLibraryV18,
  temporarilyLeaveSecretLibraryV18,
  updateSecretLibraryAccessV18,
  type SecretLibraryStateV18,
} from './SecretLibraryV18';

import {
  createSecretLibraryNpcAccessStateV18,
  askSecretLibraryV18,
  selectSecretLibraryTextV18,
  studySecretLibraryTextV18,
  finishSecretLibraryStudyV18,
  type SecretLibraryNpcAccessStateV18,
  type SecretLibraryAcquiredKnowledgeV18,
} from './SecretLibraryNpcAccessV18';

import {
  selectSecretLibraryVisitorsV18,
  type SecretLibraryCandidateV18,
  type SecretLibrarySelectionResultV18,
} from './SecretLibrarySelectionV18';

import type {
  SecretLibrarySourceLanguageV18,
  SecretLibrarySearchResultV18,
} from './SecretLibraryGatewayV18';

export interface SecretLibraryAgentStateV18 {
  library: SecretLibraryStateV18;

  npcAccess:
    SecretLibraryNpcAccessStateV18;

  /**
   * Последний игровой год,
   * который агент обработал.
   */
  lastProcessedWorldYear: number;

  /**
   * История ежегодных выборов посетителей.
   */
  annualSelections:
    SecretLibrarySelectionResultV18[];

  /**
   * Максимум сохранённых записей.
   * Нужен, чтобы лог не рос бесконечно.
   */
  maxSelectionHistory: number;
}

export interface SecretLibraryWorldClockV18 {
  worldYear: number;

  currentWorldMinute: number;

  minutesPerWorldYear: number;
}

export interface SecretLibraryStudyDecisionV18 {
  /**
   * NPC сам формулирует тему поиска.
   */
  question: string;

  /**
   * Язык внешнего источника.
   * По умолчанию английский Wikisource.
   */
  language?: SecretLibrarySourceLanguageV18;

  /**
   * Какой найденный текст выбрать.
   *
   * Если не задано —
   * агент возьмёт первый найденный результат.
   */
  preferredTitle?: string;

  /**
   * Сколько игровых минут читать в этом цикле.
   */
  studyMinutes: number;

  /**
   * После чтения NPC может временно выйти.
   */
  leaveAfterStudy?: boolean;
}

export interface SecretLibraryNpcCycleResultV18 {
  agentId: string;

  entered: boolean;

  question?: string;

  searchResults?: SecretLibrarySearchResultV18[];

  selectedTitle?: string;

  studiedMinutes: number;

  learned?: SecretLibraryAcquiredKnowledgeV18 | null;

  temporarilyLeft: boolean;

  error?: string;
}

/**
 * Создать полностью автономное состояние агента.
 */
export function createSecretLibraryAgentV18(
  initialWorldYear = 0,
): SecretLibraryAgentStateV18 {
  return {
    library:
      createSecretLibraryV18(
        initialWorldYear,
      ),

    npcAccess:
      createSecretLibraryNpcAccessStateV18(),

    lastProcessedWorldYear:
      initialWorldYear,

    annualSelections: [],

    maxSelectionHistory: 64,
  };
}

/**
 * Новый год:
 *
 * - библиотека открывает месячное окно;
 * - получает список кандидатов мира;
 * - выбирает максимум 5;
 * - начинает период доступа.
 */
export function beginSecretLibraryYearV18(
  state: SecretLibraryAgentStateV18,
  clock: Readonly<SecretLibraryWorldClockV18>,
  candidates:
    readonly SecretLibraryCandidateV18[],
): SecretLibrarySelectionResultV18 | null {
  if (
    clock.worldYear <=
    state.lastProcessedWorldYear
  ) {
    return null;
  }

  /**
   * На всякий случай закрываем старое окно,
   * если движок перескочил далеко вперёд.
   */
  updateSecretLibraryAccessV18(
    state.library,
    clock.currentWorldMinute,
  );

  const opened =
    openSecretLibraryForYearV18(
      state.library,
      clock.worldYear,
      clock.currentWorldMinute,
      clock.minutesPerWorldYear,
    );

  state.lastProcessedWorldYear =
    clock.worldYear;

  if (!opened) {
    return null;
  }

  const selection =
    selectSecretLibraryVisitorsV18(
      state.library,
      state.npcAccess,
      candidates,
    );

  state.annualSelections.push(
    selection,
  );

  if (
    state.annualSelections.length >
    state.maxSelectionHistory
  ) {
    state.annualSelections.splice(
      0,
      state.annualSelections.length -
        state.maxSelectionHistory,
    );
  }

  return selection;
}

/**
 * Проверяем, не закончился ли месяц библиотеки.
 */
export function tickSecretLibraryAgentV18(
  state: SecretLibraryAgentStateV18,
  currentWorldMinute: number,
): void {
  updateSecretLibraryAccessV18(
    state.library,
    currentWorldMinute,
  );
}

/**
 * Полный цикл одного NPC:
 *
 * вошёл
 * -> сформулировал вопрос
 * -> получил реальные результаты
 * -> выбрал книгу
 * -> прочитал
 * -> попытался усвоить
 * -> при желании вышел
 *
 * Эта функция не заставляет NPC выбрать тему.
 * decision должен приходить от его собственной логики.
 */
export async function runSecretLibraryNpcCycleV18(
  state: SecretLibraryAgentStateV18,
  agentId: string,
  currentWorldMinute: number,
  decision:
    Readonly<SecretLibraryStudyDecisionV18>,
): Promise<SecretLibraryNpcCycleResultV18> {
  const result:
    SecretLibraryNpcCycleResultV18 = {
      agentId,
      entered: false,
      studiedMinutes: 0,
      temporarilyLeft: false,
    };

  try {
    const entered =
      enterSecretLibraryV18(
        state.library,
        agentId,
        currentWorldMinute,
      );

    if (!entered) {
      return result;
    }

    result.entered = true;

    const question =
      decision.question.trim();

    if (!question) {
      return result;
    }

    result.question =
      question;

    const language =
      decision.language ?? 'en';

    const searchResults =
      await askSecretLibraryV18(
        state.library,
        state.npcAccess,
        agentId,
        question,
        currentWorldMinute,
        language,
      );

    result.searchResults =
      searchResults;

    if (
      searchResults.length === 0
    ) {
      return result;
    }

    let selectedTitle =
      decision.preferredTitle;

    if (selectedTitle) {
      const exact =
        searchResults.find(
          (entry) =>
            entry.title ===
            selectedTitle,
        );

      if (!exact) {
        selectedTitle =
          searchResults[0].title;
      }
    } else {
      selectedTitle =
        searchResults[0].title;
    }

    result.selectedTitle =
      selectedTitle;

    await selectSecretLibraryTextV18(
      state.library,
      state.npcAccess,
      agentId,
      selectedTitle,
      currentWorldMinute,
      language,
    );

    const studyMinutes =
      Math.max(
        0,
        Math.floor(
          decision.studyMinutes,
        ),
      );

    if (studyMinutes > 0) {
      const studied =
        studySecretLibraryTextV18(
          state.library,
          state.npcAccess,
          agentId,
          studyMinutes,
          currentWorldMinute,
        );

      if (studied) {
        result.studiedMinutes =
          studyMinutes;
      }
    }

    /**
     * Пока завершаем одну учебную сессию
     * после данного чтения.
     *
     * Если понимания недостаточно,
     * вернётся null.
     */
    result.learned =
      finishSecretLibraryStudyV18(
        state.library,
        state.npcAccess,
        agentId,
        currentWorldMinute,
      );

    if (
      decision.leaveAfterStudy === true
    ) {
      result.temporarilyLeft =
        temporarilyLeaveSecretLibraryV18(
          state.library,
          agentId,
          currentWorldMinute,
        );
    }

    return result;
  } catch (error) {
    result.error =
      error instanceof Error
        ? error.message
        : String(error);

    return result;
  }
}

/**
 * Получить все знания,
 * которые конкретный NPC вынес из Тайной библиотеки.
 */
export function getSecretLibraryKnowledgeForNpcV18(
  state:
    Readonly<SecretLibraryAgentStateV18>,
  agentId: string,
): readonly SecretLibraryAcquiredKnowledgeV18[] {
  return (
    state.npcAccess
      .mindsByAgentId[agentId]
      ?.acquiredKnowledge ?? []
  );
}

/**
 * Сколько мест использовано в текущем году.
 */
export function getSecretLibraryVisitorCountV18(
  state:
    Readonly<SecretLibraryAgentStateV18>,
): number {
  return state.library.visitors.length;
}

/**
 * Открыта ли библиотека прямо сейчас.
 */
export function isSecretLibraryOpenV18(
  state:
    Readonly<SecretLibraryAgentStateV18>,
  currentWorldMinute: number,
): boolean {
  if (
    state.library.status !== 'open'
  ) {
    return false;
  }

  const closesAt =
    state.library.closesAtWorldMinute;

  if (closesAt === undefined) {
    return false;
  }

  return (
    currentWorldMinute <
    closesAt
  );
}
