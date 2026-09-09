import { describe, expect, it } from 'vitest';
import { stableJsonStringify } from '../src/core/stableJson';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import type { WorldState } from '../src/world/types';

const oldRepairs = [
  ['ainkrad-world-rules-0.3.16', 'migration:v16-additive-schema-repair-2026-08-26', '2026-08-26'],
  ['ainkrad-world-rules-0.3.18', 'migration:v18-additive-schema-repair-2026-09-07-cultural-agency', '2026-09-07-cultural-agency'],
  ['ainkrad-world-rules-0.3.19', 'migration:v20-continuity-knowledge-boundaries-2026-09-09', '2026-09-09-knowledge-boundaries'],
] as const;

async function persist(store: InMemoryWorldStore, state: WorldState, operationId: string, operationFingerprint = operationId) {
  const next = structuredClone(state);
  next.revision++;
  return (await store.commit({ worldId: state.id, expectedRevision: state.revision,
    nextState: next, operationId, operationFingerprint, events: [], memories: [] })).state;
}

function dropUnrecordedElfEvidence(state: WorldState) {
  const opportunities = state.v16!.raceFamilyOpportunityByRace;
  delete (opportunities as Partial<typeof opportunities>).elf;
  for (const [key, value] of Object.entries(state.v16!.localFamilyOpportunityByKey)) {
    if (value.race === 'elf') delete state.v16!.localFamilyOpportunityByKey[key];
  }
}

function protectedLife(state: WorldState) {
  return { now: state.now, calendar: state.calendar, determinism: state.determinism,
    agents: state.agents, relationships: state.relationships, population: state.population,
    humanEvidence: state.v16!.raceFamilyOpportunityByRace.human,
    economy: state.v16!.settlementEconomyById, v15: state.v15 };
}

describe('v0.3.20 startup repair after an earlier completed repair', () => {
  it.each(oldRepairs)('recovers missing elf evidence in %s without resetting the world', async (rulesVersion, operationId, schemaRevision) => {
    const source = await WorldEngine.create({ worldId: `elf-repair-${rulesVersion}`,
      seed: 'ainkrad-browser-world', store: new InMemoryWorldStore() });
    const state = source.snapshot();
    state.rulesVersion = rulesVersion;
    state.governance.constitutionVersion = rulesVersion.replace('world-rules', 'constitution');
    if (rulesVersion.endsWith('.16')) delete state.v18;
    if (!rulesVersion.endsWith('.19')) delete state.v19;
    state.v16!.raceFamilyOpportunityByRace.human.opportunityChecks = 23;
    const store = new InMemoryWorldStore();
    await store.initializeWorld(state);
    const recorded = await persist(store, state, operationId, stableJsonStringify({
      kind: 'world_migration', from: rulesVersion, to: rulesVersion,
      mode: 'same_version_additive_schema_repair', schemaRevision,
    }));
    // An older writer can persist a later incomplete projection even though
    // the operation journal still contains the successful original repair.
    dropUnrecordedElfEvidence(recorded);
    const stale = await persist(store, recorded, 'older-writer-checkpoint');
    const preserved = structuredClone(protectedLife(stale));
    const opened = await WorldEngine.open({ worldId: stale.id, store });
    const after = opened.snapshot();
    expect(after.v16!.raceFamilyOpportunityByRace.elf.race).toBe('elf');
    expect(after.v16!.localFamilyOpportunityByKey['settlement_ainkrad::elf']).toBeDefined();
    expect(protectedLife(after)).toEqual(preserved);
    expect((await WorldEngine.open({ worldId: stale.id, store })).snapshot()).toEqual(after);
    await opened.advanceCanonicalTimeTo(after.calendar.elapsedWorldMinutes + 60);
    expect(opened.snapshot().calendar.elapsedWorldMinutes).toBe(after.calendar.elapsedWorldMinutes + 60);
  });

  it('can repair a later incomplete revision after this hotfix already repaired once', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({ worldId: 'repeated-elf-repair', seed: 'elf', store });
    let state = world.snapshot();
    dropUnrecordedElfEvidence(state);
    await persist(store, state, 'old-writer-first');
    const repaired = await WorldEngine.open({ worldId: state.id, store });
    state = repaired.snapshot();
    dropUnrecordedElfEvidence(state);
    const later = await persist(store, state, 'old-writer-later');
    const reopened = await WorldEngine.open({ worldId: state.id, store });
    expect(reopened.snapshot().revision).toBe(later.revision + 1);
    expect(reopened.snapshot().v16!.raceFamilyOpportunityByRace.elf.race).toBe('elf');
    expect((await store.history(state.id)).filter(e => e.payload.migrationMode === 'same_version_additive_schema_repair')).toHaveLength(2);
  });

  it('preserves nonzero Cardinal experience and world time when recovering the same world', async () => {
    const options = { worldId: 'elf-cardinal-continuity', seed: 'ainkrad-browser-world',
      mode: 'observer' as const, store: new InMemoryWorldStore(), controlLog: new InMemoryAppendOnlyLog() };
    const runtime = await LiveWorldRuntime.create(options);
    let frame = await runtime.tick();
    for (let i = 0; i < 5; i++) frame = await runtime.tick();
    const experience = frame.evaluation!.experience.totalExperience;
    expect(experience).toBeGreaterThan(0);
    const stale = (await options.store.loadWorld(options.worldId))!;
    dropUnrecordedElfEvidence(stale);
    await persist(options.store, stale, 'old-writer-with-cardinal-history');
    const resumed = await (await LiveWorldRuntime.create(options)).tick(0);
    expect(resumed.evaluation!.experience.totalExperience).toBe(experience);
    expect(resumed.world.calendar).toEqual(frame.world.calendar);
    expect(resumed.world.agents).toEqual(frame.world.agents);
  });

  it('keeps strict validation for damaged existing counters instead of silently erasing evidence', async () => {
    const store = new InMemoryWorldStore();
    const source = await WorldEngine.create({ worldId: 'invalid-counter', seed: 'elf', store });
    const state = source.snapshot();
    state.v16!.raceFamilyOpportunityByRace.elf.opportunityChecks = -1;
    const stale = await persist(store, state, 'invalid-old-counter');
    await expect(WorldEngine.open({ worldId: state.id, store })).rejects.toThrow('opportunityChecks');
    expect(await store.loadWorld(state.id)).toEqual(stale);
  });
});
