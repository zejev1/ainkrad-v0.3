import { describe, expect, it } from 'vitest';
import { IndependentWorldEntryGateway } from '../src/boundary/WorldEntryGateway';
import {
  applyDivineActionV19,
  assertWorldV19State,
  MAX_RECENT_PRAYERS_V19,
  MAX_SIGNIFICANT_PRAYERS_PER_AGENT_V19,
  recordContextualPrayerV19,
} from '../src/v19/DivineAgencyV19';
import { WORLD_RULES_VERSION_V18 } from '../src/v18/UnderworldFoundationV18';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WORLD_RULES_VERSION, WorldEngine } from '../src/world/WorldEngine';
import type { AgentState, WorldState } from '../src/world/types';

async function freshWorld(worldId: string): Promise<{
  store: InMemoryWorldStore;
  engine: WorldEngine;
  state: WorldState;
}> {
  const store = new InMemoryWorldStore();
  const engine = await WorldEngine.create({
    worldId,
    seed: `${worldId}-seed`,
    store,
    startTime: 0,
  });
  return { store, engine, state: engine.snapshot() };
}

function identityAndLifeChoice(agent: Readonly<AgentState>) {
  return structuredClone({
    identity: agent.identity,
    personality: agent.personality,
    values: agent.mind.values,
    goal: agent.goal,
    parentIds: agent.life.parentIds,
    childIds: agent.life.childIds,
  });
}

