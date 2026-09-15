import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { lifeContinuityDiagnosticsV22, passesReproductiveAgeHealthV22, strongestPracticedKindV22 } from '../src/v18/LifeContinuityDiagnosticsV22';

const source = () => WorldEngine.create({ worldId: 'life-audit', seed: 'life-audit', store: new InMemoryWorldStore() });

describe('read-only, race-aware life diagnostics', () => {
  it('does not invent an adventurer from an all-zero practice record', () => {
    expect(strongestPracticedKindV22({ adventurer: 0, forager: 0, scout: 0 })).toBe('none');
    expect(strongestPracticedKindV22({ adventurer: 0, forager: 3, scout: 8 })).toBe('scout');
    expect(strongestPracticedKindV22({ adventurer: NaN, scout: -1 })).toBe('none');
  });
  it('uses actual racial age and health limits, not the old universal human cutoff', async () => {
    const engine = await source(); const world = engine.snapshot();
    const a = Object.values(world.agents)[0];
    a.life.ageYears = 90; a.life.health = 0.8; a.race = 'elf';
    expect(passesReproductiveAgeHealthV22(a)).toBe(true);
    a.race = 'human'; a.life.ageYears = 30; a.life.health = 0.5;
    expect(passesReproductiveAgeHealthV22(a)).toBe(false);
    a.life.health = 0.8;
    expect(passesReproductiveAgeHealthV22(a)).toBe(true);
    a.life.alive = false;
    expect(passesReproductiveAgeHealthV22(a)).toBe(false);
  });
  it('does not mutate the snapshot or report legacy missing receipts as zero journeys', async () => {
    const engine = await source(); const world = engine.snapshot();
    const before = structuredClone(world);
    const report = lifeContinuityDiagnosticsV22(world);
    expect(report.explorationTracking).toBeNull();
    expect(world).toEqual(before);
    expect(report.family.human.scheduledPairChecks).toBeNull();
    expect(Object.values(report.byRaceGeneration).reduce((n, g) => n + g.living, 0)).toBe(report.living);
  });
});
