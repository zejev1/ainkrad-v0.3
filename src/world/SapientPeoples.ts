import {
  orientedRouteWaypoints,
  rebuildWorldRoutes,
  routeIdBetween,
} from './WorldNavigation';
import type {
  AgentPersonality,
  AgentPhysiologyState,
  AgentRace,
  AgentSkills,
  AgentState,
  WorldBiome,
  WorldPoint2D,
  WorldState,
} from './types';

export interface SapientPeopleFoundation {
  singularLabel: string;
  pluralLabel: string;
  homelandName: string;
  homelandCenter: WorldPoint2D;
  homelandBiomes: readonly WorldBiome[];
  culturalStrengths: readonly string[];
  historicDispositionToHumans:
    | 'home'
    | 'friendly'
    | 'wary'
    | 'hostile';
  lifespanBaseYears: number;
  founderCombatMastery: number;
  personalityRanges: Readonly<
    Record<keyof AgentPersonality, readonly [number, number]>
  >;
  skillRanges: Readonly<Record<keyof AgentSkills, readonly [number, number]>>;
  physiologyScale: Readonly<Record<keyof AgentPhysiologyState, number>>;
}

const HUMAN_CENTER = { x: 50, y: 50 } as const;

/**
 * One map unit is 100 metres. These six vertices form a regular hexagon:
 * every pair of founding peoples is 100-200 km apart. Elves and dwarves
 * begin on the nearer western vertices; hostile or wary peoples begin deeper
 * beyond them. Geography is physical, not a cosmetic map offset.
 */
export const SAPIENT_PEOPLE_FOUNDATIONS: Readonly<
  Record<AgentRace, SapientPeopleFoundation>
