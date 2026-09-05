/**
 * Ainkrad v18 — automatic Secret Library study.
 *
 * Этот модуль заставляет выбранных посетителей реально
 * пользоваться библиотекой:
 *
 * выбран NPC
 * -> выбирает тему на основе своей личности/целей
 * -> ищет настоящие человеческие тексты
 * -> читает
 * -> усваивает то, что смог понять
 *
 * Никакого прямого интернет-доступа NPC не получает.
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

function chooseStudyQuestionV18(
  agent: Readonly<AgentState>,
): string {
  /**
   * Сначала смотрим на текущую цель NPC.
   */
  switch (agent.goal.kind) {
    case 'secure_resources':
      return 'agriculture food storage irrigation farming';

    case 'contribute':
      return 'construction engineering masonry tools';

    case 'explore':
      return 'geography navigation maps astronomy travel';

    case 'seek_truth':
      return 'mathematics astronomy philosophy natural science';

    case 'build_family':
      return 'medicine childbirth hygiene food health';

    case 'connect':
      return 'trade law governance negotiation accounting';

    case 'recover':
      return 'medicine wounds hygiene healing';

    case 'reflect':
      return 'philosophy ethics governance mathematics';

    default:
      break;
  }

  /**
   * Если цель не дала хорошей темы —
   * используем характер и навыки.
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
        agent.progression?.combatMastery ?? 0,
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
    'general knowledge mathematics agriculture medicine engineering'
  );
}

function calculateStudyMinutesV18(
  agent: Readonly<AgentState>,
): number {
  /**
   * Одна учебная сессия:
   * примерно 2–8 игровых часов.
   */
  const baseMinutes = 120;

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
 * Запускаем одну учебную сессию
 * для всех текущих посетителей библиотеки.
 */
export async function runAutomaticSecretLibraryStudyV18(
  secretLibrary:
    SecretLibraryAgentStateV18,

  world:
    Readonly<WorldState>,
): Promise<
  SecretLibraryNpcCycleResultV18[]
> {
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
    /**
     * Закончил — больше не читаем.
     */
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

    /**
     * Пока английский Wikisource —
     * там выбор исторических текстов больше.
     */
    const result =
      await runSecretLibraryNpcCycleV18(
        secretLibrary,

        agent.id,

        currentWorldMinute,

        {
          question,

          language: 'en',

          studyMinutes,

          /**
           * После сессии NPC выходит.
           * Потом в течение месяца он может войти снова.
           */
          leaveAfterStudy: true,
        },
      );

    results.push(
      result,
    );
  }

  return results;
}
