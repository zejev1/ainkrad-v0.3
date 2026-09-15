import { buildingSize, pointInPolygon, segmentHitsPolygon } from './BuildingFootprints';
import { PreparedPolygonQuery } from './PreparedPolygonQuery';
import { FeatureIndex, featureBounds, type FeatureBounds } from './geography/FeatureIndex';
import { terrainForPlaces } from './geography/WorldTerrain';
import type { WorldPlace, WorldPoint2D, WorldTraversalKind } from './types';

type Places = Readonly<Record<string, WorldPlace>>;
interface Water { polygon: WorldPoint2D[]; signature: string; order: number }
export interface NavigationFailureProof {
  waterBounds?: FeatureBounds;
  buildingBounds?: FeatureBounds;
  signature: string;
}
interface AttemptBounds { waterBounds?: FeatureBounds; buildingBounds?: FeatureBounds }
const mergeBounds = (current: FeatureBounds | undefined, next: FeatureBounds): FeatureBounds => current
  ? { minX: Math.min(current.minX, next.minX), minY: Math.min(current.minY, next.minY),
      maxX: Math.max(current.maxX, next.maxX), maxY: Math.max(current.maxY, next.maxY) }
  : { ...next };
interface Building { place: WorldPlace; signature: string; order: number }
const polygonSignature = (p: readonly WorldPoint2D[]): string => p.map(v => `${v.x},${v.y}`).join(';');
const scopes = new WeakMap<Places, PhysicalNavigationQueries>();

/** Read-only, synchronous geometry scope: build local indexes once per rebuild,
 * not once per A* edge. It is discarded afterwards, so even same-length in-place
 * polygon edits and moved/removed houses are seen by the next rebuild. */
