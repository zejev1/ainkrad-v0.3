import { describe, expect, it } from 'vitest';
import { IndependentWorldClockGateway } from '../src/boundary/WorldClockGateway';
import { IndependentWorldEntryGateway } from '../src/boundary/WorldEntryGateway';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import {
  DEFAULT_WORLD_MINUTES_PER_TICK,
  WORLD_MINUTES_PER_YEAR,
  worldCalendarAtMinutes,
} from '../src/world/WorldClock';
import { WorldEngine } from '../src/world/WorldEngine';

describe('External FLA-like world clock', () => {
  it('advances calendar and biological age by the same persisted duration', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'clock-world',
      seed: 'clock-world-seed',
      store,
    });
    const before = world.snapshot();
    const beforeAge = before.agents.agent_1.life.ageYears;

    await world.step(1, WORLD_MINUTES_PER_YEAR / 2);
    await world.step(2, WORLD_MINUTES_PER_YEAR / 2);

    const after = world.snapshot();
    expect(after.calendar.elapsedWorldMinutes).toBe(WORLD_MINUTES_PER_YEAR);
    expect(after.agents.agent_1.life.ageYears - beforeAge).toBeCloseTo(1, 10);
    expect(worldCalendarAtMinutes(after.calendar.elapsedWorldMinutes)).toMatchObject({
      year: 2,
      dayOfYear: 1,
    });

    const reopened = await WorldEngine.open({ worldId: after.id, store });
    expect(reopened.snapshot().calendar).toEqual(after.calendar);
  });

  it('keeps world-speed authority in an independent validating gateway', () => {
    const gateway = new IndependentWorldClockGateway();
    expect(gateway.current()).toMatchObject({
      speedId: 'year_per_minute',
      multiplier: 1,
      worldMinutesPerTick: DEFAULT_WORLD_MINUTES_PER_TICK,
    });
    expect(gateway.set('real_time', 10)).toMatchObject({
      speedId: 'real_time',
      multiplier: 10,
    });
    expect(() => gateway.set('cardinal_override', 1)).toThrow(
      'Unknown external world-speed preset',
    );
    expect(gateway.set('year_per_minute', 100)).toMatchObject({
      speedId: 'year_per_minute',
      multiplier: 100,
    });
  });
});

describe('Human-like bodies and growing civilization', () => {
  it('lets a young body peak and an older body become physically weaker', async () => {
    const world = await WorldEngine.create({
      worldId: 'physiology-world',
      seed: 'physiology-world-seed',
      store: new InMemoryWorldStore(),
    });
    const young = world.snapshot().agents.agent_1;

    await world.step(1, WORLD_MINUTES_PER_YEAR * 40);

    const older = world.snapshot().agents.agent_1;
    expect(older.life.ageYears - young.life.ageYears).toBeCloseTo(40, 10);
    expect(older.life.stage).toBe('adult');
    expect(older.life.physiology.strength).toBeLessThan(
      young.life.physiology.strength,
    );
    expect(older.life.physiology.recovery).toBeLessThan(
      young.life.physiology.recovery,
    );
  });

  it('opens remote monster habitats and grows villages into cities', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'civilization-world',
      seed: 'monster-growth-test',
      store,
    });
    // Run the same 60 semantic world quanta/year inside one atomic commit.
    // This keeps the release test fast without changing world dynamics.
    await world.advanceCanonicalTime(1, WORLD_MINUTES_PER_YEAR * 12);

    const frontier = world.snapshot();
    expect(frontier.growth.stage).toBeGreaterThanOrEqual(5);
    expect(
      Object.values(frontier.wildlife).some(
        (population) => population.isMonster && population.threat >= 0.7,
      ),
    ).toBe(true);

    const entryGateway = new IndependentWorldEntryGateway(world);
    for (let index = 1; index <= 36; index += 1) {
      const expected = world.snapshot();
      const result = await entryGateway.enter(
        {
          requestId: `city-population:${index}`,
          worldId: expected.id,
          externalIdentityId: `city_resident_${index}`,
          displayName: `Citizen ${index}`,
          role: 'resident',
          requestedAt: expected.now,
        },
        expected,
      );
      expect(result.authorized).toBe(true);
    }
    // Settlement/city checks run every 24 semantic quanta.
    await world.advanceCanonicalTime(2, DEFAULT_WORLD_MINUTES_PER_TICK * 24);

    const society = world.snapshot();
    expect(
      Object.values(society.places).some((place) => place.kind === 'city'),
    ).toBe(true);
    const history = await store.history(society.id);
    expect(history.some((event) => event.kind === 'world.city.emerged')).toBe(true);
  }, 30_000);
});
