import type { WorldPlace, WorldPoint2D, WorldState } from '../types';
import { buildingPolygon, pointInPolygon, polygonsOverlap } from '../BuildingFootprints';
import { bindWorldTerrain } from './WorldTerrain';
import { hash } from './TerrainMath';
import type { OffshoreLand } from './OceanExploration';

export const HABITAT_RESCUE_VERSION = 'inhabited-islands-2026-09-18';
export interface HabitatRescueResult {
  changed: boolean;
  settlementIds: string[];
  addedIslandIds: string[];
  addedPlaceIds: string[];
  blockedSettlementIds: string[];
}
const pos = (place: Readonly<WorldPlace>): WorldPoint2D => ({ x: place.mapX, y: place.mapY });
const distance = (a: WorldPoint2D, b: WorldPoint2D) => Math.hypot(a.x - b.x, a.y - b.y);
const rootId = (world: Readonly<WorldState>, settlementId: string) =>
  `habitat-rescue:${world.epoch ?? 1}:${settlementId}`;

function island(id: string, center: WorldPoint2D, radius: number, seed: number): OffshoreLand {
  const phase = hash(`${seed}:${id}:phase`) / 0x1_0000_0000 * Math.PI * 2;
  return { id, kind: 'island', seed, center: { ...center }, radius,
    outline: Array.from({ length: 32 }, (_, i) => {
      const angle = i * Math.PI / 16;
      const r = radius * (0.89 + 0.045 * Math.sin(angle * 3 + phase) + 0.025 * Math.sin(angle * 5 - phase));
      return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r };
    }),
  };
}
function crosses(a: WorldPoint2D, b: WorldPoint2D, c: WorldPoint2D, d: WorldPoint2D): boolean {
  const cross = (p: WorldPoint2D, q: WorldPoint2D, r: WorldPoint2D) =>
    (q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  return cross(a,b,c)*cross(a,b,d) <= 0 && cross(c,d,a)*cross(c,d,b) <= 0 &&
    Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)) <= Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x)) &&
    Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)) <= Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y));
}
function touchesRoute(land: OffshoreLand, route: readonly WorldPoint2D[]): boolean {
  if (route.some(p => pointInPolygon(p, land.outline))) return true;
  for (let i = 1; i < route.length; i++) {
    for (let j = 0; j < land.outline.length; j++) {
      if (crosses(route[i-1],route[i],land.outline[j],land.outline[(j+1)%land.outline.length])) return true;
    }
  }
  return false;
}
function connect(world: WorldState, a: string, b: string): void {
  if (!world.places[a].connectedPlaceIds.includes(b)) world.places[a].connectedPlaceIds.push(b);
  if (!world.places[b].connectedPlaceIds.includes(a)) world.places[b].connectedPlaceIds.push(a);
}

/** Explicit, user-authorized emergency geology, not Cardinal policy and not
 * procedural exploration. Adds dry islands UNDER saved offshore homelands;
 * it never translates people/places, rerolls terrain, rewrites charts, invents
 * resident knowledge or refills settlement warehouses. Offshore recipes do
 * not influence the mainland outline or its drainage network. */
