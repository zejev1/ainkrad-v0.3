/**
 * Ainkrad v18 — Secret Library real human books catalogue.
 *
 * Здесь перечисляются реальные человеческие труды,
 * существовавшие в настоящей истории.
 *
 * ВАЖНО:
 * - NPC не получает знание автоматически;
 * - книга остаётся внутри Тайной библиотеки;
 * - NPC должен читать и понимать текст;
 * - этот файл хранит каталог книг, а не игровые бонусы;
 * - позднее источник книги сможет подгружаться из реального мира.
 */

export type SecretLibraryBookCategoryV18 =
  | 'agriculture'
  | 'medicine'
  | 'mathematics'
  | 'astronomy'
  | 'engineering'
  | 'architecture'
  | 'economics'
  | 'trade'
  | 'governance'
  | 'law'
  | 'military'
  | 'philosophy'
  | 'geography'
  | 'natural_science';

export interface RealHumanBookV18 {
  id: string;

  title: string;

  originalTitle?: string;

  author: string;

  approximateYear: number;

  culture: string;

  category: SecretLibraryBookCategoryV18;

  /**
   * Язык оригинального произведения.
   */
  originalLanguage: string;

  /**
   * Краткое описание того, чему посвящён реальный труд.
   * Это НЕ замена самой книги.
   */
  description: string;

  /**
   * Какие области знания NPC потенциально может
   * изучать по этой книге.
   */
  subjects: string[];

  /**
   * Реальная книга никогда не становится предметом NPC.
   */
  removable: false;

  /**
   * Позже сюда будет подключаться реальный внешний источник.
   * Пока каталог лишь сообщает, какой именно труд нужен.
   */
  externalLookup: {
    workTitle: string;
    author: string;
  };
}

