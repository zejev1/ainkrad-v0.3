/**
 * Ainkrad v18 — Secret Library foundation.
 *
 * Тайная библиотека — единственная точка Ainkrad, где разрешён
 * контролируемый доступ к знаниям реального человеческого мира.
 *
 * ВАЖНО:
 * - книги принадлежат библиотеке и никогда не переходят NPC;
 * - NPC может унести только то, что понял и запомнил;
 * - максимум 5 посетителей за один игровой год;
 * - окно посещения длится один игровой месяц;
 * - в течение этого месяца посетитель может выходить для сна,
 *   еды и других бытовых нужд и возвращаться;
 * - после закрытия следующее окно открывается только в новом году;
 * - сама библиотека не управляет тем, что NPC потом делает со знаниями.
 */

export const SECRET_LIBRARY_ID_V18 = 'secret-library-v18';
export const SECRET_LIBRARIAN_ID_V18 = 'secret-librarian-v18';

export const SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18 = 5;

/**
 * Ainkrad пока использует условный календарь.
 * Здесь месяц считается 1/12 игрового года.
 * Позже привяжем это к настоящему Calendar WorldState.
 */
export const SECRET_LIBRARY_MONTHS_OPEN_V18 = 1;

export type SecretLibraryAccessStatusV18 =
  | 'closed'
  | 'selection'
  | 'open';

export type SecretLibraryVisitorStatusV18 =
  | 'selected'
  | 'inside'
  | 'temporarily_outside'
  | 'finished';

export interface SecretLibraryVisitorV18 {
  agentId: string;

  /**
   * Год, в котором NPC получил право посещения.
   */
  accessYear: number;

  /**
   * Состояние посещения.
   */
  status: SecretLibraryVisitorStatusV18;

  /**
   * Сколько времени NPC реально провёл внутри библиотеки.
   * Это не равно всему месяцу доступа:
   * NPC может выходить есть, спать и заниматься бытом.
   */
  studyMinutes: number;

  firstEntryWorldMinute?: number;
  lastEntryWorldMinute?: number;
  lastExitWorldMinute?: number;

  /**
   * Идентификаторы знаний, которые NPC действительно понял.
   * Не список просмотренных книг.
   */
  learnedKnowledgeIds: string[];
}

/**
 * Книга существует только внутри Тайной библиотеки.
 *
 * externalSourceId позже будет указывать на реальный источник:
 * реальную книгу, архив, научный текст и т.п.
 *
 * Сам текст книги в WorldState не переносится.
 */
export interface SecretLibraryBookV18 {
  id: string;

  title: string;
  author?: string;
  publicationYear?: number;

  /**
   * Реальный внешний источник.
   * Пока это только ссылка-идентификатор.
   * В следующем модуле подключим безопасный gateway.
   */
  externalSourceId: string;

  subjectTags: string[];

  /**
   * Книга физически не может покинуть библиотеку.
   */
  removable: false;
}

/**
 * Отдельная единица знания, которую NPC способен понять.
 *
 * Это важно: чтение книги само по себе ничего магически
 * не записывает в голову персонажа.
 */
export interface SecretLibraryKnowledgeV18 {
  id: string;

  sourceBookId: string;

  title: string;

  subject: string;

  /**
   * Краткое смысловое содержание знания.
   * Позже оно будет получаться из реального источника.
   */
  summary: string;

  /**
   * Сложность понимания от 0 до 1.
   */
  difficulty: number;

  /**
   * Насколько глубоко NPC освоил материал.
   * Для каталога библиотеки обычно 1.
   * Личная степень понимания NPC хранится отдельно.
   */
  completeness: number;
}

/**
 * Хранитель Тайной библиотеки.
 *
 * Это специальный персонаж мира, но НЕ обычный житель.
 * Он не выбирает судьбу цивилизации и не обучает NPC напрямую.
 *
 * Его задача:
 * - охранять правила библиотеки;
 * - выдавать разрешённым NPC доступ;
 * - показывать книги;
 * - связываться с внешним источником знаний через отдельный gateway.
 */
export interface SecretLibrarianV18 {
  id: typeof SECRET_LIBRARIAN_ID_V18;

  name: string;

  role: 'secret_librarian';

  alive: true;

  /**
   * У Хранителя нет права физически передавать книги наружу.
   */
  mayRemoveBooks: false;

  /**
   * У него нет права напрямую изменять знания NPC.
   */
  mayInjectKnowledge: false;

  /**
   * Единственное особое право — запросить реальный источник
   * через внешний шлюз, который создадим отдельно.
   */
  mayRequestExternalKnowledge: true;
}

export interface SecretLibraryStateV18 {
  id: typeof SECRET_LIBRARY_ID_V18;

