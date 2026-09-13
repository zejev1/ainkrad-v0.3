import type {
  AgentState,
  V16HumanConstructionStage,
  V16HumanHouseRecipe,
  V16SettlementEconomyState,
  V16SettlementResourceState,
} from '../world/types';

export interface HumanHouseRecipeV21 {
  id: V16HumanHouseRecipe;
  wood: number;
  stone: number;
  laborPersonDays: number;
}

/**
 * Ordinary people adapt a dwelling to local material. Quarried stone improves
 * a foundation but is not a magical prerequisite for shelter.
 */
export const HUMAN_HOUSE_RECIPES_V21: Readonly<
  Record<V16HumanHouseRecipe, HumanHouseRecipeV21>
> = {
  timber_wattle_thatch: {
    id: 'timber_wattle_thatch',
    wood: 0.72,
    stone: 0,
    laborPersonDays: 260,
  },
  timber_stone_foundation: {
    id: 'timber_stone_foundation',
    wood: 0.62,
    stone: 0.35,
    laborPersonDays: 210,
  },
};

export function selectHumanHouseRecipeV21(
  economy: Readonly<V16SettlementEconomyState>,
  land: Readonly<V16SettlementResourceState>,
): HumanHouseRecipeV21 | undefined {
  const stoneFoundation = HUMAN_HOUSE_RECIPES_V21.timber_stone_foundation;
  if (
    economy.stocks.wood >= stoneFoundation.wood &&
    economy.stocks.stone >= stoneFoundation.stone
  ) {
    return stoneFoundation;
  }

  const vernacular = HUMAN_HOUSE_RECIPES_V21.timber_wattle_thatch;
  if (
    economy.stocks.wood >= vernacular.wood &&
    land.renewableBase >= 0.16
  ) {
    return vernacular;
  }
  return undefined;
}

export function humanConstructionStageV21(
  completedPersonDays: number,
  requiredPersonDays: number,
): V16HumanConstructionStage {
  const ratio = Math.max(0, completedPersonDays) / Math.max(1, requiredPersonDays);
  if (ratio < 0.04) return 'site_selection';
  if (ratio < 0.16) return 'materials';
  if (ratio < 0.29) return 'foundation';
  if (ratio < 0.5) return 'frame';
  if (ratio < 0.7) return 'walls';
  if (ratio < 0.9) return 'roof';
  return 'finishing';
}

export function humanHousingInitiativeV21(
  agent: Readonly<AgentState>,
  householdCrowding: number,
): number {
  return Math.max(
    0,
    Math.min(
      1,
      householdCrowding * 0.34 +
        agent.personality.diligence * 0.2 +
        agent.mind.values.care * 0.2 +
        agent.mind.values.ambition * 0.1 +
        agent.skills.craft * 0.08 +
        agent.needs.purpose * 0.08,
    ),
  );
}

export function humanConstructionVolunteerWillingnessV21(
  agent: Readonly<AgentState>,
  householdMember: boolean,
  localCrowding: number,
): number {
  return Math.max(
    0,
    Math.min(
      1,
      (householdMember ? 0.24 : 0) +
        localCrowding * 0.18 +
        agent.personality.diligence * 0.2 +
        agent.personality.generosity * 0.14 +
        agent.mind.values.care * 0.12 +
        agent.skills.craft * 0.08 +
        agent.needs.purpose * 0.04,
    ),
  );
}

/** One decision quantum covers about six days; a chosen building action may
 * contribute part of that interval while leaving time for food, sleep and life. */
export function humanConstructionLaborV21(input: {
  agent: Readonly<AgentState>;
  constructionKnowledge: number;
  hasConstructionTool: boolean;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
}): number {
  const seasonScale =
    input.season === 'summer'
      ? 1
      : input.season === 'spring'
        ? 0.92
        : input.season === 'autumn'
          ? 0.82
          : 0.58;
  const toolScale = input.hasConstructionTool ? 1.18 : 0.82;
  const skillScale =
    0.7 + input.agent.skills.craft * 0.22 + input.constructionKnowledge * 0.38;
  const bodyScale =
    0.62 +
    input.agent.life.physiology.strength * 0.18 +
    input.agent.life.physiology.endurance * 0.2;
  return Math.max(0.35, 3.4 * seasonScale * toolScale * skillScale * bodyScale);
}
