import { describe, expect, it } from 'vitest';
import { createGenesisTeachers } from '../src/v15/GenesisBootstrap';
import { HUMAN_KNOWLEDGE_CURRICULUM_V18 } from '../src/v18/HumanKnowledgeFoundationV18';

describe('v0.3.22 Genesis exploration/adventure mentor', () => {
  it('keeps the four Genesis bootstrap teachers and uses survival as the exploration mentor', () => {
    const teachers = createGenesisTeachers('world:epoch:1', 0);
    expect(teachers).toHaveLength(4);
    const survival = teachers.find((teacher) => teacher.domain === 'survival');
    expect(survival).toBeDefined();
    expect(survival?.ordinaryResident).toBe(false);
    expect(survival?.countedInPopulation).toBe(false);
  });

  it('teaches world exploration and adventurer mechanics without creating a compulsory profession', () => {
    const topics = HUMAN_KNOWLEDGE_CURRICULUM_V18.survival.topics;
    expect(topics).toContain('world_exploration_and_surveying');
    expect(topics).toContain('expedition_preparation_and_provisions');
    expect(topics).toContain('adventurer_party_roles_and_cooperation');
    expect(topics).toContain('dungeon_entrances_floors_and_ranked_danger');
    expect(topics).toContain('retreat_rest_and_survival_before_reward');
    expect(topics).toContain('artifacts_loot_trade_and_adventure_economy');
  });
});
