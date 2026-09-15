import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import type { AgentState, WorldState } from '../src/world/types';
import { assertResidentCartography, consultSettlementMap, recordResidentSurvey, recordResidentRouteArrival, residentSurveyedPlaceIds, shareResidentCartography } from '../src/world/ResidentCartography';
import { residentKnownPath, invalidateResidentNavigation } from '../src/world/ResidentNavigation';
import { routeIdBetween } from '../src/world/WorldNavigation';
import { sharePlaceKnowledgeV20 } from '../src/v20/KnowledgeBoundariesV20';
import { ensureLivelihoodV18 } from '../src/v18/LivelihoodAndRhythmV18';

async function fixture() {
  const engine = await WorldEngine.create({ worldId: 'shared-maps-test', seed: 'shared-maps-test', store: new InMemoryWorldStore(), agentNames: ['Explorer', 'Neighbour', 'Descendant', 'Visitor'] });
  const world = engine.snapshot();
  const [first, second, child, visitor] = Object.values(world.agents);
  for (const a of [first, second, child, visitor]) { a.life.ageYears = 25; a.life.stage = 'adult'; a.life.alive = true; }
  const home = world.places[first.homeId];
  second.homeId = first.homeId; child.homeId = first.homeId;
  const place = (id: string, x: number) => ({ ...structuredClone(home), id, name: id, kind: 'forest' as const, surface: 'land' as const, settlementId: undefined, mapX: x, mapY: home.mapY + 1000, connectedPlaceIds: [] });
  world.places.remote_a = place('remote_a', home.mapX + 1000);
  world.places.remote_b = place('remote_b', home.mapX + 1010);
  const foreignId = 'foreign-village';
  const hometown = world.settlements[home.settlementId!];
  world.settlements[foreignId] = { ...structuredClone(hometown), id: foreignId, centerPlaceId: 'foreign_home', homePlaceIds: ['foreign_home'] };
  world.places.foreign_home = { ...structuredClone(home), id: 'foreign_home', settlementId: foreignId, mapX: home.mapX + 900 };
  visitor.homeId = 'foreign_home';
  for (const a of [first, second, child, visitor]) at(world, a, a.homeId);
  return { engine, world, first, second, child, visitor, settlementId: home.settlementId! };
}
function at(world: WorldState, agent: AgentState, id: string) {
  agent.locationId = id; agent.movement = undefined;
  agent.position = { x: world.places[id].mapX, y: world.places[id].mapY, layerId: 'surface' };
}