  name: string;

  librarian: SecretLibrarianV18;

  status: SecretLibraryAccessStatusV18;

  /**
   * Текущий игровой год библиотеки.
   */
  currentAccessYear: number;

  /**
   * Момент открытия годового месячного окна.
   */
  openedAtWorldMinute?: number;

  /**
   * Момент окончательного закрытия окна.
   */
  closesAtWorldMinute?: number;

  /**
   * Все NPC, которым в этом году был выдан пропуск.
   * Максимум пять.
   */
  visitors: SecretLibraryVisitorV18[];

  /**
   * Каталог книг, доступных только внутри библиотеки.
   */
  books: SecretLibraryBookV18[];

  /**
   * Знания, извлечённые из реальных источников.
   */
  knowledge: SecretLibraryKnowledgeV18[];
}

export function createSecretLibrarianV18(): SecretLibrarianV18 {
  return {
    id: SECRET_LIBRARIAN_ID_V18,
    name: 'Хранитель Тайной библиотеки',
    role: 'secret_librarian',
    alive: true,
    mayRemoveBooks: false,
    mayInjectKnowledge: false,
    mayRequestExternalKnowledge: true,
  };
}

export function createSecretLibraryV18(
  initialWorldYear = 0,
): SecretLibraryStateV18 {
  return {
    id: SECRET_LIBRARY_ID_V18,
    name: 'Тайная библиотека',
    librarian: createSecretLibrarianV18(),
    status: 'closed',
    currentAccessYear: initialWorldYear,
    visitors: [],
    books: [],
    knowledge: [],
  };
}

/**
 * Начать новое ежегодное окно доступа.
 *
 * minutesPerWorldYear приходит из движка,
 * поэтому библиотека не придумывает собственную скорость времени.
 */
export function openSecretLibraryForYearV18(
  library: SecretLibraryStateV18,
  worldYear: number,
  currentWorldMinute: number,
  minutesPerWorldYear: number,
): boolean {
  if (library.status !== 'closed') {
    return false;
  }

  if (worldYear <= library.currentAccessYear) {
    return false;
  }

  const oneMonth =
    minutesPerWorldYear / 12 * SECRET_LIBRARY_MONTHS_OPEN_V18;

  library.currentAccessYear = worldYear;
  library.status = 'selection';
  library.openedAtWorldMinute = currentWorldMinute;
  library.closesAtWorldMinute = currentWorldMinute + oneMonth;

  /**
   * Новый год = новый набор максимум из пяти посетителей.
   * История полученных знаний самих NPC хранится у NPC,
   * а не здесь.
   */
  library.visitors = [];

  return true;
}

/**
 * Выдать NPC право посещать библиотеку в текущем году.
 *
 * Здесь пока НЕТ алгоритма выбора пяти NPC.
 * Это специально.
 *
 * Позже отдельно решим, кто их выбирает:
 * случай,
 * стремление самого NPC,
 * Хранитель,
 * общество,
 * достижение,
 * либо смешанная система.
 */
export function grantSecretLibraryAccessV18(
  library: SecretLibraryStateV18,
  agentId: string,
): boolean {
  if (library.status !== 'selection') {
    return false;
  }

  if (
    library.visitors.length >=
    SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18
  ) {
    return false;
  }

  if (
    library.visitors.some(
      (visitor) => visitor.agentId === agentId,
    )
  ) {
    return false;
  }

  library.visitors.push({
    agentId,
    accessYear: library.currentAccessYear,
    status: 'selected',
    studyMinutes: 0,
    learnedKnowledgeIds: [],
  });

  return true;
}

/**
 * После выбора посетителей библиотека начинает принимать их.
 *
 * Допускается и меньше пяти NPC:
 * если подходящих нашлось только трое — войдут трое.
 */
export function beginSecretLibraryStudyPeriodV18(
  library: SecretLibraryStateV18,
): boolean {
  if (library.status !== 'selection') {
    return false;
  }

  if (library.visitors.length === 0) {
    return false;
  }

  library.status = 'open';

  return true;
}

export function canAgentEnterSecretLibraryV18(
  library: Readonly<SecretLibraryStateV18>,
  agentId: string,
  currentWorldMinute: number,
): boolean {
  if (library.status !== 'open') {
    return false;
  }

  if (
    library.closesAtWorldMinute !== undefined &&
    currentWorldMinute >= library.closesAtWorldMinute
  ) {
    return false;
  }

  const visitor = library.visitors.find(
    (entry) => entry.agentId === agentId,
  );

  if (!visitor) {
    return false;
  }

  return (
    visitor.status === 'selected' ||
    visitor.status === 'temporarily_outside' ||
    visitor.status === 'inside'
  );
}

