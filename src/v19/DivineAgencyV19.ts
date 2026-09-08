import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';
import type {
  AgentState,
  DivineContactKind,
  DivineGiftKind,
  WorldState,
} from '../world/types';
import type {
  V19AgentDivineAgencyState,
  V19DeityRelationshipState,
  V19DivineContactRecord,
  V19DivineGiftGrant,
  V19DivineInterpretation,
  V19PrayerEmotion,
  V19PrayerEvidence,
  V19PrayerRecord,
  V19PrayerTopic,
  V19ReligionRecognitionState,
  V19SignificantPrayerHistoryEntry,
  WorldV19State,
} from './types';
import {
  assertAdventureEconomyV19,
  createAdventureEconomyV19,
  repairAdventureEconomyV19,
} from './AdventureEconomyV19';

export const WORLD_RULES_VERSION_V19 = 'ainkrad-world-rules-0.3.19';
export const WORLD_V19_SCHEMA_VERSION = 'v19' as const;
export const DIVINE_AGENCY_VERSION_V19 = 'divine-agency-v19' as const;

export const DIVINE_GIFTS_V19: readonly DivineGiftKind[] = [
  'longevity',
  'might',
  'genius_inventor',
  'crowd_charisma',
  'healing_touch',
  'demon_king_hero',
] as const;

export const DIVINE_CONTACT_KINDS_V19: readonly DivineContactKind[] = [
  'message',
  'revelation',
  'command',
  'request',
  'warning',
  'vision',
  'sign',
] as const;

export const PRAYER_TOPICS_V19: readonly V19PrayerTopic[] = [
  'health',
  'family',
  'grief',
  'hunger',
  'harvest',
  'war',
  'danger',
  'travel',
  'poverty',
  'gratitude',
  'purpose',
] as const;

export const MAX_RECENT_PRAYERS_V19 = 256;
export const MAX_SIGNIFICANT_PRAYERS_PER_AGENT_V19 = 12;
export const MAX_DIVINE_GIFTS_PER_AGENT_V19 = 12;
export const MAX_DIVINE_CONTACTS_PER_AGENT_V19 = 24;
export const MAX_DEITY_RELATIONSHIPS_PER_AGENT_V19 = 12;
export const MAX_RELIGION_SPEAKERS_V19 = 64;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const emptyPrayerCount = (): Record<V19PrayerTopic, number> => ({
  health: 0,
  family: 0,
  grief: 0,
  hunger: 0,
  harvest: 0,
  war: 0,
  danger: 0,
  travel: 0,
  poverty: 0,
  gratitude: 0,
  purpose: 0,
});

function emptyAgentState(agentId: string): V19AgentDivineAgencyState {
  return {
    agentId,
    gifts: [],
    contacts: [],
    deityRelationships: [],
    significantPrayers: [],
    totalPrayerCount: 0,
  };
}

function legacyCallingToV19(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
  profile: V19AgentDivineAgencyState,
): void {
  const legacy = agent.privateDivineCalling;
  if (!legacy) return;
  const giftId = `legacy-gift:${legacy.audienceId}`;
  if (!profile.gifts.some((gift) => gift.id === giftId)) {
    profile.gifts.push({
      id: giftId,
      gift: legacy.gift,
      deityId: legacy.deityId,
      deityName: legacy.deityName,
      grantedWorldMinute: Math.min(
        world.calendar.elapsedWorldMinutes,
        Math.max(0, legacy.grantedWorldMinute),
      ),
      delivery: 'direct',
      interpretation: 'direct_contact',
    });
  }
  const contactId = `legacy-contact:${legacy.audienceId}`;
  if (!profile.contacts.some((contact) => contact.id === contactId)) {
    profile.contacts.push({
      id: contactId,
      kind: 'message',
      deityId: legacy.deityId,
      deityName: legacy.deityName,
      ...(legacy.religionName ? { religionName: legacy.religionName } : {}),
      message: legacy.message,
      receivedWorldMinute: Math.min(
        world.calendar.elapsedWorldMinutes,
        Math.max(0, legacy.grantedWorldMinute),
      ),
      interpretation: 'direct_contact',
      sharedCount: Math.max(0, legacy.sharedCount),
      ...(legacy.lastSharedWorldMinute === undefined
        ? {}
        : { lastSharedWorldMinute: legacy.lastSharedWorldMinute }),
    });
  }
  ensureDeityRelationshipOnProfile(
    profile,
    legacy.deityId,
    legacy.deityName,
    true,
    agent.mind.beliefs.divinePresence,
  );
}

export function createWorldV19State(
  world: Readonly<WorldState>,
  migratedFromRulesVersion: string,
): WorldV19State {
  const byAgentId: Record<string, V19AgentDivineAgencyState> = {};
  for (const agent of Object.values(world.agents)) {
    const profile = emptyAgentState(agent.id);
    legacyCallingToV19(world, agent, profile);
    byAgentId[agent.id] = profile;
  }
  return {
    version: WORLD_V19_SCHEMA_VERSION,
    migratedFromRulesVersion,
    adventureEconomy: createAdventureEconomyV19(world),
    divineAgency: {
      version: DIVINE_AGENCY_VERSION_V19,
      byAgentId,
      recentPrayers: [],
      totalPrayerCount: 0,
      prayerCountByTopic: emptyPrayerCount(),
      nextPrayerSequence: 1,
      religionRecognitionByName: {},
    },
  };
}

export function ensureWorldV19State(world: WorldState): WorldV19State {
  world.v19 ??= createWorldV19State(
    world,
    world.rulesVersion || WORLD_RULES_VERSION_V19,
  );
  return world.v19;
}

export function ensureAgentDivineAgencyV19(
  world: WorldState,
  agentId: string,
): V19AgentDivineAgencyState {
  const v19 = ensureWorldV19State(world);
  return (v19.divineAgency.byAgentId[agentId] ??= emptyAgentState(agentId));
}

function ensureDeityRelationshipOnProfile(
  profile: V19AgentDivineAgencyState,
  deityId: string,
  deityName: string,
  knowsName: boolean,
  initialBelief: number,
): V19DeityRelationshipState {
  let relationship = profile.deityRelationships.find(
    (candidate) => candidate.deityId === deityId,
  );
  if (!relationship) {
    relationship = {
      deityId,
      deityName,
      knowsName,
      beliefStrength: clamp01(initialBelief),
      trust: clamp01(initialBelief * 0.42),
      fear: 0.08,
      doubt: clamp01(1 - initialBelief),
      gratitude: 0,
      prayerCount: 0,
      answeredPrayerCount: 0,
    };
    profile.deityRelationships.push(relationship);
    profile.deityRelationships = profile.deityRelationships
      .sort(
        (left, right) =>
          right.prayerCount - left.prayerCount ||
          right.beliefStrength - left.beliefStrength,
      )
      .slice(0, MAX_DEITY_RELATIONSHIPS_PER_AGENT_V19);
  } else {
    relationship.deityName = deityName || relationship.deityName;
    relationship.knowsName ||= knowsName;
  }
  return relationship;
}

