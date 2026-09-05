/**
 * Ainkrad v18 — Secret Library annual visitor selection.
 *
 * Раз в игровой год Тайная библиотека выбирает
 * максимум 5 живых NPC.
 *
 * Выбор не является приказом Cardinal.
 * Это право доступа к библиотеке.
 */

import type {
  SecretLibraryStateV18,
} from './SecretLibraryV18';

import {
  SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18,
  grantSecretLibraryAccessV18,
  beginSecretLibraryStudyPeriodV18,
} from './SecretLibraryV18';

import type {
  SecretLibraryNpcAccessStateV18,
  SecretLibraryNpcMindV18,
} from './SecretLibraryNpcAccessV18';

import {
  ensureSecretLibraryNpcMindV18,
} from './SecretLibraryNpcAccessV18';

export interface SecretLibraryCandidateV18 {
  agentId: string;

  alive: boolean;

  /**
   * Возраст NPC.
   */
  ageYears: number;

  /**
   * Значения 0..1.
   */
  intelligence: number;
  curiosity: number;
  literacy: number;
  memory: number;
  concentration: number;
}

export interface SecretLibrarySelectionResultV18 {
  year: number;

  selectedAgentIds: string[];

  rejectedAgentIds: string[];
}

function clamp01V18(value: number): number {
  return Math.max(
    0,
    Math.min(1, value),
  );
}

/**
 * Минимальные условия.
 *
 * Мы пока не делаем библиотеку элитным университетом.
 * Даже не очень грамотный NPC может попасть внутрь.
 */
export function isEligibleForSecretLibraryV18(
  candidate: Readonly<SecretLibraryCandidateV18>,
): boolean {
  if (!candidate.alive) {
    return false;
  }

  /**
   * Маленьких детей пока не пускаем.
   */
  if (candidate.ageYears < 10) {
    return false;
  }

  return true;
}

/**
 * Насколько NPC естественно подходит для посещения.
 *
 * Это не "рейтинг достоинства".
 * Это вероятность того, что он действительно
 * сможет воспользоваться редким шансом.
 */
export function calculateSecretLibraryCandidateScoreV18(
  candidate: Readonly<SecretLibraryCandidateV18>,
): number {
  const intelligence =
    clamp01V18(candidate.intelligence);

  const curiosity =
    clamp01V18(candidate.curiosity);

  const literacy =
    clamp01V18(candidate.literacy);

  const memory =
    clamp01V18(candidate.memory);

  const concentration =
    clamp01V18(candidate.concentration);

  return (
    curiosity * 0.30 +
    intelligence * 0.25 +
    literacy * 0.18 +
    memory * 0.14 +
    concentration * 0.13
  );
}

/**
 * Добавляем случайность.
 *
 * Без неё одна и та же пятёрка самых умных
 * могла бы ходить в библиотеку каждый год.
 *
 * Поэтому способный NPC имеет преимущество,
 * но шанс получают и остальные.
 */
function calculateAnnualSelectionWeightV18(
  candidate: Readonly<SecretLibraryCandidateV18>,
): number {
  const ability =
    calculateSecretLibraryCandidateScoreV18(
      candidate,
    );

  const randomFactor =
    Math.random() * 0.45;

  return (
    ability * 0.75 +
    randomFactor
  );
}

/**
 * NPC, уже ходивший раньше, получает небольшой штраф.
 *
 * Это не запрет повторного входа.
 * Он может попасть туда снова в будущем.
 *
 * Но библиотека старается распространять знания
 * между большим количеством людей.
 */
function previousKnowledgePenaltyV18(
  mind:
    | Readonly<SecretLibraryNpcMindV18>
    | undefined,
): number {
  if (!mind) {
    return 0;
  }

  const visits =
    mind.acquiredKnowledge.length;

  return Math.min(
    0.35,
    visits * 0.04,
  );
}

/**
 * Выбираем до пяти NPC.
 */
export function selectSecretLibraryVisitorsV18(
  library: SecretLibraryStateV18,
  npcState: SecretLibraryNpcAccessStateV18,
  candidates:
    readonly SecretLibraryCandidateV18[],
): SecretLibrarySelectionResultV18 {
  const eligible =
    candidates.filter(
      isEligibleForSecretLibraryV18,
    );

  const ranked =
    eligible
      .map((candidate) => {
        const mind =
          npcState.mindsByAgentId[
            candidate.agentId
          ];

        return {
          candidate,

          score:
            calculateAnnualSelectionWeightV18(
              candidate,
            ) -
            previousKnowledgePenaltyV18(
              mind,
            ),
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score,
      );

  const selected =
    ranked.slice(
      0,
      SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18,
    );

  const selectedAgentIds: string[] = [];

  for (const entry of selected) {
    const candidate =
      entry.candidate;

    /**
     * Создаём библиотечную модель сознания NPC,
     * если он раньше туда не попадал.
     */
    const mind =
      ensureSecretLibraryNpcMindV18(
        npcState,
        candidate.agentId,
      );

    /**
     * Переносим реальные характеристики NPC
     * в модель чтения библиотеки.
     */
    mind.intelligence =
      clamp01V18(
        candidate.intelligence,
      );

    mind.curiosity =
      clamp01V18(
        candidate.curiosity,
      );

    mind.literacy =
      clamp01V18(
        candidate.literacy,
      );

    mind.memory =
      clamp01V18(
        candidate.memory,
      );

    mind.concentration =
      clamp01V18(
        candidate.concentration,
      );

    const granted =
      grantSecretLibraryAccessV18(
        library,
        candidate.agentId,
      );

    if (granted) {
      selectedAgentIds.push(
        candidate.agentId,
      );
    }
  }

  /**
   * Если выбран хотя бы один посетитель —
   * начинается месячное окно обучения.
   */
  if (
    selectedAgentIds.length > 0
  ) {
    beginSecretLibraryStudyPeriodV18(
      library,
    );
  }

  const selectedSet =
    new Set(selectedAgentIds);

  return {
    year:
      library.currentAccessYear,

    selectedAgentIds,

    rejectedAgentIds:
      eligible
        .map(
          (candidate) =>
            candidate.agentId,
        )
        .filter(
          (agentId) =>
            !selectedSet.has(agentId),
        ),
  };
}

/**
 * Удобная функция для проверки,
 * выбран ли конкретный NPC в этом году.
 */
export function wasSelectedForSecretLibraryV18(
  library:
    Readonly<SecretLibraryStateV18>,
  agentId: string,
): boolean {
  return library.visitors.some(
    (visitor) =>
      visitor.agentId === agentId,
  );
}
