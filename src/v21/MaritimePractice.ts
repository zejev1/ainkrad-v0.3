import type { AgentState, V15WorldItemState, WorldState } from '../world/types';
import { ensureSettlementEconomyV16 } from '../v16/SocietyFoundationV16';
import { RULID_HARBOR_ID } from '../world/RulidHarbor';

export const BOAT_KNOWLEDGE_ID = 'boatbuilding-timber-hull';
export const FISHING_KNOWLEDGE_ID = 'fishing-handline-and-habitat';

export type VesselDesignV22 = 'coastal_skiff' | 'sailing_boat' | 'coastal_ship';

export const VESSEL_DESIGNS_V22 = {
  coastal_skiff: {
    name: 'Прибрежная рыбацкая лодка', laborMinutes: 4_800, wood: 0.8, stone: 0.08,
    passengers: 2, cargoKg: 300, range: 60, seaworthiness: 0.34,
    minCraft: 0.25, minKnowledge: 0.35, priorExperience: 0,
  },
  sailing_boat: {
    name: 'Парусная мореходная лодка', laborMinutes: 13_000, wood: 2.4, stone: 0.16,
    passengers: 5, cargoKg: 950, range: 180, seaworthiness: 0.58,
    minCraft: 0.42, minKnowledge: 0.52, priorExperience: 0.12,
  },
  coastal_ship: {
    name: 'Прибрежный парусный корабль', laborMinutes: 32_000, wood: 5.8, stone: 0.42,
    passengers: 12, cargoKg: 3_000, range: 480, seaworthiness: 0.78,
    minCraft: 0.58, minKnowledge: 0.7, priorExperience: 0.3,
  },
} as const;

const DESIGN_ORDER: VesselDesignV22[] = ['coastal_skiff', 'sailing_boat', 'coastal_ship'];
const designRank = (design: VesselDesignV22 | undefined) => Math.max(0, DESIGN_ORDER.indexOf(design ?? 'coastal_skiff'));

export function maritimeUnderstanding(world: Readonly<WorldState>, agentId: string, knowledgeId: string): number {
  return world.v18?.secretLibrary.knowledgeByAgentId[agentId]?.find(r => r.knowledgeId === knowledgeId)?.understanding ?? 0;
}

export function vesselDesignV22(item: Readonly<V15WorldItemState>): VesselDesignV22 {
  return item.boat?.design ?? 'coastal_skiff';
}

export function vesselCapabilitiesV22(item: Readonly<V15WorldItemState>) {
  const defaults = VESSEL_DESIGNS_V22[vesselDesignV22(item)];
  return {
    passengers: item.boat?.passengerCapacity ?? defaults.passengers,
    cargoKg: item.boat?.cargoCapacityKg ?? defaults.cargoKg,
    range: item.boat?.range ?? defaults.range,
    seaworthiness: item.boat?.seaworthiness ?? defaults.seaworthiness,
  };
}

function ownedCompletedBoats(world: Readonly<WorldState>, agentId: string): V15WorldItemState[] {
  return Object.values(world.v15?.items ?? {}).filter(item => item.ownerAgentId === agentId && item.boat?.completed)
    .sort((a,b)=>designRank(vesselDesignV22(b))-designRank(vesselDesignV22(a)) || (b.boat?.designExperience??0)-(a.boat?.designExperience??0));
}

function nextDesign(world: Readonly<WorldState>, agent: Readonly<AgentState>): VesselDesignV22 | undefined {
  const knowledge = maritimeUnderstanding(world, agent.id, BOAT_KNOWLEDGE_ID);
  const completed = ownedCompletedBoats(world, agent.id);
  if (!completed.length) return knowledge >= VESSEL_DESIGNS_V22.coastal_skiff.minKnowledge && agent.skills.craft >= VESSEL_DESIGNS_V22.coastal_skiff.minCraft
    ? 'coastal_skiff' : undefined;
  const best = completed[0], rank = designRank(vesselDesignV22(best));
  if (rank >= DESIGN_ORDER.length - 1) return undefined;
  const candidate = DESIGN_ORDER[rank + 1], spec = VESSEL_DESIGNS_V22[candidate];
  return (best.boat?.designExperience ?? 0) >= spec.priorExperience && knowledge >= spec.minKnowledge && agent.skills.craft >= spec.minCraft
    ? candidate : undefined;
}