export function ensureInhabitedLandRescue(world: WorldState): HabitatRescueResult {
  const result: HabitatRescueResult = { changed:false, settlementIds:[], addedIslandIds:[], addedPlaceIds:[], blockedSettlementIds:[] };
  const foundation = world.terrain;
  const terrain = bindWorldTerrain(world);
  if (!foundation || !terrain) return result;

  const targets = new Map<string, WorldPoint2D>();
  for (const town of Object.values(world.settlements)) {
    const center = world.places[town.centerPlaceId];
    if (center && center.surface !== 'water') targets.set(town.id, pos(center));
  }
  // A saved but not yet populated reservation is also authoritative. An old
  // world must not create its next people in the sea after this repair.
  for (const anchor of foundation.anchors) {
    if (/^foundation_(elf|dwarf|goblin|orc|ogre)$/.test(anchor.id)) {
      const settlementId = `settlement_${anchor.id.slice('foundation_'.length)}_homeland`;
      if (!targets.has(settlementId)) targets.set(settlementId, { x:anchor.x, y:anchor.y });
    }
  }
  const maritimePaths = Object.values(world.routes).filter(r => r.traversal === 'boat').map(r => r.waypoints);
  for (const item of Object.values(world.v15?.items ?? {})) {
    if (item.boat?.journey) maritimePaths.push(item.boat.journey.waypoints);
    if (item.boat?.position && item.boat.journey) maritimePaths.push([item.boat.position]);
  }
  const additions: OffshoreLand[] = [];
  const existing = foundation.offshore ?? [];
  const landConflict = (land: OffshoreLand) =>
    polygonsOverlap(land.outline, terrain.outline) ||
    [...existing, ...additions].some(other => polygonsOverlap(land.outline, other.outline)) ||
    maritimePaths.some(route => touchesRoute(land, route));

  for (const [settlementId, center] of [...targets].sort(([a],[b]) => a.localeCompare(b))) {
    const id = rootId(world, settlementId);
    if (existing.some(land => land.id === id)) continue;
    const members = Object.values(world.places).filter(p => p.settlementId === settlementId && p.surface !== 'water');
    const footprint = [center, ...members.flatMap(p => [pos(p), ...buildingPolygon(p)])];
    for (const agent of Object.values(world.agents)) {
      if (agent.movement?.boatId) continue;
      if (world.places[agent.locationId]?.settlementId === settlementId && distance(agent.position,center) < 1000) {
        footprint.push({x:agent.position.x,y:agent.position.y});
        if (agent.movement && world.places[agent.movement.targetPlaceId]?.settlementId === settlementId) {
          footprint.push(...agent.movement.waypoints);
        }
      }
    }
    if (footprint.every(p => terrain.isLand(p))) continue;
    // Do not change an otherwise intact mainland coastline to repair a river
    // or a beach. This rescue is specifically for isolated offshore towns.
    if (terrain.isLand(center)) { result.blockedSettlementIds.push(settlementId); continue; }
    const reach = Math.max(0, ...footprint.map(p => distance(center,p)));
    const radius = Math.max(250, (reach + 12) / 0.78);
    if (radius > 3000 || existing.length + additions.length >= 32) {
      result.blockedSettlementIds.push(settlementId); continue;
    }
    const seed = hash(`${foundation.seed}:${id}`);
    const main = island(id,center,radius,seed);
    if (landConflict(main) || !footprint.every(p => pointInPolygon(p,main.outline))) {
      result.blockedSettlementIds.push(settlementId); continue;
    }
    additions.push(main);
    result.settlementIds.push(settlementId);
    // A pair of nearby real islands gives the rescued people an archipelago
    // to explore later. It grants neither routes nor knowledge of those shores.
    for (let satellite = 1; satellite <= 2 && existing.length + additions.length < 32; satellite++) {
      for (let bearing = 0; bearing < 24; bearing++) {
        const angle = (seed / 0x1_0000_0000 + bearing / 24 + satellite * 0.37) * Math.PI * 2;
        const smallRadius = Math.max(80, Math.min(180, radius * 0.45));
        const offset = radius + smallRadius + 160;
        const candidate = island(`${id}:island:${satellite}`, {
          x:center.x+Math.cos(angle)*offset, y:center.y+Math.sin(angle)*offset,
        }, smallRadius, hash(`${seed}:${satellite}`));
        if (landConflict(candidate)) continue;
        additions.push(candidate); break;
      }
    }
  }
  if (additions.length) {
    foundation.offshore = [...existing, ...additions];
    foundation.key = 'terrain-v1:' + hash(JSON.stringify({version:1,epoch:foundation.epoch,seed:foundation.seed,key:'',anchors:foundation.anchors,offshore:foundation.offshore}));
    bindWorldTerrain(world);
    result.addedIslandIds = additions.map(land => land.id);
    result.changed = true;
  }
  const actualTerrain = bindWorldTerrain(world)!;
  for (const [settlementId, center] of targets) {
    const town = world.settlements[settlementId];
    if (!town || !foundation.offshore?.some(land => land.id === rootId(world,settlementId))) continue;
    const specs = [
      {suffix:'woodland',name:`Лес острова ${town.name}`,kind:'forest' as const,biome:'forest' as const,x:6,y:2,fertility:0.72},
      {suffix:'meadow',name:`Съедобные луга острова ${town.name}`,kind:'meadow' as const,biome:'plains' as const,x:-5,y:2,fertility:0.78},
      {suffix:'stone',name:`Каменные выходы острова ${town.name}`,kind:'mountains' as const,biome:'mountains' as const,x:3,y:-7,fertility:0.18},
    ];
    for (const spec of specs) {
      const placeId = `${rootId(world,settlementId)}:${spec.suffix}`;
      if (world.places[placeId]) continue;
      const p = {x:center.x+spec.x,y:center.y+spec.y};
      if (actualTerrain.sample(p.x,p.y).water) continue;
      world.places[placeId] = {id:placeId,name:spec.name,kind:spec.kind,biome:spec.biome,surface:'land',mapX:p.x,mapY:p.y,
        settlementId,capacity:24,connectedPlaceIds:[],fertility:spec.fertility,danger:0.08,geographyVersion:1,discoveredAt:world.now};
      town.memberPlaceIds.push(placeId);
      connect(world,town.centerPlaceId,placeId);
      result.addedPlaceIds.push(placeId);
      result.changed = true;
      if (spec.suffix !== 'stone') {
        const wildlifeId = `${placeId}:wildlife`;
        world.wildlife[wildlifeId] ??= {id:wildlifeId,species:spec.suffix==='meadow'?'rabbit':'deer',habitatId:placeId,
          count:spec.suffix==='meadow'?12:6,carryingCapacity:spec.suffix==='meadow'?24:12,reproductionRate:0.12,
          alertness:0.2,threat:0.04,isMonster:false,lastChangedAt:world.now};
      }
    }
  }
  return result;
}
