import {repairWorldTerrain,bindWorldTerrain} from './geography/WorldTerrain';
import {hash} from './geography/TerrainMath';
import { updateSettlementGeometry } from './SettlementGeometryV21';
import { updateNaturalGeography, finishWorldGeography } from './WorldGeography';
import { reconcileRouteGeometry } from './RouteGeometryMigration';
import { rebuildWorldRoutes } from './WorldNavigation';
import type { WorldPoint2D, WorldState } from './types';

const FOUNDING_HUMAN_SETTLEMENTS = [
  'settlement_ainkrad',
  'settlement_rulid',
  'settlement_zakkaria',
] as const;

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
  const northSouthJitter = (unit('latitude') - 0.5) * 1_200;
  const westJitterA = (unit('ainkrad-x') - 0.5) * 1_200;
  const westJitterZ = (unit('zakkaria-x') - 0.5) * 1_200;
  const rulidY = (unit('rulid-y') - 0.5) * 1_600;

  const targets: Record<(typeof FOUNDING_HUMAN_SETTLEMENTS)[number],WorldPoint2D> = {
    settlement_ainkrad: {
      x: -36_000 + westJitterA,
      y: mirror * (-20_000 + northSouthJitter),
    },
    settlement_rulid: {
      // ContinentalRelief keeps the original eastern sea at x > 96.
      // 95.2 therefore leaves the civic centre only 0.8 unit = 80 m inland.
      x: 95.2,
      y: rulidY,
    },
    settlement_zakkaria: {
      x: -36_000 + westJitterZ,
      y: mirror * (20_000 + northSouthJitter),
    },
  };

  let changed = false;
  for (const settlementId of FOUNDING_HUMAN_SETTLEMENTS) {
    const town = world.settlements[settlementId];
    const center = world.places[town.centerPlaceId];
    if (!center) continue;
    const target = targets[settlementId];
    const dx = target.x - center.mapX;
    const dy = target.y - center.mapY;
    if (Math.hypot(dx,dy) < 1e-9) continue;

    for (const place of Object.values(world.places)) {
      if (place.settlementId !== settlementId) continue;
      const before = {x:place.mapX,y:place.mapY};
      const after = {x:place.mapX + dx,y:place.mapY + dy};
      // Rulid's dedicated shore must stay at the sea-facing edge instead of
      // carrying its old ~3 km inland offset with the rest of the settlement.
      if (settlementId === 'settlement_rulid' && place.id === 'rulid_shore') {
        after.x = 95.7;
        after.y = target.y;
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

    // Fresh founders are stationary here. Keep their physical coordinates with
    // their homes when the whole founding settlement is translated.
    for (const agent of Object.values(world.agents)) {
      const home = world.places[agent.homeId];
      if (home?.settlementId !== settlementId || agent.movement) continue;
      agent.position.x += dx;
      agent.position.y += dy;
    }
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

/** Versioned geometry migration; calendar, RNG, identities and knowledge stay intact. */
export function repairCompactSettlementLayout(world:WorldState):boolean {
  bindWorldTerrain(world);
  const oldRoutes=world.routes;
  const moved=new Map<string,{before:WorldPoint2D;after:WorldPoint2D}>();
  const foundingSpreadChanged=spreadFoundingHumanSettlements(world,moved);
  const naturalChanged=updateNaturalGeography(world);
  updateSettlementGeometry(world,(id,point)=>{
    const place=world.places[id];
    moved.set(id,{before:{x:place.mapX,y:place.mapY},after:point});
    place.mapX=point.x;place.mapY=point.y;place.urbanLayoutVersion=3;
  });
  const terrainChanged=repairWorldTerrain(world);

  // The first founding pass necessarily precedes terrain creation. Re-plan
  // Rulid once the real coastline exists so homes/fields remain on dry land,
  // while its civic centre stays within 100 m of the sea.
  if(foundingSpreadChanged&&terrainChanged&&world.settlements.settlement_rulid){
    invalidateRulidLayoutForCoast(world);
    updateSettlementGeometry(world,(id,point)=>{
      const place=world.places[id];
      moved.set(id,{before:{x:place.mapX,y:place.mapY},after:point});
      place.mapX=point.x;place.mapY=point.y;place.urbanLayoutVersion=3;
    });
  }

  const geographyChanged=finishWorldGeography(world);
  if(!terrainChanged&&!naturalChanged&&!foundingSpreadChanged&&!moved.size&&!geographyChanged)return false;
  world.routes=rebuildWorldRoutes(world.places,world.routes);
  reconcileRouteGeometry(world,oldRoutes,moved);
  return true;
}
