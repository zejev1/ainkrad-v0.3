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
  if (place.kind === 'home') return 0.72;

  const settlement = place.settlementId
    ? world.settlements[place.settlementId]
    : undefined;
  const settlementRadius = settlement?.radius ?? 7;

  switch (place.kind) {
    case 'village':
    case 'city':
    case 'commons':
      return Math.max(2.4, Math.min(7.5, settlementRadius * 0.42));
    case 'resource_field':
      return Math.max(2.2, Math.min(5.6, settlementRadius * 0.34));
    case 'workshop':
      return Math.max(1.5, Math.min(3.4, settlementRadius * 0.22));
    case 'quiet_space':
    case 'meadow':
    case 'forest':
    case 'shore':
      return Math.max(1.8, Math.min(4.8, settlementRadius * 0.3));
    default:
      return 1.45;
  }
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
    const ambientRadius = 0.18 + mobility * 0.24;
    return {
      x: stableX + Math.cos(ambientPhase) * ambientRadius,
      y: stableY + Math.sin(ambientPhase) * ambientRadius * 0.62,
      layerId: agent.position.layerId,
    };
  }

  // A small display-only gait makes the walking state legible while CSS
  // interpolates between consecutive authoritative physical coordinates.
  const stridePhase = phase + safeFrameSequence * 1.6;
  const strideRadius = 0.06 + mobility * 0.05;

  return {
    x: agent.position.x + Math.cos(stridePhase) * strideRadius,
    y: agent.position.y + Math.sin(stridePhase) * strideRadius * 0.38,
    layerId: agent.position.layerId,
  };
}
