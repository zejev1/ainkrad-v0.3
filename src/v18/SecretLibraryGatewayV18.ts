/**
 * Ainkrad v18 — Secret Library External Knowledge Gateway
 *
 * Этот файл даёт Тайной библиотеке реальный доступ к публичным
 * человеческим текстам через Wikisource / MediaWiki API.
 *
 * ВАЖНО:
 * - остальные NPC не получают прямой интернет-доступ;
 * - Cardinal не получает прямой интернет-доступ;
 * - внешний текст проходит только через функции этого gateway;
 * - книги остаются "внутри" библиотеки как материал для чтения;
 * - наружу NPC уносит только понятое знание.
 */

export type SecretLibrarySourceLanguageV18 =
  | 'en'
  | 'ru'
  | 'de'
  | 'fr'
  | 'it'
  | 'es'
  | 'la';

export interface SecretLibraryExternalTextV18 {
  source: 'wikisource';

  language: SecretLibrarySourceLanguageV18;

  title: string;

  /**
   * Реальный URL страницы источника.
   */
  sourceUrl: string;

  /**
   * Очищенный текст страницы.
   */
  text: string;

  /**
   * Время получения текста из настоящего мира.
   */
  fetchedAtRealTime: number;
}

export interface SecretLibrarySearchResultV18 {
  title: string;
  snippet: string;
  sourceUrl: string;
}

const WIKISOURCE_HOSTS_V18: Record<
  SecretLibrarySourceLanguageV18,
  string
> = {
  en: 'https://en.wikisource.org',
  ru: 'https://ru.wikisource.org',
  de: 'https://de.wikisource.org',
  fr: 'https://fr.wikisource.org',
  it: 'https://it.wikisource.org',
  es: 'https://es.wikisource.org',
  la: 'https://la.wikisource.org',
};

/**
 * Ограничение размера одного загруженного текста.
 *
 * Это защита браузера Ainkrad от случайной загрузки
 * огромного документа целиком.
 */
export const SECRET_LIBRARY_MAX_TEXT_LENGTH_V18 = 120_000;

/**
 * Только Wikisource разрешён этому gateway.
 *
 * Никакого произвольного URL от NPC.
 */
function getWikisourceHostV18(
  language: SecretLibrarySourceLanguageV18,
): string {
  return WIKISOURCE_HOSTS_V18[language];
}

