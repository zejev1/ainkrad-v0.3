import type { AgentState, RelationshipState, WorldState } from '../world/types';
import type { V19AdventureRank, V19DungeonState } from '../v19/types';

export const DUNGEON_FLOOR_COUNT_V21 = 100;
export const MAX_EXPEDITION_PARTY_SIZE_V21 = 6;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function stableUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function relationshipBetween(
  world: Readonly<WorldState>,
  left: string,
  right: string,
): Readonly<RelationshipState> | undefined {
  return Object.values(world.relationships).find(
    (relationship) =>
      (relationship.agentA === left && relationship.agentB === right) ||
      (relationship.agentA === right && relationship.agentB === left),
  );
}

export function dungeonRankForFloorV21(floor: number): Exclude<V19AdventureRank, 'unranked'> {
  const bounded = Math.max(1, Math.min(DUNGEON_FLOOR_COUNT_V21, Math.floor(floor)));
  if (bounded <= 10) return 'F';
  if (bounded <= 25) return 'E';
  if (bounded <= 40) return 'D';
  if (bounded <= 55) return 'C';
  if (bounded <= 70) return 'B';
  if (bounded <= 85) return 'A';
  return 'S';
}

export function residentCombatCapacityV21(agent: Readonly<AgentState>): number {
  return clamp01(
    agent.life.health * 0.16 +
      agent.energy * 0.12 +
      agent.life.physiology.strength * 0.15 +
      agent.life.physiology.endurance * 0.12 +
      agent.skills.hunting * 0.13 +
      agent.skills.exploration * 0.08 +
      (agent.progression?.combatMastery ?? 0) * 0.18 +
      Math.min(0.06, (agent.progression?.level ?? 1) / 1_200),
  );
}

export interface DungeonRiskAssessmentV21 {
  targetFloor: number;
  floorRank: Exclude<V19AdventureRank, 'unranked'>;
  knownDanger: number;
  partyCapacity: number;
  coordination: number;
  survivalMargin: number;
  recommendation: 'reasonable' | 'dangerous' | 'reckless';
}

export function assessDungeonRiskV21(
  world: Readonly<WorldState>,
  dungeon: Readonly<V19DungeonState>,
  party: readonly Readonly<AgentState>[],
  targetFloor: number,
): DungeonRiskAssessmentV21 {
  const members = party.filter((agent) => agent.life.alive).slice(0, MAX_EXPEDITION_PARTY_SIZE_V21);
  const capacities = members.map(residentCombatCapacityV21);
  const combined = capacities.length === 0
    ? 0
    : 1 - capacities.reduce((remaining, capacity) => remaining * (1 - capacity * 0.48), 1);
  const relationshipStrengths: number[] = [];
  for (let left = 0; left < members.length; left += 1) {
    for (let right = left + 1; right < members.length; right += 1) {
      const relation = relationshipBetween(world, members[left].id, members[right].id);
      if (relation) {
        relationshipStrengths.push(
          clamp01((relation.trust + relation.affinity + relation.respect - relation.conflict) / 3),
        );
      }
    }
  }
  const familiarity = relationshipStrengths.length
    ? relationshipStrengths.reduce((sum, value) => sum + value, 0) / relationshipStrengths.length
    : members.length === 1
      ? 0.35
      : 0.16;
  const roleCoverage = clamp01(
    Number(members.some((agent) => residentCombatCapacityV21(agent) >= 0.58)) * 0.3 +
      Number(members.some((agent) => agent.skills.exploration >= 0.5)) * 0.25 +
      Number(members.some((agent) => agent.skills.social >= 0.5)) * 0.15 +
      Math.min(0.3, members.length * 0.06),
  );
  const coordination = clamp01(familiarity * 0.58 + roleCoverage * 0.42);
  const floor = Math.max(1, Math.min(DUNGEON_FLOOR_COUNT_V21, Math.floor(targetFloor)));
  const bossPressure = floor % 10 === 0 ? 0.09 : 0;
  const knownDanger = clamp01(
    dungeon.threat * 0.48 +
      (floor / DUNGEON_FLOOR_COUNT_V21) * 0.48 +
      bossPressure +
      (members.length === 1 ? 0.08 : 0),
  );
  const partyCapacity = clamp01(combined * (0.82 + coordination * 0.28));
  const survivalMargin = partyCapacity - knownDanger;
  return {
    targetFloor: floor,
    floorRank: dungeonRankForFloorV21(floor),
    knownDanger,
    partyCapacity,
    coordination,
    survivalMargin,
    recommendation: survivalMargin >= 0.08
      ? 'reasonable'
      : survivalMargin >= -0.12
        ? 'dangerous'
        : 'reckless',
  };
}

/** Candidates join only from the same physical entrance and each makes a
 * seeded personal decision. No guild, settlement or Cardinal can insert a
 * member into the returned party. */
export function formVoluntaryDungeonPartyV21(
  world: Readonly<WorldState>,
  leader: Readonly<AgentState>,
  dungeon: Readonly<V19DungeonState>,
  choiceRoll: number,
): AgentState[] {
  const party: AgentState[] = [world.agents[leader.id]].filter(
    (agent): agent is AgentState => Boolean(agent),
  );
  const candidates = Object.values(world.agents)
    .filter(
      (candidate) =>
        candidate.id !== leader.id &&
        candidate.life.alive &&
        candidate.life.stage === 'adult' &&
        candidate.locationId === dungeon.entrancePlaceId &&
        !candidate.movement &&
        candidate.life.health >= 0.5 &&
        candidate.energy >= 0.38 &&
        ((candidate.knownDungeonIds ?? []).includes(dungeon.id) ||
          (candidate.knownPlaceIds ?? []).includes(dungeon.entrancePlaceId)),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const candidate of candidates) {
    if (party.length >= MAX_EXPEDITION_PARTY_SIZE_V21) break;
    const relation = relationshipBetween(world, leader.id, candidate.id);
    const trust = relation
      ? clamp01((relation.trust + relation.affinity + relation.respect - relation.conflict) / 3)
      : 0.12;
    const willingness = clamp01(
      0.04 +
        candidate.personality.riskTolerance * 0.24 +
        candidate.mind.values.care * 0.13 +
        candidate.mind.values.ambition * 0.13 +
        candidate.skills.hunting * 0.12 +
        candidate.skills.exploration * 0.1 +
        trust * 0.24 -
        candidate.mind.emotions.fear * 0.17 -
        candidate.stress * 0.1,
    );
    const personalRoll = (
      Math.max(0, Math.min(0.999999, choiceRoll)) +
      stableUnit(`${world.id}:${dungeon.id}:${candidate.id}:${world.calendar.elapsedWorldMinutes}`)
    ) % 1;
    if (personalRoll < willingness) party.push(candidate);
  }
  return party;
}