> = {
  human: {
    singularLabel: 'человек',
    pluralLabel: 'люди',
    homelandName: 'Айнкрад',
    homelandCenter: HUMAN_CENTER,
    homelandBiomes: ['plains', 'forest', 'river'],
    culturalStrengths: ['обучение', 'земледелие', 'строительство'],
    historicDispositionToHumans: 'home',
    lifespanBaseYears: 82,
    founderCombatMastery: 0.08,
    personalityRanges: {
      sociability: [0.3, 0.82], diligence: [0.3, 0.86], curiosity: [0.28, 0.86],
      generosity: [0.24, 0.82], resilience: [0.42, 0.9], riskTolerance: [0.3, 0.82],
    },
    skillRanges: {
      gathering: [0.18, 0.45], hunting: [0.18, 0.46], craft: [0.18, 0.46],
      social: [0.22, 0.5], exploration: [0.2, 0.52],
    },
    physiologyScale: { strength: 1, endurance: 1, mobility: 1, recovery: 1 },
  },
  elf: {
    singularLabel: 'эльф',
    pluralLabel: 'эльфы',
    homelandName: 'Лесной Совет',
    homelandCenter: { x: -7950, y: 8050 },
    homelandBiomes: ['forest', 'plains', 'river'],
    culturalStrengths: ['лесоводство', 'исцеление', 'дальние пути'],
    historicDispositionToHumans: 'friendly',
    lifespanBaseYears: 225,
    founderCombatMastery: 0.14,
    personalityRanges: {
      sociability: [0.38, 0.82], diligence: [0.36, 0.82], curiosity: [0.56, 0.94],
      generosity: [0.38, 0.86], resilience: [0.48, 0.9], riskTolerance: [0.34, 0.78],
    },
    skillRanges: {
      gathering: [0.24, 0.48], hunting: [0.26, 0.52], craft: [0.24, 0.5],
      social: [0.34, 0.62], exploration: [0.46, 0.72],
    },
    physiologyScale: { strength: 0.92, endurance: 1.08, mobility: 1.2, recovery: 1.14 },
  },
  dwarf: {
    singularLabel: 'гном',
    pluralLabel: 'гномы',
    homelandName: 'Каменные Залы',
    homelandCenter: { x: -9450, y: -6450 },
    homelandBiomes: ['mountains', 'ancient_ruins'],
    culturalStrengths: ['горное дело', 'кузнечное ремесло', 'каменное строительство'],
    historicDispositionToHumans: 'friendly',
    lifespanBaseYears: 155,
    founderCombatMastery: 0.17,
    personalityRanges: {
      sociability: [0.26, 0.7], diligence: [0.58, 0.96], curiosity: [0.3, 0.72],
      generosity: [0.28, 0.74], resilience: [0.62, 0.97], riskTolerance: [0.28, 0.68],
    },
    skillRanges: {
      gathering: [0.2, 0.44], hunting: [0.2, 0.44], craft: [0.48, 0.76],
      social: [0.2, 0.48], exploration: [0.28, 0.56],
    },
    physiologyScale: { strength: 1.16, endurance: 1.22, mobility: 0.88, recovery: 1.1 },
  },
  goblin: {
    singularLabel: 'гоблин',
    pluralLabel: 'гоблины',
    homelandName: 'Зелёные Кланы',
    homelandCenter: { x: -19950, y: 3550 },
    homelandBiomes: ['plains', 'forest', 'swamp'],
    culturalStrengths: ['засады', 'собирательство', 'приспособление'],
    historicDispositionToHumans: 'hostile',
    lifespanBaseYears: 68,
    founderCombatMastery: 0.13,
    personalityRanges: {
      sociability: [0.34, 0.78], diligence: [0.28, 0.78], curiosity: [0.34, 0.82],
      generosity: [0.18, 0.62], resilience: [0.48, 0.9], riskTolerance: [0.5, 0.94],
    },
    skillRanges: {
      gathering: [0.28, 0.52], hunting: [0.32, 0.6], craft: [0.2, 0.48],
      social: [0.18, 0.46], exploration: [0.36, 0.66],
    },
    physiologyScale: { strength: 0.9, endurance: 1.02, mobility: 1.15, recovery: 1.06 },
  },
  orc: {
    singularLabel: 'орк',
    pluralLabel: 'орки',
    homelandName: 'Каменный Клан',
    homelandCenter: { x: -23950, y: -7950 },
    homelandBiomes: ['mountains', 'ancient_ruins', 'plains'],
    culturalStrengths: ['воинская дисциплина', 'каменное ремесло', 'дальние походы'],
    historicDispositionToHumans: 'hostile',
    lifespanBaseYears: 92,
    founderCombatMastery: 0.22,
    personalityRanges: {
      sociability: [0.26, 0.72], diligence: [0.42, 0.88], curiosity: [0.24, 0.68],
      generosity: [0.18, 0.64], resilience: [0.62, 0.97], riskTolerance: [0.58, 0.96],
    },
    skillRanges: {
      gathering: [0.18, 0.42], hunting: [0.38, 0.66], craft: [0.26, 0.54],
      social: [0.16, 0.44], exploration: [0.32, 0.62],
    },
    physiologyScale: { strength: 1.2, endurance: 1.16, mobility: 0.98, recovery: 1.08 },
  },
  ogre: {
    singularLabel: 'огр',
    pluralLabel: 'огры',
    homelandName: 'Долина Великанов',
    homelandCenter: { x: -34450, y: 4350 },
    homelandBiomes: ['swamp', 'mountains', 'ancient_ruins'],
    culturalStrengths: ['тяжёлое строительство', 'охота', 'стойкость'],
    historicDispositionToHumans: 'wary',
    lifespanBaseYears: 118,
    founderCombatMastery: 0.2,
    personalityRanges: {
      sociability: [0.2, 0.66], diligence: [0.34, 0.8], curiosity: [0.2, 0.64],
      generosity: [0.22, 0.7], resilience: [0.68, 0.99], riskTolerance: [0.42, 0.86],
    },
    skillRanges: {
      gathering: [0.2, 0.46], hunting: [0.36, 0.64], craft: [0.24, 0.54],
      social: [0.14, 0.4], exploration: [0.22, 0.5],
    },
    physiologyScale: { strength: 1.3, endurance: 1.26, mobility: 0.82, recovery: 1.12 },
  },
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function raceFounderPersonality(
  race: AgentRace,
  between: (minimum: number, maximum: number) => number,
): AgentPersonality {
  const ranges = SAPIENT_PEOPLE_FOUNDATIONS[race].personalityRanges;
  return {
    sociability: between(...ranges.sociability),
    diligence: between(...ranges.diligence),
    curiosity: between(...ranges.curiosity),
    generosity: between(...ranges.generosity),
    resilience: between(...ranges.resilience),
    riskTolerance: between(...ranges.riskTolerance),
  };
}

export function raceFounderSkills(
  race: AgentRace,
  between: (minimum: number, maximum: number) => number,
): AgentSkills {
  const ranges = SAPIENT_PEOPLE_FOUNDATIONS[race].skillRanges;
  return {
    gathering: between(...ranges.gathering),
    hunting: between(...ranges.hunting),
    craft: between(...ranges.craft),
    social: between(...ranges.social),
    exploration: between(...ranges.exploration),
  };
}

export function racePhysiology(
  race: AgentRace,
  baseline: Readonly<AgentPhysiologyState>,
): AgentPhysiologyState {
  const scale = SAPIENT_PEOPLE_FOUNDATIONS[race].physiologyScale;
  return {
    strength: clamp01(baseline.strength * scale.strength),
    endurance: clamp01(baseline.endurance * scale.endurance),
    mobility: clamp01(baseline.mobility * scale.mobility),
    recovery: clamp01(baseline.recovery * scale.recovery),
  };
}

export interface InitialRaceDiplomacy {
  familiarity: number;
  trust: number;
  fear: number;
  grievance: number;
  cooperation: number;
  hostility: number;
}

export function initialRaceDiplomacy(
  raceA: AgentRace | undefined,
  raceB: AgentRace | undefined,
): InitialRaceDiplomacy {
  if (!raceA || !raceB || raceA === raceB) {
    return { familiarity: 0, trust: 0.5, fear: 0, grievance: 0, cooperation: 0, hostility: 0 };
  }
  const other = raceA === 'human' ? raceB : raceB === 'human' ? raceA : undefined;
  const disposition = other
    ? SAPIENT_PEOPLE_FOUNDATIONS[other].historicDispositionToHumans
    : 'wary';
  if (disposition === 'friendly') {
    return { familiarity: 0.08, trust: 0.66, fear: 0.03, grievance: 0, cooperation: 0.12, hostility: 0.02 };
  }
  if (disposition === 'hostile') {
    const orcish = other === 'orc';
    return {
      familiarity: 0.08,
      trust: orcish ? 0.14 : 0.2,
      fear: orcish ? 0.3 : 0.24,
      grievance: orcish ? 0.42 : 0.34,
      cooperation: 0,
      hostility: orcish ? 0.6 : 0.5,
    };
  }
  return { familiarity: 0.04, trust: 0.36, fear: 0.18, grievance: 0.08, cooperation: 0.01, hostility: 0.2 };
}

export function settlementFoundingRace(
  world: Readonly<WorldState>,
  settlementId: string,
): AgentRace | undefined {
  if (settlementId === 'settlement_ainkrad') return 'human';
  for (const race of Object.keys(SAPIENT_PEOPLE_FOUNDATIONS) as AgentRace[]) {
    if (settlementId === `settlement_${race}_homeland`) return race;
  }
  const counts = new Map<AgentRace, number>();
  for (const agent of Object.values(world.agents)) {
    if (world.places[agent.homeId]?.settlementId !== settlementId) continue;
    const race = agent.race ?? 'human';
    counts.set(race, (counts.get(race) ?? 0) + 1);
  }
  return [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0]?.[0];
}

function routePath(
  world: Readonly<WorldState>,
  fromId: string,
  toId: string,
): string[] | undefined {
  if (fromId === toId) return [fromId];
  const queue = [fromId];
  const prior = new Map<string, string | undefined>([[fromId, undefined]]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const connected of world.places[current]?.connectedPlaceIds ?? []) {
      if (prior.has(connected) || !world.routes[routeIdBetween(current, connected)]) continue;
      prior.set(connected, current);
      if (connected === toId) {
        const path = [toId];
        let cursor: string | undefined = current;
        while (cursor !== undefined) {
          path.push(cursor);
          cursor = prior.get(cursor);
        }
        return path.reverse();
      }
      queue.push(connected);
    }
  }
  return undefined;
}

