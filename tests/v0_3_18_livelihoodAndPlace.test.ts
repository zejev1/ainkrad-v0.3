import { describe, expect, it } from 'vitest';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';
import { allowedActionsForAgeV16 } from '../src/v16/SocietyFoundationV16';

describe('v0.3.18 truthful livelihoods and workplaces', () => {
  it('lets older children choose bounded chores without adult hunting', () => {
    const humanActions = allowedActionsForAgeV16('human', 9);
    expect(humanActions.has('gather')).toBe(true);
    expect(humanActions.has('work')).toBe(true);
    expect(humanActions.has('hunt')).toBe(false);
    expect(humanActions.has('bond')).toBe(false);
  });

  it('records production only after arrival at a compatible physical place', async () => {
    const store = new InMemoryWorldStore();
    const worldId = 'v18-truthful-workplaces';
    const world = await WorldEngine.create({
      worldId,
      seed: 'v18-truthful-workplaces',
      store,
    });

    await world.advanceCanonicalTimeTo(12 * WORLD_MINUTES_PER_YEAR);
    const snapshot = world.snapshot();
    const events = await store.history(worldId);
    const gathered = events.filter((event) => event.kind === 'agent.gathered');
    const worked = events.filter((event) => event.kind === 'agent.worked');
    const prayed = events.filter((event) => event.kind === 'agent.prayed');
    const travelled = events.filter(
      (event) => event.kind === 'agent.travel.started',
    );

    expect(gathered.length).toBeGreaterThan(0);
    expect(worked.length).toBeGreaterThan(0);
    expect(travelled.length).toBeGreaterThan(0);
    for (const event of gathered) {
      const place = snapshot.places[String(event.payload.locationId)];
      expect(place).toBeDefined();
      expect(place.kind).not.toBe('workshop');
      expect(
        place.kind === 'resource_field' ||
          place.kind === 'meadow' ||
          place.kind === 'forest' ||
          place.kind === 'mountains' ||
          place.kind === 'ruins' ||
          place.kind === 'swamp' ||
          place.biome === 'plains' ||
          place.biome === 'forest',
      ).toBe(true);
    }
    for (const event of worked) {
      expect(snapshot.places[String(event.payload.locationId)]?.kind).toBe(
        'workshop',
      );
    }
    for (const event of prayed) {
      expect(['quiet_space', 'ruins']).toContain(
        snapshot.places[String(event.payload.locationId)]?.kind,
      );
    }
    expect(
      travelled.every(
        (event) =>
          event.payload.physicalArrivalRequired === true &&
          event.payload.fromPlaceId !== event.payload.destinationId,
      ),
    ).toBe(true);
  }, 20_000);
});
