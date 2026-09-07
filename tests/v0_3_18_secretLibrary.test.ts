import { describe, expect, it } from 'vitest';
import {
  SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18,
  SECRET_LIBRARY_PLACE_ID_V18,
} from '../src/v18/SecretLibraryV18';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import type { WorldV18State } from '../src/v18/types';

describe('v0.3.18 lightweight Secret Library', () => {
  it('persists one fixed anchor beside Ainkrad when the map expands', async () => {
    const source = await WorldEngine.create({
      worldId: 'secret-library-fixed-anchor',
      seed: 'secret-library-fixed-anchor',
      store: new InMemoryWorldStore(),
    });
    const expanded = source.snapshot();
    const before = expanded.places[SECRET_LIBRARY_PLACE_ID_V18];
    const anchor = expanded.places.commons;
    expect(before.mapX).toBe(anchor.mapX - 8);
    expect(before.mapY).toBe(anchor.mapY + 6);

    expanded.places['far-frontier'] = {
      id: 'far-frontier',
      name: 'Дальний фронтир',
      kind: 'meadow',
      capacity: 12,
      biome: 'plains',
      mapX: 12_000,
      mapY: -9_000,
      connectedPlaceIds: [],
      fertility: 0.5,
      danger: 0.1,
      surface: 'land',
      discoveredAt: expanded.calendar.elapsedWorldMinutes,
    };
    const store = new InMemoryWorldStore();
    await store.initializeWorld(expanded);
    const reopened = await WorldEngine.open({ worldId: expanded.id, store });
    const after = reopened.snapshot().places[SECRET_LIBRARY_PLACE_ID_V18];
    expect({ x: after.mapX, y: after.mapY }).toEqual({
      x: before.mapX,
      y: before.mapY,
    });
  });

  it('repairs the old edge-relative position once and keeps old knowledge', async () => {
    const source = await WorldEngine.create({
      worldId: 'secret-library-old-save-repair',
      seed: 'secret-library-old-save-repair',
      store: new InMemoryWorldStore(),
    });
    const stale = source.snapshot();
    const resident = Object.values(stale.agents)[0];
    stale.places[SECRET_LIBRARY_PLACE_ID_V18].kind = 'ruins';
    stale.places[SECRET_LIBRARY_PLACE_ID_V18].mapX = -15_000;
    stale.places[SECRET_LIBRARY_PLACE_ID_V18].mapY = 8_000;
    (stale.v18 as WorldV18State & { secretLibrary: unknown }).secretLibrary = {
      version: 'secret-library-v18',
      currentAccessYear: 7,
      opensAtWorldMinute: 0,
      closesAtWorldMinute: 43_200,
      status: 'closed',
      visitors: [],
      knowledgeByAgentId: {
        [resident.id]: [
          {
            id: 'legacy-knowledge',
            topic: 'Очистка ран',
            sourceTitle: 'Античная медицина',
            sourceUrl: 'https://en.wikisource.org/wiki/Medicine',
            acquiredWorldMinute: 10,
            understanding: 0.42,
            summary: 'Рану нужно очищать.',
            practicalDomains: ['medicine'],
          },
        ],
      },
      totalVisits: 1,
      totalKnowledgeRecords: 1,
    };

    const store = new InMemoryWorldStore();
    await store.initializeWorld(stale);
    const repaired = await WorldEngine.open({ worldId: stale.id, store });
    const state = repaired.snapshot();
    const libraryPlace = state.places[SECRET_LIBRARY_PLACE_ID_V18];
    expect(libraryPlace.kind).toBe('library');
    expect(libraryPlace.mapX).toBe(state.places.commons.mapX - 8);
    expect(libraryPlace.mapY).toBe(state.places.commons.mapY + 6);
    expect(state.v18!.secretLibrary.knowledgeByAgentId[resident.id]).toHaveLength(1);
    expect(state.v18!.secretLibrary.knowledgeByAgentId[resident.id][0].title)
      .toBe('Очистка ран');
    expect(state.revision).toBe(stale.revision + 1);
  });

  it('selects at most five volunteers and teaches only after physical arrival', async () => {
    const source = await WorldEngine.create({
      worldId: 'secret-library-physical-study-source',
      seed: 'secret-library-physical-study',
      store: new InMemoryWorldStore(),
    });
    const prepared = source.snapshot();
    for (const agent of Object.values(prepared.agents)) {
      agent.personality.curiosity = 1;
      agent.personality.diligence = 1;
      agent.mind.values.knowledge = 1;
      agent.mind.autonomy = 1;
      agent.stress = 0;
      prepared.v18!.languageByAgentId[agent.id].cyrillicLiteracy = 1;
    }
    const store = new InMemoryWorldStore();
    await store.initializeWorld(prepared);
    const world = await WorldEngine.open({ worldId: prepared.id, store });

    const revision = world.snapshot().revision;
    await world.step(1);
    const selected = world.snapshot().v18!.secretLibrary.visitors;
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.length).toBeLessThanOrEqual(
      SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18,
    );
    expect(world.snapshot().revision).toBe(revision + 1);
    expect(world.snapshot().v18!.secretLibrary.totalKnowledgeRecords).toBe(0);
    expect(selected.every((visitor) => visitor.acceptedVoluntarily)).toBe(true);
    expect(
      selected.every((visitor) =>
        world.snapshot().agents[visitor.agentId].movement?.targetPlaceId ===
          SECRET_LIBRARY_PLACE_ID_V18,
      ),
    ).toBe(true);

    for (let tick = 2; tick <= 7; tick += 1) await world.step(tick);
    const completed = world.snapshot().v18!.secretLibrary;
    expect(completed.totalKnowledgeRecords).toBeGreaterThan(0);
    expect(
      completed.visitors.some((visitor) =>
        visitor.studyQuanta > 0 && visitor.arrivedWorldMinute !== undefined,
      ),
    ).toBe(true);
  });
});
