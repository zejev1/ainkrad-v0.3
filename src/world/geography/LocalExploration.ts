import type { AgentState, WorldBiome, WorldPlace, WorldPoint2D, WorldState } from '../types';
import { FeatureIndex } from './FeatureIndex';
import { bindWorldTerrain } from './WorldTerrain';
import { nearestRiverPoint } from './RiverCourses';
import { distanceToSegment, hash } from './TerrainMath';

const SURVEY_RADII = [6, 12, 22, 36] as const;
const MAX_SURVEY_RADIUS = SURVEY_RADII.at(-1)!;
const MAX_CLEARANCE = 6;
const CANDIDATES_PER_RING = 28;
const LAND_LINE_SAMPLE_STEP = 0.4;

interface PlaceIndexCache {
  places: Readonly<Record<string, WorldPlace>>;
  count: number;
  geographyRevision: number;
  index: FeatureIndex<WorldPlace>;
}

const localPlaceIndexes = new WeakMap<object, PlaceIndexCache>();

function indexedLandPlaces(world: Readonly<WorldState>): FeatureIndex<WorldPlace> {
  const count = Object.keys(world.places).length;
  const geographyRevision = world.geography?.revision ?? -1;
  const key = world as object;
  const cached = localPlaceIndexes.get(key);
  if (
    cached &&
    cached.places === world.places &&
    cached.count === count &&
    cached.geographyRevision === geographyRevision
  ) {
    return cached.index;
  }
  const index = new FeatureIndex(
    Object.values(world.places).filter((place) => place.surface !== 'water'),
    (place) => ({
      minX: place.mapX,
      minY: place.mapY,
      maxX: place.mapX,
      maxY: place.mapY,
    }),
    16,
  );
  localPlaceIndexes.set(key, {
    places: world.places,
    count,
    geographyRevision,
    index,
  });
  return index;
}

function localPlaces(
  world: Readonly<WorldState>,
  origin: Readonly<WorldPoint2D>,
): WorldPlace[] {
  const radius = MAX_SURVEY_RADIUS + MAX_CLEARANCE;
  return indexedLandPlaces(world).query({
    minX: origin.x - radius,
    minY: origin.y - radius,
    maxX: origin.x + radius,
    maxY: origin.y + radius,
  });
}

function requiredClearance(place: Readonly<WorldPlace>): number {
  if (place.settlementId || ['home', 'workshop', 'library', 'quiet_space', 'resource_field', 'outskirts'].includes(place.kind)) {
    return 2.2;
  }
  return 5.5;
}

/** Survey the ground that exists, including the accessible bank, never create
 * a desired biome or move the coast to suit an exploration script. */
export function localTerrainBiome(world: Readonly<WorldState>, point: WorldPoint2D): WorldBiome | undefined {
  const model = bindWorldTerrain(world);
  if (!model) return undefined;
  const sample = model.sample(point.x, point.y);
  if (sample.water) return undefined;
  const box = { minX: point.x - 1, minY: point.y - 1, maxX: point.x + 1, maxY: point.y + 1 };
  for (const anchor of model.anchors.query(box)) {
    if (anchor.kind !== 'lake' || !anchor.water) continue;
    if (anchor.water.some((p, i, polygon) => distanceToSegment(point, p, polygon[(i + 1) % polygon.length]).distance < 0.4)) return 'lake';
  }
  for (const river of model.rivers.query(box)) {
    if (nearestRiverPoint(point, river).distance < river.width + 0.4) return 'river';
  }
  if (model.landOutlines.some(outline=>outline.some((p, i, polygon) => distanceToSegment(point, p, polygon[(i + 1) % polygon.length]).distance < 0.6))) return 'coast';
  return sample.biome;
}

/**
 * Finds the next piece of genuinely new ground around the explorer's physical
 * position. A discovery advances by hundreds of metres or a few kilometres,
 * never teleports across the continent and never packs dozens of permanent
 * named regions into the same 200-metre patch.
 *
 * The explorer's own home direction is only a soft preference. It helps a
 * sequence of voluntary exploration choices grow a frontier outward instead
 * of repeatedly circling the same settlement, while still allowing side trips
 * for useful terrain and personal curiosity.
 */