function rebuildAffectedMovement(world: WorldState, agent: AgentState): void {
  const movement = agent.movement;
  if (!movement) return;
  const path = routePath(world, agent.locationId, movement.targetPlaceId);
  if (!path) {
    agent.movement = undefined;
    return;
  }
  const waypoints: WorldPoint2D[] = [{ x: agent.position.x, y: agent.position.y }];
  for (let index = 0; index < path.length - 1; index += 1) {
    const fromId = path[index];
    const route = world.routes[routeIdBetween(fromId, path[index + 1])];
    if (!route) continue;
    waypoints.push(...orientedRouteWaypoints(route, fromId).slice(1));
  }
  movement.waypoints = waypoints;
  movement.nextWaypointIndex = Math.min(1, Math.max(0, waypoints.length - 1));
}

/**
 * One-time, idempotent repair for v0.3.18/v0.3.19 saves whose generated
 * homelands were only 11-23 km from Ainkrad. Identity, memories, inventories,
 * ages, Cardinal history and world time are untouched.
 */
export function repairSapientHomelandGeography(world: WorldState): number {
  const movedSettlementIds = new Set<string>();
  const deltaBySettlement = new Map<string, WorldPoint2D>();
  for (const race of Object.keys(SAPIENT_PEOPLE_FOUNDATIONS) as AgentRace[]) {
    if (race === 'human') continue;
    const settlementId = `settlement_${race}_homeland`;
    const center = world.places[settlementId];
    if (!center) continue;
    const target = SAPIENT_PEOPLE_FOUNDATIONS[race].homelandCenter;
    const delta = { x: target.x - center.mapX, y: target.y - center.mapY };
    if (Math.hypot(delta.x, delta.y) < 0.001) continue;
    movedSettlementIds.add(settlementId);
    deltaBySettlement.set(settlementId, delta);
    for (const place of Object.values(world.places)) {
      if (place.settlementId !== settlementId) continue;
      place.mapX += delta.x;
      place.mapY += delta.y;
      if (place.boundaryPolygon) {
        place.boundaryPolygon = place.boundaryPolygon.map((point) => ({
          x: point.x + delta.x,
          y: point.y + delta.y,
        }));
      }
    }
    const settlement = world.settlements[settlementId];
    if (settlement) {
      settlement.centerX = target.x;
      settlement.centerY = target.y;
    }
  }
  if (movedSettlementIds.size === 0) return 0;

  world.routes = rebuildWorldRoutes(world.places, world.routes);
  for (const agent of Object.values(world.agents)) {
    const locationSettlement = world.places[agent.locationId]?.settlementId;
    const delta = locationSettlement
      ? deltaBySettlement.get(locationSettlement)
      : undefined;
    if (delta) {
      agent.position.x += delta.x;
      agent.position.y += delta.y;
    }
    const targetSettlement = agent.movement
      ? world.places[agent.movement.targetPlaceId]?.settlementId
      : undefined;
    if (delta || (targetSettlement && movedSettlementIds.has(targetSettlement))) {
      rebuildAffectedMovement(world, agent);
    }
  }
  return movedSettlementIds.size;
}
