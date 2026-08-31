/**
 * Existing Ainkrad resident progression recovered exactly from the preserved
 * v0.3.13 WorldEngine.
 *
 * This is NOT a new dungeon level system. It is the already-existing world
 * progression that later dungeons must reuse.
 */

export interface ResidentProgressionV15 {
  level: number;
  experience: number;
  objectControlAuthority: number;
  systemControlAuthority: number;
  combatMastery: number;
  sacredArts: number;
}

export interface ResidentProgressionSeedInputV15 {
  ageYears: number;
  generation: number;
  skills: {
    gathering: number;
    hunting: number;
    craft: number;
    social: number;
    exploration: number;
  };
  valuesKnowledge: number;
  curiosity: number;
  awe: number;
  divinePresence: number;
  physiologyStrength: number;
}

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

export function levelForExperienceV15(experience: number): number {
  return Math.max(
    1,
    Math.min(
      100,
      1 + Math.floor(Math.sqrt(Math.max(0, experience) / 24)),
    ),
  );
}

/**
 * Exact preserved migration/reconstruction formula for residents that need
 * progression derived from already-lived skills/age/generation.
 */
export function progressionFromLivedStateV15(
  input: ResidentProgressionSeedInputV15,
): ResidentProgressionV15 {
  const skillAverage =
    (
      input.skills.gathering +
      input.skills.hunting +
      input.skills.craft +
      input.skills.social +
      input.skills.exploration
    ) / 5;

  const livedAdultYears = Math.max(0, input.ageYears - 18);
  const experience = Math.max(
    0,
    skillAverage * 90 +
      livedAdultYears * 1.2 +
      input.generation * 18,
  );

  return {
    level: levelForExperienceV15(experience),
    experience,
    objectControlAuthority: clamp01(
      skillAverage * 0.72 + input.skills.craft * 0.18,
    ),
    systemControlAuthority: clamp01(
      input.valuesKnowledge * 0.34 +
        input.curiosity * 0.28 +
        input.skills.exploration * 0.2,
    ),
    combatMastery: clamp01(
      input.skills.hunting * 0.62 +
        input.physiologyStrength * 0.22,
    ),
    sacredArts: clamp01(
      input.valuesKnowledge * 0.22 +
        input.awe * 0.28 +
        input.divinePresence * 0.18,
    ),
  };
}

export const LIVED_XP_GAIN_BY_EVENT_V15 = {
  'agent.worked': 1.1,
  'agent.gathered': 0.8,
  'agent.hunted': 1.9,
  'agent.explored': 1.35,
  'agent.help.accepted': 0.55,
  'agent.bond.accepted': 0.45,
  'agent.reflected': 0.28,
  'agent.prayed': 0.42,
} as const;

export type LivedProgressionEventKindV15 =
  keyof typeof LIVED_XP_GAIN_BY_EVENT_V15;

export interface ProgressionAdvanceResultV15 {
  before: ResidentProgressionV15;
  after: ResidentProgressionV15;
  gainedExperience: number;
  leveledUp: boolean;
}

/**
 * Exact recovered event XP/mastery increments.
 *
 * Later dungeon combat/rewards must feed THIS SAME experience field instead
 * of introducing a second incompatible level scale.
 */
export function advanceResidentProgressionFromLivedEventV15(
  progression: ResidentProgressionV15,
  kind: LivedProgressionEventKindV15,
): ProgressionAdvanceResultV15 {
  const before = {...progression};
  const gain = LIVED_XP_GAIN_BY_EVENT_V15[kind];

  progression.experience += gain;
  progression.level = levelForExperienceV15(progression.experience);

  if (kind === 'agent.hunted') {
    progression.combatMastery = clamp01(
      progression.combatMastery + 0.0028,
    );
    progression.objectControlAuthority = clamp01(
      progression.objectControlAuthority + 0.0018,
    );
  } else if (kind === 'agent.worked' || kind === 'agent.gathered') {
    progression.objectControlAuthority = clamp01(
      progression.objectControlAuthority + 0.0015,
    );
  } else if (kind === 'agent.explored') {
    progression.objectControlAuthority = clamp01(
      progression.objectControlAuthority + 0.001,
    );
    progression.systemControlAuthority = clamp01(
      progression.systemControlAuthority + 0.0011,
    );
  } else if (kind === 'agent.reflected' || kind === 'agent.prayed') {
    progression.systemControlAuthority = clamp01(
      progression.systemControlAuthority + 0.0014,
    );
    progression.sacredArts = clamp01(
      progression.sacredArts + 0.0012,
    );
  }

  return {
    before,
    after: {...progression},
    gainedExperience: gain,
    leveledUp: progression.level > before.level,
  };
}

/**
 * A newly born child starts at the exact preserved neutral progression.
 */
export function newbornProgressionV15(): ResidentProgressionV15 {
  return {
    level: 1,
    experience: 0,
    objectControlAuthority: 0,
    systemControlAuthority: 0,
    combatMastery: 0,
    sacredArts: 0,
  };
}