export function ensureDeityRelationshipV19(
  world: WorldState,
  agentId: string,
  deityId: string,
  deityName: string,
  knowsName: boolean,
): V19DeityRelationshipState {
  const agent = world.agents[agentId];
  const profile = ensureAgentDivineAgencyV19(world, agentId);
  return ensureDeityRelationshipOnProfile(
    profile,
    deityId,
    deityName,
    knowsName,
    agent?.mind.beliefs.divinePresence ?? 0,
  );
}

function sanitizeAgentProfile(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
  profile: V19AgentDivineAgencyState,
): V19AgentDivineAgencyState {
  profile.agentId = agent.id;
  profile.gifts ??= [];
  profile.contacts ??= [];
  profile.deityRelationships ??= [];
  profile.significantPrayers ??= [];
  profile.totalPrayerCount ??= 0;
  legacyCallingToV19(world, agent, profile);
  profile.gifts = profile.gifts.slice(-MAX_DIVINE_GIFTS_PER_AGENT_V19);
  profile.contacts = profile.contacts.slice(-MAX_DIVINE_CONTACTS_PER_AGENT_V19);
  profile.deityRelationships = profile.deityRelationships
    .filter((relationship) => relationship.deityId.trim())
    .slice(-MAX_DEITY_RELATIONSHIPS_PER_AGENT_V19);
  profile.significantPrayers = profile.significantPrayers.slice(
    -MAX_SIGNIFICANT_PRAYERS_PER_AGENT_V19,
  );
  return profile;
}

export function repairWorldV19AdditiveSchema(
  world: WorldState,
  migratedFromRulesVersion: string,
): WorldV19State {
  const v19 = ensureWorldV19State(world);
  v19.version = WORLD_V19_SCHEMA_VERSION;
  v19.migratedFromRulesVersion ||= migratedFromRulesVersion;
  v19.divineAgency ??= createWorldV19State(
    world,
    migratedFromRulesVersion,
  ).divineAgency;
  const agency = v19.divineAgency;
  agency.version = DIVINE_AGENCY_VERSION_V19;
  agency.byAgentId ??= {};
  agency.recentPrayers ??= [];
  agency.totalPrayerCount ??= agency.recentPrayers.length;
  agency.prayerCountByTopic ??= emptyPrayerCount();
  for (const topic of PRAYER_TOPICS_V19) {
    agency.prayerCountByTopic[topic] ??= 0;
  }
  agency.nextPrayerSequence ??= agency.totalPrayerCount + 1;
  agency.religionRecognitionByName ??= {};
  agency.recentPrayers = agency.recentPrayers.slice(-MAX_RECENT_PRAYERS_V19);
  for (const [agentId, profile] of Object.entries(agency.byAgentId)) {
    const agent = world.agents[agentId];
    if (!agent) continue;
    agency.byAgentId[agentId] = sanitizeAgentProfile(world, agent, profile);
  }
  // Newborn residents obtain a profile lazily when they first pray or meet a
  // deity. Reopening a world must not manufacture empty records and commit a
  // new revision merely because a child was born since the prior launch.
  for (const agent of Object.values(world.agents)) {
    if (!agent.privateDivineCalling || agency.byAgentId[agent.id]) continue;
    agency.byAgentId[agent.id] = sanitizeAgentProfile(
      world,
      agent,
      emptyAgentState(agent.id),
    );
  }
  for (const recognition of Object.values(agency.religionRecognitionByName)) {
    recognition.voluntarySpeakerIds = [
      ...new Set(recognition.voluntarySpeakerIds ?? []),
    ]
      .filter((id) => world.agents[id] !== undefined)
      .slice(-MAX_RELIGION_SPEAKERS_V19);
    recognition.testimonyCount ??= 0;
  }
  repairAdventureEconomyV19(world);
  return v19;
}

export function hasDivineGiftV19(
  world: Readonly<WorldState>,
  agentId: string,
  gift: DivineGiftKind,
): boolean {
  return Boolean(
    world.v19?.divineAgency.byAgentId[agentId]?.gifts.some(
      (grant) => grant.gift === gift,
    ),
  );
}

export function divineGiftActionAffinityV19(
  world: Readonly<WorldState>,
  agentId: string,
  action: string,
): number {
  let boost = 0;
  if (hasDivineGiftV19(world, agentId, 'healing_touch') && action === 'help') {
    boost += 0.1;
  }
  if (hasDivineGiftV19(world, agentId, 'genius_inventor')) {
    if (action === 'work') boost += 0.055;
    if (action === 'explore' || action === 'reflect') boost += 0.035;
  }
  if (
    hasDivineGiftV19(world, agentId, 'crowd_charisma') &&
    action === 'socialize'
  ) {
    boost += 0.055;
  }
  if (hasDivineGiftV19(world, agentId, 'might')) {
    if (action === 'hunt' || action === 'help') boost += 0.035;
  }
  if (hasDivineGiftV19(world, agentId, 'demon_king_hero')) {
    if (['hunt', 'explore', 'help'].includes(action)) boost += 0.06;
  }
  return Math.min(0.12, boost);
}

export function applyPersistentDivineGiftEffectsV19(
  world: WorldState,
  agent: AgentState,
): void {
  if (hasDivineGiftV19(world, agent.id, 'longevity')) {
    agent.life.lifespanYears = Math.max(
      agent.life.lifespanYears,
      agent.life.ageYears + 150,
      220,
    );
  }
  if (hasDivineGiftV19(world, agent.id, 'might')) {
    agent.life.physiology.strength = Math.max(
      0.96,
      agent.life.physiology.strength,
    );
    agent.life.physiology.endurance = Math.max(
      0.92,
      agent.life.physiology.endurance,
    );
  }
  if (hasDivineGiftV19(world, agent.id, 'demon_king_hero')) {
    agent.life.health = Math.max(0.98, agent.life.health);
    agent.life.physiology = {
      strength: 1,
      endurance: 1,
      mobility: 1,
      recovery: 1,
    };
  }
}

const livelihoodLabels: Readonly<Record<string, string>> = {
  undecided: 'житель без выбранного ремесла',
  farmer: 'земледелец',
  forager: 'собиратель',
  woodcutter: 'лесоруб',
  miner: 'рудокоп',
  fisher: 'рыбак',
  hunter: 'охотник',
  artisan: 'ремесленник',
  smith: 'кузнец',
  builder: 'строитель',
  caregiver: 'заботящийся о других',
  scout: 'разведчик',
  cartographer: 'картограф',
  adventurer: 'искатель приключений',
  teacher: 'наставник',
  scribe: 'писец',
  guard: 'страж',
  warrior: 'воин',
  spiritual_keeper: 'хранитель веры',
};

