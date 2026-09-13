import type {
  AgentActionKind,
  AgentState,
  V15WorldBookPageState,
  V15WorldBookState,
  WorldState,
} from '../world/types';
import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';
import { ensureEmbodiedWorldV21 } from './EmbodiedWorldV21';

export const FOUNDING_PRIMER_ID_V21 = 'artifact:founding-primer-v21';
export const FOUNDING_PRIMER_BOOK_ID_V21 = 'book:founding-primer-v21';
export const FOUNDING_PRIMER_ACTIVE_YEARS_V21 = 100;
const STUDY_INTERVAL = 30 * 1_440;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const FOUNDING_PRIMER_TOPICS_V21 = [
  'дом как укрытие, имущество и место возвращения',
  'семья, родство, забота, личные границы и взаимная ответственность',
  'уход за ребёнком без лишения его личности',
  'ремонт жилья, пожарная безопасность и уважение права отсутствующего владельца',
  'сезоны, дождь, снег, гроза, холод и безопасное поведение в пути',
] as const;

const FOUNDING_PRIMER_PAGES: V15WorldBookPageState[] = [
  {
    pageNumber: 1,
    chapter: 'Дом — место жизни и возвращения',
    minimumAgeYears: 5,
    text: 'Дом защищает человека от холода, жары, дождя, ветра и опасности. В нём спят, готовят пищу, хранят воду, одежду, инструменты и памятные вещи. Дом не является клеткой: человек может уйти работать, гулять или путешествовать и затем вернуться. У каждого живущего есть право на безопасное место для сна и на угол, где его вещи не берут без разрешения. Чтобы дом оставался пригодным, жильцы замечают сырость, трещины, дым, испорченную пищу и поломки, обсуждают их и вместе выбирают, что исправить сначала.',
    concepts: ['дом', 'укрытие', 'возвращение', 'личные вещи', 'безопасность'],
  },
  {
    pageNumber: 2,
    chapter: 'Жильцы, владельцы и отсутствующие',
    minimumAgeYears: 7,
    text: 'Если человек временно ушёл в поход, на работу или в гости, его дом не становится ничейным. Соседи могут проверить крышу после бури или потушить пожар, но не присваивают жильё и имущество. Перед долгим отсутствием полезно сказать близким, куда человек направился и когда примерно вернётся. Дом можно считать оставленным только после надёжных сведений о смерти владельца или ясного добровольного отказа. Тогда община сначала ремонтирует пригодное пустующее жильё и лишь затем тратит материалы и труд на новое строительство.',
    concepts: ['владение', 'отсутствие', 'путешествие', 'ремонт', 'наследование'],
  },
  {
    pageNumber: 3,
    chapter: 'Что такое семья',
    minimumAgeYears: 5,
    text: 'Семья возникает из родства, близости, совместной жизни и принятой ответственности. Родители заботятся о ребёнке, но ребёнок остаётся отдельной личностью со своими чувствами и характером. Братья, сёстры, супруги и старшие родственники могут помогать друг другу, однако помощь не даёт права командовать чужой жизнью. Любовь проявляется не только словами: люди делятся пищей, слушают, лечат, учат, защищают и помнят обещания. Родство нельзя угадать по внешности; его узнают из общей истории семьи и честных рассказов тех, кто её знает.',
    concepts: ['семья', 'родство', 'забота', 'личность', 'ответственность'],
  },
  {
    pageNumber: 4,
    chapter: 'Согласие и личные границы',
    minimumAgeYears: 8,
    text: 'У каждого человека есть тело, мысли, вещи и время, которыми нельзя распоряжаться без его согласия. Можно попросить об объятии, помощи, разговоре или совместном деле и нужно услышать ответ. Отказ не всегда означает неприязнь: человек может устать, испугаться, заболеть или хотеть побыть один. Если кто-то не способен ответить из-за ранения или потери сознания, допустима необходимая помощь для спасения жизни, но не использование его беспомощности. Спор лучше начинать с описания случившегося и собственных чувств, а не с угроз и унижения.',
    concepts: ['согласие', 'границы', 'отказ', 'помощь', 'уважение'],
  },
  {
    pageNumber: 5,
    chapter: 'Как растёт ребёнок',
    minimumAgeYears: 5,
    text: 'Маленькому ребёнку нужна близость взрослого, потому что он ещё не умеет оценивать далёкую дорогу, воду, огонь, незнакомых людей и резкую погоду. По мере взросления ему доверяют всё более дальние поручения и учат возвращаться вовремя. Надзор означает знать, где ребёнок находится, договориться о безопасных границах и прийти на помощь, а не думать и решать вместо него. Ошибки разбирают спокойно: что произошло, какой был риск и как поступить в следующий раз. Самостоятельность растёт вместе с опытом, здоровьем и доказанной ответственностью.',
    concepts: ['ребёнок', 'надзор', 'опасность', 'самостоятельность', 'обучение'],
  },
  {
    pageNumber: 6,
    chapter: 'Повседневная жизнь дома',
    minimumAgeYears: 7,
    text: 'Жилой дом требует повторяющихся дел: принести чистую воду, приготовить пищу, убрать отходы, высушить одежду, проветрить помещение и проверить очаг перед сном. Работу распределяют с учётом возраста, здоровья, навыков и занятости, а не только привычки. Запасы считают заранее, особенно перед зимой или дальней дорогой. Сырую и готовую пищу держат раздельно; загрязнённую воду не смешивают с питьевой. Если один член семьи болен, остальные временно берут часть его работы на себя и следят, не ухудшается ли состояние.',
    concepts: ['быт', 'вода', 'пища', 'очаг', 'совместный труд'],
  },
  {
    pageNumber: 7,
    chapter: 'Чистота, огонь и первая помощь',
    minimumAgeYears: 9,
    text: 'Грязь сама по себе не объясняет каждую болезнь, но чистые руки, вода, посуда, перевязочный материал и удаление отходов уменьшают опасность заражения. Огонь держат на негорючем основании, рядом оставляют воду или песок, а дым выводят наружу. При порезе сначала останавливают кровь чистым давлением, затем осматривают и закрывают рану. При сильном кровотечении, затруднённом дыхании, потере сознания, глубоком ожоге или резком ухудшении зовут наиболее опытного лекаря. Прочитанное правило не заменяет наблюдение и практическое обучение.',
    concepts: ['чистота', 'огонь', 'рана', 'заражение', 'практика'],
  },
  {
    pageNumber: 8,
    chapter: 'Времена года и погода',
    minimumAgeYears: 6,
    text: 'Весной становится теплее, но часты дождь, грязь и быстрые перемены температуры. Летом длиннее день и выше риск жары, жажды, грозы и порчи еды. Осенью холодает, усиливается ветер и нужно готовить запасы. Зимой холод, снег и короткий день требуют тёплого укрытия и осторожности в пути. Погода меняет самочувствие: жара утомляет и обезвоживает, холод отнимает тепло, сырость портит одежду, сильный ветер затрудняет движение. Ощущения разных людей различаются, поэтому решение принимают по состоянию тела и наблюдаемым условиям.',
    concepts: ['весна', 'лето', 'осень', 'зима', 'погода', 'комфорт'],
  },
  {
    pageNumber: 9,
    chapter: 'Безопасность в дороге',
    minimumAgeYears: 10,
    text: 'Перед выходом смотрят на небо, ветер, температуру, состояние дороги и предполагаемую длительность пути. Берут подходящую одежду, воду, пищу, свет, простой перевязочный материал и сообщают близким направление. Во время грозы избегают одиноких высоких деревьев, открытых вершин и воды. В мороз следят за онемением кожи и дрожью, в жару — за головокружением, слабостью и прекращением пота. Если условия стали опаснее ожидаемого, разумно искать укрытие или возвращаться; отказ от продолжения пути не является трусостью.',
    concepts: ['дорога', 'подготовка', 'гроза', 'переохлаждение', 'перегрев'],
  },
  {
    pageNumber: 10,
    chapter: 'Материалы и ремонт',
    minimumAgeYears: 11,
    text: 'Дерево сравнительно лёгкое и удобное в обработке, но горит, гниёт от сырости и требует защиты. Камень тяжёлый и хорошо выдерживает давление, однако может треснуть и плохо удерживает тепло без правильной кладки. Волокно и кожа подходят для связей, покрытий и одежды, но изнашиваются и боятся огня. Ремонт начинают с осмотра причины: протекающую крышу бессмысленно только сушить, а трещину нельзя прятать под отделкой. Сначала укрепляют опасную часть, затем заменяют повреждённый материал и после проверяют результат в дождь, ветер или под нагрузкой.',
    concepts: ['дерево', 'камень', 'волокно', 'кожа', 'ремонт'],
  },
  {
    pageNumber: 11,
    chapter: 'Решения семьи без потери свободы',
    minimumAgeYears: 12,
    text: 'Общие решения обсуждают те, кого затронут последствия. Сначала называют проблему и известные факты, затем желания, риски и доступные средства. Более опытный человек может объяснить опасность, но опыт не делает его непогрешимым. В срочной угрозе кто-то берёт руководство на короткое время; после опасности семья разбирает решение и возвращает обычные права каждому. Участие в семье не отменяет дружбу, ремесло, путешествия и личные цели. Хорошее соглашение отвечает на вопросы: кто что делает, когда это нужно, как понять результат и что предпринять при неудаче.',
    concepts: ['решение', 'факты', 'риск', 'свобода', 'соглашение'],
  },
  {
    pageNumber: 12,
    chapter: 'Дом и семья в памяти общины',
    minimumAgeYears: 14,
    text: 'Люди умирают, уезжают и создают новые семьи, поэтому община хранит свидетельства о родстве, владении, долгах, обещаниях и важных поступках. Запись помогает, но её сверяют с живыми свидетелями и обстоятельствами. После смерти имущество не исчезает: близкие договариваются о наследовании, завершают необходимые дела и сохраняют память о человеке. Пустой дом осматривают и ремонтируют, если он пригоден, но не объявляют заброшенным только потому, что хозяина давно не видели. Память о поступках остаётся у знавших человека и распространяется через рассказы, а не возникает у всех мгновенно.',
    concepts: ['община', 'память', 'свидетельство', 'наследование', 'пустой дом'],
  },
];

