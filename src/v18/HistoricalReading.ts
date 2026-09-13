import type { HumanKnowledgeEntryV18 } from './HumanKnowledgeV18';
import { HISTORICAL_SOURCES } from './HistoricalSourceCorpus';

export const HUMAN_KNOWLEDGE_CUTOFF_YEAR = 1900;

/** Original text is divided into readable pages, not replaced by invented lessons. */
export const HISTORICAL_READING_MATERIALS: HumanKnowledgeEntryV18[] = HISTORICAL_SOURCES.flatMap(source => {
  if (source.year > HUMAN_KNOWLEDGE_CUTOFF_YEAR) return [];
  const words = source.paragraphs.join('\n\n').split(/\s+/u);
  const pages: HumanKnowledgeEntryV18[] = [];
  for (let offset = 0; offset < words.length; offset += 320) {
    pages.push({
      id: offset === 0 ? source.id : `${source.id}:page:${offset / 320 + 1}`,
      title: `${source.title} · страница ${offset / 320 + 1}`,
      category: source.category,
      historicalSource: `Энциклопедический словарь Брокгауза и Ефрона, ${source.year}`,
      sourceUrl: source.sourceUrl,
      sourceBookId: `historical:${source.id}`,
      knownByYear: source.year,
      knowledge: [words.slice(offset, offset + 320).join(' ')],
      concepts: [...source.concepts],
      difficulty: source.category === 'engineering' || source.category === 'medicine' ? 0.46 : 0.28,
    });
  }
  return pages;
});

/** Persistable bookmark. A short session accumulates instead of restarting the text. */
export function consumeReadingWords(
  progress: { pendingKnowledgeId?: string; pendingReadWords?: number },
  knowledgeId: string,
  totalWords: number,
  wordBudget: number,
): { wordsRead: number; completed: boolean } {
  if (progress.pendingKnowledgeId !== knowledgeId) {
    progress.pendingKnowledgeId = knowledgeId;
    progress.pendingReadWords = 0;
  }
  const before = Math.max(0, Math.min(totalWords, progress.pendingReadWords ?? 0));
  const wordsRead = Math.max(0, Math.min(totalWords - before, wordBudget));
  progress.pendingReadWords = before + wordsRead;
  return { wordsRead, completed: progress.pendingReadWords >= totalWords };
}
