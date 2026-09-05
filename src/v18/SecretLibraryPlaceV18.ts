/**
 * Ainkrad v18 — physical Secret Library place.
 *
 * Физическое представление Тайной библиотеки в мире.
 *
 * Правила:
 * - библиотека является настоящим местом на карте;
 * - располагается в юго-западной части стартового Ainkrad;
 * - не принадлежит поселению;
 * - книги нельзя вынести наружу;
 * - обычный NPC не получает доступ только потому,
 *   что физически дошёл до здания;
 * - доступ определяет SecretLibraryV18.
 */

import type {
  WorldPlace,
  WorldState,
} from '../world/types';

import type {
  SecretLibraryAgentStateV18,
} from './SecretLibraryAgentV18';

export const SECRET_LIBRARY_PLACE_ID_V18 =
  'secret_library_v18';

export const SECRET_LIBRARY_PLACE_NAME_V18 =
  'Тайная библиотека';

/**
 * Отступ от существующих границ мира.
 *
 * X ближе к западной границе.
 * Y ближе к южной границе.
 */
const SECRET_LIBRARY_WEST_OFFSET_V18 = 4;
const SECRET_LIBRARY_SOUTH_OFFSET_V18 = 4;

/**
 * Находим физические координаты библиотеки.
 *
 * Координаты вычисляются только при первом создании.
 * После этого библиотека остаётся на своём месте,
 * даже если мир расширяется дальше.
 */
export function calculateSecretLibraryPositionV18(
  world: Readonly<WorldState>,
): {
  mapX: number;
  mapY: number;
} {
  const ordinaryPlaces =
    Object.values(world.places).filter(
      (place) =>
        place.id !==
        SECRET_LIBRARY_PLACE_ID_V18,
    );

  if (ordinaryPlaces.length === 0) {
    return {
      mapX: -20,
      mapY: 20,
    };
  }

  const minX =
    Math.min(
      ...ordinaryPlaces.map(
        (place) => place.mapX,
      ),
    );

  const maxY =
    Math.max(
      ...ordinaryPlaces.map(
        (place) => place.mapY,
      ),
    );

  return {
    /**
     * Немного левее основной освоенной территории.
     */
    mapX:
      minX -
      SECRET_LIBRARY_WEST_OFFSET_V18,

    /**
     * Ниже основной освоенной территории.
     */
    mapY:
      maxY +
      SECRET_LIBRARY_SOUTH_OFFSET_V18,
  };
}

/**
 * Создаёт настоящее WorldPlace.
 *
 * Используем kind = ruins, потому что старый WorldPlaceKind
 * пока не содержит отдельного secret_library.
 *
 * Благодаря отдельному ID UI всё равно сможет
 * рисовать библиотеку своим символом и названием.
 */
export function createSecretLibraryWorldPlaceV18(
  world: Readonly<WorldState>,
): WorldPlace {
  const position =
    calculateSecretLibraryPositionV18(
      world,
    );

  return {
    id:
      SECRET_LIBRARY_PLACE_ID_V18,

    name:
      SECRET_LIBRARY_PLACE_NAME_V18,

    kind:
      'ruins',

    capacity:
      6,

    biome:
      'ancient_ruins',

    mapX:
      position.mapX,

    mapY:
      position.mapY,

    connectedPlaceIds:
      [],

    /**
     * Библиотека не является местом добычи пищи.
     */
    fertility:
      0,

    /**
     * Само здание не наносит урон.
     *
     * Ограничение доступа реализуется библиотечным агентом,
     * а не показателем danger.
     */
    danger:
      0,

    surface:
      'land',

    /**
     * Это независимое место.
     * Не принадлежит городу или деревне.
     */
    settlementId:
      undefined,

    claimedBySettlementId:
      undefined,

    /**
     * Библиотека известна миру с самого начала.
     */
    discoveredAt:
      0,
  };
}

/**
 * Полная информация, которую UI должен показывать
 * при нажатии на здание.
 */
export interface SecretLibraryInspectorV18 {
  placeId: string;

  name: string;

  status:
    | 'Закрыта'
    | 'Выбор посетителей'
    | 'Открыта';

  currentYear: number;

  visitorLimit: number;

  selectedVisitors: Array<{
    agentId: string;

    agentName: string;

    status:
      | 'Выбран'
      | 'В библиотеке'
      | 'Временно вышел'
      | 'Закончил';

    studyMinutes: number;

    studyHours: number;

    learnedCount: number;

    learnedKnowledge: Array<{
      topic: string;

      sourceTitle: string;

      sourceUrl: string;

      understandingPercent: number;

      rememberedText: string;
    }>;
  }>;

