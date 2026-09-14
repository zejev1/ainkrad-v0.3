const TERRAIN_OWNED_AREA_KINDS = new Set([
  'water',
  'forest',
  'mountains',
  'swamp',
  'meadow',
]);

/**
 * Continuous terrain is the single source of truth for natural surfaces.
 * Legacy/survey polygons may remain in saves for knowledge and boundaries,
 * but must never repaint the rendered terrain at particular zoom levels.
 *
 * Keeping this policy pure makes the zoom regression independently testable
 * without touching geography, simulation state or the terrain generator.
 */
export function shouldPaintAtlasAreaOverlay(
  kind: string,
  hasContinuousTerrain: boolean,
): boolean {
  return !hasContinuousTerrain || !TERRAIN_OWNED_AREA_KINDS.has(kind);
}