/** This offers a work destination, never assigns work or reveals unknown water. */
export function boatWorkSite(world: Readonly<WorldState>, agent: Readonly<AgentState>): string | undefined {
  if (!agent.life.alive || agent.life.ageYears < 18 || agent.skills.craft < 0.25 ||
      maritimeUnderstanding(world, agent.id, BOAT_KNOWLEDGE_ID) < 0.35) return;
  const active = Object.values(world.v15?.items ?? {}).find(item => item.ownerAgentId === agent.id && item.boat && !item.boat.completed);
  if (active) return active.locationId;
  const completed = ownedCompletedBoats(world, agent.id);
  const repair = completed.find(item => !item.boat!.journey && (item.boat!.condition ?? 1) < 0.95);
  if (repair) return repair.locationId;
  const design = nextDesign(world, agent);
  if (!design) return undefined;
  const known = new Set(agent.knownPlaceIds ?? []);
  const harbor = world.places[RULID_HARBOR_ID];
  const homeSettlement = world.places[agent.homeId]?.settlementId;
  if (harbor && homeSettlement === 'settlement_rulid') {
    if (known.has(RULID_HARBOR_ID)) return RULID_HARBOR_ID;
    if (design === 'coastal_ship') return undefined;
  }
  return [...known].map(id => world.places[id]).filter(place => place?.surface === 'shore' &&
    Math.hypot(place.mapX - agent.position.x, place.mapY - agent.position.y) < 12)
    .sort((a, b) => Math.hypot(a.mapX - agent.position.x, a.mapY - agent.position.y) -
      Math.hypot(b.mapX - agent.position.x, b.mapY - agent.position.y))[0]?.id;
}

/** A real, finite material project. Better vessels are not unlocked by a menu:
 * a Spark must first build, sail and learn from the previous design. */
export function workOnBoat(world: WorldState, agent: AgentState): boolean {
  const site = boatWorkSite(world, agent);
  const settlementId = world.places[agent.homeId]?.settlementId;
  if (!world.v15 || !site || agent.locationId !== site || agent.movement || !settlementId) return false;
  const economy = ensureSettlementEconomyV16(world, settlementId);
  let item = Object.values(world.v15.items).find(i => i.ownerAgentId === agent.id && i.boat && !i.boat.completed);
  const minute = world.calendar.elapsedWorldMinutes;
  if (!item) {
    const repair = ownedCompletedBoats(world, agent.id).find(i=>!i.boat!.journey&&(i.boat!.condition??1)<.95);
    if (repair) {
      if(economy.stocks.wood<.03)return false;
      economy.stocks.wood-=.03; repair.boat!.condition=Math.min(1,(repair.boat!.condition??1)+.12);
      repair.boat!.lastWorkedMinute=minute;agent.energy=Math.max(0,agent.energy-.025);return true;
    }
    const design = nextDesign(world, agent); if (!design) return false;
    const spec = VESSEL_DESIGNS_V22[design];
    // Housing and food remain higher priority than shipbuilding.
    if (economy.activeHumanHomeProject || economy.stocks.wood < spec.wood + 0.4 || economy.stocks.stone < spec.stone) return false;
    economy.stocks.wood -= spec.wood; economy.stocks.stone -= spec.stone;
    const id = `boat:${world.id}:${++world.v15.itemSequence}`;
    item = world.v15.items[id] = {
      id, kind: 'artifact', name: `Строится: ${spec.name}`, ownerAgentId: agent.id,
      createdByAgentId: agent.id, createdWorldMinute: minute, locationId: site,
      quality: 0, effectiveness: 0, reliability: 0,
      description: 'Материалы собраны на берегу; судно ещё не пригодно к плаванию.',
      boat: { laborMinutes: 0, requiredLaborMinutes: spec.laborMinutes, lastWorkedMinute: minute, completed: false,
        design, designExperience: 0, passengerCapacity: spec.passengers, cargoCapacityKg: spec.cargoKg,
        range: spec.range, seaworthiness: spec.seaworthiness },
    };
    return true;
  }
  const project = item.boat!;
  if (minute <= project.lastWorkedMinute) return false;
  const effort = Math.min(8 * 60, minute - project.lastWorkedMinute) *
    (0.25 + agent.skills.craft * 0.5 + maritimeUnderstanding(world, agent.id, BOAT_KNOWLEDGE_ID) * 0.25);
  project.lastWorkedMinute = minute;
  project.laborMinutes = Math.min(project.requiredLaborMinutes, project.laborMinutes + effort);
  project.completed = project.laborMinutes >= project.requiredLaborMinutes;
  if (project.completed) {
    const spec = VESSEL_DESIGNS_V22[vesselDesignV22(item)];
    item.name = spec.name;
    item.quality = Math.min(1, 0.2 + agent.skills.craft * 0.6 + maritimeUnderstanding(world,agent.id,BOAT_KNOWLEDGE_ID)*.12);
    item.reliability = Math.min(1,item.quality*.85+spec.seaworthiness*.15);
    item.effectiveness = Math.min(1,item.quality * 0.6 + designRank(vesselDesignV22(item))*.12);
    project.condition=1;
    item.description = `${spec.name}: до ${spec.passengers} взрослых, около ${spec.cargoKg} кг груза; дальность и мореходность получены из реально освоенной конструкции.`;
  }
  agent.energy = Math.max(0, agent.energy - 0.04);
  agent.skills.craft = Math.min(1, agent.skills.craft + effort / 100000);
  return true;
}
