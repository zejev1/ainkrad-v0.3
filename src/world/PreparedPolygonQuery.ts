import type { WorldPoint2D } from './types';

interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
interface Edge extends Bounds { a: WorldPoint2D; b: WorldPoint2D }
interface Node extends Bounds { edges?: Edge[]; left?: Node; right?: Node }
const intersects = (a: Bounds, b: Bounds): boolean =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
function tree(edges: Edge[]): Node {
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const edge of edges) {
    bounds.minX = Math.min(bounds.minX, edge.minX); bounds.minY = Math.min(bounds.minY, edge.minY);
    bounds.maxX = Math.max(bounds.maxX, edge.maxX); bounds.maxY = Math.max(bounds.maxY, edge.maxY);
  }
  if (edges.length <= 8) return { ...bounds, edges };
  const x = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
  edges.sort((a, b) => x ? (a.minX + a.maxX) - (b.minX + b.maxX) : (a.minY + a.maxY) - (b.minY + b.maxY));
  const middle = Math.floor(edges.length / 2);
  return { ...bounds, left: tree(edges.slice(0, middle)), right: tree(edges.slice(middle)) };
}
function anyEdge(node: Node, bounds: Bounds, predicate: (edge: Edge) => boolean): boolean {
  if (!intersects(node, bounds)) return false;
  if (node.edges) return node.edges.some(edge => intersects(edge, bounds) && predicate(edge));
  return anyEdge(node.left!, bounds, predicate) || anyEdge(node.right!, bounds, predicate);
}
/** Immutable query snapshot. The parity and intersection predicates are exactly
 * the existing physical rules; a BVH skips edges that cannot affect the query.
 * Recreate after a polygon edit. No global length-only mutation cache is used. */
export class PreparedPolygonQuery {
  private readonly root: Node;
  private readonly yBuckets: Edge[][];
  private readonly yScale: number;
  constructor(polygon: readonly WorldPoint2D[]) {
    const parityEdges = new Map<string, Edge>();
    for (let i = 0; i < polygon.length; i += 1) {
      const a = { ...polygon[i] }, b = { ...polygon[(i + 1) % polygon.length] };
      if (a.x === b.x && a.y === b.y) continue;
      const key = [`${a.x},${a.y}`, `${b.x},${b.y}`].sort().join('|');
      // Even-odd holes are joined by a duplicated, zero-area connector.
      if (parityEdges.has(key)) parityEdges.delete(key);
      else parityEdges.set(key, { a, b, minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y),
        maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) });
    }
    const edges = [...parityEdges.values()];
    this.root = tree([...edges]);
    const count = Math.max(1, Math.min(128, Math.ceil(Math.sqrt(edges.length) * 4)));
    this.yBuckets = Array.from({ length: count }, () => []);
    const span = this.root.maxY - this.root.minY;
    this.yScale = span > 0 && Number.isFinite(span) ? count / span : 0;
    for (const edge of edges) {
      const lo = this.bucketIndex(edge.minY), hi = this.bucketIndex(edge.maxY);
      for (let i = lo; i <= hi; i++) this.yBuckets[i].push(edge);
    }
  }
  private bucketIndex(y: number): number {
    return this.yScale ? Math.max(0, Math.min(this.yBuckets.length - 1,
      Math.floor((y - this.root.minY) * this.yScale))) : 0;
  }
  contains(point: Readonly<WorldPoint2D>): boolean {
    if (point.x < this.root.minX || point.x > this.root.maxX ||
        point.y < this.root.minY || point.y > this.root.maxY) return false;
    let inside = false;
    // The horizontal parity ray can meet only edges spanning this y-band.
    // This avoids allocating closures and walking the whole ocean-hole BVH
    // three times for every short A* edge; crossing still uses exact predicates.
    for (const { a, b } of this.yBuckets[this.bucketIndex(point.y)]) {
      if ((a.y > point.y) !== (b.y > point.y) &&
          point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  hitsSegment(a: Readonly<WorldPoint2D>, b: Readonly<WorldPoint2D>): boolean {
    const bounds = { minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y),
      maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) };
    if (!intersects(this.root, bounds)) return false;
    if (this.contains(a) || this.contains(b) || this.contains({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })) return true;
    const cross = (p: Readonly<WorldPoint2D>, q: Readonly<WorldPoint2D>, r: Readonly<WorldPoint2D>): number =>
      (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return anyEdge(this.root, bounds, ({ a: c, b: d }) =>
      cross(a, b, c) * cross(a, b, d) < -1e-14 && cross(c, d, a) * cross(c, d, b) < -1e-14);
  }
}
