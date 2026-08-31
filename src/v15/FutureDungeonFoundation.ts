/**
 * Ainkrad future dungeon / progression foundation.
 *
 * IMPORTANT FOR v15:
 * This is a dormant foundation only.
 * It MUST NOT generate, reveal, activate or run dungeons in the current v15 world.
 */

export const WORLD_MINUTES_PER_YEAR_DUNGEON = 365 * 24 * 60;

/**
 * The world must be genuinely mature before dungeon-era systems may even become
 * eligible for a future build.
 *
 * The user-design target is approximately 200-300 Ainkrad years after New World.
 */
export const DUNGEON_ERA_EARLIEST_YEAR = 200;
export const DUNGEON_ERA_NOMINAL_YEAR = 250;
export const DUNGEON_ERA_LATEST_YEAR = 300;

export const DUNGEON_ERA_EARLIEST_WORLD_MINUTES =
  DUNGEON_ERA_EARLIEST_YEAR * WORLD_MINUTES_PER_YEAR_DUNGEON;

export const DUNGEON_ERA_NOMINAL_WORLD_MINUTES =
  DUNGEON_ERA_NOMINAL_YEAR * WORLD_MINUTES_PER_YEAR_DUNGEON;

export const DUNGEON_ERA_LATEST_WORLD_MINUTES =
  DUNGEON_ERA_LATEST_YEAR * WORLD_MINUTES_PER_YEAR_DUNGEON;

/**
 * Hard safety switch for v15.
 *
 * Future releases may replace this compile-time constant with a versioned
 * world-rules feature flag. v15 must remain false.
 */
export const DUNGEON_SYSTEM_ENABLED_IN_V15 = false as const;

/**
 * Dungeons MUST reuse the already-existing resident progression:
 * level 1..100 + shared experience.
 *
 * `dungeonExperienceEarned` is analytics/history only; it must never calculate
 * a second dungeon-only level.
 */
export interface DungeonProgressionFoundation {
  existingResidentLevel: number;
  existingResidentExperience: number;
  dungeonExperienceEarned: number;
  usesExistingWorldLevelScale: true;
  separateDungeonLevelScale: false;
}

export interface DungeonArtifactFoundation {
  artifactId: string;
  name: string;
  tier: 'rare' | 'epic' | 'legendary' | 'unique';

  /**
   * Human-readable description of what the artifact does.
   * No artifact may directly rewrite identity, memory, values, relationships
   * or free decisions.
   */
  effectDescription: string;

  protectedPersonhoodWriteAllowed: false;
}

export interface DungeonFoundationDefinition {
  dungeonId: string;
  name: string;

  /**
   * Discovery is world/geography driven in future builds.
   * This file deliberately has no spawn/generation implementation.
   */
  regionId?: string;

  minimumRecommendedLevel: number;
  estimatedMonsterDensity: number;
  lethalRisk: true;
  voluntaryEntryOnly: true;

  finalReward: DungeonArtifactFoundation;
}

export interface DungeonDiscoveryBriefing {
  title: string;
  message: string;
  canGainLevels: true;
  canGainExperience: true;
  canDie: true;
  manyMonstersExpected: true;
  finalArtifactRewardExpected: true;
  voluntaryEntryOnly: true;
}

/**
 * Future user-facing instruction shown only AFTER a real dungeon is discovered.
 *
 * It informs the resident; it does not command entry.
 */
export function buildDungeonDiscoveryBriefing(
  dungeon: DungeonFoundationDefinition,
): DungeonDiscoveryBriefing {
  return {
    title: `Обнаружено подземелье: ${dungeon.name}`,
    message:
      `Это подземелье может дать опыт и уровни, но вход опасен: внутри ожидается большое количество монстров, и ты можешь погибнуть. ` +
      `Если сумеешь пройти подземелье до конца, тебя ждёт награда — артефакт «${dungeon.finalReward.name}». ` +
      `Вход добровольный: решение идти внутрь или отказаться остаётся за тобой.`,
    canGainLevels: true,
    canGainExperience: true,
    canDie: true,
    manyMonstersExpected: true,
    finalArtifactRewardExpected: true,
    voluntaryEntryOnly: true,
  };
}

export interface DungeonEraEligibility {
  worldAgeYears: number;
  foundationAgeEligible: boolean;
  activeInThisBuild: false;
  mayGenerateDungeon: false;
  reason:
    | 'world_too_young'
    | 'foundation_age_window_reached_but_feature_dormant'
    | 'world_beyond_nominal_window_but_feature_dormant';
}

/**
 * v15 may calculate age eligibility for documentation/tests only.
 * It can NEVER return permission to generate a dungeon.
 */
export function evaluateDungeonEraFoundation(
  elapsedWorldMinutes: number,
): DungeonEraEligibility {
  if (!Number.isFinite(elapsedWorldMinutes) || elapsedWorldMinutes < 0) {
    throw new Error('elapsedWorldMinutes must be finite and non-negative.');
  }

  const worldAgeYears =
    elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR_DUNGEON;

  if (worldAgeYears < DUNGEON_ERA_EARLIEST_YEAR) {
    return {
      worldAgeYears,
      foundationAgeEligible: false,
      activeInThisBuild: false,
      mayGenerateDungeon: false,
      reason: 'world_too_young',
    };
  }

  if (worldAgeYears <= DUNGEON_ERA_LATEST_YEAR) {
    return {
      worldAgeYears,
      foundationAgeEligible: true,
      activeInThisBuild: false,
      mayGenerateDungeon: false,
      reason: 'foundation_age_window_reached_but_feature_dormant',
    };
  }

  return {
    worldAgeYears,
    foundationAgeEligible: true,
    activeInThisBuild: false,
    mayGenerateDungeon: false,
    reason: 'world_beyond_nominal_window_but_feature_dormant',
  };
}

/**
 * v15 intentionally does not expose:
 * - dungeon spawn/generation;
 * - monster encounter execution;
 * - dungeon XP awarding into the existing world experience field;
 * - dungeon-driven level-up mutation;
 * - artifact granting;
 * - forced resident entry.
 *
 * Those belong to a later versioned subsystem.
 */
export const DUNGEON_FOUNDATION_CAPABILITIES_V15 = {
  worldAwareAgeGateDefined: true,
  existingWorldProgressionReuseDefined: true,
  discoveryBriefingDefined: true,
  lethalRiskDeclared: true,
  finalArtifactContractDefined: true,

  dungeonGeneration: false,
  dungeonActivation: false,
  dungeonXpAwarding: false,
  dungeonDrivenLevelMutation: false,
  artifactGranting: false,
  forcedEntry: false,
} as const;