const countWords = (text: string): number => text.trim().split(/\s+/u).length;

export const FOUNDING_PRIMER_BOOK_V21: V15WorldBookState = {
  id: FOUNDING_PRIMER_BOOK_ID_V21,
  title: 'Основы дома, семьи и безопасной жизни',
  author: 'Учебник первых поколений Айнкрада',
  language: 'русский',
  edition: 1,
  pages: FOUNDING_PRIMER_PAGES,
  totalWords: FOUNDING_PRIMER_PAGES.reduce(
    (total, page) => total + countWords(page.text),
    0,
  ),
};

const primerIdForSettlement = (settlementId: string): string =>
  settlementId === 'settlement_ainkrad'
    ? FOUNDING_PRIMER_ID_V21
    : `${FOUNDING_PRIMER_ID_V21}:${settlementId}`;

export function ensureFoundingPrimerV21(world: WorldState): void {
  const v15 = world.v15;
  if (!v15) return;
  const books = (v15.books ??= {});
  books[FOUNDING_PRIMER_BOOK_ID_V21] ??=
    structuredClone(FOUNDING_PRIMER_BOOK_V21);
  for (const settlement of Object.values(world.settlements)) {
    const id = primerIdForSettlement(settlement.id);
    const existing = v15.items[id];
    if (existing) {
      existing.bookId = FOUNDING_PRIMER_BOOK_ID_V21;
      existing.description =
        'Физический экземпляр полного учебника из двенадцати последовательных глав.';
      continue;
    }
    v15.items[id] = {
      id,
      kind: 'artifact',
      name: FOUNDING_PRIMER_BOOK_V21.title,
      createdWorldMinute: world.calendar.elapsedWorldMinutes,
      locationId: settlement.centerPlaceId,
      quality: 1,
      effectiveness: 0.88,
      reliability: 0.96,
      description:
        'Физический экземпляр полного учебника из двенадцати последовательных глав.',
      bookId: FOUNDING_PRIMER_BOOK_ID_V21,
    };
  }
}

