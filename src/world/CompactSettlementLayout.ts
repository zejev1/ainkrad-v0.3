import {repairWorldTerrain,bindWorldTerrain} from './geography/WorldTerrain';
import {hash} from './geography/TerrainMath';
import {ensureInhabitedLandRescue} from './geography/InhabitedLandRescue';
import { updateSettlementGeometry } from './SettlementGeometryV21';
import { updateNaturalGeography, finishWorldGeography } from './WorldGeography';
import { reconcileRouteGeometry } from './RouteGeometryMigration';
import { rebuildWorldRoutes } from './WorldNavigation';
import { compactLibraryPlot } from './SettlementLibraryLayout';
import { HUMAN_LIBRARY_IDS, LIBRARY_LIMIT } from '../v21/LibraryAdmissions';
import type { WorldPoint2D, WorldState } from './types';

const FOUNDING_HUMAN_SETTLEMENTS = [
  'settlement_ainkrad',
  'settlement_rulid',
  'settlement_zakkaria',
] as const;

const FOUNDING_HUMAN_CIVIC_CENTERS: Readonly<Record<(typeof FOUNDING_HUMAN_SETTLEMENTS)[number], string>> = {
  settlement_ainkrad: 'commons',
  settlement_rulid: 'rulid_commons',
  settlement_zakkaria: 'zakkaria_commons',
};

/**
 * New founding worlds use the public square/market as the actual civic centre
 * in all three human communities. Older lived worlds are never re-centred here
 * because changing the origin after history exists would move streets/buildings
 * during the geometry migration.
 */
function normalizeFreshFoundingCivicCenters(world: WorldState): boolean {
  if (world.terrain) return false;
  let changed = false;
  for (const settlementId of FOUNDING_HUMAN_SETTLEMENTS) {
    const town = world.settlements[settlementId];
    const commons = world.places[FOUNDING_HUMAN_CIVIC_CENTERS[settlementId]];
    if (!town || !commons || commons.settlementId !== settlementId) continue;
    if (town.centerPlaceId !== commons.id) {
      town.centerPlaceId = commons.id;
      changed = true;
    }
    if (town.centerX !== commons.mapX || town.centerY !== commons.mapY) {
      town.centerX = commons.mapX;
      town.centerY = commons.mapY;
      changed = true;
    }
    if (changed) {
      delete town.boundaryPolygon;
      delete town.layoutVersion;
      delete town.layoutSignature;
    }
  }
  return changed;
}

/**
 * F2 founding humans must begin as three genuinely distant populations, not as
 * three labels on the same eastern quarter of the continent. This runs only
 * before the physical terrain foundation exists, so an already-lived world is
 * never teleported by a reload or migration.
 *
 * Map unit = 100 metres. Rulid's civic centre is placed 0.8 map units (80 m)
 * inland from the fixed eastern ocean rim at x=96. Ainkrad and Zakkaria occupy
 * opposite far-west north/south sectors. Small deterministic jitter keeps new
 * epochs/seed worlds from using identical coordinates without consuming the
 * world's semantic RNG stream.
 */
function spreadFoundingHumanSettlements(
  world: WorldState,
  moved: Map<string,{before:WorldPoint2D;after:WorldPoint2D}>,
): boolean {
  if (world.terrain) return false;
  if (!FOUNDING_HUMAN_SETTLEMENTS.every((id) => world.settlements[id])) return false;

  const unit = (suffix:string) =>
    hash(`${world.id}:epoch:${world.epoch ?? 1}:human-foundations:${suffix}`) / 0x1_0000_0000;
  const mirror = unit('mirror') < 0.5 ? -1 : 1;
  const northSouthJitter = (unit('latitude') - 0.5) * 800;
  const westJitterA = (unit('ainkrad-x') - 0.5) * 800;
  const westJitterZ = (unit('zakkaria-x') - 0.5) * 800;
  const rulidY = (unit('rulid-y') - 0.5) * 1_400;

  // These points sit well inside the persisted continental outline instead of
  // relying on settlement anchors to pull a thin peninsula underneath them.
  // The resulting triangle is still continent-scale: every side stays above
  // ~3,500 km while leaving kilometres of dry survey room around both western
  // foundations.
  const targets: Record<(typeof FOUNDING_HUMAN_SETTLEMENTS)[number],WorldPoint2D> = {
    settlement_ainkrad: {
      x: -32_000 + westJitterA,
      y: mirror * (-18_000 + northSouthJitter),
    },
    settlement_rulid: {
      // ContinentalRelief keeps the original eastern sea at x > 96.
      // 95.2 therefore leaves the civic centre only 0.8 unit = 80 m inland.
      x: 95.2,
      y: rulidY,
    },
    settlement_zakkaria: {
      x: -32_000 + westJitterZ,
      y: mirror * (18_000 + northSouthJitter),
    },
  };

  let changed = false;
  for (const settlementId of FOUNDING_HUMAN_SETTLEMENTS) {
    const town = world.settlements[settlementId];
    const center = world.places[town.centerPlaceId];
    if (!center) continue;
    const originalCenter = {x:center.mapX,y:center.mapY};
    const target = targets[settlementId];
    const dx = target.x - originalCenter.x;
    const dy = target.y - originalCenter.y;
    if (Math.hypot(dx,dy) < 1e-9) continue;

    for (const place of Object.values(world.places)) {
      if (place.settlementId !== settlementId) continue;
      const before = {x:place.mapX,y:place.mapY};
      const local = {x:place.mapX-originalCenter.x,y:place.mapY-originalCenter.y};
      let after = {x:place.mapX + dx,y:place.mapY + dy};

      if (settlementId === 'settlement_rulid') {
        if (place.id === 'rulid_shore') {
          // Dry launch bank roughly 30 m from the fixed east-sea boundary.
          after = {x:95.7,y:target.y};
        } else if (place.id !== center.id) {
          // Rulid is a coastal town: all civic/residential offsets must point
          // inland (west), otherwise the old local +X layout puts buildings
          // directly into the ocean and silently drops routes.
          after = {x:target.x-Math.abs(local.x),y:target.y+local.y};
        }
      }

      place.mapX = after.x;
      place.mapY = after.y;
      delete place.boundaryPolygon;
      delete place.geographyVersion;
      delete place.urbanLayoutVersion;
      delete place.urbanLot;
      moved.set(place.id,{before,after});
      changed = true;
    }

    town.centerX = target.x;
    town.centerY = target.y;
    delete town.boundaryPolygon;
    delete town.layoutVersion;
    delete town.layoutSignature;

    // This branch only runs during creation/reset before lived history. Align
    // stationary founders with their translated homes, including Rulid's
    // reflected inland layout. Existing worlds never enter this branch.
    for (const agent of Object.values(world.agents)) {
      const home = world.places[agent.homeId];
      if (home?.settlementId !== settlementId || agent.movement) continue;
      agent.position.x = home.mapX;
      agent.position.y = home.mapY;
    }
  }
  return changed;
}

