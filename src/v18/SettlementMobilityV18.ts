import type { AgentState, WorldPlace, WorldState } from '../world/types';
import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export interface V18SiteAppraisal {
  placeId: string;
  score: number;
  fertility: number;
  danger: number;
  routeDistance: number;
  resourceOpportunity: number;
  reasons: string[];
}

export interface V18DepartureDecision {
  agentId: string;
  willingness: number;
  acceptsExpedition: boolean;
  reasons: string[];
}

export interface V18CampSettlementDecision {
  agentId: string;
  readiness: number;
  acceptanceChance: number;
  acceptsSettlement: boolean;
  reasons: string[];
}

function biomeResourceOpportunity(place: Readonly<WorldPlace>): number {
  switch (place.biome) {
    case 'river':
      return 0.92;
    case 'plains':
    case 'forest':
      return 0.82;
    case 'lake':
    case 'coast':
      return 0.76;
    case 'mountains':
      return 0.62;
    case 'swamp':
      return 0.48;
    case 'ancient_ruins':
      return 0.38;
    case 'settlement':
    default:
      return 0.3;
  }
}

/**
 * Appraise only physically discovered, reachable land. This function describes
 * opportunities; it never commands a resident to move or found anything.
 */
export function appraiseFrontierSitesV18(
  state: Readonly<WorldState>,
  originSettlementId: string,
  routeDistanceFromOrigin: (placeId: string) => number | undefined,
): V18SiteAppraisal[] {
  const origin = state.settlements[originSettlementId];
  if (!origin) return [];
  const lifecycle = state.v18?.settlementLifecycleById[originSettlementId];
  const originMemberIds = new Set(origin.memberPlaceIds);

  return Object.values(state.places)
    .filter(
      (place) =>
        place.surface === 'land' &&
        !place.settlementId &&
        !originMemberIds.has(place.id) &&
        place.kind !== 'cemetery' &&
        place.kind !== 'home',
    )
    .map((place) => {
      const routeDistance = routeDistanceFromOrigin(place.id);
      if (routeDistance === undefined) return undefined;
      const resourceOpportunity = biomeResourceOpportunity(place);
      const accessibility = 1 / (1 + routeDistance * 0.16);
      const safety = 1 - place.danger;
      const unclaimed = place.claimedBySettlementId ? 0 : 1;
      const pressure = lifecycle?.departurePressure ?? 0;
      const score = clamp01(
        place.fertility * 0.28 +
          resourceOpportunity * 0.25 +
          safety * 0.22 +
          accessibility * 0.15 +
          unclaimed * 0.06 +
          pressure * 0.04,
      );
      const reasons: string[] = [];
      if (place.fertility >= 0.65) reasons.push('fertile_land');
      if (resourceOpportunity >= 0.75) reasons.push('resource_opportunity');
      if (place.danger >= 0.42) reasons.push('known_danger');
      if (routeDistance >= 4) reasons.push('long_route');
      if (place.claimedBySettlementId) reasons.push('claimed_land');
      return {
        placeId: place.id,
        score,
        fertility: place.fertility,
        danger: place.danger,
        routeDistance,
        resourceOpportunity,
        reasons,
      } satisfies V18SiteAppraisal;
    })
    .filter((site): site is V18SiteAppraisal => site !== undefined)
    .sort((left, right) => right.score - left.score || left.placeId.localeCompare(right.placeId));
}

