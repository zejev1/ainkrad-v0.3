import type { AgentState, WorldState } from '../world/types';
import { ensureSettlementEconomyV16 } from '../v16/SocietyFoundationV16';

export const BOAT_KNOWLEDGE_ID = 'boatbuilding-timber-hull';
export const FISHING_KNOWLEDGE_ID = 'fishing-handline-and-habitat';

export function maritimeUnderstanding(world: Readonly<WorldState>, agentId: string, knowledgeId: string): number {
  return world.v18?.secretLibrary.knowledgeByAgentId[agentId]?.find(r => r.knowledgeId === knowledgeId)?.understanding ?? 0;
}

/** This offers a work destination, never assigns work or reveals unknown water. */
export function boatWorkSite(world: Readonly<WorldState>, agent: Readonly<AgentState>): string | undefined {
  if (!agent.life.alive || agent.life.ageYears < 18 || agent.skills.craft < 0.25 ||
      maritimeUnderstanding(world, agent.id, BOAT_KNOWLEDGE_ID) < 0.35) return;
  const complete=Object.values(world.v15?.items??{}).find(item=>item.ownerAgentId===agent.id&&item.boat?.completed);
  if(complete)return !complete.boat!.journey&&(complete.boat!.condition??1)<.95?complete.locationId:undefined;
  const active = Object.values(world.v15?.items ?? {}).find(item => item.ownerAgentId === agent.id && item.boat);
  if (active) return active.locationId;
  return (agent.knownPlaceIds ?? []).map(id => world.places[id]).filter(place => place?.surface === 'shore' &&
    Math.hypot(place.mapX - agent.position.x, place.mapY - agent.position.y) < 12)
    .sort((a, b) => Math.hypot(a.mapX - agent.position.x, a.mapY - agent.position.y) -
      Math.hypot(b.mapX - agent.position.x, b.mapY - agent.position.y))[0]?.id;
}

/** A real, finite material project. Reading alone cannot create a vessel;
 * only chosen work at its bank contributes, and duplicate minutes do not. */
export function workOnBoat(world: WorldState, agent: AgentState): boolean {
  const site = boatWorkSite(world, agent);
  const settlementId = world.places[agent.homeId]?.settlementId;
  if (!world.v15 || !site || agent.locationId !== site || agent.movement || !settlementId) return false;
  const economy = ensureSettlementEconomyV16(world, settlementId);
  let item = Object.values(world.v15.items).find(i => i.ownerAgentId === agent.id && i.boat);
  const minute = world.calendar.elapsedWorldMinutes;
  if (!item) {
    // Do not consume the town's final food or its active housing reserve.
    if (economy.activeHumanHomeProject || economy.stocks.wood < 1.2 || economy.stocks.stone < 0.08) return false;
    economy.stocks.wood -= 0.8;
    economy.stocks.stone -= 0.08;
    const id = `boat:${world.id}:${++world.v15.itemSequence}`;
    item = world.v15.items[id] = {
      id, kind: 'artifact', name: 'Строящаяся прибрежная лодка', ownerAgentId: agent.id,
      createdByAgentId: agent.id, createdWorldMinute: minute, locationId: site,
      quality: 0, effectiveness: 0, reliability: 0,
      description: 'Материалы подготовлены на берегу; корпус ещё не готов к использованию.',
      boat: { laborMinutes: 0, requiredLaborMinutes: 4800, lastWorkedMinute: minute, completed: false },
    };
    return true;
  }
  const project = item.boat!;
  if (minute <= project.lastWorkedMinute) return false;
  if(project.completed) {
    if(economy.stocks.wood<.03||project.journey)return false;
    economy.stocks.wood-=.03;project.condition=Math.min(1,(project.condition??1)+.12);
    project.lastWorkedMinute=minute;agent.energy=Math.max(0,agent.energy-.025);return true;
  }
  // One selected work session contributes at most eight hours, regardless of
  // elapsed travel, sleep or browser catch-up between sessions.
  const effort = Math.min(8 * 60, minute - project.lastWorkedMinute) *
    (0.25 + agent.skills.craft * 0.5 + maritimeUnderstanding(world, agent.id, BOAT_KNOWLEDGE_ID) * 0.25);
  project.lastWorkedMinute = minute;
  project.laborMinutes = Math.min(project.requiredLaborMinutes, project.laborMinutes + effort);
  project.completed = project.laborMinutes >= project.requiredLaborMinutes;
  if (project.completed) {
    item.name = 'Прибрежная рыбацкая лодка';
    item.quality = Math.min(1, 0.2 + agent.skills.craft * 0.6);
    item.reliability = item.quality;
    item.effectiveness = item.quality * 0.6;
    project.condition=1;
    item.description = 'Гребная лодка: рыбалка на воде, разведка берегов и перевозка до двух взрослых с грузом в пределах грузоподъёмности 300 кг. Требует ухода; в шторм выход опасен.';
  }
  agent.energy = Math.max(0, agent.energy - 0.04);
  agent.skills.craft = Math.min(1, agent.skills.craft + effort / 100000);
  return true;
}
