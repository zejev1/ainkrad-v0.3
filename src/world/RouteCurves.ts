import type { WorldPoint2D } from './types';

const distance = (a: Readonly<WorldPoint2D>, b: Readonly<WorldPoint2D>) =>
  Math.hypot(b.x - a.x, b.y - a.y);

/** Rounds surveyed route corners into a sampled physical curve. The returned
 * points are used for movement as well as drawing, so the map never invents a
 * cosmetic road that residents do not actually follow. */
export function roundedRoutePath(
  path: readonly WorldPoint2D[],
  samplesPerCorner = 4,
): WorldPoint2D[] {
  if (path.length < 3) return path.map((point) => ({ ...point }));
  const samples = Math.max(2, Math.min(8, Math.floor(samplesPerCorner)));
  const result: WorldPoint2D[] = [{ ...path[0] }];
  const push = (point: WorldPoint2D) => {
    if (distance(result.at(-1)!, point) > 1e-8) result.push(point);
  };

  for (let index = 1; index < path.length - 1; index += 1) {
    const a = path[index - 1];
    const corner = path[index];
    const c = path[index + 1];
    const incomingLength = distance(a, corner);
    const outgoingLength = distance(corner, c);
    if (incomingLength < 1e-8 || outgoingLength < 1e-8) continue;
    const inX = (corner.x - a.x) / incomingLength;
    const inY = (corner.y - a.y) / incomingLength;
    const outX = (c.x - corner.x) / outgoingLength;
    const outY = (c.y - corner.y) / outgoingLength;
    const directionSimilarity = Math.max(-1, Math.min(1, inX * outX + inY * outY));
    if (directionSimilarity > 0.997) continue;
    const turnSeverity = (1 - directionSimilarity) / 2;
    const trim = Math.min(incomingLength, outgoingLength) *
      Math.min(0.42, 0.22 + turnSeverity * 0.18);
    const entry = { x: corner.x - inX * trim, y: corner.y - inY * trim };
    const exit = { x: corner.x + outX * trim, y: corner.y + outY * trim };
    push(entry);
    for (let sample = 1; sample <= samples; sample += 1) {
      const t = sample / samples;
      const inverse = 1 - t;
      push({
        x: inverse * inverse * entry.x + 2 * inverse * t * corner.x + t * t * exit.x,
        y: inverse * inverse * entry.y + 2 * inverse * t * corner.y + t * t * exit.y,
      });
    }
  }
  push({ ...path.at(-1)! });
  return result;
}