class PhysicalNavigationQueries {
  readonly model;
  readonly waters: Water[];
  readonly waterIndex: FeatureIndex<Water>;
  readonly buildingIndex: FeatureIndex<Building>;
  readonly worldSignature: string;
  private attempt?: AttemptBounds;
  private readonly polygons = new WeakMap<readonly WorldPoint2D[], PreparedPolygonQuery>();
  constructor(private readonly places: Places) {
    this.model = terrainForPlaces(places);
    const all = Object.values(places);
    this.waters = all.flatMap((p, order) => {
      if (this.model && p.kind === 'ocean') return [];
      const polygon = p.waterPolygon ?? (p.surface === 'water' ? p.boundaryPolygon : undefined);
      return polygon ? [{ polygon, order, signature: `${p.id}:${polygonSignature(polygon)}` }] : [];
    });
    this.waterIndex = new FeatureIndex(this.waters, w => featureBounds(w.polygon), 32);
    const buildings = all.flatMap((place, order) => buildingSize(place).width > 0
      ? [{ place, order, signature: `${place.id}:${place.kind}:${place.mapX}:${place.mapY}:${place.rotation ?? 0}` }] : []);
    this.buildingIndex = new FeatureIndex(buildings, b => ({ minX: b.place.mapX, maxX: b.place.mapX,
      minY: b.place.mapY, maxY: b.place.mapY }), 2);
    // Negative construction results may be reused only with unchanged inputs.
    this.worldSignature = `${this.model?.foundation.key ?? ''}|${all.map(p =>
      `${p.id}:${p.kind}:${p.biome}:${p.mapX}:${p.mapY}:${p.surface}:${p.rotation ?? 0}`).join('|')}|` +
      this.waters.map(w => w.signature).join('|');
  }
  waterIn(bounds?: FeatureBounds): WorldPoint2D[][] {
    if (this.attempt && bounds) this.attempt.waterBounds = mergeBounds(this.attempt.waterBounds, bounds);
    // Construction queries are bounded. A future unbounded caller must not be
    // incorrectly cached as if it had read no water geometry.
    if (this.attempt && !bounds) this.attempt.waterBounds = { minX:-Infinity,minY:-Infinity,maxX:Infinity,maxY:Infinity };
    const local = bounds ? this.waterIndex.query(bounds).sort((a, b) => a.order - b.order) : this.waters;
    return [...local.map(w => w.polygon), ...(this.model
      ? [this.model.ocean, ...(bounds ? this.model.waterIn(bounds) : this.model.riverPolygons)] : [])];
  }
  buildingsIn(bounds: FeatureBounds): WorldPlace[] {
    if (this.attempt) this.attempt.buildingBounds = mergeBounds(this.attempt.buildingBounds, bounds);
    return this.buildingIndex.query(bounds).sort((a, b) => a.order - b.order).map(b => b.place);
  }
  polygon(polygon: readonly WorldPoint2D[]): PreparedPolygonQuery {
    let query = this.polygons.get(polygon);
    if (!query) { query = new PreparedPolygonQuery(polygon); this.polygons.set(polygon, query); }
    return query;
  }
  beginAttempt(): void { this.attempt = {}; }
  clearAttempt(): void { this.attempt = undefined; }
  private constructionSignature(from: Readonly<WorldPlace>, to: Readonly<WorldPlace>, traversal: WorldTraversalKind,
    bounds: AttemptBounds): string {
    // These are the non-indexed inputs read by buildRoute/organicStreetPath.
    // All A*/detour water and building reads are captured separately below.
    const geometry = (p: Readonly<WorldPlace> | undefined) => p ? [p.id,p.kind,p.biome,p.surface,p.mapX,p.mapY,
      p.settlementId,p.urbanLayoutVersion,p.urbanLot,p.rotation] : undefined;
    const all = Object.values(this.places);
    const town = from.settlementId ?? (from.id === 'secret_library_v18' ? this.places.commons?.settlementId : undefined);
    const townCenter = town ? all.find(p => p.settlementId === town && ['commons','city','village'].includes(p.kind)) : undefined;
    const distance = Math.hypot(to.mapX-from.mapX,to.mapY-from.mapY);
    const rough = all.filter(p => ['mountains','swamp','forest'].includes(p.kind) &&
      Math.hypot(p.mapX-from.mapX,p.mapY-from.mapY) < distance+12);
    const water = bounds.waterBounds ? this.waterIndex.query(bounds.waterBounds).sort((a,b)=>a.order-b.order) : [];
    const buildings = bounds.buildingBounds ? this.buildingIndex.query(bounds.buildingBounds).sort((a,b)=>a.order-b.order) : [];
    return JSON.stringify([this.model?.foundation.key,traversal,geometry(from),geometry(to),geometry(townCenter),
      this.places.commons?.settlementId,rough.map(geometry),water.map(w=>w.signature),buildings.map(b=>b.signature)]);
  }
  finishFailure(from: Readonly<WorldPlace>, to: Readonly<WorldPlace>, traversal: WorldTraversalKind): NavigationFailureProof {
    const bounds = this.attempt ?? {};
    this.attempt = undefined;
    return { ...bounds, signature: this.constructionSignature(from,to,traversal,bounds) };
  }
  failureUnchanged(proof: NavigationFailureProof, from: Readonly<WorldPlace>, to: Readonly<WorldPlace>, traversal: WorldTraversalKind): boolean {
    return proof.signature === this.constructionSignature(from,to,traversal,proof);
  }
  routeSignature(path: readonly WorldPoint2D[]): string {
    const water = this.waterIndex.query(featureBounds(path)).sort((a, b) => a.order - b.order);
    const buildings = this.buildingIndex.query(featureBounds(path, 0.28)).sort((a, b) => a.order - b.order);
    return `${this.model?.foundation.key ?? ''}|${polygonSignature(path)}|${water.map(w => w.signature).join('|')}|` +
      buildings.map(b => b.signature).join('|');
  }
}
export function withPhysicalNavigationQueries<T>(places: Places, operation: () => T): T {
  if (scopes.has(places)) return operation();
  scopes.set(places, new PhysicalNavigationQueries(places));
  try { return operation(); } finally { scopes.delete(places); }
}
export function indexedWaterPolygons(places: Places, bounds?: FeatureBounds): WorldPoint2D[][] | undefined {
  return scopes.get(places)?.waterIn(bounds);
}
export function indexedBuildings(places: Places, bounds: FeatureBounds): WorldPlace[] | undefined {
  return scopes.get(places)?.buildingsIn(bounds);
}
export function waterContains(point: WorldPoint2D, polygon: readonly WorldPoint2D[], places: Places): boolean {
  return scopes.get(places)?.polygon(polygon).contains(point) ?? pointInPolygon(point, polygon);
}
export function waterHitsSegment(a: WorldPoint2D, b: WorldPoint2D, polygon: readonly WorldPoint2D[], places: Places): boolean {
  return scopes.get(places)?.polygon(polygon).hitsSegment(a, b) ?? segmentHitsPolygon(a, b, polygon);
}
export function navigationRouteSignature(path: readonly WorldPoint2D[], places: Places): string | undefined {
  return scopes.get(places)?.routeSignature(path);
}
export function navigationWorldSignature(places: Places): string | undefined {
  return scopes.get(places)?.worldSignature;
}

export function beginNavigationConstruction(places: Places): void { scopes.get(places)?.beginAttempt(); }
export function clearNavigationConstruction(places: Places): void { scopes.get(places)?.clearAttempt(); }
export function finishNavigationFailure(places: Places, from: Readonly<WorldPlace>, to: Readonly<WorldPlace>, traversal: WorldTraversalKind): NavigationFailureProof | undefined {
  return scopes.get(places)?.finishFailure(from,to,traversal);
}
export function navigationFailureUnchanged(places: Places, proof: NavigationFailureProof, from: Readonly<WorldPlace>, to: Readonly<WorldPlace>, traversal: WorldTraversalKind): boolean {
  return scopes.get(places)?.failureUnchanged(proof,from,to,traversal) ?? false;
}
