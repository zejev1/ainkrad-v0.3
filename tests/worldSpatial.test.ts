import { describe, expect, it } from 'vitest';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import {
  rebuildWorldRoutes,
  routeIdBetween,
} from '../src/world/WorldNavigation';
import type { WorldPlace } from '../src/world/types';

describe('Persisted 2D world physics', () => {
  it('builds one compact settlement instead of scattering homes across the map', async () => {
    const world = await WorldEngine.create({
      worldId: 'settlement-layout',
      seed: 'settlement-layout-seed',
      store: new InMemoryWorldStore(),
    });
    const state = world.snapshot();
    const settlement = state.settlements.settlement_ainkrad;

    expect(settlement.centerPlaceId).toBe('commons');
    const homes = Object.values(state.places).filter(
      (place) => place.kind === 'home',
    );
    expect(homes.length).toBeGreaterThan(0);
    for (const home of homes) {
      expect(home.settlementId).toBe(settlement.id);
      expect(
        Math.hypot(
          home.mapX - settlement.centerX,
          home.mapY - settlement.centerY,
        ),
      ).toBeLessThan(settlement.radius);
    }

    const route = state.routes[routeIdBetween('commons', homes[0].id)];
    expect(route.waypoints).toHaveLength(3);
    const [start, middle, end] = route.waypoints;
    const cross =
      (middle.x - start.x) * (end.y - start.y) -
      (middle.y - start.y) * (end.x - start.x);
    expect(Math.abs(cross)).toBeGreaterThan(0.01);
  });

  it('persists an agent position and curved journey across an engine restart', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'persisted-movement',
      seed: 'persisted-movement-seed',
      store,
    });

    let traveller = Object.values(world.snapshot().agents).find(
      (agent) => agent.movement,
    );
    for (let tick = 1; tick <= 40 && !traveller; tick += 1) {
      await world.step(tick);
      traveller = Object.values(world.snapshot().agents).find(
        (agent) => agent.movement,
      );
    }

    expect(traveller?.movement).toBeDefined();
    const destination = world.snapshot().places[traveller!.movement!.targetPlaceId];
    expect(
      Math.hypot(
        traveller!.position.x - destination.mapX,
        traveller!.position.y - destination.mapY,
      ),
    ).toBeGreaterThan(0.01);

    const beforeRestart = world.snapshot();
    const reopened = await WorldEngine.open({
      worldId: beforeRestart.id,
      store,
    });
    expect(reopened.snapshot()).toEqual(beforeRestart);
  });

  it('does not create an implicit walking route through open water', () => {
    const land: WorldPlace = {
      id: 'land',
      name: 'Land',
      kind: 'meadow',
      capacity: 3,
      biome: 'plains',
      mapX: 0,
      mapY: 0,
      connectedPlaceIds: ['water'],
      fertility: 0.5,
      danger: 0.1,
      surface: 'land',
    };
    const water: WorldPlace = {
      id: 'water',
      name: 'Open water',
      kind: 'lake',
      capacity: 3,
      biome: 'lake',
      mapX: 10,
      mapY: 0,
      connectedPlaceIds: ['land'],
      fertility: 0.5,
      danger: 0.1,
      surface: 'water',
    };

    expect(rebuildWorldRoutes({ land, water })).toEqual({});
  });
});
