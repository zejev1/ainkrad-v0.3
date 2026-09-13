import { describe, expect, it } from 'vitest';
import { applyDivineActionV19, hasDivineGiftV19 } from '../src/v19/DivineAgencyV19';
import { observeLocalPlacesV20 } from '../src/v20/KnowledgeBoundariesV20';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { residentExplorationTarget } from '../src/world/ResidentExploration';
import { residentDecisionReflection } from '../src/world/ResidentDecisionReflection';
import { roundedRoutePath } from '../src/world/RouteCurves';
import { WorldEngine } from '../src/world/WorldEngine';

const fresh = async (id: string) =>
  (await WorldEngine.create({ worldId: id, seed: 'fix8', store: new InMemoryWorldStore() })).snapshot();

describe('FIX8 exploration, divine understanding and curved routes', () => {
  it('sends a voluntary exploration choice toward known reachable wilderness', async () => {
    const world = await fresh('fix8-frontier-target');
    const agent = world.agents.agent_1;
    const field = world.places.resource_field;
    world.places.known_frontier = {
      ...structuredClone(world.places.outskirts),
      id: 'known_frontier',
      name: 'Известная дальняя опушка',
      kind: 'forest',
      settlementId: undefined,
      mapX: field.mapX + 32,
      mapY: field.mapY + 6,
      connectedPlaceIds: [field.id],
    };
    agent.locationId = field.id;
    agent.position = { x: field.mapX, y: field.mapY, layerId: 'surface' };
    agent.knownPlaceIds = [field.id, world.places.workshop.id, 'known_frontier'];
    agent.plan = {
      kind: 'explore_frontier', targetPlaceId: world.places.workshop.id,
      startedAt: 0, expiresAt: 48,
    };

    expect(
      residentExplorationTarget(world, agent, () => true, [field.id]),
    ).toBe('known_frontier');
  });

  it('notices a connected frontier trail without learning an unconnected remote place', async () => {
    const world = await fresh('fix8-local-trail');
    const agent = world.agents.agent_1;
    const current = world.places.outskirts;
    agent.locationId = current.id;
    agent.position = { x: current.mapX, y: current.mapY, layerId: 'surface' };
    world.places.connected_frontier = {
      ...structuredClone(current), id: 'connected_frontier', kind: 'meadow',
      settlementId: undefined, mapX: current.mapX + 40, connectedPlaceIds: [current.id],
    };
    world.places.hidden_frontier = {
      ...structuredClone(current), id: 'hidden_frontier', kind: 'forest',
      settlementId: undefined, mapX: current.mapX + 10, connectedPlaceIds: [],
    };
    current.connectedPlaceIds.push('connected_frontier');
    agent.knownPlaceIds = [current.id];

    observeLocalPlacesV20(world, agent);
    expect(agent.knownPlaceIds).toContain('connected_frontier');
    expect(agent.knownPlaceIds).not.toContain('hidden_frontier');
  });

  it('rounds a physical right-angle route instead of keeping a square corner', () => {
    const curve = roundedRoutePath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(curve[0]).toEqual({ x: 0, y: 0 });
    expect(curve.at(-1)).toEqual({ x: 10, y: 10 });
    expect(curve.length).toBeGreaterThan(4);
    expect(curve).not.toContainEqual({ x: 10, y: 0 });
    const largestTurn = Math.max(...curve.slice(1, -1).map((point, index) => {
      const before = curve[index];
      const after = curve[index + 2];
      const a = Math.atan2(point.y - before.y, point.x - before.x);
      const b = Math.atan2(after.y - point.y, after.x - point.x);
      return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
    }));
    expect(largestTurn).toBeLessThan(Math.PI / 3);
  });

  it('keeps the original gift when legacy is added', async () => {
    const world = await fresh('fix8-legacy');
    const agent = world.agents.agent_1;
    applyDivineActionV19(world, {
      operationId: 'might', agentId: agent.id, deityId: 'player_deity',
      deityName: 'Создатель', gift: 'might', worldMinute: 0, interpretationRoll: 0.5,
    });
    const legacy = applyDivineActionV19(world, {
      operationId: 'legacy', agentId: agent.id, deityId: 'player_deity',
      deityName: 'Создатель', gift: 'legacy', inheritanceGift: 'might',
      contactKind: 'message', message: 'Этот дар сможет перейти твоему ребёнку.',
      worldMinute: 0, interpretationRoll: 0.5,
    });
    expect(world.v19!.divineAgency.byAgentId[agent.id].gifts.map((gift) => gift.gift))
      .toEqual(['might', 'legacy']);
    expect(hasDivineGiftV19(world, agent.id, 'might')).toBe(true);
    expect(legacy.residentResponse).toMatch(/не исчез|ребён/i);
  });

  it('answers the actual private words from the resident context and recognizes a named gift', async () => {
    const world = await fresh('fix8-personal-answer');
    const agent = world.agents.agent_2;
    world.v18!.livelihoodByAgentId[agent.id].primary = 'farmer';
    agent.mind.values.knowledge = 0.95;
    agent.mind.values.freedom = 0.2;
    const message = 'Проверь тропу у северного леса и сам реши, безопасна ли она.';
    const result = applyDivineActionV19(world, {
      operationId: 'personal', agentId: agent.id, deityId: 'player_deity',
      deityName: 'Создатель', gift: 'pathfinder', contactKind: 'request', message,
      worldMinute: 0, interpretationRoll: 0.3,
    });
    expect(result.residentResponse).toContain(message);
    expect(result.residentResponse).toMatch(/земледелец/i);
    expect(result.residentResponse).toMatch(/смысл|подтверждение/i);
    expect(result.residentResponse).toMatch(/Следопыт/);
  });

  it('records an ordinary decision as a short human reflection instead of visible maths', async () => {
    const world = await fresh('fix8-human-thought');
    const agent = world.agents.agent_1;
    agent.energy = 0.72;
    agent.resources = 0.56;
    agent.stress = 0.34;
    agent.mind.values.freedom = 0.96;
    const reflection = residentDecisionReflection(agent, {
      action: 'work', dominantAction: 'gather', consideredActionCount: 8, openness: 0.7,
    });

    expect(reflection.deliberationWorldMinutes).toBeLessThanOrEqual(0.75);
    expect(reflection.innerThought).toMatch(/Я |Мне |моим|моё/i);
    expect(reflection.innerThought).toMatch(/обстоятельств|выбрать|сил|риск|припас|близост|смысл/i);
    expect(reflection.innerThought).toMatch(/работ|дело/i);
    expect(reflection.innerThought).not.toMatch(/\d+\s*(?:%|вариант)/i);
  });

  it('lets consequential choices take minutes, never simulated days of thinking', async () => {
    const world = await fresh('fix8-consequential-thought');
    const agent = world.agents.agent_2;
    agent.stress = 0.8;
    const reflection = residentDecisionReflection(agent, {
      action: 'explore', dominantAction: 'rest', consideredActionCount: 10, openness: 0.95,
    });
    expect(reflection.deliberationWorldMinutes).toBeGreaterThan(1);
    expect(reflection.deliberationWorldMinutes).toBeLessThanOrEqual(8);
    expect(reflection.innerThought).toMatch(/дальше|знаком/i);
  });
});