  totalStudyMinutes: number;

  totalStudyHours: number;

  totalLearnedKnowledge: number;

  booksKnownToLibrary: number;

  externalAccess: {
    enabled: boolean;

    source:
      'Wikisource';

    directNpcInternetAccess:
      false;
  };

  rules: string[];
}

function visitorStatusLabelV18(
  status:
    | 'selected'
    | 'inside'
    | 'temporarily_outside'
    | 'finished',
):
  | 'Выбран'
  | 'В библиотеке'
  | 'Временно вышел'
  | 'Закончил' {
  switch (status) {
    case 'selected':
      return 'Выбран';

    case 'inside':
      return 'В библиотеке';

    case 'temporarily_outside':
      return 'Временно вышел';

    case 'finished':
      return 'Закончил';
  }
}

function libraryStatusLabelV18(
  status:
    | 'closed'
    | 'selection'
    | 'open',
):
  | 'Закрыта'
  | 'Выбор посетителей'
  | 'Открыта' {
  switch (status) {
    case 'closed':
      return 'Закрыта';

    case 'selection':
      return 'Выбор посетителей';

    case 'open':
      return 'Открыта';
  }
}

/**
 * Строим живой отчёт для клика по библиотеке.
 *
 * Здесь отображается реальное состояние,
 * а не декоративная заглушка.
 */
export function inspectSecretLibraryPlaceV18(
  world:
    Readonly<WorldState>,

  secretLibrary:
    Readonly<SecretLibraryAgentStateV18>,
): SecretLibraryInspectorV18 {
  const visitors =
    secretLibrary.library.visitors.map(
      (visitor) => {
        const agent =
          world.agents[
            visitor.agentId
          ];

        const mind =
          secretLibrary.npcAccess
            .mindsByAgentId[
              visitor.agentId
            ];

        const acquiredKnowledge =
          mind?.acquiredKnowledge ??
          [];

        return {
          agentId:
            visitor.agentId,

          agentName:
            agent?.name ??
            visitor.agentId,

          status:
            visitorStatusLabelV18(
              visitor.status,
            ),

          studyMinutes:
            visitor.studyMinutes,

          studyHours:
            Math.round(
              (
                visitor.studyMinutes /
                60
              ) *
                10,
            ) / 10,

          learnedCount:
            acquiredKnowledge.length,

          learnedKnowledge:
            acquiredKnowledge.map(
              (knowledge) => ({
                topic:
                  knowledge.topic,

                sourceTitle:
                  knowledge.sourceTitle,

                sourceUrl:
                  knowledge.sourceUrl,

                understandingPercent:
                  Math.round(
                    knowledge
                      .understanding *
                      100,
                  ),

                rememberedText:
                  knowledge
                    .rememberedText,
              }),
            ),
        };
      },
    );

  const totalStudyMinutes =
    visitors.reduce(
      (
        total,
        visitor,
      ) =>
        total +
        visitor.studyMinutes,
      0,
    );

  const totalLearnedKnowledge =
    visitors.reduce(
      (
        total,
        visitor,
      ) =>
        total +
        visitor.learnedCount,
      0,
    );

  return {
    placeId:
      SECRET_LIBRARY_PLACE_ID_V18,

    name:
      SECRET_LIBRARY_PLACE_NAME_V18,

    status:
      libraryStatusLabelV18(
        secretLibrary.library
          .status,
      ),

    currentYear:
      secretLibrary.library
        .currentAccessYear,

    visitorLimit:
      5,

    selectedVisitors:
      visitors,

    totalStudyMinutes,

    totalStudyHours:
      Math.round(
        (
          totalStudyMinutes /
          60
        ) *
          10,
      ) / 10,

    totalLearnedKnowledge,

    booksKnownToLibrary:
      secretLibrary.library
        .books.length,

    externalAccess: {
      enabled:
        true,

      source:
        'Wikisource',

      directNpcInternetAccess:
        false,
    },

    rules: [
      'Библиотека открывается один раз в игровой год.',
      'Право доступа получают максимум пять NPC.',
      'Период доступа длится один игровой месяц.',
      'Посетители могут выходить для сна, еды и бытовых нужд.',
      'После окончания месяца библиотека закрывается до следующего года.',
      'Книги нельзя вынести из Тайной библиотеки.',
      'NPC может распоряжаться усвоенными знаниями свободно.',
      'Прямого доступа NPC к интернету нет.',
    ],
  };
}

/**
 * Проверка специального места без изменения WorldPlaceKind.
 */
export function isSecretLibraryPlaceV18(
  placeId: string,
): boolean {
  return (
    placeId ===
    SECRET_LIBRARY_PLACE_ID_V18
  );
}
