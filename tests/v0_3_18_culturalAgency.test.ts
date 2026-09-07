import { describe, expect, it } from 'vitest';
import {
  chooseCulturalChildNameV18,
  repairLegacyTechnicalChildNamesV18,
} from '../src/v18/CulturalNamingV18';
import { recordRussianConversationV18 } from '../src/v18/LanguageAndConversationV18';
import {
  practiceSecretLibraryKnowledgeV18,
  secretLibraryActionAffinityV18,
  type SecretLibraryKnowledgeRecordV18,
} from '../src/v18/SecretLibraryV18';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import type { RelationshipState } from '../src/world/types';

async function stateFor(name: string) {
  const world = await WorldEngine.create({
    worldId: name,
    seed: name,
    store: new InMemoryWorldStore(),
    startTime: 0,
  });
  return world.snapshot();
}

function navigationRecord(
  id: string,
  understanding = 0.78,
): SecretLibraryKnowledgeRecordV18 {
  return {
    id: `library:${id}:navigation`,
    knowledgeId: 'navigation-compass',
    title: 'Магнитный компас',
    category: 'navigation',
    historicalSource: 'Средневековая навигационная практика',
    sourceTitle: 'Реальный исторический источник',
    sourceUrl: 'https://en.wikisource.org/wiki/Compass',
    acquiredWorldMinute: 100,
    understanding,
    summary: 'Намагниченная стрелка помогает сохранять направление.',
    concepts: ['магнитная стрелка', 'стороны света'],
    practiceCount: 0,
    sharedCount: 0,
  };
}

function acquaintedRelationship(): RelationshipState {
  return {
    agentA: 'agent_1',
    agentB: 'agent_2',
    trust: 0.62,
    affinity: 0.54,
    respect: 0.58,
    conflict: 0.04,
    updatedAt: 0,
  };
}

describe('v0.3.18 cultural naming, speech and applied knowledge', () => {
  it('lets parents create many normal cultural names without leaking counters', async () => {
    const state = await stateFor('cultural-names');
    const parentA = state.agents.agent_1;
    const parentB = state.agents.agent_2;
    const used = new Set(
      Object.values(state.agents).map((agent) => agent.name.toLocaleLowerCase('ru-RU')),
    );
    const produced = new Set<string>();

    for (let sequence = 11; sequence <= 610; sequence += 1) {
      const choice = chooseCulturalChildNameV18({
        worldId: state.id,
        race: 'human',
        sex: sequence % 2 === 0 ? 'female' : 'male',
        sequence,
        parentA,
        parentB,
        existingNames: used,
      });
      expect(choice.name).not.toMatch(/\d/);
      expect(choice.parentIds).toEqual([parentA.id, parentB.id]);
      expect(used.has(choice.name.toLocaleLowerCase('ru-RU'))).toBe(false);
      used.add(choice.name.toLocaleLowerCase('ru-RU'));
      produced.add(choice.name);
    }

    expect(produced.size).toBe(600);
  });

  it('repairs only legacy numbered child aliases in an existing save', async () => {
    const state = await stateFor('legacy-numbered-name-repair');
    const legacy = structuredClone(state.agents.agent_1);
    legacy.id = 'epoch_1_agent_11';
    legacy.name = 'Ari 11';
    legacy.sex = 'female';
    legacy.life.generation = 1;
    legacy.life.parentIds = ['agent_1', 'agent_2'];
    const userNamed = structuredClone(legacy);
    userNamed.id = 'epoch_1_agent_12';
    userNamed.name = 'Ada 12';
    state.agents[legacy.id] = legacy;
    state.agents[userNamed.id] = userNamed;

    expect(repairLegacyTechnicalChildNamesV18(state)).toBe(1);
    expect(state.agents[legacy.id].name).not.toMatch(/\d/);
    expect(state.agents[userNamed.id].name).toBe('Ada 12');
  });

  it('renders varied personal speech instead of one phrase per topic', async () => {
    const state = await stateFor('varied-conversation');
    const speaker = state.agents.agent_1;
    const listener = state.agents.agent_2;
    listener.locationId = speaker.locationId;
    const relationship = acquaintedRelationship();
    state.relationships['agent_1::agent_2'] = relationship;
    const utterances = new Set<string>();

    for (let sequence = 1; sequence <= 30; sequence += 1) {
      const conversation = recordRussianConversationV18({
        id: `varied-conversation-${sequence}`,
        state,
        speaker,
        listener,
        relationship,
        sentiment: 0.12,
        topicRoll: 0,
        audibilityRoll: 0.5,
        placeOccupancy: 2,
      });
      expect(conversation.topic).toBe('daily_life');
      utterances.add(conversation.utterance);
    }

    expect(utterances.size).toBeGreaterThanOrEqual(20);
  });

  it('speaks a genuinely learned idea and transfers only partial understanding', async () => {
    const state = await stateFor('knowledge-conversation');
    const speaker = state.agents.agent_1;
    const listener = state.agents.agent_2;
    listener.locationId = speaker.locationId;
    const relationship = acquaintedRelationship();
    state.relationships['agent_1::agent_2'] = relationship;
    relationship.trust = 0.9;
    state.v18!.secretLibrary.knowledgeByAgentId[speaker.id] = [
      navigationRecord(speaker.id),
    ];
    let knowledgeableConversation;

    for (let index = 0; index <= 100; index += 1) {
      const conversation = recordRussianConversationV18({
        id: `knowledge-conversation-${index}`,
        state,
        speaker,
        listener,
        relationship,
        sentiment: 0.45,
        topicRoll: index / 100,
        audibilityRoll: 0.5,
        placeOccupancy: 2,
      });
      if (conversation.evidence.knowledgeId) {
        knowledgeableConversation = conversation;
        break;
      }
    }

    expect(knowledgeableConversation).toBeDefined();
    expect(knowledgeableConversation!.utterance).toContain('Магнитный компас');
    expect(knowledgeableConversation!.evidence.knowledgeShared).toBe(true);
    const learned = state.v18!.secretLibrary.knowledgeByAgentId[listener.id][0];
    expect(learned.learnedFromAgentId).toBe(speaker.id);
    expect(learned.understanding).toBeGreaterThan(0.04);
    expect(learned.understanding).toBeLessThan(0.78);
    expect(learned.practiceCount).toBe(0);
  });

  it('turns reading into bounded action affinity and improves it only by practice', async () => {
    const state = await stateFor('knowledge-to-action');
    const agent = state.agents.agent_1;
    const record = navigationRecord(agent.id, 0.42);
    state.v18!.secretLibrary.knowledgeByAgentId[agent.id] = [record];

    expect(secretLibraryActionAffinityV18(state, agent.id, 'explore')).toBeGreaterThan(0);
    expect(secretLibraryActionAffinityV18(state, agent.id, 'gather')).toBe(0);
    const before = record.understanding;
    expect(practiceSecretLibraryKnowledgeV18(state, agent.id, 'gather')).toBeUndefined();
    expect(record.understanding).toBe(before);
    expect(practiceSecretLibraryKnowledgeV18(state, agent.id, 'explore'))
      .toBe(record.knowledgeId);
    expect(record.practiceCount).toBe(1);
    expect(record.understanding).toBeGreaterThan(before);
  });
});