/** Every adult answers for themselves. The caller supplies a persisted RNG roll. */
export function decideFrontierExpeditionV18(
  state: Readonly<WorldState>,
  agent: Readonly<AgentState>,
  originSettlementId: string,
  site: Readonly<V18SiteAppraisal>,
  roll: number,
): V18DepartureDecision {
  const lifecycle = state.v18?.settlementLifecycleById[originSettlementId];
  const attachment = clamp01(
    agent.needs.belonging * 0.42 +
      agent.mind.values.tradition * 0.25 +
      agent.mind.beliefs.worldTrust * 0.12,
  );
  const dangerAversion = site.danger * (1 - agent.personality.riskTolerance);
  const livelihood = state.v18?.livelihoodByAgentId[agent.id];
  const rhythm = state.v18?.lifeRhythmByAgentId[agent.id];
  const yearsSinceOutside =
    rhythm?.lastOutsideSettlementWorldMinute === undefined
      ? Math.max(1, agent.life.ageYears * 0.2)
      : Math.max(
          0,
          (state.calendar.elapsedWorldMinutes -
            rhythm.lastOutsideSettlementWorldMinute) /
            WORLD_MINUTES_PER_YEAR,
        );
  const frontierStagnation = clamp01(yearsSinceOutside / 4);
  const foundingGenerationRoot = agent.life.generation === 0 ? 0.2 : 0;
  const generationalIndependence =
    agent.life.generation === 0
      ? 0
      : Math.min(0.32, 0.22 + agent.life.generation * 0.025);
  const willingness = clamp01(
    agent.personality.curiosity * 0.2 +
      agent.personality.riskTolerance * 0.16 +
      agent.mind.values.ambition * 0.17 +
      agent.mind.values.freedom * 0.12 +
      agent.skills.exploration * 0.14 +
      (livelihood?.primary === 'scout' ? 0.12 : 0) +
      frontierStagnation * 0.1 +
      generationalIndependence +
      (lifecycle?.departurePressure ?? 0) * 0.2 +
      site.score * 0.24 +
      (1 - agent.needs.purpose) * 0.09 -
      attachment * 0.16 -
      dangerAversion * 0.22 -
      foundingGenerationRoot,
  );
  const reasons: string[] = [];
  if ((lifecycle?.resourcePressure ?? 0) >= 0.42) reasons.push('local_scarcity');
  if ((lifecycle?.housingPressure ?? 0) >= 0.35) reasons.push('housing_pressure');
  if (site.resourceOpportunity >= 0.7) reasons.push('new_resources');
  if (site.fertility >= 0.65) reasons.push('fertile_site');
  if (agent.personality.curiosity >= 0.62) reasons.push('curiosity');
  if (agent.mind.values.freedom >= 0.62) reasons.push('freedom');
  if (livelihood?.primary === 'scout') reasons.push('scout_livelihood');
  if (frontierStagnation >= 0.65) reasons.push('long_without_frontier');
  if (attachment >= 0.62) reasons.push('attachment_to_home');
  if (dangerAversion >= 0.28) reasons.push('danger_concern');
  if (foundingGenerationRoot > 0) reasons.push('founder_root');
  if (generationalIndependence > 0) reasons.push('own_generation_future');

  // A high score creates an opportunity, never a deterministic order. Later
  // generations have no founder oath tying them to Ainkrad, so the same
  // willingness is allowed to turn into action a little more often. The RNG
  // roll and the independent decision at camp still preserve refusal twice.
  const acceptanceChance = clamp01(
    agent.life.generation === 0
      ? Math.max(0, willingness - 0.32) * 0.72
      : 0.06 + Math.max(0, willingness - 0.4) * 0.95,
  );
  return {
    agentId: agent.id,
    willingness,
    acceptsExpedition: willingness >= 0.5 && clamp01(roll) < acceptanceChance,
    reasons,
  };
}

/**
 * Reconsider settlement after the volunteers have physically reached camp.
 * Their prior voluntary commitment matters, but it is not a command: injury,
 * exhaustion, stress and newly visible danger can still make anyone return.
 */
export function decideFrontierSettlementAtCampV18(
  state: Readonly<WorldState>,
  agent: Readonly<AgentState>,
  originSettlementId: string,
  site: Readonly<V18SiteAppraisal>,
  roll: number,
): V18CampSettlementDecision {
  const departure = decideFrontierExpeditionV18(
    state,
    agent,
    originSettlementId,
    site,
    1,
  );
  const dangerAversion = site.danger * (1 - agent.personality.riskTolerance);
  const readiness = clamp01(
    departure.willingness * 0.5 +
      0.32 +
      agent.needs.purpose * 0.08 +
      agent.life.health * 0.05 +
      agent.energy * 0.05 +
      site.score * 0.08 -
      agent.stress * 0.18 -
      dangerAversion * 0.15,
  );
  const acceptanceChance = clamp01(
    0.18 + readiness * 0.72 - agent.stress * 0.2 - dangerAversion * 0.12,
  );
  const reasons = [...departure.reasons, 'prior_voluntary_commitment'];
  if (agent.energy < 0.28) reasons.push('camp_exhaustion');
  if (agent.stress > 0.62) reasons.push('camp_stress');
  if (dangerAversion >= 0.28) reasons.push('danger_reconsidered');

  return {
    agentId: agent.id,
    readiness,
    acceptanceChance,
    acceptsSettlement:
      readiness >= 0.48 && clamp01(roll) < acceptanceChance,
    reasons,
  };
}

export function expeditionProvisionShareV18(
  memberCount: number,
  routeDistance: number,
): number {
  return Math.min(0.32, 0.025 + memberCount * 0.014 + routeDistance * 0.006);
}
