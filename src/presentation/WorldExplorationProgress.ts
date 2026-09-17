import { TERRAIN_BOUNDS } from '../world/geography/TerrainTypes';
import type { WorldPoint2D, WorldState } from '../world/types';

/**
 * Coarse planet-scale exploration grid. 20×20 keeps the metric cheap and
 * stable while still making level 100 mean every coarse land/sea sector has
 * physically recorded exploration evidence.
 */
const COVERAGE_COLUMNS = 20;
const COVERAGE_ROWS = 20;
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
 * Read-only evidence metric. It never mutates world state and never runs in
 * the simulation hot path. It counts only persisted physical evidence:
 * discovered regions/places, actual surveys, and actually traversed routes.
 */
export function worldExplorationCoverageCells(world: Readonly<WorldState>): ReadonlySet<number> {
  const cells = new Set<number>();

  for (const id of world.growth.discoveredRegionIds) {
    const place = world.places[id];
    if (place) markPoint(cells, { x: place.mapX, y: place.mapY });
  }

  // Ocean/offshore discoveries and other physically discovered places are not
  // all represented by growth.discoveredRegionIds.
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
  return Math.max(0, Math.min(100, Math.floor((covered / COVERAGE_CELLS) * 100)));
}

/**
 * World level is deliberately 1..100. Level 100 is reached only when every
 * coarse physical sector in the current terrain bounds has exploration
 * evidence. Internal growth.stage remains an uncapped historical sequence and
 * is NOT a player-facing world level.
 */
export function worldExplorationLevel(world: Readonly<WorldState>): number {
  return Math.max(1, worldExplorationPercent(world));
}

export const WORLD_EXPLORATION_COVERAGE_CELLS = COVERAGE_CELLS;