function professionFor(world: Readonly<WorldState>, agentId: string): string {
  const kind = world.v18?.livelihoodByAgentId[agentId]?.primary ?? 'undecided';
  return livelihoodLabels[kind] ?? kind;
}

function interpretationForAction(
  agent: Readonly<AgentState>,
  relationship: Readonly<V19DeityRelationshipState>,
  contactKind: DivineContactKind | undefined,
  roll: number,
): V19DivineInterpretation {
  if (contactKind && contactKind !== 'sign') return 'direct_contact';
  const belief = relationship.beliefStrength;
  const fear = clamp01(agent.mind.emotions.fear * 0.55 + relationship.fear * 0.45);
  if (contactKind === 'sign') {
    if (roll < belief * 0.62) return 'miracle';
    if (roll < 0.58 + agent.personality.curiosity * 0.18) return 'uncertain';
    return fear > 0.65 ? 'frightening' : 'natural_cause';
  }
  if (roll < belief * (0.36 + relationship.trust * 0.3)) return 'miracle';
  if (roll < 0.35 + (1 - belief) * 0.18) return 'luck';
  if (roll < 0.62) return 'natural_cause';
  if (roll < 0.72 && relationship.doubt > 0.62) return 'another_deity';
  if (fear > 0.68 && roll > 0.9) return 'frightening';
  return 'uncertain';
}

function residentResponseForAction(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
  deityName: string,
  gift: DivineGiftKind | undefined,
  contactKind: DivineContactKind | undefined,
  interpretation: V19DivineInterpretation,
): string {
  const profession = professionFor(world, agent.id);
  const independent = agent.mind.values.freedom >= 0.62;
  const frightened = agent.mind.emotions.fear >= 0.58;
  const faithful = agent.mind.beliefs.divinePresence >= 0.58;
  if (contactKind) {
    const heard = contactKind === 'sign' ? 'Я увидел этот знак' : `Я слышу тебя, ${deityName}`;
    if (contactKind === 'command' && independent) {
      return `${heard}. Я обдумаю твои слова, но решение и последствия останутся моими.`;
    }
    if (frightened) {
      return `${heard}. Мне страшно, и я не обещаю, что понял тебя правильно.`;
    }
    if (faithful) {
      return `${heard}. Я сохраню эти слова и сам решу, как жить с ними дальше.`;
    }
    return `${heard}, но пока не знаю, голос ли это божества или испытание моего разума.`;
  }
  const change = gift
    ? `Мои возможности изменились, хотя я по-прежнему ${profession}`
    : 'Со мной произошло нечто непонятное';
  if (interpretation === 'miracle') {
    return `${change}. Возможно, это ответ на молитву, но уверенности у меня нет.`;
  }
  if (interpretation === 'luck') {
    return `${change}. Может быть, мне просто невероятно повезло.`;
  }
  if (interpretation === 'another_deity') {
    return `${change}. Я не знаю, кому обязан этим и что от меня теперь ждут.`;
  }
  if (interpretation === 'frightening') {
    return `${change}. Это пугает меня сильнее, чем радует.`;
  }
  if (interpretation === 'natural_cause') {
    return `${change}. Сначала я поищу этому обычное объяснение.`;
  }
  return `${change}. Я не стану называть это чудом, пока не пойму, что случилось.`;
}

function findPrayer(
  world: WorldState,
  agentId: string,
  prayerId: string,
): {
  recent?: V19PrayerRecord;
  history?: V19SignificantPrayerHistoryEntry;
} {
  const agency = ensureWorldV19State(world).divineAgency;
  return {
    recent: agency.recentPrayers.find((prayer) => prayer.id === prayerId),
    history: agency.byAgentId[agentId]?.significantPrayers.find(
      (prayer) => prayer.prayerId === prayerId,
    ),
  };
}

export interface DivineActionV19Input {
  operationId: string;
  agentId: string;
  deityId: string;
  deityName: string;
  religionName?: string;
  gift?: DivineGiftKind;
  contactKind?: DivineContactKind;
  message?: string;
  relatedPrayerId?: string;
  worldMinute: number;
  interpretationRoll: number;
}

export interface DivineActionV19Result {
  actionId: string;
  giftGranted: boolean;
  contactRecorded: boolean;
  interpretation: V19DivineInterpretation;
  residentResponse: string;
}