export function foundingPrimerEligibleV21(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
): boolean {
  const worldAge = world.calendar.elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR;
  return agent.life.alive && agent.life.ageYears >= 5 &&
    agent.life.ageYears < 18 && worldAge < FOUNDING_PRIMER_ACTIVE_YEARS_V21;
}

export interface FoundingPrimerStudyResultV21 {
  studied: boolean;
  lesson: number;
  firstLesson: boolean;
  pageNumber?: number;
  chapter?: string;
  wordsRead?: number;
  pageCompleted?: boolean;
}

/** Reads real words in sequence without replacing the child's chosen action. */
export function studyFoundingPrimerV21(
  world: WorldState,
  agent: AgentState,
  action: AgentActionKind,
): FoundingPrimerStudyResultV21 {
  const noStudy = { studied: false, lesson: 0, firstLesson: false } as const;
  ensureFoundingPrimerV21(world);
  if (!foundingPrimerEligibleV21(world, agent)) return noStudy;
  if (!['rest', 'relax', 'socialize', 'help', 'reflect', 'work'].includes(action)) {
    return noStudy;
  }
  const place = world.places[agent.locationId];
  if (!place?.settlementId && agent.locationId !== agent.homeId) return noStudy;
  const settlementId = place?.settlementId ??
    world.places[agent.homeId]?.settlementId;
  const copy = settlementId
    ? world.v15?.items[primerIdForSettlement(settlementId)]
    : undefined;
  const book = copy?.bookId
    ? world.v15?.books?.[copy.bookId]
    : undefined;
  if (!book?.pages.length) return noStudy;

  const knowledge = ensureEmbodiedWorldV21(world)
    .appliedKnowledgeByAgentId[agent.id];
  const now = world.calendar.elapsedWorldMinutes;
  if (
    knowledge.lastPrimerWorldMinute !== undefined &&
    now - knowledge.lastPrimerWorldMinute < STUDY_INTERVAL
  ) return noStudy;
  const pages = book.pages.filter(
    (page) => page.minimumAgeYears <= agent.life.ageYears,
  );
  if (!pages.length) return noStudy;
  const pageIndex = knowledge.foundingPrimerPageIndex % pages.length;
  const page = pages[pageIndex];
  const pageWords = countWords(page.text);
  const literacy = world.v18?.languageByAgentId[agent.id]?.cyrillicLiteracy ?? 0;
  const guidedReading = agent.life.ageYears < 8 ? 0.55 : 0.18;
  const readingCapacity = Math.max(
    35,
    Math.floor(35 + agent.life.ageYears * 4 + literacy * 80 + guidedReading * 70),
  );
  const remainingWords = Math.max(
    0,
    pageWords - knowledge.foundingPrimerWordOffset,
  );
  const wordsRead = Math.min(readingCapacity, remainingWords);
  const pageCompleted = wordsRead >= remainingWords;
  const firstLesson = knowledge.foundingPrimerLessons === 0;
  const aptitude = world.v15?.knowledgeByAgentId[agent.id]?.aptitude.household ?? 0.5;
  const readFraction = pageWords > 0 ? wordsRead / pageWords : 0;
  const lesson = (0.004 + aptitude * 0.004) * Math.max(0.2, readFraction);
  const hasConcept = (names: readonly string[]): boolean =>
    page.concepts.some((concept) => names.includes(concept));
  if (hasConcept(['дом', 'укрытие', 'владение', 'ремонт', 'быт', 'пустой дом'])) {
    knowledge.homeTheory = clamp01(knowledge.homeTheory + lesson);
  }
  if (hasConcept(['семья', 'родство', 'забота', 'ребёнок', 'согласие', 'границы'])) {
    knowledge.familyTheory = clamp01(knowledge.familyTheory + lesson);
  }
  if (hasConcept(['погода', 'комфорт', 'дорога', 'гроза', 'переохлаждение', 'перегрев'])) {
    knowledge.weatherTheory = clamp01(knowledge.weatherTheory + lesson);
  }
  knowledge.foundingPrimerLessons += 1;
  knowledge.foundingPrimerWordsRead += wordsRead;
  knowledge.foundingPrimerWordOffset += wordsRead;
  if (pageCompleted) {
    knowledge.foundingPrimerWordOffset = 0;
    knowledge.foundingPrimerPageIndex = (pageIndex + 1) % pages.length;
    if (knowledge.foundingPrimerPageIndex === 0) {
      knowledge.foundingPrimerCompletedReadings += 1;
    }
  }
  knowledge.lastPrimerWorldMinute = now;
  knowledge.lastLearnedWorldMinute = now;
  const general = world.v15?.knowledgeByAgentId[agent.id];
  if (general) {
    general.household = clamp01(general.household + lesson * 0.24);
    general.survival = clamp01(general.survival + lesson * 0.18);
    general.verifiedLearningSessions += 1;
    general.lastLearningWorldMinute = now;
  }
  return {
    studied: true,
    lesson,
    firstLesson,
    pageNumber: page.pageNumber,
    chapter: page.chapter,
    wordsRead,
    pageCompleted,
  };
}
