import type { WorldState } from '../world/types';

/** One transform for buildings, people, animals and settlement footprints. */
export function createWorldMapProjection(world: Readonly<WorldState>) {
  const places = Object.values(world.places);
  const minX = Math.min(...places.map(p => p.mapX));
  const maxX = Math.max(...places.map(p => p.mapX));
  const minY = Math.min(...places.map(p => p.mapY));
  const maxY = Math.max(...places.map(p => p.mapY));
  const spanX = Math.max(12, maxX - minX);
  const spanY = Math.max(12, maxY - minY);
  const scaleX = 90 / (spanX * 1.16);
  const scaleY = 90 / (spanY * 1.16);
  return {
    minX, maxX, minY, maxY, scaleX, scaleY,
    point: (x: number, y: number) => ({
      x: 5 + (x - minX + spanX * 0.08) * scaleX,
      y: 5 + (y - minY + spanY * 0.08) * scaleY,
    }),
    size: (width: number, height = width) => ({
      width: width * scaleX, height: height * scaleY,
    }),
  };
}
