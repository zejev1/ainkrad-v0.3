import { describe, expect, it } from 'vitest';
import { IndependentWorldClockGateway } from '../src/boundary/WorldClockGateway';
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

    expect(after.calendar.elapsedWorldMinutes).toBe(
      WORLD_MINUTES_PER_YEAR,
    );

    expect(
      after.agents.agent_1.life.ageYears - beforeAge,
    ).toBeCloseTo(1, 10);

    expect(
      worldCalendarAtMinutes(after.calendar.elapsedWorldMinutes),
    ).toMatchObject({
      year: 2,
      dayOfYear: 1,
    });

    const reopened = await WorldEngine.open({
      worldId: after.id,
      store,
    });

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

    expect(() =>
      gateway.set('cardinal_override', 1),
    ).toThrow('Unknown external world-speed preset');

    expect(() =>
      gateway.set('year_per_minute', 100),
    ).toThrow('must be 1 or 10');
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

    expect(
      older.life.ageYears - young.life.ageYears,
    ).toBeCloseTo(40, 10);

    expect(older.life.stage).toBe('adult');

    expect(
      older.life.physiology.strength,
    ).toBeLessThan(
      young.life.physiology.strength,
    );

    expect(
      older.life.physiology.recovery,
    ).toBeLessThan(
      young.life.physiology.recovery,
    );
  });

  it('opens remote monster habitats and grows populated settlements into cities', async () => {
    const store = new InMemoryWorldStore();

    const world = await WorldEngine.create({
      worldId: 'civilization-world',
      seed: 'monster-growth-test',
      store,
      agentNames: Array.from(
        { length: 24 },
        (_, index) => `Resident ${index + 1}`,
      ),
    });

    let reachedCivilizationTarget = false;

    for (let tick = 1; tick <= 900; tick += 1) {
      await world.step(tick);

      if (tick % 12 !== 0) continue;

      const snapshot = world.snapshot();

      const hasMonster = Object.values(snapshot.wildlife).some(
        (population) =>
          population.isMonster &&
          population.threat >= 0.7,
      );

      const hasCity = Object.values(snapshot.places).some(
        (place) => place.kind === 'city',
      );

      if (
        snapshot.growth.stage >= 5 &&
        hasMonster &&
        hasCity
      ) {
        reachedCivilizationTarget = true;
        break;
      }
    }

    const society = world.snapshot();

    expect(society.growth.stage).toBeGreaterThanOrEqual(5);

    expect(
      Object.values(society.wildlife).some(
        (population) =>
          population.isMonster &&
          population.threat >= 0.7,
      ),
    ).toBe(true);

    expect(
      Object.values(society.places).some(
        (place) => place.kind === 'city',
      ),
    ).toBe(true);

    expect(reachedCivilizationTarget).toBe(true);

    const history = await store.history(society.id);


    expect(
      history.some(
        (event) =>
          event.kind === 'world.city.emerged',
      ),
    ).toBe(true);
  });
});