export function applyDivineActionV19(
  world: WorldState,
  input: Readonly<DivineActionV19Input>,
): DivineActionV19Result {
  const agent = world.agents[input.agentId];
  if (!agent?.life.alive) {
    throw new Error(`Living divine-action resident ${input.agentId} was not found.`);
  }
  const profile = ensureAgentDivineAgencyV19(world, agent.id);
  const relationship = ensureDeityRelationshipV19(
    world,
    agent.id,
    input.deityId,
    input.deityName,
    Boolean(input.contactKind),
  );
  const interpretation = interpretationForAction(
    agent,
    relationship,
    input.contactKind,
    clamp01(input.interpretationRoll),
  );
  const response = residentResponseForAction(
    world,
    agent,
    input.deityName,
    input.gift,
    input.contactKind,
    interpretation,
  ).slice(0, 480);
  const alreadyHadGift = input.gift
    ? profile.gifts.some((grant) => grant.gift === input.gift)
    : false;
  let giftGranted = false;

  if (input.gift && !alreadyHadGift) {
    const grant: V19DivineGiftGrant = {
      id: `gift:${input.operationId}`,
      gift: input.gift,
      deityId: input.deityId,
      deityName: input.deityName,
      grantedWorldMinute: input.worldMinute,
      delivery: input.contactKind
        ? input.contactKind === 'sign'
          ? 'ambiguous_sign'
          : 'direct'
        : 'silent',
      interpretation,
      residentResponse: response,
      ...(input.relatedPrayerId ? { relatedPrayerId: input.relatedPrayerId } : {}),
    };
    profile.gifts.push(grant);
    profile.gifts = profile.gifts.slice(-MAX_DIVINE_GIFTS_PER_AGENT_V19);
    giftGranted = true;

    const progression = (agent.progression ??= {
      level: 1,
      experience: 0,
      objectControlAuthority: 0,
      systemControlAuthority: 0,
      combatMastery: 0,
      sacredArts: 0,
    });
    if (input.gift === 'longevity') {
      agent.life.lifespanYears = Math.max(
        agent.life.lifespanYears,
        agent.life.ageYears + 150,
        220,
      );
    } else if (input.gift === 'might') {
      agent.life.physiology.strength = Math.max(0.96, agent.life.physiology.strength);
      agent.life.physiology.endurance = Math.max(0.92, agent.life.physiology.endurance);
      progression.combatMastery = Math.max(0.72, progression.combatMastery);
    } else if (input.gift === 'genius_inventor') {
      agent.skills.craft = 1;
      agent.skills.exploration = Math.max(0.9, agent.skills.exploration);
      const knowledge = world.v15?.knowledgeByAgentId[agent.id];
      if (knowledge) {
        knowledge.aptitude.agriculture = 1;
        knowledge.aptitude.construction = 1;
        knowledge.aptitude.household = 1;
        knowledge.aptitude.survival = 1;
      }
    } else if (input.gift === 'crowd_charisma') {
      agent.skills.social = 1;
    } else if (input.gift === 'healing_touch') {
      progression.sacredArts = Math.max(0.95, progression.sacredArts);
    } else {
      agent.life.health = 1;
      agent.energy = 1;
      agent.life.physiology = {
        strength: 1,
        endurance: 1,
        mobility: 1,
        recovery: 1,
      };
      agent.skills.hunting = 1;
      agent.skills.craft = 1;
      agent.skills.exploration = 1;
      progression.experience = Math.max(progression.experience, 99 * 99 * 24);
      progression.level = 100;
      progression.combatMastery = 1;
    }
  }

  let contactRecorded = false;
  if (input.contactKind) {
    const contact: V19DivineContactRecord = {
      id: `contact:${input.operationId}`,
      kind: input.contactKind,
      deityId: input.deityId,
      deityName: input.deityName,
      ...(input.religionName ? { religionName: input.religionName } : {}),
      message: input.message ?? '',
      receivedWorldMinute: input.worldMinute,
      interpretation,
      residentResponse: response,
      ...(input.relatedPrayerId ? { relatedPrayerId: input.relatedPrayerId } : {}),
      sharedCount: 0,
    };
    profile.contacts.push(contact);
    profile.contacts = profile.contacts.slice(-MAX_DIVINE_CONTACTS_PER_AGENT_V19);
    contactRecorded = true;
  }

  relationship.lastContactWorldMinute = input.worldMinute;
  relationship.knowsName ||= Boolean(input.contactKind && input.contactKind !== 'sign');
  if (interpretation === 'direct_contact') {
    relationship.beliefStrength = clamp01(relationship.beliefStrength + 0.11);
    relationship.doubt = clamp01(relationship.doubt - 0.08);
    relationship.trust = clamp01(
      relationship.trust + (agent.mind.emotions.fear > 0.7 ? 0.01 : 0.045),
    );
  } else if (interpretation === 'miracle') {
    relationship.beliefStrength = clamp01(relationship.beliefStrength + 0.06);
    relationship.gratitude = clamp01(relationship.gratitude + 0.08);
    relationship.doubt = clamp01(relationship.doubt - 0.04);
  } else if (interpretation === 'frightening') {
    relationship.fear = clamp01(relationship.fear + 0.14);
    relationship.beliefStrength = clamp01(relationship.beliefStrength + 0.025);
  } else if (interpretation === 'natural_cause') {
    relationship.doubt = clamp01(relationship.doubt + 0.025);
  }

  agent.mind.emotions.awe = clamp01(
    agent.mind.emotions.awe +
      (interpretation === 'direct_contact' ? 0.14 : interpretation === 'miracle' ? 0.08 : 0.025),
  );
  agent.mind.emotions.fear = clamp01(
    agent.mind.emotions.fear + (interpretation === 'frightening' ? 0.1 : 0),
  );
  agent.mind.emotions.hope = clamp01(
    agent.mind.emotions.hope +
      (['direct_contact', 'miracle', 'luck'].includes(interpretation) ? 0.06 : 0.01),
  );
  agent.mind.beliefs.divinePresence = clamp01(
    agent.mind.beliefs.divinePresence +
      (interpretation === 'direct_contact'
        ? 0.08
        : interpretation === 'miracle'
          ? 0.04
          : interpretation === 'frightening'
            ? 0.015
            : interpretation === 'natural_cause'
              ? -0.006
              : 0),
  );

  if (input.relatedPrayerId) {
    const linked = findPrayer(world, agent.id, input.relatedPrayerId);
    const prayerResponse = {
      interventionId: input.operationId,
      respondedWorldMinute: input.worldMinute,
      ...(input.gift ? { gift: input.gift } : {}),
      ...(input.contactKind ? { contactKind: input.contactKind } : {}),
      interpretation,
      residentResponse: response,
    };
    if (linked.recent) linked.recent.response = prayerResponse;
    if (linked.history) {
      linked.history.response = prayerResponse;
    } else if (linked.recent) {
      profile.significantPrayers.push(historyFromPrayer(linked.recent));
      profile.significantPrayers = profile.significantPrayers.slice(
        -MAX_SIGNIFICANT_PRAYERS_PER_AGENT_V19,
      );
    }
    if (['direct_contact', 'miracle'].includes(interpretation)) {
      relationship.answeredPrayerCount += 1;
    }
  }

  agent.lastMeaningfulEventAt = world.now;
  return {
    actionId: input.operationId,
    giftGranted,
    contactRecorded,
    interpretation,
    residentResponse: response,
  };
}

interface PrayerCandidate {
  topic: V19PrayerTopic;
  triggerEvent: string;
  subject: string;
  target?: AgentState;
  targetRelationship?: string;
  desiredOutcome: string;
  fact: string;
  request: string;
  score: number;
}

function stableUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function settlementForAgent(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
) {
  const directId =
    world.places[agent.locationId]?.settlementId ??
    world.places[agent.homeId]?.settlementId;
  if (directId && world.settlements[directId]) return world.settlements[directId];
  return Object.values(world.settlements).find(
    (settlement) =>
      settlement.memberPlaceIds.includes(agent.locationId) ||
      settlement.memberPlaceIds.includes(agent.homeId),
  );
}

function relatedPeople(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
): Array<{ person: AgentState; relationship: string; closeness: number }> {
  const people = new Map<
    string,
    { person: AgentState; relationship: string; closeness: number }
  >();
  for (const childId of agent.life.childIds) {
    const child = world.agents[childId];
    if (child) people.set(child.id, { person: child, relationship: 'ребёнок', closeness: 1 });
  }
  for (const parentId of agent.life.parentIds) {
    const parent = world.agents[parentId];
    if (parent) people.set(parent.id, { person: parent, relationship: 'родитель', closeness: 0.86 });
  }
  for (const relationship of Object.values(world.relationships)) {
    if (relationship.agentA !== agent.id && relationship.agentB !== agent.id) continue;
    const otherId = relationship.agentA === agent.id
      ? relationship.agentB
      : relationship.agentA;
    const person = world.agents[otherId];
    if (!person) continue;
    const closeness = clamp01(
      relationship.trust * 0.35 +
        relationship.affinity * 0.38 +
        relationship.respect * 0.17 -
        relationship.conflict * 0.3,
    );
    const label = relationship.conflict > 0.66
      ? 'враг'
      : relationship.affinity > 0.72 && relationship.trust > 0.62
        ? 'любимый человек'
        : closeness > 0.48
          ? 'близкий друг'
          : 'знакомый';
    const prior = people.get(person.id);
    if (!prior || closeness > prior.closeness) {
      people.set(person.id, { person, relationship: label, closeness });
    }
  }
  return [...people.values()].sort(
    (left, right) => right.closeness - left.closeness,
  );
}