describe('settlement map is shared evidence, not a telepathic global atlas', () => {
  it('records only an actual survey, not a destination or legacy pre-arrival flag', async () => {
    const {world, first, second, settlementId} = await fixture();
    ensureLivelihoodV18(world, first).mappedPlaceIds = ['remote_a'];
    consultSettlementMap(world, first); consultSettlementMap(world, second);
    expect(recordResidentSurvey(world, first, 'remote_a')).toBe(false);
    expect(world.cartography!.bySettlementId[settlementId].points.remote_a?.survey).toBeUndefined();
    expect(residentSurveyedPlaceIds(world, second)).not.toContain('remote_a');
    at(world, first, 'remote_a');
    expect(recordResidentSurvey(world, first, 'remote_a')).toBe(true);
    expect(recordResidentSurvey(world, first, 'remote_a')).toBe(false);
    expect(residentSurveyedPlaceIds(world, second)).not.toContain('remote_a');
  });
  it('return deposits the map once; another traveller uses it without personal mapping credit', async () => {
    const {world, first, second, settlementId} = await fixture();
    consultSettlementMap(world, second);
    at(world, first, 'remote_a'); recordResidentSurvey(world, first, 'remote_a');
    consultSettlementMap(world, first); // Too far away: no publication.
    expect(world.cartography!.bySettlementId[settlementId].points.remote_a).toBeUndefined();
    at(world, first, first.homeId); consultSettlementMap(world, first);
    consultSettlementMap(world, second);
    expect(residentSurveyedPlaceIds(world, second)).toContain('remote_a');
    expect(second.knownPlaceIds).toContain('remote_a');
    expect(ensureLivelihoodV18(world, second).mappedPlaceIds).not.toContain('remote_a');
    at(world, second, 'remote_a');
    expect(recordResidentSurvey(world, second, 'remote_a')).toBe(false);
    const revision = world.cartography!.bySettlementId[settlementId].revision;
    at(world, first, first.homeId);
    for (let i = 0; i < 100; i++) consultSettlementMap(world, first);
    expect(world.cartography!.bySettlementId[settlementId].revision).toBe(revision);
  });
  it('freezes a carried copy when a traveller leaves, including later survey upgrades', async () => {
    const {world, first, second, settlementId} = await fixture();
    first.knownPlaceIds = [...(first.knownPlaceIds ?? []), 'remote_a'];
    consultSettlementMap(world, first); consultSettlementMap(world, second);
    expect(second.knownPlaceIds).toContain('remote_a');
    expect(residentSurveyedPlaceIds(world, second)).not.toContain('remote_a');
    at(world, second, 'remote_b');
    const carried = second.cartography!.copies[settlementId];
    at(world, first, 'remote_a'); recordResidentSurvey(world, first, 'remote_a');
    at(world, first, first.homeId); consultSettlementMap(world, first);
    consultSettlementMap(world, second);
    expect(second.cartography!.copies[settlementId]).toBe(carried);
    expect(residentSurveyedPlaceIds(world, second)).not.toContain('remote_a');
    at(world, second, second.homeId); consultSettlementMap(world, second);
    expect(residentSurveyedPlaceIds(world, second)).toContain('remote_a');
  });
  it('survives author death, JSON save/load and descendants without immortal mentors', async () => {
    const {world, first, child} = await fixture();
    at(world, first, 'remote_a'); recordResidentSurvey(world, first, 'remote_a');
    at(world, first, first.homeId); consultSettlementMap(world, first);
    first.life.alive = false;
    delete world.agents[first.id];
    const saved: WorldState = JSON.parse(JSON.stringify(world));
    const nextGeneration = saved.agents[child.id];
    expect(nextGeneration.cartography).toBeUndefined();
    consultSettlementMap(saved, nextGeneration);
    expect(residentSurveyedPlaceIds(saved, nextGeneration)).toContain('remote_a');
    expect(saved.cartography!.bySettlementId[saved.places[nextGeneration.homeId].settlementId!].points.remote_a.survey?.surveyedBy).toBe(first.id);
    expect(() => assertResidentCartography(saved)).not.toThrow();
  });
  it('does not grant the notes of an explorer who dies before returning or sharing', async () => {
    const {world, first, second} = await fixture();
    at(world, first, 'remote_a'); recordResidentSurvey(world, first, 'remote_a');
    first.life.alive = false;
    consultSettlementMap(world, second);
    expect(residentSurveyedPlaceIds(world, second)).not.toContain('remote_a');
  });
  it('keeps foreign towns isolated until a physical meeting and report home', async () => {
    const {world, first, second, visitor} = await fixture();
    at(world, first, 'remote_a'); recordResidentSurvey(world, first, 'remote_a');
    at(world, first, first.homeId); consultSettlementMap(world, first);
    consultSettlementMap(world, visitor);
    sharePlaceKnowledgeV20(world, first, visitor); // Different locations.
    expect(residentSurveyedPlaceIds(world, visitor)).not.toContain('remote_a');
    at(world, first, 'remote_b'); at(world, visitor, 'remote_b');
    sharePlaceKnowledgeV20(world, first, visitor);
    expect(residentSurveyedPlaceIds(world, visitor)).toContain('remote_a');
    expect(world.cartography!.bySettlementId['foreign-village'].points.remote_a).toBeUndefined();
    at(world, visitor, visitor.homeId); consultSettlementMap(world, visitor);
    expect(world.cartography!.bySettlementId['foreign-village'].points.remote_a.survey?.surveyedBy).toBe(first.id);
    expect(ensureLivelihoodV18(world, visitor).mappedPlaceIds).not.toContain('remote_a');
    expect(second.cartography).toBeUndefined();
  });
  it('a meeting transmits only the carried revision, not subsequent remote updates', async () => {
    const {world, first, second, visitor} = await fixture();
    consultSettlementMap(world, first); consultSettlementMap(world, second);
    at(world, second, 'remote_b');
    at(world, first, 'remote_a'); recordResidentSurvey(world, first, 'remote_a');
    at(world, first, first.homeId); consultSettlementMap(world, first);
    at(world, visitor, 'remote_b'); shareResidentCartography(world, second, visitor);
    expect(residentSurveyedPlaceIds(world, visitor)).not.toContain('remote_a');
  });
  it('never publishes secret-library locations or accepts co-location while moving', async () => {
    const {world, first, second, settlementId} = await fixture();
    const library = 'secret_library_v18';
    first.knownPlaceIds = [...(first.knownPlaceIds ?? []), library];
    consultSettlementMap(world, first);
    expect(world.cartography!.bySettlementId[settlementId].points[library]).toBeUndefined();
    at(world, first, 'remote_a'); recordResidentSurvey(world, first, 'remote_a');
    at(world, second, 'remote_a');
    second.movement = { targetPlaceId: 'remote_b', purpose: 'walk', waypoints: [{x: 0,y: 0},{x: 1,y: 1}], nextWaypointIndex: 1, startedAt: 1, worldStageAtStart: 0 };
    shareResidentCartography(world, first, second);
    expect(residentSurveyedPlaceIds(world, second)).not.toContain('remote_a');
  });
  it('records traversed route evidence once, only after physical arrival', async () => {
    const {world, first} = await fixture();
    const id = routeIdBetween('remote_a', 'remote_b');
    world.routes[id] = {id, fromPlaceId: 'remote_a', toPlaceId: 'remote_b', traversal: 'walk', waypoints: [{x: 0,y: 0},{x: 1,y: 1}],distance: 1};
    at(world, first, 'remote_b'); recordResidentRouteArrival(world, first, [id]);
    const revision = first.cartography!.revision;
    recordResidentRouteArrival(world, first, [id]);
    expect(first.cartography!.revision).toBe(revision);
    expect(first.cartography!.routes[id].traversedBy).toBe(first.id);
    expect(first.knownPlaceIds).toContain('remote_a');
    at(world, first, first.homeId); consultSettlementMap(world, first);
    expect(Object.keys(world.cartography!.bySettlementId[world.places[first.homeId].settlementId!].routes)).toEqual([id]);
  });
  it('rejects a forged future carried revision instead of silently importing it', async () => {
    const {world, first, settlementId} = await fixture();
    consultSettlementMap(world, first);
    first.cartography!.copies[settlementId] = world.cartography!.bySettlementId[settlementId].revision + 1;
    expect(() => assertResidentCartography(world)).toThrow('Invalid carried map revision');
  });
});