export function localSurveySite(
  world: Readonly<WorldState>,
  explorer: Readonly<AgentState>,
  sequence: number,
  roll: number,
) {
  const model = bindWorldTerrain(world);
  if (!model || explorer.movement) return undefined;
  const origin = explorer.position;
  const nearby = localPlaces(world, origin);
  const home = world.places[explorer.homeId];
  const settlement = home?.settlementId ? world.settlements[home.settlementId] : undefined;
  const homeCenter = settlement
    ? { x: settlement.centerX, y: settlement.centerY }
    : home
      ? { x: home.mapX, y: home.mapY }
      : { x: origin.x, y: origin.y };
  const currentDistanceFromHome = Math.hypot(origin.x - homeCenter.x, origin.y - homeCenter.y);
  const identityBearing = (hash(`${world.id}:${explorer.id}:frontier`) / 0x1_0000_0000) * Math.PI * 2;
  const currentBearing = currentDistanceFromHome > 1
    ? Math.atan2(origin.y - homeCenter.y, origin.x - homeCenter.x)
    : identityBearing;
  const angleOffset =
    (hash(`${world.terrain?.seed}:${explorer.id}:${sequence}`) / 0x1_0000_0000 + roll) * Math.PI * 2;

  for (const radius of SURVEY_RADII) {
    const choices: Array<WorldPoint2D & { biome: WorldBiome; connections: string[]; weight: number }> = [];
    for (let index = 0; index < CANDIDATES_PER_RING; index += 1) {
      const angle = angleOffset + index * (Math.PI * 2 / CANDIDATES_PER_RING);
      const point = {
        x: origin.x + Math.cos(angle) * radius,
        y: origin.y + Math.sin(angle) * radius,
      };
      const closest = nearby.reduce((minimum, place) =>
        Math.min(minimum, Math.hypot(place.mapX - point.x, place.mapY - point.y) / requiredClearance(place)),
      Number.POSITIVE_INFINITY);
      if (closest < 1) continue;

      const biome = localTerrainBiome(world, point);
      if (!biome || !model.isLand(point)) continue;

      // The initial sight/survey line must remain on land. Navigation later
      // builds the exact obstacle-avoiding route and charges real walking time.
      const samples = Math.max(1, Math.ceil(radius / LAND_LINE_SAMPLE_STEP));
      let dry = true;
      for (let sampleIndex = 1; sampleIndex <= samples; sampleIndex += 1) {
        const t = sampleIndex / samples;
        if (model.sample(
          origin.x + (point.x - origin.x) * t,
          origin.y + (point.y - origin.y) * t,
        ).water) {
          dry = false;
          break;
        }
      }
      if (!dry) continue;

      const distanceFromHome = Math.hypot(point.x - homeCenter.x, point.y - homeCenter.y);
      const outwardGain = (distanceFromHome - currentDistanceFromHome) / Math.max(1, radius);
      const directionalFit = (Math.cos(angle - currentBearing) + 1) / 2;
      const useful = biome === 'forest'
        ? (1 - explorer.resources) * 0.18
        : ['coast', 'river', 'lake'].includes(biome)
          ? 0.12
          : 0;
      const clearanceBonus = Math.min(0.3, Math.max(0, closest - 1) * 0.08);
      const outwardPreference = Math.max(-0.18, Math.min(0.55, outwardGain * 0.48));
      const weight = Math.max(
        0.05,
        1 +
          useful +
          outwardPreference +
          directionalFit * (0.12 + explorer.personality.curiosity * 0.14) +
          clearanceBonus,
      );
      choices.push({ ...point, biome, connections: [explorer.locationId], weight });
    }
    if (choices.length) {
      let pick = Math.max(0, Math.min(0.999999, roll)) *
        choices.reduce((sum, point) => sum + point.weight, 0);
      return choices.find((point) => (pick -= point.weight) <= 0) ?? choices[choices.length - 1];
    }
  }
  return undefined;
}