function selectPrayerDeity(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
  profile: V19AgentDivineAgencyState,
  roll: number,
): { id: string; name: string; known: boolean; belief: number } {
  const established = [...profile.deityRelationships].sort(
    (left, right) =>
      right.beliefStrength + right.trust - right.doubt * 0.35 -
      (left.beliefStrength + left.trust - left.doubt * 0.35),
  );
  if (established.length > 0 && (established[0].knowsName || roll < 0.78)) {
    const chosen = established[Math.min(
      established.length - 1,
      Math.floor(clamp01(roll) * Math.min(3, established.length)),
    )];
    return {
      id: chosen.deityId,
      name: chosen.deityName,
      known: chosen.knowsName,
      belief: chosen.beliefStrength,
    };
  }
  const worldDeities = Object.values(world.cosmology.deities);
  if (worldDeities.length > 0) {
    const deity = worldDeities[Math.min(
      worldDeities.length - 1,
      Math.floor(clamp01(roll) * worldDeities.length),
    )];
    return {
      id: deity.id,
      name: deity.name,
      known: agent.mind.beliefs.divinePresence >= 0.38,
      belief: agent.mind.beliefs.divinePresence,
    };
  }
  return {
    id: 'unknown_divinity',
    name: 'тот, кто может услышать',
    known: false,
    belief: agent.mind.beliefs.divinePresence,
  };
}

function buildPrayerCandidates(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
  settlement: ReturnType<typeof settlementForAgent>,
): {
  candidates: PrayerCandidate[];
  evidence: Omit<V19PrayerEvidence, 'facts' | 'targetRelationship' | 'targetAlive'>;
} {
  const related = relatedPeople(world, agent);
  const sick = related
    .filter(({ person }) => person.life.alive && person.life.health < 0.68)
    .sort((left, right) =>
      (1 - right.person.life.health) * right.closeness -
      (1 - left.person.life.health) * left.closeness,
    )[0];
  const dead = related
    .filter(({ person, closeness }) => !person.life.alive && closeness >= 0.45)
    .sort((left, right) => right.closeness - left.closeness)[0];
  const absent = related
    .filter(
      ({ person, closeness }) =>
        person.life.alive &&
        closeness >= 0.5 &&
        person.locationId !== person.homeId,
    )
    .sort((left, right) => right.closeness - left.closeness)[0];
  const settlementId = settlement?.id;
  const resources = settlementId
    ? world.v16?.settlementResourcesById[settlementId]
    : undefined;
  const economy = settlementId
    ? world.v16?.settlementEconomyById[settlementId]
    : undefined;
  const foodCapacity = economy?.storageCapacity.food ?? 0;
  const foodShare = foodCapacity > 0
    ? clamp01((economy?.stocks.food ?? 0) / foodCapacity)
    : resources?.storedResources;
  const rhythm = world.v18?.lifeRhythmByAgentId[agent.id];
  const satiety = rhythm?.satiety ?? clamp01(0.48 + agent.resources * 0.38);
  const localDanger = world.places[agent.locationId]?.danger ?? 0;
  const activeWar = settlementId
    ? Object.values(world.v16?.settlementRelations ?? {}).some(
        (relation) =>
          relation.activeWar &&
          (relation.settlementA === settlementId || relation.settlementB === settlementId),
      )
    : false;
  const placeName = world.places[agent.locationId]?.name ?? 'этом месте';
  const settlementName = settlement?.name ?? placeName;
  const candidates: PrayerCandidate[] = [];

  if (agent.life.health < 0.78) {
    candidates.push({
      topic: 'health',
      triggerEvent: 'self_health_decline',
      subject: 'собственное здоровье',
      desiredOutcome: 'выздороветь и сохранить возможность жить своей жизнью',
      fact: `моё здоровье ухудшилось, и обычный день даётся мне всё тяжелее`,
      request: `дай мне возможность восстановиться и снова самому заботиться о своей жизни`,
      score: 0.54 + (1 - agent.life.health) * 0.72,
    });
  }
  if (sick) {
    candidates.push({
      topic: 'family',
      triggerEvent: 'close_person_health_decline',
      subject: `болезнь: ${sick.person.name}`,
      target: sick.person,
      targetRelationship: sick.relationship,
      desiredOutcome: `${sick.person.name} должен выжить и выздороветь`,
      fact: `${sick.person.name}, мой ${sick.relationship}, слабеет и почти не может жить как прежде`,
      request: `помоги ${sick.person.name} пережить это и выздороветь`,
      score: 0.7 + (1 - sick.person.life.health) * 0.82 + sick.closeness * 0.24,
    });
  }
  if (dead && agent.mind.emotions.grief > 0.16) {
    candidates.push({
      topic: 'grief',
      triggerEvent: 'death_of_close_person',
      subject: `смерть: ${dead.person.name}`,
      target: dead.person,
      targetRelationship: dead.relationship,
      desiredOutcome: `понять или пережить смерть ${dead.person.name}`,
      fact: `${dead.person.name}, мой ${dead.relationship}, умер, а боль от этой потери не ушла`,
      request: `покажи мне, как жить дальше и не предать память о ${dead.person.name}`,
      score: 0.56 + agent.mind.emotions.grief * 0.78 + dead.closeness * 0.2,
    });
  }
  if (satiety < 0.58 || (foodShare !== undefined && foodShare < 0.32)) {
    candidates.push({
      topic: 'hunger',
      triggerEvent: 'food_shortage',
      subject: `нехватка еды в ${settlementName}`,
      desiredOutcome: `пережить нехватку еды без смерти близких`,
      fact: `запасы еды в ${settlementName} истощаются, и голод уже чувствуется каждый день`,
      request: `дай нам шанс пережить это время, пока мы сами ищем пищу и новые земли`,
      score: 0.46 + (1 - satiety) * 0.7 + (foodShare === undefined ? 0 : (1 - foodShare) * 0.55),
    });
  }
  if (resources && resources.fertility < 0.46) {
    candidates.push({
      topic: 'harvest',
      triggerEvent: 'exhausted_settlement_land',
      subject: `истощённая земля возле ${settlementName}`,
      desiredOutcome: `дождаться восстановления земли и следующего урожая`,
      fact: `земля возле ${settlementName} истощилась и больше не кормит нас как раньше`,
      request: `пусть у нас хватит времени и разума восстановить поля до следующего урожая`,
      score: 0.4 + (1 - resources.fertility) * 0.68,
    });
  }
  if (activeWar) {
    candidates.push({
      topic: 'war',
      triggerEvent: 'settlement_at_war',
      subject: `война, затронувшая ${settlementName}`,
      desiredOutcome: `сохранить близких и добиться прекращения войны`,
      fact: `${settlementName} втянут в войну, и никто не знает, кто следующим не вернётся домой`,
      request: `помоги нам защитить живых и найти выход, который остановит новые смерти`,
      score: 0.82 + agent.mind.emotions.fear * 0.36,
    });
  }
  if (localDanger > 0.4 || agent.mind.emotions.fear > 0.58) {
    candidates.push({
      topic: 'danger',
      triggerEvent: 'immediate_danger',
      subject: `опасность возле ${placeName}`,
      desiredOutcome: `вернуться в безопасное место и защитить окружающих`,
      fact: `опасность возле ${placeName} стала слишком близкой, а страх уже мешает думать`,
      request: `дай мне ясность и шанс выбраться, не бросив тех, кто рядом`,
      score: 0.42 + localDanger * 0.55 + agent.mind.emotions.fear * 0.5,
    });
  }
  if (absent) {
    candidates.push({
      topic: 'travel',
      triggerEvent: 'close_person_away_from_home',
      subject: `ожидание возвращения: ${absent.person.name}`,
      target: absent.person,
      targetRelationship: absent.relationship,
      desiredOutcome: `${absent.person.name} должен вернуться живым`,
      fact: `${absent.person.name}, мой ${absent.relationship}, всё ещё далеко от дома`,
      request: `пусть ${absent.person.name} найдёт дорогу обратно и вернётся живым`,
      score: 0.38 + absent.closeness * 0.42 + agent.mind.emotions.fear * 0.22,
    });
  }
  if (agent.locationId !== agent.homeId || agent.movement) {
    candidates.push({
      topic: 'travel',
      triggerEvent: 'own_distant_journey',
      subject: `собственный путь вдали от дома`,
      desiredOutcome: `закончить путь и вернуться живым`,
      fact: `я далеко от дома, и впереди ещё путь по незнакомой земле`,
      request: `не неси меня вместо моих ног — лишь помоги увидеть дорогу домой`,
      score: 0.3 + agent.mind.emotions.fear * 0.32 + (1 - agent.energy) * 0.28,
    });
  }
  if (agent.resources < 0.3) {
    candidates.push({
      topic: 'poverty',
      triggerEvent: 'personal_resource_poverty',
      subject: `бедность и нехватка необходимого`,
      desiredOutcome: `добыть необходимое честным трудом`,
      fact: `у меня почти не осталось припасов, а одного желания работать уже недостаточно`,
      request: `дай мне возможность заработать необходимое, не отнимая его у других`,
      score: 0.36 + (1 - agent.resources) * 0.52,
    });
  }
  if (
    agent.life.health > 0.82 &&
    satiety > 0.66 &&
    agent.mind.emotions.joy > 0.58
  ) {
    candidates.push({
      topic: 'gratitude',
      triggerEvent: 'lived_good_fortune',
      subject: `благополучие семьи и дома`,
      desiredOutcome: `выразить благодарность без требования награды`,
      fact: `сегодня я здоров, сыт и могу вернуться к тем, кто мне дорог`,
      request: `я ничего не требую — только благодарю за этот день`,
      score: 0.28 + agent.mind.emotions.joy * 0.32 + agent.mind.emotions.awe * 0.2,
    });
  }
  candidates.push({
    topic: 'purpose',
    triggerEvent: 'search_for_meaning',
    subject: `сомнение о собственном пути`,
    desiredOutcome: `понять следующий честный выбор`,
    fact: `я не понимаю, куда ведут мои решения и что в моей жизни действительно важно`,
    request: `не выбирай вместо меня — помоги увидеть то, чего я сам не замечаю`,
    score: 0.2 + (1 - agent.needs.purpose) * 0.48 + agent.mind.emotions.awe * 0.18,
  });

  return {
    candidates,
    evidence: {
      ...(settlement ? { settlementId: settlement.id, settlementName: settlement.name } : {}),
      profession: professionFor(world, agent.id),
      locationId: agent.locationId,
      health: agent.life.health,
      satiety,
      personalResources: agent.resources,
      ...(foodShare === undefined ? {} : { localFoodShare: foodShare }),
      ...(resources ? { localFertility: resources.fertility } : {}),
      localDanger,
      activeWar,
    },
  };
}

