import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import type { AgentState, WorldState } from '../src/world/types';
import { ensureAgentEmbodiedWorldV21, ensureEmbodiedWorldV21, recordMaterialPracticeV21, recordEmbodiedReadingV21, recordCarePracticeV21 } from '../src/v21/EmbodiedWorldV21';

async function fixture() {
  const engine = await WorldEngine.create({ worldId: 'hot-path-continuity', seed: 'hot-path-continuity', store: new InMemoryWorldStore(), agentNames: ['A', 'B', 'C'] });
  const inner = engine as any;
  inner.workingState = engine.snapshot(); inner.stagedEvents = []; inner.stagedMemories = [];
  const world: WorldState = inner.state;
  const agents = Object.values(world.agents);
  for (const agent of agents) { agent.life.alive = true; agent.life.ageYears = 25; agent.life.stage = 'adult'; agent.resources = .6; }
  return { inner, world, agents };
}
afterEach(() => vi.restoreAllMocks());

describe('targeted embodied actions retain life without a world-sized repair per action', () => {
  it('does not enumerate unrelated people or items when recording practice and reading', async () => {
    const { world, agents: [a, b] } = await fixture();
    ensureEmbodiedWorldV21(world);
    const unrelated = JSON.stringify(world.v21!.appliedKnowledgeByAgentId[b.id]);
    const table = world.agents;
    world.agents = new Proxy(table, { ownKeys() { throw new Error('per-action world scan'); } });
    expect(() => {
      ensureAgentEmbodiedWorldV21(world, a.id);
      recordMaterialPracticeV21(world, a.id, 2);
      recordEmbodiedReadingV21(world, a, 'medicine', 'test-anatomy', .8);
    }).not.toThrow();
    expect(world.v21!.appliedKnowledgeByAgentId[a.id].materialPractice).toBeGreaterThan(0);
    expect(world.v21!.appliedKnowledgeByAgentId[a.id].anatomyTheory).toBeGreaterThan(0);
    expect(JSON.stringify(world.v21!.appliedKnowledgeByAgentId[b.id])).toBe(unrelated);
    world.agents = table;
  });
  it('initializes a new living body locally and keeps full boundary cleanup for deaths', async () => {
    const { world, agents: [a, b] } = await fixture();
    ensureEmbodiedWorldV21(world);
    delete world.v21!.bodiesByAgentId[a.id]; delete world.v21!.appliedKnowledgeByAgentId[a.id];
    expect(ensureAgentEmbodiedWorldV21(world, a.id).bodiesByAgentId[a.id]).toBeDefined();
    expect(world.v21!.appliedKnowledgeByAgentId[a.id].foundingPrimerWordsRead).toBe(0);
    b.life.alive = false;
    ensureEmbodiedWorldV21(world);
    expect(world.v21!.bodiesByAgentId[b.id]).toBeUndefined();
    expect(world.v21!.appliedKnowledgeByAgentId[b.id]).toBeUndefined();
  });
});

describe('an old origin location is not physical presence during travel', () => {
  it.each(['performHelp', 'performBond', 'interact'])('does not perform %s with a resident already on the road', async method => {
    const { inner, world, agents: [a, b] } = await fixture();
    b.locationId = a.locationId; b.position = { ...a.position };
    inner.buildResidentDecisionIndexes(Object.values(world.agents));
    b.movement = { targetPlaceId: 'elsewhere', purpose: 'walk', waypoints: [{x:0,y:0},{x:1,y:1}], nextWaypointIndex: 1, startedAt: 1, worldStageAtStart: 0 };
    const before = JSON.stringify({ a, b, relationships: world.relationships });
    inner[method](a, b, 1);
    expect(JSON.stringify({ a, b, relationships: world.relationships })).toBe(before);
    expect(inner.agentsAtLocation(a.locationId).map((agent: AgentState) => agent.id)).not.toContain(b.id);
    expect(inner.stagedEvents).toHaveLength(0);
  });
  it('retains home/outskirts prayer without inventing a pilgrimage or changing location', async () => {
    const { inner, world, agents: [a] } = await fixture();
    const place = Object.values(world.places).find(p => p.kind === 'outskirts')!;
    a.locationId = place.id; a.position = {x:place.mapX,y:place.mapY,layerId:'surface'}; a.movement = undefined;
    const before = { location: a.locationId, position: { ...a.position } };
    inner.performPray(a, 1);
    expect(a.locationId).toBe(before.location); expect(a.position).toEqual(before.position);
    expect(a.movement).toBeUndefined(); expect(a.lastAction).toBe('pray');
    const event = inner.stagedEvents.find((e: {kind:string}) => e.kind === 'agent.prayed');
    expect(event).toBeDefined(); expect(event.payload.locationId).toBe(place.id);
    expect(typeof event.payload.prayerId).toBe('string');
  });
});
