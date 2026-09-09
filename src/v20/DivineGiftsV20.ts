import type { AgentState, WorldState } from '../world/types';

/** Capabilities only: these grants never assign a vocation, belief or action. */
export const GIFT_CATALOG_V20 = {
  might: ['Крепкое тело', 'Сила, выносливость и переносимый запас для настоящего пути.'],
  tireless: ['Неутомимый', 'Медленнее устаёт при работе и в пути.'],
  longevity: ['Долголетие', 'Замедляет взрослое биологическое старение; не делает бессмертным.'],
  robust_health: ['Крепкое здоровье', 'Снижает вред от болезней, не отменяя голод и ранения.'],
  rapid_healing: ['Быстрое исцеление', 'Ускоряет восстановление ран при наличии еды и отдыха.'],
  agility: ['Проворность', 'Повышает подвижность и шанс уклониться от нападения.'],
  keen_eye: ['Острый глаз', 'Помогает заметить близкую угрозу и признаки ресурсов.'],
  great_mind: ['Великий ум', 'Усиливает понимание изученного и проверку причин и последствий.'],
  genius_inventor: ['Изобретатель', 'Помогает находить решения из уже изученных знаний.'],
  perfect_memory: ['Совершенная память', 'Замедляет забывание лично полученных знаний.'],
  fast_learning: ['Быстрое обучение', 'Усиливает результат реального занятия и практики.'],
  gifted_teacher: ['Учитель', 'Усиливает передачу собственных знаний при личном обучении.'],
  eloquence: ['Красноречие', 'Помогает быть понятым собеседником, сохраняя его право отказаться.'],
  charm: ['Очарование', 'Усиливает положительное впечатление при личном контакте.'],
  crowd_charisma: ['Глас толпы', 'Слова могут достигнуть нескольких присутствующих слушателей.'],
  iron_will: ['Несгибаемая воля', 'Снижает страх и стресс от угроз.'],
  premonition: ['Предчувствие', 'Иногда помогает избежать непосредственной опасности.'],
  pathfinder: ['Следопыт', 'Усиливает результаты самостоятельной разведки.'],
  beast_friend: ['Друг зверей', 'Снижает агрессию обычной фауны при близком столкновении.'],
  warrior_talent: ['Воинский талант', 'Ускоряет освоение боя через реальные столкновения и занятия.'],
  master_craft: ['Мастер ремесла', 'Усиливает практику ремесла, которое житель выбирает сам.'],
  fertility: ['Плодородие', 'Увеличивает вероятность зачатия после добровольного решения взрослых.'],
  luck: ['Удача', 'Немного улучшает шансы при рискованном исходе.'],
  divine_protection: ['Защита божества', 'Даёт небольшой шанс пережить смертельное событие.'],
  discovery_spark: ['Искра открытия', 'Помогает соединять известные идеи; знаний из будущего не даёт.'],
  legacy: ['Наследие', 'Один выбранный существующий дар имеет шанс перейти ребёнку.'],
  marked: ['Отмеченный', 'Видимый знак без прибавок к характеристикам; толкование принадлежит свидетелям.'],
  healing_touch: ['Дар исцеления', 'Позволяет помочь раненому при личном контакте.'],
  demon_king_hero: ['Герой — комплекс даров', 'Сила, ум, подвижность, выносливость и боевой потенциал; поступки выбирает житель.'],
} as const;

export type GiftKindV20 = keyof typeof GIFT_CATALOG_V20;

export function hasGiftV20(world: Readonly<WorldState>, agentId: string, kind: GiftKindV20): boolean {
  return Boolean(world.v19?.divineAgency.byAgentId[agentId]?.gifts.some(grant => grant.gift === kind));
}

export function learningFactorV20(world: Readonly<WorldState>, agent: Readonly<AgentState>, domain = ''): number {
  let factor = 1;
  if (hasGiftV20(world, agent.id, 'fast_learning')) factor += 0.7;
  if (hasGiftV20(world, agent.id, 'great_mind')) factor += 0.35;
  if (domain === 'craft' && hasGiftV20(world, agent.id, 'master_craft')) factor += 0.8;
  if (domain === 'exploration' && hasGiftV20(world, agent.id, 'pathfinder')) factor += 0.8;
  if (domain === 'hunting' && hasGiftV20(world, agent.id, 'warrior_talent')) factor += 0.7;
  return factor;
}

export function giftLearningSnapshotV20(world: Readonly<WorldState>, agent: Readonly<AgentState>) {
  const profile = world.v15?.knowledgeByAgentId[agent.id];
  return { skills: { ...agent.skills }, energy: agent.energy,
    domains: { agriculture: profile?.agriculture ?? 0, construction: profile?.construction ?? 0,
      household: profile?.household ?? 0, survival: profile?.survival ?? 0 } };
}

export function applyLivedGiftLearningV20(world: WorldState, agent: AgentState, before: ReturnType<typeof giftLearningSnapshotV20>): void {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  for (const key of Object.keys(agent.skills) as Array<keyof AgentState['skills']>) {
    const gained = Math.max(0, agent.skills[key] - before.skills[key]);
    agent.skills[key] = clamp(agent.skills[key] + gained * (learningFactorV20(world, agent, key) - 1));
  }
  const profile = world.v15?.knowledgeByAgentId[agent.id];
  if (profile) for (const key of Object.keys(before.domains) as Array<keyof typeof before.domains>) {
    const gained = Math.max(0, profile[key] - before.domains[key]);
    profile[key] = clamp(profile[key] + gained * (learningFactorV20(world, agent) - 1));
  }
  if (hasGiftV20(world, agent.id, 'tireless')) agent.energy = clamp(agent.energy + Math.max(0, before.energy-agent.energy)*0.7);
  if (hasGiftV20(world, agent.id, 'iron_will')) {
    agent.stress *= 0.95;
    agent.mind.emotions.fear *= 0.92;
  }
}

export function canReadLibraryV20(agent: Readonly<AgentState>, libraryId: string): boolean {
  return (agent.race ?? 'human') === (libraryId === 'elf_library_v20' ? 'elf' : 'human');
}