describe('v0.3.19 independent divine agency', () => {
  it('migrates a v18 life exactly once and translates a legacy audience without activating its role', async () => {
    const source = await freshWorld('v19-legacy-audience');
    const legacy = source.state;
    const resident = legacy.agents.agent_1;
    resident.privateDivineCalling = {
      audienceId: 'old-audience',
      deityId: 'player_deity',
      deityName: 'Создатель',
      religionName: 'Путь',
      message: 'Иди своим путём.',
      gift: 'might',
      calling: 'hero',
      acceptedCalling: true,
      grantedWorldMinute: 0,
      sharedCount: 0,
    };
    const preserved = structuredClone({
      now: legacy.now,
      calendar: legacy.calendar,
      agents: legacy.agents,
      relationships: legacy.relationships,
      determinism: legacy.determinism,
      v18: legacy.v18,
    });
    legacy.rulesVersion = WORLD_RULES_VERSION_V18;
    legacy.governance.constitutionVersion = 'ainkrad-constitution-0.3.18';
    delete legacy.v19;
    const store = new InMemoryWorldStore();
    await store.initializeWorld(legacy);

    const opened = await WorldEngine.open({ worldId: legacy.id, store });
    const migrated = opened.snapshot();
    expect(migrated.rulesVersion).toBe(WORLD_RULES_VERSION);
    expect({
      now: migrated.now,
      calendar: migrated.calendar,
      agents: migrated.agents,
      relationships: migrated.relationships,
      determinism: migrated.determinism,
      v18: migrated.v18,
    }).toEqual(preserved);
    const profile = migrated.v19?.divineAgency.byAgentId.agent_1;
    expect(profile?.gifts.map((item) => item.gift)).toEqual(['might']);
    expect(profile?.contacts.map((item) => item.message)).toEqual(['Иди своим путём.']);
    const revision = migrated.revision;
    const reopened = await WorldEngine.open({ worldId: legacy.id, store });
    expect(reopened.snapshot().revision).toBe(revision);
  });

  it('lets an ordinary resident keep identity and profession after any gift, including the hero preset', async () => {
    const { state } = await freshWorld('v19-gift-not-class');
    const resident = state.agents.agent_1;
    const livelihood = state.v18!.livelihoodByAgentId[resident.id];
    livelihood.primary = 'farmer';
    livelihood.stage = 'established';
    const before = identityAndLifeChoice(resident);

    const result = applyDivineActionV19(state, {
      operationId: 'hero-preset-for-farmer',
      agentId: resident.id,
      deityId: 'player_deity',
      deityName: 'Создатель',
      gift: 'demon_king_hero',
      worldMinute: state.calendar.elapsedWorldMinutes,
      interpretationRoll: 0.91,
    });

    expect(result.giftGranted).toBe(true);
    expect(result.contactRecorded).toBe(false);
    expect(result.interpretation).not.toBe('direct_contact');
    expect(identityAndLifeChoice(resident)).toEqual(before);
    expect(livelihood.primary).toBe('farmer');
    expect(resident.progression?.level).toBeLessThan(100);
    expect(state.v19!.divineAgency.byAgentId[resident.id].gifts[0].mastery).toBeCloseTo(0.06);
    expect(resident.privateDivineCalling).toBeUndefined();
  });

  it('treats messages, revelations and commands as information the resident interprets freely', async () => {
    const { state } = await freshWorld('v19-contact-autonomy');
    const resident = state.agents.agent_2;
    const before = identityAndLifeChoice(resident);
    const command = applyDivineActionV19(state, {
      operationId: 'contact-command',
      agentId: resident.id,
      deityId: 'player_deity',
      deityName: 'Создатель',
      religionName: 'Путь Создателя',
      contactKind: 'command',
      message: 'Отправляйся на север и предупреди людей.',
      worldMinute: state.calendar.elapsedWorldMinutes,
      interpretationRoll: 0.2,
    });
    const revelation = applyDivineActionV19(state, {
      operationId: 'contact-revelation',
      agentId: resident.id,
      deityId: 'player_deity',
      deityName: 'Создатель',
      contactKind: 'revelation',
      message: 'За горами есть безопасная долина.',
      worldMinute: state.calendar.elapsedWorldMinutes,
      interpretationRoll: 0.7,
    });

    expect(command.contactRecorded).toBe(true);
    expect(revelation.contactRecorded).toBe(true);
    expect(command.residentResponse).toMatch(/решение|сам/i);
    expect(identityAndLifeChoice(resident)).toEqual(before);
    expect(state.v19?.divineAgency.byAgentId[resident.id].contacts).toHaveLength(2);
    expect(state.v19?.divineAgency.byAgentId[resident.id].gifts).toHaveLength(0);
  });

  it('builds a prayer from a sick child, lived conditions and the resident rather than awarding anything', async () => {
    const { state } = await freshWorld('v19-lived-prayer');
    const parent = state.agents.agent_1;
    const child = state.agents.agent_2;
    parent.life.childIds = [child.id];
    child.life.parentIds = [parent.id];
    child.life.health = 0.18;
    parent.stress = 0.91;
    parent.mind.emotions.fear = 0.88;
    parent.mind.values.care = 0.93;

    const prayer = recordContextualPrayerV19(state, parent, {
      subject: 0.2,
      deity: 0.4,
      wording: 0.73,
    });

    expect(prayer.triggerEvent).toBe('close_person_health_decline');
    expect(prayer.targetPersonId).toBe(child.id);
    expect(prayer.generatedPrayerText).toContain(child.name);
    expect(prayer.evidence.health).toBe(parent.life.health);
    expect(prayer.evidence.targetRelationship).toBe('ребёнок');
    expect(prayer.desiredOutcome).toContain('выздороветь');
    expect(state.v19?.divineAgency.totalPrayerCount).toBe(1);
    expect(state.v19?.divineAgency.byAgentId[parent.id].gifts).toHaveLength(0);
    expect(state.v19?.divineAgency.byAgentId[parent.id].contacts).toHaveLength(0);
  });

  it('links an answer to prayer without making a silent gift automatically identifiable as divine', async () => {
    const { state } = await freshWorld('v19-prayer-response');
    const resident = state.agents.agent_3;
    resident.resources = 0.05;
    resident.stress = 0.82;
    const prayer = recordContextualPrayerV19(state, resident, {
      subject: 0.1,
      deity: 0.4,
      wording: 0.25,
    });
    const response = applyDivineActionV19(state, {
      operationId: 'silent-longevity',
      agentId: resident.id,
      deityId: 'player_deity',
      deityName: 'Создатель',
      gift: 'longevity',
      relatedPrayerId: prayer.id,
      worldMinute: state.calendar.elapsedWorldMinutes,
      interpretationRoll: 0.58,
    });

    expect(response.interpretation).not.toBe('direct_contact');
    expect(prayer.response?.interventionId).toBe('silent-longevity');
    expect(prayer.response?.residentResponse).toBe(response.residentResponse);
    expect(state.v19!.divineAgency.byAgentId[resident.id].gifts.some(g => g.gift === 'longevity')).toBe(true);
  });

  it('keeps detailed prayer storage bounded while preserving cumulative counts and significant history', async () => {
    const { state } = await freshWorld('v19-prayer-bounds');
    const resident = state.agents.agent_4;
    resident.stress = 0.9;
    resident.resources = 0.08;
    for (let index = 0; index < MAX_RECENT_PRAYERS_V19 + 40; index += 1) {
      recordContextualPrayerV19(state, resident, {
        subject: (index % 11) / 10,
        deity: (index % 7) / 6,
        wording: (index % 13) / 12,
      });
    }
    const agency = state.v19!.divineAgency;
    expect(agency.recentPrayers).toHaveLength(MAX_RECENT_PRAYERS_V19);
    expect(agency.totalPrayerCount).toBe(MAX_RECENT_PRAYERS_V19 + 40);
    expect(agency.byAgentId[resident.id].significantPrayers.length).toBeLessThanOrEqual(
      MAX_SIGNIFICANT_PRAYERS_PER_AGENT_V19,
    );
    assertWorldV19State(state);
  });

  it('allows the action only through the independent gateway and emits no direct public event to Cardinal', async () => {
    const { store, engine } = await freshWorld('v19-private-gateway');
    const gateway = new IndependentWorldEntryGateway(engine);
    const expected = engine.snapshot();
    const historyBefore = await store.history(expected.id);
    const record = await gateway.audience(
      {
        requestId: 'private-action-001',
        worldId: expected.id,
        agentId: 'agent_5',
        deityId: 'player_deity',
        deityName: 'Создатель',
        gift: 'might',
        requestedAt: expected.now,
      },
      expected,
    );
    const after = engine.snapshot();
    const historyAfter = await store.history(expected.id);

    expect(record.authorized).toBe(true);
    expect(after.v19?.divineAgency.byAgentId.agent_5.gifts[0].gift).toBe('might');
    expect(historyAfter).toEqual(historyBefore);
    expect(Object.values(after.agents).every((agent) =>
      agent.id === 'agent_5' || agent.privateDivineCalling === undefined,
    )).toBe(true);
  });
});