function buildApiUrlV18(
  language: SecretLibrarySourceLanguageV18,
  params: Record<string, string>,
): string {
  const host = getWikisourceHostV18(language);

  const url = new URL(`${host}/w/api.php`);

  url.searchParams.set('origin', '*');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function htmlToReadableTextV18(html: string): string {
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();

    const document = parser.parseFromString(
      html,
      'text/html',
    );

    document
      .querySelectorAll(
        [
          'script',
          'style',
          'noscript',
          'table',
          '.mw-editsection',
          '.navigation',
          '.metadata',
          '.sistersitebox',
        ].join(','),
      )
      .forEach((element) => element.remove());

    return (document.body.textContent ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Fallback для окружений без DOMParser.
   * Это не идеальный HTML parser, но gateway всё равно
   * останется работоспособным вне браузера.
   */
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Поиск настоящего произведения в Wikisource.
 */
export async function searchRealHumanTextsV18(
  query: string,
  language: SecretLibrarySourceLanguageV18 = 'en',
  limit = 10,
): Promise<SecretLibrarySearchResultV18[]> {
  const cleanQuery = query.trim();

  if (!cleanQuery) {
    return [];
  }

  const safeLimit = Math.max(
    1,
    Math.min(20, Math.floor(limit)),
  );

  const url = buildApiUrlV18(language, {
    action: 'query',
    list: 'search',
    srsearch: cleanQuery,
    srnamespace: '0',
    srlimit: String(safeLimit),
  });

  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Secret Library search failed: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as {
    query?: {
      search?: Array<{
        title: string;
        snippet?: string;
      }>;
    };
  };

  const host = getWikisourceHostV18(language);

  return (data.query?.search ?? []).map((entry) => ({
    title: entry.title,

    snippet: htmlToReadableTextV18(
      entry.snippet ?? '',
    ),

    sourceUrl:
      `${host}/wiki/${encodeURIComponent(
        entry.title.replace(/ /g, '_'),
      )}`,
  }));
}

/**
 * Загрузить настоящий текст конкретной страницы Wikisource.
 *
 * Например:
 *
 * fetchRealHumanTextV18(
 *   'The Elements of Euclid',
 *   'en'
 * )
 */
export async function fetchRealHumanTextV18(
  pageTitle: string,
  language: SecretLibrarySourceLanguageV18 = 'en',
): Promise<SecretLibraryExternalTextV18> {
  const cleanTitle = pageTitle.trim();

  if (!cleanTitle) {
    throw new Error(
      'Secret Library cannot fetch an empty book title.',
    );
  }

  const url = buildApiUrlV18(language, {
    action: 'parse',
    page: cleanTitle,
    prop: 'text',
    redirects: '1',
  });

  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Secret Library fetch failed: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as {
    parse?: {
      title?: string;
      text?: string;
    };

    error?: {
      code?: string;
      info?: string;
    };
  };

  if (data.error) {
    throw new Error(
      `Secret Library source error: ${
        data.error.info ??
        data.error.code ??
        'unknown error'
      }`,
    );
  }

  if (!data.parse?.text) {
    throw new Error(
      `Secret Library found no readable text for "${cleanTitle}".`,
    );
  }

  let readableText =
    htmlToReadableTextV18(data.parse.text);

  if (
    readableText.length >
    SECRET_LIBRARY_MAX_TEXT_LENGTH_V18
  ) {
    readableText = readableText.slice(
      0,
      SECRET_LIBRARY_MAX_TEXT_LENGTH_V18,
    );
  }

  const host = getWikisourceHostV18(language);

  const resolvedTitle =
    data.parse.title ?? cleanTitle;

  return {
    source: 'wikisource',

    language,

    title: resolvedTitle,

    sourceUrl:
      `${host}/wiki/${encodeURIComponent(
        resolvedTitle.replace(/ /g, '_'),
      )}`,

    text: readableText,

    fetchedAtRealTime: Date.now(),
  };
}

/**
 * Удобная функция:
 *
 * NPC/Хранитель задаёт тему -> gateway ищет реальные тексты.
 *
 * Важно: это всё ещё поиск книг, а не "ответ ИИ".
 * Источником остаётся настоящий человеческий текст.
 */
export async function findBooksForSecretLibraryV18(
  subject: string,
  language: SecretLibrarySourceLanguageV18 = 'en',
): Promise<SecretLibrarySearchResultV18[]> {
  return searchRealHumanTextsV18(
    subject,
    language,
    10,
  );
}

/**
 * Проверка, существует ли конкретная страница.
 */
export async function realHumanTextExistsV18(
  pageTitle: string,
  language: SecretLibrarySourceLanguageV18 = 'en',
): Promise<boolean> {
  const cleanTitle = pageTitle.trim();

  if (!cleanTitle) {
    return false;
  }

  const url = buildApiUrlV18(language, {
    action: 'query',
    titles: cleanTitle,
  });

  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as {
      query?: {
        pages?: Array<{
          title?: string;
          missing?: boolean;
        }>;
      };
    };

    const page = data.query?.pages?.[0];

    return Boolean(
      page &&
      page.missing !== true,
    );
  } catch {
    return false;
  }
}

/**
 * ЖЁСТКОЕ правило шлюза:
 *
 * Нельзя попросить Secret Library скачать произвольный URL.
 * Только заранее поддержанные источники.
 *
 * Если позже добавим Gutenberg, Internet Archive и т.п.,
 * они получат отдельные адаптеры.
 */
export function arbitraryInternetAccessAllowedV18(): false {
  return false;
}
