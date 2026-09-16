import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';
import { hasLibraryAdmission } from '../v21/LibraryAdmissions';
import type { AgentActionKind, AgentState, WorldState } from '../world/types';

/**
 * Stable public catalogue.  The tuple shape is kept because the browser and
 * old saves already consume it.  A grant is potential, not an instant maxed
 * stat: semantic strength comes from the saved mastery on the grant.
 */
export const GIFT_CATALOG_V20 = {
  might: ['Крепкое тело', 'Потенциал силы и выносливости растёт только через реальный труд, путь и нагрузку.'],
  tireless: ['Неутомимый', 'С практикой медленнее устаёт при настоящей работе и в пути.'],
  longevity: ['Долголетие', 'По мере освоения замедляет взрослое биологическое старение; не делает бессмертным.'],
  robust_health: ['Крепкое здоровье', 'Постепенно повышает устойчивость к болезням и вредной среде, не отменяя голод и ранения.'],
  rapid_healing: ['Быстрое исцеление', 'По мере освоения ускоряет собственное восстановление при наличии еды и отдыха.'],
  agility: ['Проворность', 'Практика движения и опасных ситуаций развивает подвижность и уклонение.'],
  keen_eye: ['Острый глаз', 'Наблюдение и разведка развивают способность замечать близкую угрозу и признаки ресурсов.'],
  great_mind: ['Великий ум', 'Реальное обучение и размышление постепенно усиливают понимание причин и последствий.'],
  genius_inventor: ['Изобретатель', 'Практические попытки постепенно улучшают способность соединять уже известные идеи.'],
  perfect_memory: ['Совершенная память', 'Развивается через использование памяти и постепенно замедляет забывание прожитого знания.'],
  fast_learning: ['Быстрое обучение', 'Усиливается только реальным занятием, практикой и проверенными результатами.'],
  gifted_teacher: ['Учитель', 'Растёт через успешное личное обучение других, не копируя им знания мгновенно.'],
  eloquence: ['Красноречие', 'Развивается в разговорах; помогает быть понятым, сохраняя право собеседника отказаться.'],
  charm: ['Очарование', 'Развивается в личном общении и влияет только на впечатление, не переписывая чувства другого.'],
  crowd_charisma: ['Глас толпы', 'Развивается через реальные выступления; слова могут достигнуть нескольких присутствующих слушателей.'],
  iron_will: ['Несгибаемая воля', 'Испытания и пережитая опасность постепенно повышают устойчивость к страху и стрессу.'],
  premonition: ['Предчувствие', 'Опыт риска постепенно повышает редкий шанс заметить непосредственную опасность заранее.'],
  pathfinder: ['Следопыт', 'Реальная разведка постепенно усиливает навигацию и исследовательскую практику.'],
  beast_friend: ['Друг зверей', 'Мирные близкие встречи постепенно снижают риск агрессии обычной фауны.'],
  warrior_talent: ['Воинский талант', 'Осваивается через реальные столкновения и занятия, а не выдачей готового мастерства.'],
  master_craft: ['Мастер ремесла', 'Осваивается через настоящее ремесло, которое житель выбирает сам.'],
  fertility: ['Плодородие', 'Умеренно помогает физическому зачатию и вынашиванию; не заставляет хотеть детей и имеет жёсткие пределы для многоплодия.'],
  luck: ['Удача', 'Постепенно и лишь немного улучшает случайные рискованные исходы.'],
  divine_protection: ['Защита божества', 'По мере освоения даёт редкий шанс пережить смертельное событие.'],
  discovery_spark: ['Искра открытия', 'Практические попытки помогают соединять уже известные идеи; знаний из будущего не даёт.'],
  legacy: ['Наследие', 'Усиливает шанс передачи одного выбранного существующего дара ребёнку; сам дар не заменяет родительское обучение.'],
  marked: ['Отмеченный', 'Видимый знак без прямой прибавки к характеристикам; толкование принадлежит свидетелям.'],
  healing_touch: ['Дар исцеления', 'Начинается с мелких ран и недомоганий и растёт через реальную помощь до тяжёлых ранений и болезней.'],
  demon_king_hero: ['Герой — комплекс даров', 'Потенциал силы, ума, подвижности, выносливости и боя; каждый компонент развивается прожитой практикой.'],
  immortality: ['Способность: Бессмертие', 'Искра не умирает, но навсегда теряет способность иметь потомство; способность не наследуется. Передавать другим она может лишь знания, приобретённые за последние 50 прожитых лет.'],
  eternal_youth: ['Способность: Вечная молодость', 'Хронологический возраст и прожитая история сохраняются, но тело не стареет дальше зрелого возраста. Искра остаётся смертной от ран, болезней и катастроф; способность не наследуется.'],
  phoenix: ['Способность: Феникс', 'Один раз за жизнь возвращает Искру с порога нестарческой смерти. После срабатывания способность считается исчерпанной и не наследуется.'],
  living_archive: ['Способность: Живой архив', 'Личная память не разрушается от стресса и возраста, но знание по-прежнему надо получить самому и передавать другим только обычным общением и обучением. Способность не наследуется.'],
} as const;

