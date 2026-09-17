import { TERRAIN_BOUNDS } from '../world/geography/TerrainTypes';
import type { WorldPoint2D, WorldState } from '../world/types';

/**
 * Planet-scale exploration grid. 100×100 gives 10,000 physical sectors across
 * the current terrain bounds (~63×56 km per sector). A level cannot reach 100
 * until every land/sea sector has persisted exploration evidence.
 */
const COVERAGE_COLUMNS = 100;
const COVERAGE_ROWS = 100;
const COVERAGE_CELLS = COVERAGE_COLUMNS * COVERAGE_ROWS;
const CELL_WIDTH = (TERRAIN_BOUNDS.maxX - TERRAIN_BOUNDS.minX) / COVERAGE_COLUMNS;
const CELL_HEIGHT = (TERRAIN_BOUNDS.maxY - TERRAIN_BOUNDS.minY) / COVERAGE_ROWS;
const SEGMENT_SAMPLE_STEP = Math.max(1, Math.min(CELL_WIDTH, CELL_HEIGHT) * 0.45);

function coverageCell(point: Readonly<WorldPoint2D>): number | undefined {
  if (
    point.x < TERRAIN_BOUNDS.minX || point.x > TERRAIN_BOUNDS.maxX ||
    point.y < TERRAIN_BOUNDS.minY || point.y > TERRAIN_BOUNDS.maxY
  ) return undefined;
  const x = Math.min(
    COVERAGE_COLUMNS - 1,
    Math.max(0, Math.floor((point.x - TERRAIN_BOUNDS.minX) / CELL_WIDTH)),
  );
  const y = Math.min(
    COVERAGE_ROWS - 1,
    Math.max(0, Math.floor((point.y - TERRAIN_BOUNDS.minY) / CELL_HEIGHT)),
  );
  return y * COVERAGE_COLUMNS + x;
}

function markPoint(cells: Set<number>, point: Readonly<WorldPoint2D> | undefined): void {
  if (!point) return;
  const cell = coverageCell(point);
  if (cell !== undefined) cells.add(cell);
}

function markSegment(cells: Set<number>, from: Readonly<WorldPoint2D>, to: Readonly<WorldPoint2D>): void {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / SEGMENT_SAMPLE_STEP));
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    markPoint(cells, {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    });
  }
}

/**
 * Read-only evidence metric. It never mutates world state and is presentation
 * only: the simulation engine does not call it. Evidence comes from persisted
 * discoveries, real surveys and actually traversed routes.
 */
export function worldExplorationCoverageCells(world: Readonly<WorldState>): ReadonlySet<number> {
  const cells = new Set<number>();

  for (const id of world.growth.discoveredRegionIds) {
    const place = world.places[id];
    if (place) markPoint(cells, { x: place.mapX, y: place.mapY });
  }

  // Ocean/offshore discoveries and some other physical discoveries are not
  // necessarily represented by growth.discoveredRegionIds.
  for (const place of Object.values(world.places)) {
    if (place.discoveredAt !== undefined) {
      markPoint(cells, { x: place.mapX, y: place.mapY });
    }
  }

  for (const map of Object.values(world.cartography?.bySettlementId ?? {})) {
    for (const [placeId, point] of Object.entries(map.points)) {
      if (point.surveyedRevision === undefined) continue;
      const place = world.places[placeId];
      if (place) markPoint(cells, { x: place.mapX, y: place.mapY });
    }
  }
  for (const agent of Object.values(world.agents)) {
    for (const placeId of Object.keys(agent.cartography?.surveys ?? {})) {
      const place = world.places[placeId];
      if (place) markPoint(cells, { x: place.mapX, y: place.mapY });
    }
  }

  // A physically traversed route proves exploration along its actual path.
  // Merely generated or connected routes do not count.
  for (const route of Object.values(world.routes)) {
    if ((route.completedTraversals ?? 0) <= 0 || route.waypoints.length === 0) continue;
    markPoint(cells, route.waypoints[0]);
    for (let index = 1; index < route.waypoints.length; index += 1) {
      markSegment(cells, route.waypoints[index - 1], route.waypoints[index]);
    }
  }

  return cells;
}

export function worldExplorationPercent(world: Readonly<WorldState>): number {
  const covered = worldExplorationCoverageCells(world).size;
  return Math.max(0, Math.min(100, (covered / COVERAGE_CELLS) * 100));
}

/**
 * Player-facing world level is 1..100 and is independent of growth.stage.
 * growth.stage remains the uncapped historical/procedural sequence so old
 * saves and deterministic simulation history are untouched.
 */
export function worldExplorationLevel(world: Readonly<WorldState>): number {
  const percent = worldExplorationPercent(world);
  if (percent >= 100) return 100;
  return Math.max(1, Math.floor(percent));
}

export const WORLD_EXPLORATION_COVERAGE_CELLS = COVERAGE_CELLS;
export const WORLD_EXPLORATION_COVERAGE_COLUMNS = COVERAGE_COLUMNS;
export const WORLD_EXPLORATION_COVERAGE_ROWS = COVERAGE_ROWS;
