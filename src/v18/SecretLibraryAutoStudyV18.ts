/**
 * Ainkrad v18 — automatic Secret Library study.
 *
 * Этот модуль:
 * - заставляет выбранных NPC реально пользоваться библиотекой;
 * - выбирает тему на основе характера и текущей цели;
 * - читает настоящие человеческие источники;
 * - отправляет живую телеметрию в здание Тайной библиотеки на карте.
 */

import type {
  WorldState,
  AgentState,
} from '../world/types';

import {
  runSecretLibraryNpcCycleV18,
  type SecretLibraryAgentStateV18,
  type SecretLibraryNpcCycleResultV18,
} from './SecretLibraryAgentV18';

import {
  inspectSecretLibraryPlaceV18,
} from './SecretLibraryPlaceV18';

const SECRET_LIBRARY_CHANNEL_V18 =
  'ainkrad-secret-library-v18';

/**
 * Отправляем текущее состояние библиотеки
 * визуальному модулю карты.
 *
 * Работает между worker и браузерным UI
 * через BroadcastChannel.
 */
function publishSecretLibraryTelemetryV18(
  secretLibrary:
    Readonly<SecretLibraryAgentStateV18>,

  world:
    Readonly<WorldState>,
): void {
  if (
    typeof BroadcastChannel ===
    'undefined'
  ) {
    return;
  }

  try {
    const inspector =
      inspectSecretLibraryPlaceV18(
        world,
        secretLibrary,
      );

    const channel =
      new BroadcastChannel(
        SECRET_LIBRARY_CHANNEL_V18,
      );

    channel.postMessage(
      inspector,
    );

    channel.close();
  } catch {
    /**
     * Ошибка панели никогда не должна
     * ломать сам мир.
     */
  }
}

function chooseStudyQuestionV18(
  agent:
    Readonly<AgentState>,
): string {
  /**
   * Сначала смотрим на настоящую
   * текущую цель NPC.
   */
  switch (agent.goal.kind) {
    case 'secure_resources':
      return (
        'agriculture farming crop rotation ' +
        'irrigation grain storage'
      );

    case 'contribute':
      return (
        'construction architecture engineering ' +
        'masonry tools'
      );

    case 'explore':
      return (
        'geography navigation maps astronomy travel'
      );

    case 'seek_truth':
      return (
        'mathematics astronomy natural philosophy science'
      );

    case 'build_family':
      return (
        'medicine hygiene childbirth health nutrition'
      );

    case 'connect':
      return (
        'trade accounting law governance negotiation'
      );

    case 'recover':
      return (
        'medicine wounds hygiene healing'
      );

    case 'reflect':
      return (
        'philosophy ethics governance mathematics'
      );

    default:
      break;
  }

  /**
   * Запасной выбор на основе личности
   * и реальных навыков NPC.
   */
  const candidates: Array<{
    score: number;
    question: string;
  }> = [
    {
      score:
        agent.personality.curiosity +
        agent.mind.values.knowledge,

      question:
        'mathematics astronomy natural philosophy science',
    },

    {
      score:
        agent.skills.craft +
        agent.personality.diligence,

      question:
        'engineering construction metallurgy tools architecture',
    },

    {
      score:
        agent.skills.gathering +
        agent.mind.values.care,

      question:
        'agriculture crops soil irrigation food storage',
    },

    {
      score:
        agent.skills.exploration +
        agent.personality.riskTolerance,

      question:
        'navigation geography maps astronomy travel',
    },

    {
      score:
        agent.skills.social +
        agent.personality.sociability,

      question:
        'trade economics accounting law governance',
    },

    {
      score:
        agent.mind.values.care +
        agent.personality.generosity,

      question:
        'medicine hygiene wounds childbirth health',
    },

    {
      score:
        agent.progression
          ?.combatMastery ??
        0,

      question:
        'military logistics fortification tactics organization',
    },
  ];

  candidates.sort(
    (a, b) =>
      b.score - a.score,
  );

  return (
    candidates[0]?.question ??
    'mathematics agriculture medicine engineering'
  );
}

function calculateStudyMinutesV18(
  agent:
    Readonly<AgentState>,
): number {
  const baseMinutes =
    120;

  const diligenceBonus =
    agent.personality.diligence *
    180;

  const curiosityBonus =
    agent.personality.curiosity *
    120;

  const energyPenalty =
    Math.max(
      0,
      1 - agent.energy,
    ) * 120;

  return Math.max(
    60,

    Math.min(
      480,

      Math.floor(
        baseMinutes +
        diligenceBonus +
        curiosityBonus -
        energyPenalty,
      ),
    ),
  );
}

/**
 * Запускает автоматическое обучение
 * текущих посетителей.
 */
export async function runAutomaticSecretLibraryStudyV18(
  secretLibrary:
    SecretLibraryAgentStateV18,

  world:
    Readonly<WorldState>,
): Promise<
  SecretLibraryNpcCycleResultV18[]
> {
  /**
   * Сначала отправляем состояние всегда —
   * даже когда библиотека закрыта.
   *
   * Поэтому на карте будет видно:
   * "Закрыта",
   * "Выбор посетителей"
   * или "Открыта".
   */
  publishSecretLibraryTelemetryV18(
    secretLibrary,
    world,
  );

  if (
    secretLibrary.library.status !==
    'open'
  ) {
    return [];
  }

  const currentWorldMinute =
    world.calendar
      .elapsedWorldMinutes;

  const results:
    SecretLibraryNpcCycleResultV18[] =
    [];

  for (
    const visitor of
    secretLibrary.library.visitors
  ) {
    if (
      visitor.status ===
      'finished'
    ) {
      continue;
    }

    const agent =
      world.agents[
        visitor.agentId
      ];

    if (
      !agent ||
      !agent.life.alive
    ) {
      continue;
    }

    const question =
      chooseStudyQuestionV18(
        agent,
      );

    const studyMinutes =
      calculateStudyMinutesV18(
        agent,
      );

    const result =
      await runSecretLibraryNpcCycleV18(
        secretLibrary,

        agent.id,

        currentWorldMinute,

        {
          question,

          language:
            'en',

          studyMinutes,

          leaveAfterStudy:
            true,
        },
      );

    results.push(
      result,
    );

    /**
     * После каждого NPC обновляем панель,
     * чтобы на экране сразу появились:
     *
     * книга,
     * тема,
     * время,
     * понимание,
     * усвоенный текст.
     */
    publishSecretLibraryTelemetryV18(
      secretLibrary,
      world,
    );
  }

  /**
   * Финальный снимок после всей пятёрки.
   */
  publishSecretLibraryTelemetryV18(
    secretLibrary,
    world,
  );

  return results;
}
