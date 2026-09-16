import type { WorldPlace, WorldState } from './types';

export const AINKRAD_OCEAN_ID = 'ocean_ainkrad';

/** Shared physical geography for both first creation and a player-started epoch. */
export function createFoundingOcean(discoveredAt: number): WorldPlace {
  return {
    id: AINKRAD_OCEAN_ID,
    name: 'Великое море Айнкрада',
    kind: 'ocean',
    capacity: 100_000,
    biome: 'ocean',
    mapX: 98,
    mapY: 88,
    connectedPlaceIds: [],
    fertility: 0.66,
    danger: 0.34,
    surface: 'water',
    boundaryPolygon: [
      { x: 96, y: -100_075 },
      { x: 200_375, y: -100_075 },
      { x: 200_375, y: 100_075 },
      { x: 96, y: 100_075 },
    ],
    discoveredAt,
  };
}

/**
 * Add only the known, omitted founding sea. Do not invent arbitrary missing
 * places, discover the shore early, overwrite existing geography, or tell NPCs
 * about it. The caller rebuilds physical routes before committing the repair.
 */
export function repairFoundingOcean(
  world: Pick<WorldState, 'places' | 'epochStartedAt'>,
): boolean {
  let changed = false;
  if (world.places[AINKRAD_OCEAN_ID] === undefined) {
    world.places[AINKRAD_OCEAN_ID] = createFoundingOcean(world.epochStartedAt ?? 0);
    changed = true;
  }
  const ocean = world.places[AINKRAD_OCEAN_ID];
  const foundingShore = world.places.shore;
  // Legacy Ainkrad saves used the canonical `shore` id. New F2 worlds may
  // also contain Rulid's physical coast. Restore reciprocity without inventing
  // links for unrelated shore places.
  const linkedShores = Object.values(world.places).filter(
    (place) =>
      place.kind === 'shore' &&
      (place.id === 'shore' || place.connectedPlaceIds.includes(AINKRAD_OCEAN_ID)),
  );
  if (foundingShore?.kind === 'shore' && !foundingShore.connectedPlaceIds.includes(AINKRAD_OCEAN_ID)) {
    foundingShore.connectedPlaceIds.push(AINKRAD_OCEAN_ID);
    changed = true;
    if (!linkedShores.includes(foundingShore)) linkedShores.push(foundingShore);
  }
  for (const shore of linkedShores) {
    if (!ocean.connectedPlaceIds.includes(shore.id)) {
      ocean.connectedPlaceIds.push(shore.id);
      changed = true;
    }
  }
  return changed;
}
