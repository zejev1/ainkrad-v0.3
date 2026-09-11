import type { WorldState } from '../world/types';

export interface MapFocus { x: number; y: number; pixelsPerUnit: number }

/** A city view fits its buildings, not distant fields, forests or homelands. */
export function townMapFocus(world: Readonly<WorldState>, residentId: string | undefined,
  width: number, height: number): MapFocus | undefined {
  const resident = world.agents[residentId ?? ''];
  const home = world.places[resident?.homeId ?? ''];
  const town = world.settlements[home?.settlementId ?? 'settlement_ainkrad'];
  return settlementMapFocus(world, town?.id ?? 'settlement_ainkrad', width, height);
}

export function settlementMapFocus(world: Readonly<WorldState>, settlementId: string,
  width: number, height: number): MapFocus | undefined {
  const town = world.settlements[settlementId];
  if (!town) return undefined;
  const center = world.places[town.centerPlaceId];
  if (!center) return undefined;
  const buildings = Object.values(world.places).filter(p =>
    (p.settlementId === center.settlementId ||
      (p.id === world.v18?.secretLibrary.placeId && world.v18.secretLibrary.anchorPlaceId === center.id)) &&
    ['home', 'commons', 'city', 'village', 'workshop', 'library', 'quiet_space'].includes(p.kind));
  const points = buildings.length ? buildings : [center];
  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  for (const p of points) {
    minX=Math.min(minX,p.mapX-0.1); maxX=Math.max(maxX,p.mapX+0.1);
    minY=Math.min(minY,p.mapY-0.1); maxY=Math.max(maxY,p.mapY+0.1);
  }
  return {x: (minX + maxX) / 2, y: (minY + maxY) / 2,
    pixelsPerUnit: Math.max(0.0005, Math.min(600, Math.max(1, width - 48) / Math.max(1, maxX - minX),
      Math.max(1, height - 72) / Math.max(1, maxY - minY)))};
}

/** Finding a person moves only the camera. A traveller stays on their route. */
export function residentMapFocus(world: Readonly<WorldState>, residentId: string | undefined,
  pixelsPerUnit: number): MapFocus | undefined {
  const resident = world.agents[residentId ?? ''];
  if (!resident?.life.alive) return undefined;
  const place = world.places[resident.locationId];
  return {x: !resident.movement && place ? place.mapX : resident.position.x,
    y: !resident.movement && place ? place.mapY : resident.position.y,
    pixelsPerUnit: Math.max(400, Math.min(1600, pixelsPerUnit))};
}