function prayerEmotion(
  agent: Readonly<AgentState>,
  topic: V19PrayerTopic,
  belief: number,
  desperation: number,
): V19PrayerEmotion {
  if (topic === 'gratitude') return 'gratitude';
  if (topic === 'grief' && belief > 0.45 && agent.mind.emotions.grief > 0.7) {
    return agent.mind.beliefs.worldTrust < 0.4 ? 'accusation' : 'anger';
  }
  if (belief < 0.24) return desperation > 0.7 ? 'bargain' : 'doubt';
  if (desperation > 0.82) return agent.mind.values.care > 0.58 ? 'promise' : 'despair';
  if (agent.mind.emotions.fear > 0.62) return 'fear';
  if (agent.mind.emotions.hope > 0.64) return 'hope';
  if (agent.stress > 0.72) return 'despair';
  return 'request';
}

function prayerText(
  agent: Readonly<AgentState>,
  deity: { name: string; known: boolean; belief: number },
  candidate: Readonly<PrayerCandidate>,
  emotion: V19PrayerEmotion,
  wordingRoll: number,
): string {
  const address = deity.known
    ? deity.belief < 0.35
      ? `Если ты правда слышишь меня, ${deity.name},`
      : `${deity.name},`
    : deity.belief < 0.22
      ? `Я не знаю, есть ли кто-нибудь за пределами видимого мира, но если есть —`
      : `Тот, кто может услышать меня,`;
  const stance: Partial<Record<V19PrayerEmotion, string>> = {
    gratitude: 'сегодня мои слова не просьба:',
    anger: 'я говорю без смирения:',
    accusation: 'ты мог вмешаться, поэтому ответь мне:',
    despair: 'я почти не вижу выхода:',
    doubt: 'я всю жизнь сомневался, и сейчас тоже сомневаюсь:',
    bargain: 'мне нечем торговаться, кроме собственного труда:',
    promise: 'я не прошу снять с меня ответственность:',
    fear: 'мне страшно это признать:',
    hope: 'я всё ещё надеюсь:',
    remorse: 'я признаю свою вину:',
    request: 'я обращаюсь к тебе потому, что',
  };
  const ageTruth = wordingRoll > 0.78
    ? ` Мне ${Math.floor(agent.life.ageYears)} лет, и я не помню другого момента, когда говорил так прямо.`
    : '';
  let ending: string;
  if (candidate.target && agent.mind.values.care > 0.62) {
    ending = ` Если за помощь нужна цена, не перекладывай её на ${candidate.target.name}.`;
  } else if (agent.mind.values.freedom > 0.68) {
    ending = ` Я сделаю всё, что могу сам; мне нужен не хозяин, а шанс.`;
  } else if (agent.mind.beliefs.worldTrust < 0.38) {
    ending = ` Если ответа не будет, я не стану притворяться, будто услышал его.`;
  } else if (agent.personality.diligence > 0.68) {
    ending = ` Завтра я всё равно продолжу делать то, что зависит от меня.`;
  } else {
    ending = ` Я не знаю, изменят ли эти слова что-нибудь, но молчать больше не могу.`;
  }
  const body = wordingRoll < 0.5
    ? `${stance[emotion] ?? stance.request} ${candidate.fact}. ${candidate.request}.`
    : `${candidate.fact}. ${stance[emotion] ?? stance.request} ${candidate.request}.`;
  return `${address} ${body}${ageTruth}${ending}`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

function historyFromPrayer(
  prayer: Readonly<V19PrayerRecord>,
): V19SignificantPrayerHistoryEntry {
  return {
    prayerId: prayer.id,
    worldMinute: prayer.worldMinute,
    worldYear: prayer.worldYear,
    topic: prayer.topic,
    triggerEvent: prayer.triggerEvent,
    subject: prayer.subject,
    ...(prayer.targetPersonId ? { targetPersonId: prayer.targetPersonId } : {}),
    ...(prayer.targetPersonName ? { targetPersonName: prayer.targetPersonName } : {}),
    emotionalState: prayer.emotionalState,
    generatedPrayerText: prayer.generatedPrayerText,
    ...(prayer.response ? { response: prayer.response } : {}),
  };
}

export interface ContextualPrayerRollsV19 {
  subject: number;
  deity: number;
  wording: number;
}

export function recordContextualPrayerV19(
  world: WorldState,
  agent: AgentState,
  rolls: Readonly<ContextualPrayerRollsV19>,
): V19PrayerRecord {
  const v19 = ensureWorldV19State(world);
  const agency = v19.divineAgency;
  const profile = ensureAgentDivineAgencyV19(world, agent.id);
  const settlement = settlementForAgent(world, agent);
  const built = buildPrayerCandidates(world, agent, settlement);
  const sequence = agency.nextPrayerSequence++;
  const candidate = [...built.candidates]
    .sort(
      (left, right) =>
        right.score + stableUnit(`${agent.id}:${right.topic}:${sequence}:${rolls.subject}`) * 0.12 -
        (left.score + stableUnit(`${agent.id}:${left.topic}:${sequence}:${rolls.subject}`) * 0.12),
    )[0];
  const deity = selectPrayerDeity(world, agent, profile, rolls.deity);
  const desperation = clamp01(
    Math.max(
      agent.stress,
      agent.mind.emotions.fear,
      agent.mind.emotions.grief,
      1 - built.evidence.satiety,
      1 - agent.life.health,
      1 - agent.resources,
      candidate.score - 0.35,
    ),
  );
  const emotion = prayerEmotion(agent, candidate.topic, deity.belief, desperation);
  const text = prayerText(agent, deity, candidate, emotion, rolls.wording);
  const importance = clamp01(
    0.28 +
      desperation * 0.48 +
      (candidate.target ? 0.12 : 0) +
      (['grief', 'war', 'health', 'family'].includes(candidate.topic) ? 0.1 : 0),
  );
  const relationship = ensureDeityRelationshipV19(
    world,
    agent.id,
    deity.id,
    deity.name,
    deity.known,
  );
  relationship.prayerCount += 1;
  relationship.lastPrayerWorldMinute = world.calendar.elapsedWorldMinutes;
  relationship.beliefStrength = clamp01(
    relationship.beliefStrength +
      (emotion === 'gratitude' ? 0.006 : emotion === 'doubt' ? -0.002 : 0.001),
  );

  const evidence: V19PrayerEvidence = {
    ...built.evidence,
    ...(candidate.targetRelationship
      ? { targetRelationship: candidate.targetRelationship }
      : {}),
    ...(candidate.target ? { targetAlive: candidate.target.life.alive } : {}),
    facts: [candidate.fact],
  };
  const prayer: V19PrayerRecord = {
    id: `prayer:${world.id}:${sequence.toString(36)}`,
    sequence,
    npcId: agent.id,
    npcName: agent.name,
    npcAgeYears: agent.life.ageYears,
    worldMinute: world.calendar.elapsedWorldMinutes,
    worldYear: Math.floor(world.calendar.elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR) + 1,
    deityId: deity.id,
    deityName: deity.name,
    deityKnown: deity.known,
    triggerEvent: candidate.triggerEvent,
    topic: candidate.topic,
    subject: candidate.subject,
    ...(candidate.target ? { targetPersonId: candidate.target.id, targetPersonName: candidate.target.name } : {}),
    desiredOutcome: candidate.desiredOutcome,
    emotionalState: emotion,
    beliefStrength: relationship.beliefStrength,
    desperation,
    importance,
    generatedPrayerText: text,
    evidence,
  };
  agency.recentPrayers.push(prayer);
  agency.recentPrayers = agency.recentPrayers.slice(-MAX_RECENT_PRAYERS_V19);
  agency.totalPrayerCount += 1;
  agency.prayerCountByTopic[candidate.topic] += 1;
  profile.totalPrayerCount += 1;
  profile.lastPrayerWorldMinute = world.calendar.elapsedWorldMinutes;
  if (importance >= 0.62 || candidate.target || ['grief', 'war'].includes(candidate.topic)) {
    profile.significantPrayers.push(historyFromPrayer(prayer));
    profile.significantPrayers = profile.significantPrayers.slice(
      -MAX_SIGNIFICANT_PRAYERS_PER_AGENT_V19,
    );
  }
  return prayer;
}

export function shareableDivineContactV19(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
  relationshipSentiment: number,
  roll: number,
): V19DivineContactRecord | undefined {
  const profile = world.v19?.divineAgency.byAgentId[agent.id];
  if (!profile || relationshipSentiment <= -0.15) return undefined;
  const worldMinute = world.calendar.elapsedWorldMinutes;
  for (const contact of [...profile.contacts].reverse()) {
    const since = contact.lastSharedWorldMinute === undefined
      ? Number.POSITIVE_INFINITY
      : worldMinute - contact.lastSharedWorldMinute;
    if (since < WORLD_MINUTES_PER_YEAR * 0.25) continue;
    const relationship = profile.deityRelationships.find(
      (candidate) => candidate.deityId === contact.deityId,
    );
    const chance = clamp01(
      0.025 +
        agent.personality.sociability * 0.07 +
        agent.personality.curiosity * 0.035 +
        (relationship?.beliefStrength ?? 0) * 0.05 +
        (contact.kind === 'warning' ? 0.035 : 0) -
        agent.mind.values.freedom * 0.015,
    );
    if (roll < chance) return contact;
  }
  return undefined;
}

export function recordVoluntaryDivineContactShareV19(
  world: WorldState,
  speakerId: string,
  listenerId: string,
  contactId: string,
  listenerMoved: boolean,
): V19DivineContactRecord | undefined {
  const profile = ensureAgentDivineAgencyV19(world, speakerId);
  const contact = profile.contacts.find((candidate) => candidate.id === contactId);
  if (!contact) return undefined;
  contact.sharedCount += 1;
  contact.lastSharedWorldMinute = world.calendar.elapsedWorldMinutes;
  const listenerRelationship = ensureDeityRelationshipV19(
    world,
    listenerId,
    contact.deityId,
    contact.deityName,
    true,
  );
  if (listenerMoved) {
    listenerRelationship.beliefStrength = clamp01(
      listenerRelationship.beliefStrength + 0.018,
    );
    listenerRelationship.doubt = clamp01(listenerRelationship.doubt - 0.009);
  }
  if (contact.religionName) {
    const agency = ensureWorldV19State(world).divineAgency;
    const recognition: V19ReligionRecognitionState =
      (agency.religionRecognitionByName[contact.religionName] ??= {
        religionName: contact.religionName,
        voluntarySpeakerIds: [],
        testimonyCount: 0,
      });
    recognition.testimonyCount += 1;
    if (!recognition.voluntarySpeakerIds.includes(speakerId)) {
      recognition.voluntarySpeakerIds.push(speakerId);
      recognition.voluntarySpeakerIds = recognition.voluntarySpeakerIds.slice(
        -MAX_RELIGION_SPEAKERS_V19,
      );
    }
    if (
      recognition.testimonyCount >= 8 &&
      recognition.voluntarySpeakerIds.length >= 3 &&
      !world.cosmology.traditions.includes(contact.religionName)
    ) {
      world.cosmology.traditions.push(contact.religionName);
    }
  }
  return contact;
}

function assertUnit(value: number, path: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${path} must be finite and within 0..1.`);
  }
}

function assertText(value: unknown, path: string, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`${path} must be non-empty and at most ${maximum} characters.`);
  }
  return value;
}

export function assertWorldV19State(world: Readonly<WorldState>): void {
  const v19 = world.v19;
  if (!v19 || v19.version !== WORLD_V19_SCHEMA_VERSION) {
    throw new Error('World v19 state is missing or has an invalid version.');
  }
  assertText(v19.migratedFromRulesVersion, 'World v19 migratedFromRulesVersion', 96);
  const agency = v19.divineAgency;
  if (!agency || agency.version !== DIVINE_AGENCY_VERSION_V19) {
    throw new Error('World v19 divine agency is missing or invalid.');
  }
  if (
    !Number.isInteger(agency.nextPrayerSequence) ||
    agency.nextPrayerSequence < 1 ||
    !Number.isInteger(agency.totalPrayerCount) ||
    agency.totalPrayerCount < agency.recentPrayers.length
  ) {
    throw new Error('World v19 prayer counters are invalid.');
  }
  if (agency.recentPrayers.length > MAX_RECENT_PRAYERS_V19) {
    throw new Error('World v19 recent prayer feed exceeds its bounded limit.');
  }
  for (const topic of PRAYER_TOPICS_V19) {
    const count = agency.prayerCountByTopic[topic];
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`World v19 prayer count ${topic} is invalid.`);
    }
  }
  for (const [agentId, profile] of Object.entries(agency.byAgentId)) {
    if (!world.agents[agentId] || profile.agentId !== agentId) {
      throw new Error(`World v19 divine profile ${agentId} references a missing resident.`);
    }
    if (
      profile.gifts.length > MAX_DIVINE_GIFTS_PER_AGENT_V19 ||
      profile.contacts.length > MAX_DIVINE_CONTACTS_PER_AGENT_V19 ||
      profile.deityRelationships.length > MAX_DEITY_RELATIONSHIPS_PER_AGENT_V19 ||
      profile.significantPrayers.length > MAX_SIGNIFICANT_PRAYERS_PER_AGENT_V19
    ) {
      throw new Error(`World v19 divine profile ${agentId} exceeds a bounded limit.`);
    }
    if (!Number.isInteger(profile.totalPrayerCount) || profile.totalPrayerCount < 0) {
      throw new Error(`World v19 prayer total for ${agentId} is invalid.`);
    }
    for (const gift of profile.gifts) {
      assertText(gift.id, `World v19 gift ${agentId}.id`, 160);
      if (!DIVINE_GIFTS_V19.includes(gift.gift)) {
        throw new Error(`World v19 gift ${gift.id} has an invalid kind.`);
      }
      if (
        !Number.isFinite(gift.grantedWorldMinute) ||
        gift.grantedWorldMinute < 0 ||
        gift.grantedWorldMinute > world.calendar.elapsedWorldMinutes
      ) {
        throw new Error(`World v19 gift ${gift.id} has invalid time.`);
      }
    }
    for (const contact of profile.contacts) {
      assertText(contact.id, `World v19 contact ${agentId}.id`, 160);
      assertText(contact.message, `World v19 contact ${contact.id}.message`, 480);
      if (!DIVINE_CONTACT_KINDS_V19.includes(contact.kind)) {
        throw new Error(`World v19 contact ${contact.id} has an invalid kind.`);
      }
    }
    for (const relationship of profile.deityRelationships) {
      assertText(relationship.deityId, `World v19 deity relation ${agentId}.id`, 64);
      assertText(relationship.deityName, `World v19 deity relation ${agentId}.name`, 64);
      for (const [field, value] of Object.entries({
        beliefStrength: relationship.beliefStrength,
        trust: relationship.trust,
        fear: relationship.fear,
        doubt: relationship.doubt,
        gratitude: relationship.gratitude,
      })) {
        assertUnit(value, `World v19 deity relation ${agentId}.${field}`);
      }
    }
  }
  for (const prayer of agency.recentPrayers) {
    if (!world.agents[prayer.npcId]) {
      throw new Error(`World v19 prayer ${prayer.id} references a missing resident.`);
    }
    assertText(prayer.generatedPrayerText, `World v19 prayer ${prayer.id}.text`, 600);
    assertText(prayer.desiredOutcome, `World v19 prayer ${prayer.id}.outcome`, 240);
    if (!PRAYER_TOPICS_V19.includes(prayer.topic)) {
      throw new Error(`World v19 prayer ${prayer.id} has an invalid topic.`);
    }
    assertUnit(prayer.beliefStrength, `World v19 prayer ${prayer.id}.beliefStrength`);
    assertUnit(prayer.desperation, `World v19 prayer ${prayer.id}.desperation`);
    assertUnit(prayer.importance, `World v19 prayer ${prayer.id}.importance`);
  }
  assertAdventureEconomyV19(world);
}
