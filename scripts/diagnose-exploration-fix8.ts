import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';
import { residentExplorationTarget } from '../src/world/ResidentExploration';
import type { WorldState } from '../src/world/types';

const fixture = JSON.parse(
  gunzipSync(
    readFileSync(new URL('../tests/fixtures/fix5-year21.json.gz', import.meta.url)),
  ).toString(),
) as WorldState;
fixture.revision = 0;

const store = new InMemoryWorldStore();
await store.initializeWorld(fixture);
const engine = await WorldEngine.open({ worldId: fixture.id, store });

function summarize(state: WorldState) {
  const living = Object.values(state.agents).filter((agent) => agent.life.alive);
  const places = state.places;
  const homeSettlement = (agent: (typeof living)[number]) =>
    places[agent.homeId]?.settlementId;
  const hasPath = (from: string, to: string): boolean => {
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === to) return true;
      for (const next of places[current]?.connectedPlaceIds ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  };
  const outside = living.filter((agent) =>
    places[agent.locationId]?.settlementId !== homeSettlement(agent),
  );
  const movingOutside = living.filter((agent) => {
    const destination = agent.movement?.targetPlaceId;
    return destination && places[destination]?.settlementId !== homeSettlement(agent);
  });
  const knowsOutside = living.filter((agent) =>
    (agent.knownPlaceIds ?? []).some(
      (placeId) => places[placeId]?.settlementId !== homeSettlement(agent),
    ),
  );
  const byRace = Object.fromEntries(
    [...new Set(living.map((agent) => agent.race))].sort().map((race) => {
      const residents = living.filter((agent) => agent.race === race);
      return [race, {
        living: residents.length,
        outside: residents.filter((agent) =>
          places[agent.locationId]?.settlementId !== homeSettlement(agent),
        ).length,
        knowsOutside: residents.filter((agent) =>
          (agent.knownPlaceIds ?? []).some(
            (placeId) => places[placeId]?.settlementId !== homeSettlement(agent),
          ),
        ).length,
        choseExplore: residents.filter((agent) => agent.lastDecision?.action === 'explore').length,
      }];
    }),
  );
  const lastDecisions = Object.fromEntries(
    [...new Set(living.map((agent) => agent.lastDecision?.action ?? 'none'))]
      .sort()
      .map((action) => [
        action,
        living.filter((agent) => (agent.lastDecision?.action ?? 'none') === action).length,
      ]),
  );
  const frontierTargets = living
    .filter((agent) => agent.lastDecision?.action === 'explore')
    .map((agent) => {
      const target = places[residentExplorationTarget(
        state,
        agent,
        (placeId) => hasPath(agent.locationId, placeId),
        state.v18?.livelihoodByAgentId[agent.id]?.mappedPlaceIds ?? [],
      )];
      return {
        agentId: agent.id,
        race: agent.race,
        current: agent.locationId,
        currentKind: places[agent.locationId]?.kind,
        target: target?.id,
        targetKind: target?.kind,
        targetSettlement: target?.settlementId ?? null,
        homeSettlement: homeSettlement(agent) ?? null,
        leavesSettlement: target?.settlementId !== homeSettlement(agent),
      };
    });
  const economies = Object.entries(state.v16?.settlementEconomyById ?? {}).map(
    ([settlementId, economy]) => {
      const residents = living.filter(
        (agent) => homeSettlement(agent) === settlementId,
      ).length;
      const criticalThreshold = Math.max(0.35, residents * 0.035);
      return {
        settlementId,
        residents,
        food: Number(economy.stocks.food.toFixed(3)),
        criticalThreshold: Number(criticalThreshold.toFixed(3)),
        critical: economy.stocks.food < criticalThreshold,
      };
    },
  );
  return {
    year: Number((state.calendar.elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR).toFixed(2)),
    living: living.length,
    outside: outside.length,
    movingOutside: movingOutside.length,
    knowsOutside: knowsOutside.length,
    explorationPlans: living.filter((agent) => agent.plan?.kind === 'explore_frontier').length,
    byRace,
    lastDecisions,
    frontierTargets,
    economies,
  };
}

console.log(JSON.stringify({ phase: 'before', ...summarize(engine.snapshot()) }));
const before = engine.snapshot().calendar.elapsedWorldMinutes;
const years = Number(process.env.DIAG_YEARS ?? '1');
await engine.advanceCanonicalTimeTo(before + WORLD_MINUTES_PER_YEAR * years);
const after = engine.snapshot();
const history = await store.history(after.id);
console.log(
  JSON.stringify({
    phase: `after-${years}-years`,
    ...summarize(after),
    exploreEvents: history.filter((event) => event.kind === 'agent.explored').length,
    discoveries: history.filter((event) => event.kind === 'world.region.discovered').length,
    exploredLocations: [
      ...new Set(
        history
          .filter((event) => event.kind === 'agent.explored')
          .map((event) => String(event.payload.locationId ?? '')),
      ),
    ],
  }),
);
