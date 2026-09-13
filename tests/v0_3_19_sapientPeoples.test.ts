import { describe, expect, it } from 'vitest';
import {
  ensureSettlementRelationV16,
  SAPIENT_RACES_V16,
} from '../src/v16/SocietyFoundationV16';
import {
  repairSapientHomelandGeography,
  SAPIENT_PEOPLE_FOUNDATIONS,
} from '../src/world/SapientPeoples';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';
import type { AgentRace } from '../src/world/types';

const races: readonly AgentRace[] = [
  'human',
  'elf',
  'dwarf',
  'goblin',
  'orc',
  'ogre',
];

async function advanceYearByYear(
  engine: WorldEngine,
  years: number,
): Promise<void> {
  for (let year = 1; year <= years; year += 1) {
    await engine.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR * year);
  }
}

describe('v0.3.19 distinct sapient peoples and continental homelands', () => {
  it('places every pair of founding peoples at least 1000 physical kilometres apart', () => {
    expect(SAPIENT_RACES_V16).toEqual(races);
    for (let left = 0; left < races.length; left += 1) {
      for (let right = left + 1; right < races.length; right += 1) {
        const a = SAPIENT_PEOPLE_FOUNDATIONS[races[left]].homelandCenter;
        const b = SAPIENT_PEOPLE_FOUNDATIONS[races[right]].homelandCenter;
        const kilometres = Math.hypot(a.x - b.x, a.y - b.y) / 10;
        expect(kilometres).toBeGreaterThanOrEqual(1000);
        expect(kilometres).toBeLessThan(4000);
      }
    }
  });

  it('creates six mechanically distinct peoples and evidence-based diplomatic priors', async () => {
    const engine = await WorldEngine.create({
      worldId: 'v19-six-sapient-peoples',
      seed: 'v19-six-sapient-peoples',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    await advanceYearByYear(engine, 12);
    const state = engine.snapshot();

    const livingRaces = new Set(
      Object.values(state.agents)
        .filter((agent) => agent.life.alive)
        .map((agent) => agent.race ?? 'human'),
    );
    expect([...livingRaces].sort()).toEqual([...races].sort());

    for (const race of races.filter((candidate) => candidate !== 'human')) {
      const settlementId = `settlement_${race}_homeland`;
      const settlement = state.settlements[settlementId];
      const expected = state.terrain!.anchors.find(
        (anchor) => anchor.id === `foundation_${race}`,
      )!;
      expect(settlement).toBeDefined();
      expect(settlement.centerX).toBeCloseTo(expected.x, 6);
      expect(settlement.centerY).toBeCloseTo(expected.y, 6);
      expect(
        Object.values(state.agents).filter(
          (agent) =>
            agent.life.generation === 0 &&
            agent.race === race &&
            state.places[agent.homeId]?.settlementId === settlementId,
        ),
      ).toHaveLength(12);
    }

    const elfRelation = ensureSettlementRelationV16(
      state,
      'settlement_ainkrad',
      'settlement_elf_homeland',
    );
    const dwarfRelation = ensureSettlementRelationV16(
      state,
      'settlement_ainkrad',
      'settlement_dwarf_homeland',
    );
    const goblinRelation = ensureSettlementRelationV16(
      state,
      'settlement_ainkrad',
      'settlement_goblin_homeland',
    );
    const orcRelation = ensureSettlementRelationV16(
      state,
      'settlement_ainkrad',
      'settlement_orc_homeland',
    );
    expect(elfRelation.trust).toBeGreaterThan(0.6);
    expect(dwarfRelation.cooperation).toBeGreaterThan(0.1);
    expect(goblinRelation.hostility).toBeGreaterThan(0.45);
    expect(orcRelation.hostility).toBeGreaterThan(goblinRelation.hostility);
    expect(orcRelation.trust).toBeLessThan(elfRelation.trust);

    const elfFounder = state.agents.elf_homeland_1;
    const dwarfFounder = state.agents.dwarf_homeland_1;
    const orcFounder = state.agents.orc_homeland_1;
    expect(elfFounder.life.lifespanYears).toBeGreaterThan(225);
    expect(elfFounder.skills.exploration).toBeGreaterThanOrEqual(0.46);
    expect(dwarfFounder.skills.craft).toBeGreaterThanOrEqual(0.48);
    expect(dwarfFounder.life.physiology.endurance).toBeGreaterThan(0.7);
    expect(orcFounder.progression?.combatMastery).toBeGreaterThanOrEqual(0.22);
  }, 60_000);

  it('repairs old close homelands once without rewriting resident identity or history', async () => {
    const engine = await WorldEngine.create({
      worldId: 'v19-repair-close-homelands',
      seed: 'v19-repair-close-homelands',
      store: new InMemoryWorldStore(),
      startTime: 0,
    });
    await advanceYearByYear(engine, 12);
    const state = engine.snapshot();
    const resident = state.agents.elf_homeland_1;
    const preserved = structuredClone({
      id: resident.id,
      name: resident.name,
      mind: resident.mind,
      life: resident.life,
      skills: resident.skills,
      v15: state.v15,
      v18: state.v18,
      v19: state.v19,
      calendar: state.calendar,
      determinism: state.determinism,
    });

    races
      .filter((race) => race !== 'human')
      .forEach((race, index) => {
        const settlementId = `settlement_${race}_homeland`;
        const center = state.places[settlementId];
        const targetX = 60 + index * 18;
        const targetY = 62 + index * 7;
        const dx = targetX - center.mapX;
        const dy = targetY - center.mapY;
        for (const place of Object.values(state.places)) {
          if (place.settlementId !== settlementId) continue;
          place.mapX += dx;
          place.mapY += dy;
        }
        state.settlements[settlementId].centerX = targetX;
        state.settlements[settlementId].centerY = targetY;
      });

    expect(repairSapientHomelandGeography(state)).toBe(5);
    expect(repairSapientHomelandGeography(state)).toBe(0);
    for (const race of races.filter((candidate) => candidate !== 'human')) {
      const expected = SAPIENT_PEOPLE_FOUNDATIONS[race].homelandCenter;
      expect(state.places[`settlement_${race}_homeland`].mapX).toBeCloseTo(expected.x, 6);
      expect(state.places[`settlement_${race}_homeland`].mapY).toBeCloseTo(expected.y, 6);
    }
    expect({
      id: resident.id,
      name: resident.name,
      mind: resident.mind,
      life: resident.life,
      skills: resident.skills,
      v15: state.v15,
      v18: state.v18,
      v19: state.v19,
      calendar: state.calendar,
      determinism: state.determinism,
    }).toEqual(preserved);
  }, 60_000);
});