export type GiftKindV20 = keyof typeof GIFT_CATALOG_V20;

export const DIVINE_BURDEN_CATALOG_V22 = {
  misfortune: ['Печать неудачи', 'Небольшая, но постоянная потеря удачных исходов; решения Искры остаются её собственными.'],
  frailty: ['Хрупкость', 'Тело хуже переносит болезнь, опасность и восстановление; это не принудительная болезнь по расписанию.'],
  empty_hands: ['Пустые руки', 'Часть личной добычи и заработка чаще теряется или расходуется; поселковые склады не исчезают магически.'],
  discord: ['Тень раздора', 'Общение становится труднее и чаще оставляет напряжение, но чувства и выбор окружающих не переписываются.'],
} as const;
export type DivineBurdenKindV22 = keyof typeof DIVINE_BURDEN_CATALOG_V22;

const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const EXCEPTIONAL_ABILITIES_V22 = ['immortality', 'eternal_youth', 'phoenix', 'living_archive'] as const satisfies readonly GiftKindV20[];
const BINARY_GIFTS = new Set<GiftKindV20>(['legacy', 'marked', ...EXCEPTIONAL_ABILITIES_V22]);
const NEVER_HERITABLE = new Set<GiftKindV20>(['legacy', 'marked', ...EXCEPTIONAL_ABILITIES_V22, 'demon_king_hero']);
export const IMMORTAL_KNOWLEDGE_TRANSFER_WINDOW_WORLD_MINUTES = 50 * WORLD_MINUTES_PER_YEAR;

export function initialGiftMasteryV20(kind: GiftKindV20): number {
  if (BINARY_GIFTS.has(kind)) return 1;
  return kind === 'demon_king_hero' ? 0.06 : 0.08;
}

export function giftGrantV20(world: Readonly<WorldState>, agentId: string, kind: GiftKindV20) {
  return world.v19?.divineAgency.byAgentId[agentId]?.gifts.find((grant) => grant.gift === kind);
}

export function hasGiftV20(world: Readonly<WorldState>, agentId: string, kind: GiftKindV20): boolean {
  return Boolean(giftGrantV20(world, agentId, kind));
}

export function burdenIntensityV22(
  world: Readonly<WorldState>,
  agentId: string,
  kind: DivineBurdenKindV22,
): number {
  const burden = world.v19?.divineAgency.byAgentId[agentId]?.burdens?.find((entry) => entry.burden === kind);
  return clamp(burden?.intensity ?? 0);
}

export function hasBurdenV22(world: Readonly<WorldState>, agentId: string, kind: DivineBurdenKindV22): boolean {
  return burdenIntensityV22(world, agentId, kind) > 0;
}

/** Fraction of a cursed resident's *personal* money gain that remains in their
 * wallet.  This never touches settlement warehouses or another resident's
 * holdings and is evaluated only when an earning actually occurs, so the
 * curse adds no per-tick population scan. */
export function personalEarningRetentionV22(
  world: Readonly<WorldState>,
  agentId: string,
): number {
  return clamp(1 - burdenIntensityV22(world, agentId, 'empty_hands') * 0.35);
}

/** Semantic strength, 0..1. Old saves without the new fields migrate to the
 * same small starting potential instead of silently retaining a maxed bonus. */
export function giftMasteryV20(world: Readonly<WorldState>, agentId: string, kind: GiftKindV20): number {
  const grant = giftGrantV20(world, agentId, kind);
  if (!grant) return 0;
  return clamp(grant.mastery ?? initialGiftMasteryV20(kind));
}