describe('a known itinerary must be the one used by actual movement', () => {
  it('uses a longer known route rather than a global shortcut through an unknown point', async () => {
    const {world, first} = await fixture();
    const ids = ['start','unknown','goal','known_a','known_b'];
    const template = world.places.remote_a;
    for (const [i,id] of ids.entries()) world.places[id] = { ...template, id, mapX: i * 2, connectedPlaceIds: [] };
    world.routes = {};
    const link = (a: string,b: string) => {
      world.places[a].connectedPlaceIds.push(b); world.places[b].connectedPlaceIds.push(a);
      const id = routeIdBetween(a,b); world.routes[id] = {id,fromPlaceId:a,toPlaceId:b,traversal:'walk',distance:1,waypoints:[{x:0,y:0},{x:1,y:1}]};
    };
    link('start','unknown');link('unknown','goal');link('start','known_a');link('known_a','known_b');link('known_b','goal');
    first.knownPlaceIds = ['start','known_a','known_b','goal']; at(world,first,'start');
    expect(residentKnownPath(world,first,'goal')).toEqual(['start','known_a','known_b','goal']);
    expect(residentKnownPath(world,first,'unknown')).toBeUndefined();
    first.knownPlaceIds.push('unknown');
    expect(residentKnownPath(world,first,'goal')).toEqual(['start','unknown','goal']);
    delete world.routes[routeIdBetween('start','unknown')];
    invalidateResidentNavigation(world);
    expect(residentKnownPath(world,first,'goal')).toEqual(['start','known_a','known_b','goal']);
    world.routes = {}; expect(residentKnownPath(world,first,'goal')).toBeUndefined();
  });
});
