import type { WildlifePopulation, WorldPlace, WorldPoint2D, WorldState } from './types';
import { bindWorldTerrain } from './geography/WorldTerrain';
import { waterAccess } from '../v21/SailingRoutes';

export const RULID_SETTLEMENT_ID = 'settlement_rulid';
export const RULID_SHORE_ID = 'rulid_shore';
export const RULID_BEACH_ID = 'rulid_beach';
export const RULID_SHIPYARD_ID = 'rulid_shipyard';
export const RULID_COASTAL_FISH_ID = 'wildlife_rulid_coastal_fish';

const point = (place: Readonly<WorldPlace>): WorldPoint2D => ({ x: place.mapX, y: place.mapY });
const distance = (a: WorldPoint2D, b: WorldPoint2D) => Math.hypot(a.x - b.x, a.y - b.y);

function connect(world: WorldState, a: string, b: string): boolean {
  const left = world.places[a], right = world.places[b];
  if (!left || !right) return false;
  let changed = false;
  if (!left.connectedPlaceIds.includes(b)) { left.connectedPlaceIds.push(b); changed = true; }
  if (!right.connectedPlaceIds.includes(a)) { right.connectedPlaceIds.push(a); changed = true; }
  return changed;
}

function coastalSite(
  world: Readonly<WorldState>,
  shore: Readonly<WorldPlace>,
  side: -1 | 1,
  preferredAlong: number,
  preferredInland: number,
): WorldPoint2D | undefined {
  const terrain = bindWorldTerrain(world);
  const wet = waterAccess(world, point(shore));
  if (!terrain || !wet) return undefined;

  const sx = wet.x - shore.mapX, sy = wet.y - shore.mapY;
  const length = Math.max(1e-9, Math.hypot(sx, sy));
  const seaward = { x: sx / length, y: sy / length };
  const inland = { x: -seaward.x, y: -seaward.y };
  const tangent = { x: -seaward.y * side, y: seaward.x * side };
  const occupied = Object.values(world.places).filter(
    place => place.id !== shore.id && place.id !== RULID_BEACH_ID && place.id !== RULID_SHIPYARD_ID &&
      place.surface !== 'water',
  );

  for (const along of [preferredAlong, preferredAlong * 0.72, preferredAlong * 1.28, preferredAlong * 1.65, 0.12, 0.2, 0.32, 0.44]) {
    for (const inward of [preferredInland, 0.03, 0.07, 0.12, 0.18]) {
      const candidate = {
        x: shore.mapX + tangent.x * along + inland.x * inward,
        y: shore.mapY + tangent.y * along + inland.y * inward,
      };
      if (terrain.sample(candidate.x, candidate.y).water) continue;
      if (!waterAccess(world, candidate)) continue;
      if (occupied.some(place => distance(candidate, point(place)) < 0.14)) continue;
      return candidate;
    }
  }
  return undefined;
}

function beachPolygon(center: WorldPoint2D): WorldPoint2D[] {
  return [
    { x: center.x - 0.08, y: center.y - 0.05 },
    { x: center.x + 0.08, y: center.y - 0.05 },
    { x: center.x + 0.08, y: center.y + 0.05 },
    { x: center.x - 0.08, y: center.y + 0.05 },
  ];
}

/**
 * Adds only missing Rulid maritime infrastructure around Rulid's already-persisted
 * physical coast. Existing city/shore coordinates, residents, history and RNG are
 * never rewritten. Once created, the saved coordinates are authoritative.
 */
export function ensureRulidMaritimeInfrastructure(world: WorldState): boolean {
  const town = world.settlements[RULID_SETTLEMENT_ID];
  const shore = world.places[RULID_SHORE_ID];
  const ocean = world.places.ocean_ainkrad;
  const commons = world.places[town?.centerPlaceId ?? 'rulid_commons'];
  if (!town || !shore || !ocean || !commons || !world.terrain) return false;

  let changed = false;

  if (!world.places[RULID_SHIPYARD_ID]) {
    const site = coastalSite(world, shore, 1, 0.23, 0.08) ?? point(shore);
    world.places[RULID_SHIPYARD_ID] = {
      id: RULID_SHIPYARD_ID,
      name: 'Верфь и пристань Рулида',
      kind: 'workshop',
      capacity: 18,
      biome: 'coast',
      mapX: site.x,
      mapY: site.y,
      connectedPlaceIds: [],
      fertility: 0.12,
      danger: 0.08,
      surface: 'shore',
      settlementId: RULID_SETTLEMENT_ID,
      urbanLayoutVersion: 3,
      discoveredAt: world.epochStartedAt ?? 0,
    };
    changed = true;
  }

  if (!world.places[RULID_BEACH_ID]) {
    const site = coastalSite(world, shore, -1, 0.3, 0.03) ?? point(shore);
    world.places[RULID_BEACH_ID] = {
      id: RULID_BEACH_ID,
      name: 'Пляж Рулида',
      kind: 'shore',
      capacity: 28,
      biome: 'coast',
      mapX: site.x,
      mapY: site.y,
      connectedPlaceIds: [],
      fertility: 0.28,
      danger: 0.12,
      surface: 'shore',
      settlementId: RULID_SETTLEMENT_ID,
      geographyVersion: 1,
      boundaryPolygon: beachPolygon(site),
      discoveredAt: world.epochStartedAt ?? 0,
    };
    changed = true;
  }

  for (const id of [RULID_SHIPYARD_ID, RULID_BEACH_ID]) {
    if (!town.memberPlaceIds.includes(id)) { town.memberPlaceIds.push(id); changed = true; }
  }

  const links: Array<[string,string]> = [
    [commons.id, RULID_SHIPYARD_ID],
    [commons.id, RULID_BEACH_ID],
    [RULID_SHORE_ID, RULID_SHIPYARD_ID],
    [RULID_SHORE_ID, RULID_BEACH_ID],
    [RULID_SHIPYARD_ID, RULID_BEACH_ID],
    [RULID_SHIPYARD_ID, ocean.id],
    [RULID_BEACH_ID, ocean.id],
  ];
  for (const [a,b] of links) changed = connect(world,a,b) || changed;

  if (!world.wildlife[RULID_COASTAL_FISH_ID]) {
    const fish: WildlifePopulation = {
      id: RULID_COASTAL_FISH_ID,
      species: 'fish',
      habitatId: RULID_SHIPYARD_ID,
      count: 14,
      carryingCapacity: 30,
      reproductionRate: 0.18,
      alertness: 0.12,
      threat: 0.02,
      isMonster: false,
      lastChangedAt: world.now,
    };
    world.wildlife[fish.id] = fish;
    changed = true;
  }

  if (changed) {
    delete town.layoutVersion;
    delete town.layoutSignature;
    delete town.boundaryPolygon;
  }
  return changed;
}