export function isImmortalV20(world: Readonly<WorldState>, agentId: string): boolean {
  return hasGiftV20(world, agentId, 'immortality');
}

export function isExceptionalAbilityV22(kind: GiftKindV20): boolean {
  return (EXCEPTIONAL_ABILITIES_V22 as readonly GiftKindV20[]).includes(kind);
}

/** Phoenix is an explicit one-shot cheat-like ability. It is consumed only
 * when a real fatal event occurs, so it adds no per-tick simulation work. */
export function triggerPhoenixV22(world: WorldState, agentId: string): boolean {
  const grant = giftGrantV20(world, agentId, 'phoenix');
  if (!grant || (grant.triggerCount ?? 0) >= 1) return false;
  grant.triggerCount = (grant.triggerCount ?? 0) + 1;
  grant.lastPracticedWorldMinute = world.calendar.elapsedWorldMinutes;
  return true;
}

export function giftIsHeritableV20(kind: GiftKindV20): boolean {
  return !NEVER_HERITABLE.has(kind);
}

/** Natural inheritance is deliberately weak.  The explicit Legacy blessing
 * can raise the selected gift's chance, but never makes inheritance certain. */
export function giftInheritanceChanceV20(
  kind: GiftKindV20,
  mastery: number,
  legacySelected = false,
): number {
  if (!giftIsHeritableV20(kind)) return 0;
  return clamp(0.015 + mastery * 0.055 + (legacySelected ? 0.18 : 0));
}

export function inheritedGiftMasteryV20(kind: GiftKindV20, parentMastery: number): number {
  if (!giftIsHeritableV20(kind)) return 0;
  return clamp(Math.max(0.035, Math.min(0.22, parentMastery * 0.24)));
}

/** A gift grows only after the matching lived action actually happened. */
export function practiceGiftV20(
  world: WorldState,
  agentId: string,
  kind: GiftKindV20,
  amount: number,
  worldMinute = world.calendar.elapsedWorldMinutes,
): number {
  const grant = world.v19?.divineAgency.byAgentId[agentId]?.gifts.find((item) => item.gift === kind);
  if (!grant) return 0;
  grant.mastery ??= initialGiftMasteryV20(kind);
  grant.practiceCount ??= 0;
  if (BINARY_GIFTS.has(kind) || !(amount > 0)) return grant.mastery;
  const delta = Math.min(0.02, amount) * (0.35 + (1 - grant.mastery) * 0.65);
  grant.mastery = clamp(grant.mastery + delta);
  grant.practiceCount = Math.min(1_000_000, grant.practiceCount + 1);
  grant.lastPracticedWorldMinute = worldMinute;
  return grant.mastery;
}

function practiceActionGiftsV20(world: WorldState, agent: AgentState, action: AgentActionKind, magnitude: number): void {
  const profile = world.v19?.divineAgency.byAgentId[agent.id];
  if (!profile || !(magnitude > 0)) return;
  const mapping: Partial<Record<AgentActionKind, GiftKindV20[]>> = {
    work: ['might', 'tireless', 'master_craft', 'genius_inventor', 'discovery_spark'],
    gather: ['might', 'tireless', 'keen_eye'],
    hunt: ['might', 'agility', 'keen_eye', 'iron_will', 'premonition', 'warrior_talent'],
    explore: ['tireless', 'agility', 'keen_eye', 'iron_will', 'premonition', 'pathfinder', 'discovery_spark'],
    help: ['healing_touch', 'gifted_teacher', 'iron_will'],
    socialize: ['eloquence', 'charm', 'crowd_charisma', 'gifted_teacher'],
    reflect: ['great_mind', 'perfect_memory', 'genius_inventor', 'discovery_spark'],
    pray: ['iron_will'],
  };
  for (const kind of mapping[action] ?? []) {
    if (profile.gifts.some((grant) => grant.gift === kind)) {
      practiceGiftV20(world, agent.id, kind, magnitude);
    }
  }
  if (profile.gifts.some((grant) => grant.gift === 'demon_king_hero') && ['work','hunt','explore','help','reflect'].includes(action)) {
    practiceGiftV20(world, agent.id, 'demon_king_hero', magnitude * 0.65);
  }
}