export const REAL_HUMAN_BOOKS_V18: RealHumanBookV18[] = [
  {
    id: 'euclid-elements',
    title: 'Начала',
    originalTitle: 'Στοιχεῖα',
    author: 'Евклид',
    approximateYear: -300,
    culture: 'Древняя Греция',
    category: 'mathematics',
    originalLanguage: 'древнегреческий',

    description:
      'Фундаментальный математический труд по геометрии, числам, пропорциям и доказательствам.',

    subjects: [
      'геометрия',
      'треугольники',
      'окружности',
      'пропорции',
      'площади',
      'простые числа',
      'математическое доказательство',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'Elements',
      author: 'Euclid',
    },
  },

  {
    id: 'ptolemy-almagest',
    title: 'Альмагест',
    originalTitle: 'Μαθηματικὴ Σύνταξις',
    author: 'Клавдий Птолемей',
    approximateYear: 150,
    culture: 'Греко-римский Египет',
    category: 'astronomy',
    originalLanguage: 'древнегреческий',

    description:
      'Большой античный труд по наблюдательной и математической астрономии.',

    subjects: [
      'движение небесных тел',
      'звёзды',
      'Солнце',
      'Луна',
      'затмения',
      'астрономические вычисления',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'Almagest',
      author: 'Claudius Ptolemy',
    },
  },

  {
    id: 'ptolemy-geography',
    title: 'География',
    originalTitle: 'Γεωγραφικὴ Ὑφήγησις',
    author: 'Клавдий Птолемей',
    approximateYear: 150,
    culture: 'Греко-римский Египет',
    category: 'geography',
    originalLanguage: 'древнегреческий',

    description:
      'Труд о картографии, координатах и описании известного мира.',

    subjects: [
      'карты',
      'координаты',
      'широта',
      'долгота',
      'география',
      'картография',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'Geography',
      author: 'Claudius Ptolemy',
    },
  },

  {
    id: 'vitruvius-architecture',
    title: 'Десять книг об архитектуре',
    originalTitle: 'De architectura',
    author: 'Марк Витрувий Поллион',
    approximateYear: -20,
    culture: 'Древний Рим',
    category: 'architecture',
    originalLanguage: 'латынь',

    description:
      'Римский трактат об архитектуре, строительстве, материалах, машинах и устройстве городов.',

    subjects: [
      'архитектура',
      'строительные материалы',
      'фундаменты',
      'водоснабжение',
      'механизмы',
      'планировка',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'De architectura',
      author: 'Vitruvius',
    },
  },

  {
    id: 'pliny-natural-history',
    title: 'Естественная история',
    originalTitle: 'Naturalis Historia',
    author: 'Плиний Старший',
    approximateYear: 77,
    culture: 'Древний Рим',
    category: 'natural_science',
    originalLanguage: 'латынь',

    description:
      'Античная энциклопедия о природе, растениях, животных, минералах, ремёслах и медицине своего времени.',

    subjects: [
      'растения',
      'животные',
      'минералы',
      'металлы',
      'земледелие',
      'лекарственные вещества',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'Naturalis Historia',
      author: 'Pliny the Elder',
    },
  },

  {
    id: 'galen-method-of-medicine',
    title: 'Метод врачевания',
    author: 'Гален',
    approximateYear: 180,
    culture: 'Римская империя',
    category: 'medicine',
    originalLanguage: 'древнегреческий',

    description:
      'Медицинский труд Галена о диагностике и лечении в рамках античной медицины.',

    subjects: [
      'анатомические наблюдения',
      'диагностика',
      'лечение',
      'раны',
      'болезни',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'Method of Medicine',
      author: 'Galen',
    },
  },

  {
    id: 'dioscorides-materia-medica',
    title: 'О лекарственных веществах',
    originalTitle: 'De materia medica',
    author: 'Диоскорид',
    approximateYear: 60,
    culture: 'Римская империя',
    category: 'medicine',
    originalLanguage: 'древнегреческий',

    description:
      'Один из важнейших античных трудов о лекарственных растениях и веществах.',

    subjects: [
      'лекарственные растения',
      'растительное сырьё',
      'масла',
      'мази',
      'лекарственные вещества',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'De materia medica',
      author: 'Pedanius Dioscorides',
    },
  },

  {
    id: 'al-khwarizmi-algebra',
    title: 'Краткая книга об исчислении восполнения и противопоставления',
    author: 'Мухаммад аль-Хорезми',
    approximateYear: 825,
    culture: 'Аббасидский халифат',
    category: 'mathematics',
    originalLanguage: 'арабский',

    description:
      'Один из основополагающих трудов по систематическому решению алгебраических задач.',

    subjects: [
      'алгебра',
      'уравнения',
      'арифметика',
      'наследство',
      'торговые расчёты',
      'измерение земли',
    ],

    removable: false,

    externalLookup: {
      workTitle:
        'The Compendious Book on Calculation by Completion and Balancing',
      author: 'Muhammad ibn Musa al-Khwarizmi',
    },
  },

  {
    id: 'ibn-sina-canon',
    title: 'Канон врачебной науки',
    originalTitle: 'القانون في الطب',
    author: 'Ибн Сина',
    approximateYear: 1025,
    culture: 'Персидско-исламский мир',
    category: 'medicine',
    originalLanguage: 'арабский',

    description:
      'Крупный систематический медицинский труд Средневековья.',

    subjects: [
      'медицина',
      'диагностика',
      'лекарства',
      'анатомия',
      'болезни',
      'гигиена',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'The Canon of Medicine',
      author: 'Avicenna',
    },
  },

  {
    id: 'al-zahrawi-tasrif',
    title: 'Китаб ат-Тасриф',
    author: 'Абу аль-Касим аз-Захрави',
    approximateYear: 1000,
    culture: 'Аль-Андалус',
    category: 'medicine',
    originalLanguage: 'арабский',

    description:
      'Большой медицинский труд, особенно известный разделами по хирургии и хирургическим инструментам.',

    subjects: [
      'хирургия',
      'раны',
      'переломы',
      'хирургические инструменты',
      'прижигание',
      'акушерство',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'Kitab al-Tasrif',
      author: 'Al-Zahrawi',
    },
  },

  {
    id: 'ibn-al-haytham-optics',
    title: 'Книга оптики',
    originalTitle: 'كتاب المناظر',
    author: 'Ибн аль-Хайсам',
    approximateYear: 1021,
    culture: 'Исламский мир',
    category: 'natural_science',
    originalLanguage: 'арабский',

    description:
      'Исследование света, зрения, отражения и преломления с сильным упором на наблюдение и эксперимент.',

    subjects: [
      'свет',
      'зрение',
      'отражение',
      'преломление',
      'оптика',
      'эксперимент',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'Book of Optics',
      author: 'Ibn al-Haytham',
    },
  },

  {
    id: 'al-biruni-india',
    title: 'Книга об Индии',
    author: 'Аль-Бируни',
    approximateYear: 1030,
    culture: 'Исламский мир',
    category: 'geography',
    originalLanguage: 'арабский',

    description:
      'Исследование географии, науки, календарей, культуры и знаний Индии.',

    subjects: [
      'география',
      'астрономия',
      'календарь',
      'измерения',
      'культура',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'Kitab al-Hind',
      author: 'Al-Biruni',
    },
  },

  {
    id: 'fibonnaci-liber-abaci',
    title: 'Книга абака',
    originalTitle: 'Liber Abaci',
    author: 'Леонардо Фибоначчи',
    approximateYear: 1202,
    culture: 'Средневековая Италия',
    category: 'mathematics',
    originalLanguage: 'латынь',

    description:
      'Труд, распространявший в Европе позиционную систему счисления и практическую торговую арифметику.',

    subjects: [
      'арабские цифры',
      'ноль',
      'арифметика',
      'дроби',
      'торговые расчёты',
      'обмен валют',
      'проценты',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'Liber Abaci',
      author: 'Leonardo Fibonacci',
    },
  },

  {
    id: 'crescenzi-agriculture',
    title: 'О сельском хозяйстве',
    originalTitle: 'Ruralia commoda',
    author: 'Пьетро де Крешенци',
    approximateYear: 1305,
    culture: 'Средневековая Италия',
    category: 'agriculture',
    originalLanguage: 'латынь',

    description:
      'Средневековый систематический труд о земледелии, садах, животных и управлении хозяйством.',

    subjects: [
      'земледелие',
      'почва',
      'сады',
      'виноград',
      'животноводство',
      'хозяйство',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'Ruralia commoda',
      author: 'Pietro de Crescenzi',
    },
  },

  {
    id: 'vegetius-military',
    title: 'Краткое изложение военного дела',
    originalTitle: 'De re militari',
    author: 'Вегеций',
    approximateYear: 390,
    culture: 'Поздняя Римская империя',
    category: 'military',
    originalLanguage: 'латынь',

    description:
      'Античный военный трактат об обучении войск, организации, лагерях, маршах и снабжении.',

    subjects: [
      'военная подготовка',
      'строй',
      'караул',
      'лагерь',
      'марш',
      'снабжение',
      'дисциплина',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'De re militari',
      author: 'Vegetius',
    },
  },

  {
    id: 'frontinus-aqueducts',
    title: 'О водопроводах города Рима',
    originalTitle: 'De aquaeductu',
    author: 'Секст Юлий Фронтин',
    approximateYear: 97,
    culture: 'Древний Рим',
    category: 'engineering',
    originalLanguage: 'латынь',

    description:
      'Практический труд об устройстве, эксплуатации и управлении римскими акведуками.',

    subjects: [
      'водоснабжение',
      'акведук',
      'измерение воды',
      'обслуживание сооружений',
      'городская инфраструктура',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'De aquaeductu',
      author: 'Frontinus',
    },
  },

  {
    id: 'aristotle-politics',
    title: 'Политика',
    originalTitle: 'Πολιτικά',
    author: 'Аристотель',
    approximateYear: -330,
    culture: 'Древняя Греция',
    category: 'governance',
    originalLanguage: 'древнегреческий',

    description:
      'Философский анализ государства, устройства общества, законов и различных форм правления.',

    subjects: [
      'государство',
      'общество',
      'законы',
      'управление',
      'гражданство',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'Politics',
      author: 'Aristotle',
    },
  },

  {
    id: 'roman-law-justinian',
    title: 'Свод гражданского права',
    originalTitle: 'Corpus Juris Civilis',
    author: 'Юстиниан I и составители комиссии',
    approximateYear: 534,
    culture: 'Византийская империя',
    category: 'law',
    originalLanguage: 'латынь',

    description:
      'Большая систематизация римского права, включая собственность, обязательства, наследование и судебные нормы.',

    subjects: [
      'право',
      'собственность',
      'договоры',
      'долги',
      'наследование',
      'суды',
    ],

    removable: false,

    externalLookup: {
      workTitle: 'Corpus Juris Civilis',
      author: 'Justinian I',
    },
  },
];

export function getRealHumanBookV18(
  id: string,
): RealHumanBookV18 | undefined {
  return REAL_HUMAN_BOOKS_V18.find(
    (book) => book.id === id,
  );
}

export function getRealHumanBooksByCategoryV18(
  category: SecretLibraryBookCategoryV18,
): RealHumanBookV18[] {
  return REAL_HUMAN_BOOKS_V18.filter(
    (book) => book.category === category,
  );
}

export function searchRealHumanBooksV18(
  query: string,
): RealHumanBookV18[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  return REAL_HUMAN_BOOKS_V18.filter((book) => {
    const searchable = [
      book.title,
      book.originalTitle ?? '',
      book.author,
      book.description,
      ...book.subjects,
    ]
      .join(' ')
      .toLowerCase();

    return searchable.includes(normalized);
  });
}