function ensureFreshFoundingHumanLibraries(world: WorldState): boolean {
  if (world.terrain) return false;
  const specs = [
    { id: HUMAN_LIBRARY_IDS[1], settlementId: 'settlement_rulid', name: 'Тайная библиотека Рулида' },
    { id: HUMAN_LIBRARY_IDS[2], settlementId: 'settlement_zakkaria', name: 'Тайная библиотека Заккарии' },
  ] as const;
  let changed = false;
  for (const spec of specs) {
    if (world.places[spec.id]) continue;
    const town = world.settlements[spec.settlementId];
    const anchor = town ? world.places[town.centerPlaceId] : undefined;
    if (!town || !anchor) continue;
    const plot = compactLibraryPlot(world.places, { x: anchor.mapX, y: anchor.mapY }, spec.id);
    if (!plot) continue;
    world.places[spec.id] = {
      id: spec.id, name: spec.name, kind: 'library', capacity: LIBRARY_LIMIT,
      biome: 'ancient_ruins', mapX: plot.x, mapY: plot.y, connectedPlaceIds: [anchor.id],
      fertility: 0, danger: 0, surface: 'land', settlementId: spec.settlementId, discoveredAt: 0,
    };
    if (!anchor.connectedPlaceIds.includes(spec.id)) anchor.connectedPlaceIds.push(spec.id);
    if (!town.memberPlaceIds.includes(spec.id)) town.memberPlaceIds.push(spec.id);
    changed = true;
  }
  return changed;
}
function invalidateRulidLayoutForCoast(world:WorldState):void {
  const town=world.settlements.settlement_rulid;
  if(!town)return;
  delete town.layoutVersion;
  delete town.layoutSignature;
  delete town.boundaryPolygon;
  for(const place of Object.values(world.places)) {
    if(place.settlementId!=='settlement_rulid')continue;
    delete place.urbanLayoutVersion;
    delete place.urbanLot;
    if(place.kind!=='shore')delete place.boundaryPolygon;
  }
}

function alignFreshFoundersWithHomes(world:WorldState):void {
  for(const agent of Object.values(world.agents)) {
    if(agent.movement || agent.locationId!==agent.homeId)continue;
    const home=world.places[agent.homeId];
    if(!home || !FOUNDING_HUMAN_SETTLEMENTS.includes(home.settlementId as any))continue;
    agent.position.x=home.mapX;
    agent.position.y=home.mapY;
  }
}

/** Versioned geometry migration; calendar, RNG, identities and knowledge stay intact. */
export function repairCompactSettlementLayout(world:WorldState):boolean {
  bindWorldTerrain(world);
  const habitatRescueChanged=ensureInhabitedLandRescue(world).changed;
  const oldRoutes=world.routes;
  const moved=new Map<string,{before:WorldPoint2D;after:WorldPoint2D}>();
  const civicCenterChanged=normalizeFreshFoundingCivicCenters(world);
  const foundingSpreadChanged=spreadFoundingHumanSettlements(world,moved);
  const freshLibraryChanged=ensureFreshFoundingHumanLibraries(world);
  const naturalChanged=updateNaturalGeography(world);
  updateSettlementGeometry(world,(id,point)=>{
    const place=world.places[id];
    moved.set(id,{before:{x:place.mapX,y:place.mapY},after:point});
    place.mapX=point.x;place.mapY=point.y;place.urbanLayoutVersion=3;
  });
  const terrainChanged=repairWorldTerrain(world);

  // The first founding pass necessarily precedes terrain creation. Re-plan
  // Rulid once the real coastline exists so homes/fields remain on dry land,
  // while its civic square stays within 100 m of the sea.
  if(foundingSpreadChanged&&terrainChanged&&world.settlements.settlement_rulid){
    invalidateRulidLayoutForCoast(world);
    updateSettlementGeometry(world,(id,point)=>{
      const place=world.places[id];
      moved.set(id,{before:{x:place.mapX,y:place.mapY},after:point});
      place.mapX=point.x;place.mapY=point.y;place.urbanLayoutVersion=3;
    });
    alignFreshFoundersWithHomes(world);
  }

  const geographyChanged=finishWorldGeography(world);
  if(!habitatRescueChanged&&!terrainChanged&&!naturalChanged&&!civicCenterChanged&&!foundingSpreadChanged&&!freshLibraryChanged&&!moved.size&&!geographyChanged)return false;
  world.routes=rebuildWorldRoutes(world.places,world.routes);
  reconcileRouteGeometry(world,oldRoutes,moved);
  return true;
}
