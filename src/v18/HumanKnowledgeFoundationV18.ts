import type { GenesisDomain } from '../v15/GenesisBootstrap';

export const HUMAN_KNOWLEDGE_FOUNDATION_VERSION_V18 =
  'ainkrad-human-knowledge-foundation-0.3.18';

export interface HumanKnowledgeCurriculumV18 {
  domain: GenesisDomain;
  referenceKnowledge: number;
  topics: readonly string[];
}

/**
 * A compact, inspectable human bootstrap curriculum. It contains principles
 * that can be taught through real work; it is not an oracle that writes a
 * finished civilization into residents' minds.
 */
export const HUMAN_KNOWLEDGE_CURRICULUM_V18: Readonly<
  Record<GenesisDomain, HumanKnowledgeCurriculumV18>
> = {
  agriculture: {
    domain: 'agriculture',
    referenceKnowledge: 0.88,
    topics: [
      'crop_rotation',
      'fallow_years',
      'soil_composting',
      'seed_selection',
      'irrigation_and_drainage',
      'harvest_storage',
    ],
  },
  construction: {
    domain: 'construction',
    referenceKnowledge: 0.9,
    topics: [
      'safe_shelter',
      'foundations_and_load_paths',
      'roads_and_bridges',
      'tools_and_materials',
      'settlement_planning',
      'fire_safety',
    ],
  },
  household: {
    domain: 'household',
    referenceKnowledge: 0.86,
    topics: [
      'clean_water_and_hygiene',
      'food_preparation',
      'first_aid',
      'child_care',
      'home_family_kinship_and_personal_boundaries',
      'home_ownership_absence_and_abandonment',
      'repair_before_new_construction',
      'conflict_resolution',
      'teaching_and_written_records',
    ],
  },
  survival: {
    domain: 'survival',
    referenceKnowledge: 0.9,
    topics: [
      'navigation_by_landmarks_and_sky',
      'route_and_map_making',
      'weather_and_ecology',
      'rain_snow_storm_cold_and_shelter',
      'safe_long_distance_travel',
      'world_exploration_and_surveying',
      'expedition_preparation_and_provisions',
      'adventurer_party_roles_and_cooperation',
      'dungeon_entrances_floors_and_ranked_danger',
      'retreat_rest_and_survival_before_reward',
      'artifacts_loot_trade_and_adventure_economy',
      'settlement_defence',
      'risk_assessment',
    ],
  },
};

export function genesisReferenceKnowledgeV18(domain: GenesisDomain): number {
  return HUMAN_KNOWLEDGE_CURRICULUM_V18[domain].referenceKnowledge;
}
