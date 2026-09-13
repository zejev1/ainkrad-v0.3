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
import {
  shareSecretLibraryKnowledgeV18,
  type SecretLibraryKnowledgeRecordV18,
} from './SecretLibraryV18';

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
  const learned = state.v18?.secretLibrary.knowledgeByAgentId[speaker.id] ?? [];
  const knows = (...categories: SecretLibraryKnowledgeRecordV18['category'][]): boolean =>
    learned.some(
      (record) => record.understanding >= 0.22 && categories.includes(record.category),
    );
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
        (knows('construction', 'craft', 'metallurgy', 'engineering') ? 0.14 : 0) +
        speaker.personality.diligence * 0.12,
    },
    {
      topic: 'resources',
      weight:
        0.05 +
        (1 - speaker.resources) * 0.48 +
        (knows('agriculture', 'economics', 'trade', 'logistics') ? 0.14 : 0) +
        (lifecycle?.resourcePressure ?? 0) * 0.38,
    },
    {
      topic: 'travel',
      weight:
        0.04 +
        speaker.personality.curiosity * 0.18 +
        (knows('navigation', 'astronomy') ? 0.18 : 0) +
        (speaker.goal.kind === 'explore' || speaker.lastAction === 'explore'
          ? 0.64
          : 0),
    },
    {
      topic: 'danger',
      weight:
        0.03 +
        speaker.mind.emotions.fear * 0.42 +
        (knows('military', 'medicine', 'logistics') ? 0.12 : 0) +
        speaker.stress * 0.2 +
        (lifecycle?.dangerPressure ?? 0) * 0.4,
    },
    {
      topic: 'learning',
      weight:
        0.04 +
        speaker.mind.values.knowledge * 0.24 +
        speaker.personality.curiosity * 0.12 +
        Math.min(0.32, learned.filter((record) => record.understanding >= 0.22).length * 0.035),
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
        (knows('governance', 'law', 'construction', 'logistics') ? 0.12 : 0) +
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

function stableUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function pick<T>(values: readonly T[], seed: string, salt: string): T {
  const index = Math.floor(stableUnit(`${seed}:${salt}`) * values.length);
  return values[Math.min(values.length - 1, index)];
}

function actionLabel(action: string | undefined): string {
  const labels: Readonly<Record<string, string>> = {
    rest: 'восстанавливал силы',
    relax: 'гулял и отдыхал',
    walk: 'осматривал окрестности',
    gather: 'добывал припасы',
    hunt: 'охотился',
    work: 'работал руками',
    socialize: 'разговаривал с людьми',
    help: 'помогал соседу',
    explore: 'исследовал дорогу',
    reflect: 'обдумывал увиденное',
    bond: 'проводил время с близким человеком',
    pray: 'искал смысл в тишине',
  };
  return labels[action ?? ''] ?? 'занимался своими делами';
}

function personalManner(speaker: Readonly<AgentState>): string {
  const traits = [
    ['curiosity', speaker.personality.curiosity],
    ['diligence', speaker.personality.diligence],
    ['sociability', speaker.personality.sociability],
    ['generosity', speaker.personality.generosity],
    ['resilience', speaker.personality.resilience],
    ['risk', speaker.personality.riskTolerance],
  ] as const;
  const strongest = [...traits].sort((left, right) => right[1] - left[1])[0][0];
  switch (strongest) {
    case 'curiosity': return 'Мне важно докопаться до причины.';
    case 'diligence': return 'Я предпочитаю проверять мысль делом.';
    case 'sociability': return 'Мне легче понять это в разговоре.';
    case 'generosity': return 'Хочу, чтобы от решения была польза не только мне.';
    case 'resilience': return 'Даже если не выйдет сразу, я попробую ещё.';
    case 'risk': return 'Я готов рискнуть, если вижу смысл.';
  }
}

function knowledgeCategoriesForTopic(
  topic: V18ConversationTopic,
): readonly SecretLibraryKnowledgeRecordV18['category'][] {
  switch (topic) {
    case 'work':
      return ['construction', 'craft', 'metallurgy', 'engineering', 'mathematics'];
    case 'resources':
      return ['agriculture', 'economics', 'trade', 'logistics'];
    case 'travel':
      return ['navigation', 'astronomy', 'logistics'];
    case 'danger':
      return ['military', 'medicine', 'logistics'];
    case 'settlement':
      return ['governance', 'law', 'construction', 'logistics', 'economics'];
    case 'family':
      return ['medicine', 'education', 'law'];
    case 'belief':
      return ['philosophy', 'writing', 'astronomy'];
    case 'conflict':
      return ['law', 'governance', 'philosophy'];
    case 'learning':
      return [
        'agriculture', 'medicine', 'construction', 'mathematics', 'economics',
        'trade', 'craft', 'metallurgy', 'navigation', 'astronomy', 'biology',
        'chemistry', 'physics', 'engineering', 'governance', 'law', 'military',
        'logistics', 'education', 'writing', 'philosophy',
      ];
    case 'daily_life':
      return [];
  }
}

function knowledgeForConversation(
  state: Readonly<WorldState>,
  speakerId: string,
  topic: V18ConversationTopic,
  seed: string,
): SecretLibraryKnowledgeRecordV18 | undefined {
  const categories = knowledgeCategoriesForTopic(topic);
  if (categories.length === 0) return undefined;
  const records = (state.v18?.secretLibrary.knowledgeByAgentId[speakerId] ?? [])
    .filter(
      (record) =>
        record.understanding >= 0.22 && categories.includes(record.category),
    )
    .sort((left, right) =>
      right.understanding - left.understanding ||
      left.knowledgeId.localeCompare(right.knowledgeId),
    )
    .slice(0, 8);
  return records.length > 0 ? pick(records, seed, 'knowledge') : undefined;
}

function knowledgeObservation(
  knowledge: Readonly<SecretLibraryKnowledgeRecordV18> | undefined,
): string | undefined {
  if (!knowledge) return undefined;
  const concept = knowledge.concepts[0] ?? 'главная мысль';
  return `В «${knowledge.title}» я прочитал о том, что такое «${concept}». Пока хочу проверить это на деле.`;
}

function utterancesForTopic(
  topic: V18ConversationTopic,
  tone: V18ConversationTone,
  speaker: Readonly<AgentState>,
  listener: Readonly<AgentState>,
  placeName: string,
  lifecycleDeparturePressure: number,
  seed: string,
  knowledge: Readonly<SecretLibraryKnowledgeRecordV18> | undefined,
): { utterance: string; reply: string } {
  const manner = personalManner(speaker);
  const learned = knowledgeObservation(knowledge);
  const tenseReplies = [
    `Я услышал тебя, ${speaker.name}, но мне нужно всё обдумать.`,
    'Сейчас я не согласен. Вернёмся к этому без крика.',
    'Мне нужны доказательства, прежде чем я приму эту мысль.',
    'Давай остановимся: я не хочу отвечать сгоряча.',
  ];
  const tenseReply = pick(tenseReplies, seed, 'tense-reply');
  const compose = (
    openings: readonly string[],
    details: readonly string[],
    questions: readonly string[],
  ): string => [
    pick(openings, seed, 'opening'),
    knowledge && learned && details.includes(learned)
      ? learned
      : pick(details, seed, 'detail'),
    pick(questions, seed, 'question'),
  ].filter(Boolean).join(' ');

  switch (topic) {
    case 'family': {
      const children = speaker.life.childIds.length;
      return {
        utterance: compose(
          [
            `${listener.name}, я снова думаю о близких.`,
            'Сегодня разговор о семье не выходит у меня из головы.',
            'Мне хочется понять, каким должен быть наш дом для детей.',
            'Семейные решения кажутся мне важнее обычной суеты.',
          ],
          [
            children > 0
              ? `У меня уже есть дети, и за их выбор нельзя решать заранее.`
              : 'Я не хочу создавать семью только потому, что так принято.',
            learned ?? manner,
            'Забота важна, но согласие каждого важнее ожиданий соседей.',
            'Мне нужно отличить собственное желание от чужого давления.',
          ],
          [
            'Как ты сам это чувствуешь?',
            'Что для тебя означает готовность?',
            'Ты бы стал торопиться?',
            'Скажи честно, не из вежливости.',
          ],
        ),
        reply: tone === 'tense'
          ? tenseReply
          : pick([
              'Я тоже считаю, что такое решение возможно только по взаимному желанию.',
              'Мне нужно время, но я рад, что ты говоришь прямо.',
              'Для меня дом начинается с доверия, а не с обещаний соседям.',
              'Давай не спешить и посмотрим, чего хотим мы сами.',
            ], seed, 'reply'),
      };
    }
    case 'work':
      return {
        utterance: compose(
          [
            `Сегодня возле «${placeName}» я ${actionLabel(speaker.lastAction)}.`,
            `Работа у «${placeName}» заставила меня кое-что заметить.`,
            'Я хочу изменить то, как выполняю привычную работу.',
            `${listener.name}, у меня появилась практическая мысль.`,
          ],
          [
            learned ?? manner,
            'Старый способ надёжен, но он тратит слишком много сил.',
            'Если сначала проверить материалы, ошибок будет меньше.',
            'Одного усердия мало — нужно понимать, почему способ работает.',
          ],
          [
            'Поможешь испытать это?',
            'Что бы ты проверил первым?',
            'Видишь в этом слабое место?',
            'Стоит показать это мастерам?',
          ],
        ),
        reply: tone === 'tense'
          ? tenseReply
          : pick([
              'Я помогу с одной попыткой, а потом сравним результат.',
              'Сначала возьмём немного материала, чтобы ошибка не стоила дорого.',
              'Покажи порядок действий — тогда я решу, присоединяться ли.',
              'Если опыт удастся повторить, этому можно будет учить других.',
            ], seed, 'reply'),
      };
    case 'resources': {
      const scarcity = speaker.resources < 0.34;
      return {
        utterance: compose(
          [
            scarcity
              ? 'Мои личные припасы почти закончились.'
              : 'Мои припасы пока держатся, но склад нельзя считать бездонным.',
            `Я посмотрел, что происходит с запасами у «${placeName}».`,
            'Мы слишком долго берём с одной и той же земли.',
            `${listener.name}, меня тревожит, как быстро уходят запасы.`,
          ],
          [
            learned ?? manner,
            'Нужно считать не размер склада, а сколько дней он прокормит жителей.',
            'Если почве не дать восстановиться, следующий урожай будет слабее.',
            'Брать всё сейчас — значит оставить соседей без выбора позже.',
          ],
          [
            'Давай сверим остатки и состояние полей.',
            'Где ты стал бы искать новый источник?',
            'Какой запас ты считаешь достаточным?',
            'Стоит ли части людей идти дальше?',
          ],
        ),
        reply: tone === 'tense'
          ? tenseReply
          : pick([
              'Я сначала посмотрю на амбар и поля, потом предложу решение.',
              'Можно дать одному участку отдохнуть и испытать другой способ рядом.',
              'Если запас мал, спор не накормит нас — нужны точные меры.',
              'Я готов поискать другой источник, но возьму провизию на обратный путь.',
            ], seed, 'reply'),
      };
    }
    case 'travel':
      return {
        utterance: compose(
          [
            `Меня тянет узнать, что лежит за дорогами от «${placeName}».`,
            'Я снова смотрю туда, где заканчиваются знакомые тропы.',
            `${listener.name}, мне хочется уйти в дальний путь.`,
            'Похоже, вокруг нас осталось слишком много белых пятен.',
          ],
          [
            learned ?? manner,
            'Хочу отмечать ориентиры и расстояния, чтобы следующий путник не шёл вслепую.',
            'Путь должен включать место ночлега и запас на возвращение.',
            'Я не ищу опасность ради хвастовства; мне нужна настоящая карта.',
          ],
          [
            'Ты помог бы проверить маршрут?',
            'Какие припасы ты взял бы?',
            'Кому оставить копию карты?',
            'Где, по-твоему, лучше сделать первую остановку?',
          ],
        ),
        reply: listener.personality.riskTolerance >= 0.5 && tone !== 'tense'
          ? pick([
              'Я готов пройти первый отрезок и вернуться, если припасов станет мало.',
              'Возьмём верёвку, воду и материал для отметок — потом решим дальше.',
              'Я пойду, если мы заранее договоримся о точке возвращения.',
              'Сначала расспрошу тех, кто уже видел окраину.',
            ], seed, 'reply')
          : pick([
              'Я пока не пойду далеко, но помогу собрать сведения и припасы.',
              'Мне нужен более безопасный маршрут, прежде чем я соглашусь.',
              'Я останусь, но буду ждать твоего возвращения и карты.',
              tenseReply,
            ], seed, 'reply-cautious'),
      };
    case 'danger':
      return {
        utterance: compose(
          [
            'В окрестностях стало тревожнее.',
            `У «${placeName}» я заметил признаки опасности.`,
            'Мне не нравится, как тихо стало на дороге.',
            `${listener.name}, перед следующим выходом нужно подготовиться.`,
          ],
          [
            learned ?? manner,
            'Нужны понятные сигналы и сменный караул, иначе усталость ослепит нас.',
            'Страх полезен, если превращается в проверку пути, а не в вечное затворничество.',
            'Один сильный защитник не заменит наблюдение и согласованный отход.',
          ],
          [
            'Что именно заметил ты?',
            'Кого стоит предупредить первым?',
            'Как проверить дорогу без лишнего риска?',
            'Где лучше поставить наблюдателя?',
          ],
        ),
        reply: tone === 'tense'
          ? tenseReply
          : pick([
              'Я проверю снаряжение и расскажу тем, кто сегодня выходит за стены.',
              'Давай сравним наблюдения, прежде чем объявлять тревогу.',
              'Я согласен на караул, если смены не будут держать силой.',
              'Сначала найдём безопасный путь назад, потом пойдём смотреть.',
            ], seed, 'reply'),
      };
    case 'learning': {
      const literacy = speakerLanguageDescription(speaker, knowledge);
      return {
        utterance: compose(
          [
            knowledge
              ? `${listener.name}, я хочу рассказать о «${knowledge.title}».`
              : `${listener.name}, я хочу научиться выражать мысли точнее.`,
            knowledge
              ? 'В библиотеке мне попалась мысль, которую нельзя оставлять только на полке.'
              : 'Сегодня я снова упражнялся в речи и письме.',
            'Я понял кое-что новое, но пока не считаю себя мастером.',
            'Знание ничего не стоит, если его нельзя объяснить другому и проверить.',
          ],
          [
            learned ?? literacy,
            manner,
            knowledge
              ? `Я понимаю этот материал примерно на ${Math.round(knowledge.understanding * 100)} процентов.`
              : 'Мне ещё трудно записывать сложные мысли без ошибок.',
            knowledge?.summary ?? 'Разговор помогает мне замечать пробелы в собственном понимании.',
          ],
          [
            'Попробуешь пересказать, как понял меня?',
            'Как бы ты проверил эту мысль на деле?',
            'Какой вопрос здесь остался без ответа?',
            'Хочешь разобрать это вместе?',
          ],
        ),
        reply: tone === 'tense'
          ? tenseReply
          : knowledge
            ? pick([
                'Я попробую повторить своими словами, а ты поправь, если исказил смысл.',
                'Сначала объясни один пример; потом я решу, чему верить.',
                'Мне интересно, но знание нужно испытать в настоящей работе.',
                'Я запомню основную мысль и сравню её с тем, что уже видел.',
              ], seed, 'reply-knowledge')
            : pick([
                'Давай разберём несколько слов, а потом попробуем записать мысль.',
                'Я могу слушать и задавать вопросы, но не буду притворяться, что всё понял.',
                'Попробуй сказать проще — так мы оба увидим, где пробел.',
                'Я покажу свою запись, если ты покажешь свою.',
              ], seed, 'reply-language'),
      };
    }
    case 'belief':
      return {
        utterance: compose(
          [
            'Иногда я думаю, есть ли смысл за пределами того, что мы видим.',
            'Сегодня тишина снова заставила меня задуматься о невидимом.',
            `${listener.name}, мне трудно отличить знак от собственного желания его увидеть.`,
            'Старые рассказы не дают мне покоя, но слепо повторять их я не хочу.',
          ],
          [
            learned ?? manner,
            'Память людей меняет рассказ, поэтому мне важны и вера, и честное сомнение.',
            'Я не хочу заставлять другого верить в то, чего он сам не пережил.',
            'Можно искать ответ и всё же признавать, что пока его не знаешь.',
          ],
          [
            'Что для тебя было бы настоящим доказательством?',
            'Какой старый рассказ ты помнишь?',
            'Можно ли жить с таким сомнением?',
            'Ты когда-нибудь чувствовал нечто похожее?',
          ],
        ),
        reply: tone === 'tense'
          ? tenseReply
          : pick([
              'Я помню предания, но своё решение о вере оставлю за собой.',
              'Мне ближе наблюдать и не выдавать надежду за знание.',
              'Сомнение не пугает меня, если мы говорим честно.',
              'Я расскажу, что видел сам, а вывод ты сделаешь самостоятельно.',
            ], seed, 'reply'),
      };
    case 'settlement': {
      const pressured = lifecycleDeparturePressure >= 0.5;
      return {
        utterance: compose(
          [
            pressured
              ? 'Мне кажется, нашему поселению становится тесно и тяжело.'
              : 'Я думаю о том, каким станет наше поселение через несколько лет.',
            `Сегодня я внимательно посмотрел на «${placeName}».`,
            'Дома, поля и дороги уже не соответствуют числу жителей.',
            `${listener.name}, нельзя вечно жить так, будто вокруг нет другой земли.`,
          ],
          [
            learned ?? manner,
            pressured
              ? 'Нужно разведать новое место, а не ждать, пока нехватка превратится в голод.'
              : 'Расширяться стоит только после проверки воды, почвы и безопасного пути.',
            'Одни хотят уйти, другие остаться; решение нельзя навязать всем сразу.',
            'Карта и учёт запасов дадут больше пользы, чем слухи.',
          ],
          [
            'Ты бы остался или сначала пошёл на разведку?',
            'Что нужно проверить перед переселением?',
            'Кому доверить составление карты?',
            'Как обсудить это со всеми без приказа?',
          ],
        ),
        reply: tone === 'tense'
          ? tenseReply
          : listener.personality.curiosity + listener.personality.riskTolerance >= 1.05
            ? pick([
                'Я готов разведать путь, но решение о новом доме приму уже на месте.',
                'Сначала нанесу воду и опасные участки на карту.',
                'Я пойду с небольшой группой и вернусь с фактами.',
                'Мне интересно новое место, но старый дом я не брошу без причины.',
              ], seed, 'reply-mobile')
            : pick([
                'Я пока останусь, но помогу тем, кто хочет проверить другой путь.',
                'Мне нужны убедительные сведения о воде и безопасности.',
                'Это место важно мне, хотя я вижу, что давление растёт.',
                'Я выслушаю разведчиков прежде, чем решать.',
              ], seed, 'reply-rooted'),
      };
    }
    case 'conflict':
      return {
        utterance: compose(
          [
            'Мне не нравится, как складывается наш разговор.',
            `${listener.name}, сейчас мы слышим друг друга слишком плохо.`,
            'Я злюсь, но не хочу превращать несогласие во вражду.',
            'Стоп. Давай назовём настоящую причину спора.',
          ],
          [
            learned ?? manner,
            'Мне важно, чтобы мою позицию пересказали без искажения.',
            'Если мы спорим о фактах, их можно проверить.',
            'Я готов уступить в способе, но не хочу молчать о причине.',
          ],
          [
            'С чего началось наше несогласие?',
            'Что именно ты считаешь неверным?',
            'Можем сделать паузу и вернуться позже?',
            'Какое решение не лишит другого выбора?',
          ],
        ),
        reply: tone === 'tense'
          ? tenseReply
          : pick([
              'Я попробую сначала повторить твою мысль, а потом возражу.',
              'Давай отделим то, что видели, от того, что только предполагаем.',
              'Я согласен сделать паузу, но к вопросу нужно вернуться.',
              'Ищи решение вместе со мной, а не победу надо мной.',
            ], seed, 'reply'),
      };
    case 'daily_life':
    default:
      return {
        utterance: compose(
          tone === 'warm'
            ? [
                `Рад тебя видеть, ${listener.name}.`,
                `${listener.name}, хорошо, что мы встретились.`,
                'У меня сегодня спокойнее на душе.',
                `Я как раз хотел поговорить с тобой, ${listener.name}.`,
              ]
            : tone === 'tense'
              ? [
                  `${listener.name}, я хочу поговорить спокойно.`,
                  'Между нами чувствуется напряжение.',
                  'Я не хочу делать вид, что всё в порядке.',
                  `${listener.name}, давай не будем говорить намёками.`,
                ]
              : [
                  `${listener.name}, расскажи, как проходит твой день.`,
                  'Мы давно не говорили о простых вещах.',
                  `Сегодня у «${placeName}» многое изменилось.`,
                  `${listener.name}, чем ты сейчас занят?`,
                ],
          [
            `До встречи с тобой я ${actionLabel(speaker.lastAction)}.`,
            manner,
            speaker.stress >= 0.7
              ? 'Я сильно устал и могу говорить резче, чем хочу.'
              : 'Сегодня у меня хватает сил слушать внимательно.',
            'Хочу понять, что изменилось у тебя, а не просто заполнить тишину.',
          ],
          [
            'Что сегодня оказалось для тебя самым важным?',
            'Есть ли дело, о котором ты хочешь рассказать?',
            'Тебе сейчас нужен совет или просто слушатель?',
            'Что ты собираешься делать дальше?',
          ],
        ),
        reply: tone === 'tense'
          ? tenseReply
          : pick([
              `Я слушаю, ${speaker.name}. Сегодня у меня свои заботы, но разговор не помешает.`,
              'Мне нужен скорее слушатель, чем готовый совет.',
              'Сначала расскажу, что случилось, а решение приму потом.',
              'День был обычным, но одна мысль всё время возвращалась.',
              'Я отвечу честно, даже если мой ответ тебе не понравится.',
            ], seed, 'reply'),
      };
  }
}

function speakerLanguageDescription(
  speaker: Readonly<AgentState>,
  knowledge: Readonly<SecretLibraryKnowledgeRecordV18> | undefined,
): string {
  if (knowledge) return knowledgeObservation(knowledge) ?? '';
  return speaker.mind.values.knowledge >= 0.6
    ? 'Мне важно не просто запомнить слова, а связать их с наблюдением.'
    : 'Я учусь формулировать то, что раньше мог показать только жестом.';
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
  const knowledge = knowledgeForConversation(state, speaker.id, topic, id);
  let rendered: { utterance: string; reply: string } | undefined;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const candidate = utterancesForTopic(
      topic,
      tone,
      speaker,
      listener,
      place?.name ?? speaker.locationId,
      lifecycleDeparturePressure,
      `${id}:${attempt}`,
      knowledge,
    );
    const duplicatesRecentPhrase =
      state.v18?.recentConversations.some(
        (conversation) =>
          conversation.utterance === candidate.utterance ||
          conversation.reply === candidate.reply,
      ) ?? false;
    rendered = candidate;
    if (!duplicatesRecentPhrase) break;
  }
  if (!rendered) {
    throw new Error('Conversation renderer produced no utterance.');
  }
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

  const knowledgeShared = knowledge
    ? shareSecretLibraryKnowledgeV18({
        world: state,
        speakerId: speaker.id,
        listenerId: listener.id,
        knowledgeId: knowledge.knowledgeId,
        relationshipTrust: relationship.trust,
        sentiment,
      })
    : false;
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
      ...(knowledge
        ? {
            knowledgeId: knowledge.knowledgeId,
            knowledgeTitle: knowledge.title,
            knowledgeShared,
          }
        : {}),
    },
    audibility,
    observerAudible: clamp01(audibilityRoll) < audibility,
  };

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
