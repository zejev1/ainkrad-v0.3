import type { WorldState, AgentState } from '../world/types';
import type { SecretLibraryStudyMaterialV18 } from '../v18/SecretLibraryV18';
import { ELF_LIBRARY_ID_V20 } from './KnowledgeBoundariesV20';
import { compactLibraryPlot } from '../world/SettlementLibraryLayout';

export function ensureElfLibraryV20(world: WorldState): void {
  const center = world.places.settlement_elf_homeland;
  const model = world.places.secret_library_v18;
  if (!center || !model || world.places[ELF_LIBRARY_ID_V20]) return;
  const plot = compactLibraryPlot(world.places, {x: center.mapX, y: center.mapY}, ELF_LIBRARY_ID_V20);
  if (!plot) return;
  world.places[ELF_LIBRARY_ID_V20] = {
    ...structuredClone(model), id: ELF_LIBRARY_ID_V20, name: 'Дом памяти эльфов',
    mapX: plot.x, mapY: plot.y, urbanLayoutVersion: 1,
    settlementId: center.id, connectedPlaceIds: [center.id],
    discoveredAt: world.now,
  };
  center.connectedPlaceIds.push(ELF_LIBRARY_ID_V20);
}

const SAGES = [
  { id: 'confucius-learning', title: 'Конфуций: учение и размышление', category: 'education' as const,
    source: 'Лунь юй, книга II', url: 'https://ctext.org/analects/wei-zheng', year: -400,
    facts: ['Изученное необходимо обдумывать и сопоставлять с собственными поступками. Одного запоминания недостаточно.', 'Признавать границы собственного знания полезнее, чем выдавать предположение за достоверное знание.'], concepts: ['проверка знания', 'размышление', 'обучение'] },
  { id: 'laozi-restraint', title: 'Лао-цзы: умеренность управления', category: 'philosophy' as const,
    source: 'Дао дэ цзин', url: 'https://ctext.org/dao-de-jing', year: -300,
    facts: ['Чрезмерное вмешательство правителя может нарушить жизнь общины.', 'Умеренность и отказ от ненужного принуждения предлагаются как способы уменьшить разрушительные конфликты. Это философские положения, а не доказанные законы природы.'], concepts: ['умеренность', 'принуждение', 'наблюдение'] },
  { id: 'sunzi-terrain', title: 'Сунь-цзы: местность и снабжение', category: 'military' as const,
    source: 'Искусство войны', url: 'https://ctext.org/art-of-war', year: -400,
    facts: ['Перед походом нужно оценить местность, расстояние, снабжение и состояние людей.', 'Сведения о противнике необходимо добывать; неизвестную силу нельзя считать заранее понятной. Затяжная война истощает хозяйство.'], concepts: ['разведка', 'снабжение', 'местность'] },
];

export function elfStudyMaterialV20(sequence: number, fallback: SecretLibraryStudyMaterialV18): SecretLibraryStudyMaterialV18 {
  if (sequence % 3 !== 0) return fallback;
  const sage = SAGES[Math.floor(sequence / 3) % SAGES.length];
  return { knowledge: { id: sage.id, title: sage.title, category: sage.category,
    historicalSource: sage.source, knownByYear: sage.year, knowledge: [...sage.facts],
    concepts: [...sage.concepts], difficulty: 0.45 },
    domain: 'household', sourceTitle: sage.source, sourceUrl: sage.url };
}

/** 238 wpm is an adult modern non-fiction reference, not a medieval guarantee. */
export function readingBudgetV20(agent: Readonly<AgentState>, literacy: number, elapsedMinutes: number, difficulty: number) {
  const minutes = Math.max(0, elapsedMinutes) * 6 / 24;
  const wordsPerMinute = Math.max(10, 238 * Math.max(0.08, literacy) * (1 - difficulty * 0.55));
  return { minutes, wordsPerMinute, maximumWords: Math.floor(minutes * wordsPerMinute) };
}