export function enterSecretLibraryV18(
  library: SecretLibraryStateV18,
  agentId: string,
  currentWorldMinute: number,
): boolean {
  if (
    !canAgentEnterSecretLibraryV18(
      library,
      agentId,
      currentWorldMinute,
    )
  ) {
    return false;
  }

  const visitor = library.visitors.find(
    (entry) => entry.agentId === agentId,
  );

  if (!visitor) {
    return false;
  }

  visitor.status = 'inside';

  if (visitor.firstEntryWorldMinute === undefined) {
    visitor.firstEntryWorldMinute = currentWorldMinute;
  }

  visitor.lastEntryWorldMinute = currentWorldMinute;

  return true;
}

/**
 * NPC может временно выйти.
 *
 * Например:
 * sleep
 * eat
 * drink
 * hygiene
 * toilet
 * social
 * emergency
 *
 * Причину здесь намеренно не ограничиваем:
 * жизненный движок Ainkrad сам решает потребности NPC.
 */
export function temporarilyLeaveSecretLibraryV18(
  library: SecretLibraryStateV18,
  agentId: string,
  currentWorldMinute: number,
): boolean {
  const visitor = library.visitors.find(
    (entry) => entry.agentId === agentId,
  );

  if (!visitor || visitor.status !== 'inside') {
    return false;
  }

  visitor.status = 'temporarily_outside';
  visitor.lastExitWorldMinute = currentWorldMinute;

  return true;
}

/**
 * Засчитать реальное время изучения.
 *
 * Время начисляется только пока NPC действительно находится внутри.
 */
export function recordSecretLibraryStudyV18(
  library: SecretLibraryStateV18,
  agentId: string,
  studiedMinutes: number,
): boolean {
  if (studiedMinutes <= 0) {
    return false;
  }

  const visitor = library.visitors.find(
    (entry) => entry.agentId === agentId,
  );

  if (!visitor || visitor.status !== 'inside') {
    return false;
  }

  visitor.studyMinutes += studiedMinutes;

  return true;
}

/**
 * Зафиксировать знание только после того,
 * как NPC действительно его понял.
 *
 * Этот метод НЕ решает, понял ли он его.
 * Позже это будет зависеть от:
 * интеллекта,
 * грамотности,
 * языка,
 * прошлого опыта,
 * сложности книги,
 * времени изучения и других факторов.
 */
export function recordLearnedKnowledgeV18(
  library: SecretLibraryStateV18,
  agentId: string,
  knowledgeId: string,
): boolean {
  const visitor = library.visitors.find(
    (entry) => entry.agentId === agentId,
  );

  if (!visitor) {
    return false;
  }

  const knowledgeExists = library.knowledge.some(
    (entry) => entry.id === knowledgeId,
  );

  if (!knowledgeExists) {
    return false;
  }

  if (
    visitor.learnedKnowledgeIds.includes(knowledgeId)
  ) {
    return false;
  }

  visitor.learnedKnowledgeIds.push(knowledgeId);

  return true;
}

/**
 * Закрытие библиотеки по окончании месячного окна.
 *
 * Все пропуска текущего года после этого перестают действовать.
 */
export function updateSecretLibraryAccessV18(
  library: SecretLibraryStateV18,
  currentWorldMinute: number,
): void {
  if (
    library.status === 'closed' ||
    library.closesAtWorldMinute === undefined
  ) {
    return;
  }

  if (currentWorldMinute < library.closesAtWorldMinute) {
    return;
  }

  for (const visitor of library.visitors) {
    visitor.status = 'finished';
  }

  library.status = 'closed';
}

/**
 * Книгу разрешено читать только внутри библиотеки.
 * Этот метод принципиально не возвращает объект,
 * который означает физическое владение книгой.
 */
export function canReadSecretLibraryBookV18(
  library: Readonly<SecretLibraryStateV18>,
  agentId: string,
  bookId: string,
  currentWorldMinute: number,
): boolean {
  if (
    !canAgentEnterSecretLibraryV18(
      library,
      agentId,
      currentWorldMinute,
    )
  ) {
    return false;
  }

  const visitor = library.visitors.find(
    (entry) => entry.agentId === agentId,
  );

  if (!visitor || visitor.status !== 'inside') {
    return false;
  }

  return library.books.some(
    (book) => book.id === bookId,
  );
}

/**
 * Физический вынос книги запрещён всегда.
 *
 * Функция существует специально, чтобы это правило
 * было выражено в коде явно, а не только в комментарии.
 */
export function canRemoveBookFromSecretLibraryV18(): false {
  return false;
}