export function learningFactorV20(world: Readonly<WorldState>, agent: Readonly<AgentState>, domain = ''): number {
  let factor = 1;
  factor += 0.7 * giftMasteryV20(world, agent.id, 'fast_learning');
  factor += 0.35 * giftMasteryV20(world, agent.id, 'great_mind');
  if (domain === 'craft') factor += 0.8 * giftMasteryV20(world, agent.id, 'master_craft');
  if (domain === 'exploration') factor += 0.8 * giftMasteryV20(world, agent.id, 'pathfinder');
  if (domain === 'hunting') factor += 0.7 * giftMasteryV20(world, agent.id, 'warrior_talent');
  factor += 0.22 * giftMasteryV20(world, agent.id, 'demon_king_hero');
  return factor;
}

export function giftLearningSnapshotV20(world: Readonly<WorldState>, agent: Readonly<AgentState>) {
  const profile = world.v15?.knowledgeByAgentId[agent.id];
  return { skills: { ...agent.skills }, energy: agent.energy, resources: agent.resources,
    domains: { agriculture: profile?.agriculture ?? 0, construction: profile?.construction ?? 0,
      household: profile?.household ?? 0, survival: profile?.survival ?? 0 } };
}

export function applyLivedGiftLearningV20(world: WorldState, agent: AgentState, before: ReturnType<typeof giftLearningSnapshotV20>): void {
  let livedGain = 0;
  for (const key of Object.keys(agent.skills) as Array<keyof AgentState['skills']>) {
    const gained = Math.max(0, agent.skills[key] - before.skills[key]);
    livedGain += gained;
    agent.skills[key] = clamp(agent.skills[key] + gained * (learningFactorV20(world, agent, key) - 1));
  }
  const profile = world.v15?.knowledgeByAgentId[agent.id];
  if (profile) for (const key of Object.keys(before.domains) as Array<keyof typeof before.domains>) {
    const gained = Math.max(0, profile[key] - before.domains[key]);
    livedGain += gained;
    profile[key] = clamp(profile[key] + gained * (learningFactorV20(world, agent) - 1));
  }
  const tireless = giftMasteryV20(world, agent.id, 'tireless');
  if (tireless > 0) agent.energy = clamp(agent.energy + Math.max(0, before.energy-agent.energy) * (0.12 + tireless * 0.58));
  const emptyHands = burdenIntensityV22(world, agent.id, 'empty_hands');
  const personalGain = Math.max(0, agent.resources - before.resources);
  if (emptyHands > 0 && personalGain > 0) {
    // The curse wastes a fraction of personal gain only; shared warehouses and
    // other residents' property are never deleted by magic.
    agent.resources = clamp(agent.resources - personalGain * 0.3 * emptyHands);
  }
  // Fast learning is practised by an actual verified gain, not by idling.
  // applyLivedGiftLearningV20 is called only around a lived action, so this
  // keeps progression causal without another scheduler or population scan.
  if (livedGain > 0 && hasGiftV20(world, agent.id, 'fast_learning')) {
    practiceGiftV20(
      world,
      agent.id,
      'fast_learning',
      Math.max(0.0003, Math.min(0.004, livedGain * 0.22)),
    );
  }
  const will = giftMasteryV20(world, agent.id, 'iron_will');
  if (will > 0) {
    agent.stress *= 1 - 0.05 * will;
    agent.mind.emotions.fear *= 1 - 0.08 * will;
  }
  const action = agent.lastAction;
  if (action) practiceActionGiftsV20(world, agent, action, Math.max(0.00025, Math.min(0.004, livedGain * 0.18 + 0.00035)));
}

export function canImmortalTransmitKnowledgeV20(
  world: Readonly<WorldState>,
  speakerId: string,
  acquiredWorldMinute: number,
): boolean {
  if (!isImmortalV20(world, speakerId)) return true;
  return world.calendar.elapsedWorldMinutes - acquiredWorldMinute <= IMMORTAL_KNOWLEDGE_TRANSFER_WINDOW_WORLD_MINUTES;
}

export function canReadLibraryV20(agent: Readonly<AgentState>, libraryId: string, world?: Readonly<WorldState>): boolean {
  return !!world && agent.locationId === libraryId && !agent.movement && hasLibraryAdmission(world, agent, libraryId);
}
