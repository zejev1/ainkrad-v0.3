import { pointInPolygon, pointSegmentDistance } from '../world/BuildingFootprints';
import type {
  AgentPositionState,
  AgentState,
  WorldState,
} from '../world/types';

function residentRadialSeed(agentId: string): number {
  let hash = 0x9e3779b9;
  for (let index = agentId.length - 1; index >= 0; index -= 1) {
    hash ^= agentId.charCodeAt(index) + ((hash << 6) >>> 0) + (hash >>> 2);
    hash >>>= 0;
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

function restingFootprintRadius(
  agent: Readonly<AgentState>,
  world: Readonly<WorldState>,
): number {
  const place = world.places[agent.locationId];
  if (!place) return 0.8;
  if (place.kind === 'home') return 0.025;
  if (place.kind === 'workshop' || place.kind === 'library') return 0.04;
  if (['commons', 'city', 'village', 'quiet_space'].includes(place.kind)) return 0.08;

  const polygon=place.boundaryPolygon;
  const anchor={x:place.mapX,y:place.mapY};
  if(polygon?.length&&pointInPolygon(anchor,polygon)) {
    return Math.min(.5,Math.max(.015,Math.min(...polygon.map((p,i)=>pointSegmentDistance(anchor,p,polygon[(i+1)%polygon.length])))*.65));
  }
  // A bank marker denotes dry land, not the middle of a water body.
  if(place.surface==='shore')return .025;
  return place.kind==='resource_field'?.10:.06;
}

function residentPhase(agentId: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < agentId.length; index += 1) {
    hash ^= agentId.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  // Final avalanche prevents sequential ids (agent_1, agent_2, ...) from
  // occupying nearly the same angular sector.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return ((hash >>> 0) / 0x1_0000_0000) * Math.PI * 2;
}

/**
 * Read-only presentation stride around a continuously persisted position.
 *
 * The persisted resident state and RNG remain untouched. Worker frequency can
 * therefore change the number of painted frames, but never the resident's or
 * Cardinal's semantic choices. WorldEngine itself advances route coordinates
 * from canonical world minutes, independently of the six-day decision grid.
 */
export function projectedResidentPosition(
  agent: Readonly<AgentState>,
  world: Readonly<WorldState>,
  frameSequence: number,
): AgentPositionState {
  const movement = agent.movement;
  const safeFrameSequence = Number.isFinite(frameSequence)
    ? Math.max(0, frameSequence)
    : 0;
  const phase = residentPhase(agent.id);
  const mobility = agent.life.physiology.mobility;

  if(movement?.boatId)return {...agent.position};

  if (!movement) {
    const place = world.places[agent.locationId];
    const anchorX = place?.mapX ?? agent.position.x;
    const anchorY = place?.mapY ?? agent.position.y;
    const footprint = restingFootprintRadius(agent, world);
    const radialSeed = residentRadialSeed(agent.id);
    const residentRadius = footprint * (0.3 + radialSeed * 0.7);
    const stableX = anchorX + Math.cos(phase) * residentRadius;
    const stableY = anchorY + Math.sin(phase) * residentRadius * 0.78;

    // Resting residents keep a stable personal spot inside the physical place.
    // Other local activities add only a small display-only stride around that
    // spot. This prevents dozens of residents from being painted on one exact
    // coordinate while preserving routes, WorldState and RNG semantics.
    if (agent.lastAction === 'rest') {
      return { x: stableX, y: stableY, layerId: agent.position.layerId };
    }
    const ambientPhase = phase + safeFrameSequence * 0.23;
    const ambientRadius = Math.min(footprint * 0.15, 0.18 + mobility * 0.24);
    return {
      x: stableX + Math.cos(ambientPhase) * ambientRadius,
      y: stableY + Math.sin(ambientPhase) * ambientRadius * 0.62,
      layerId: agent.position.layerId,
    };
  }

  // A small display-only gait makes the walking state legible while CSS
  // interpolates between consecutive authoritative physical coordinates.
  const stridePhase = phase + safeFrameSequence * 1.6;
  const strideRadius = 0.002 + mobility * 0.003;

  return {
    x: agent.position.x + Math.cos(stridePhase) * strideRadius,
    y: agent.position.y + Math.sin(stridePhase) * strideRadius * 0.38,
    layerId: agent.position.layerId,
  };
}
