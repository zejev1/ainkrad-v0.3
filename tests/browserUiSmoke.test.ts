import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import { projectedResidentPosition } from '../src/presentation/ResidentMotionProjection';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';

describe('SPCK browser UI smoke contract', () => {
  it('ships unique controls for canonical time, readable reports and diagnostics', () => {
    const browserSource = readFileSync(
      new URL('../src/browser.ts', import.meta.url),
      'utf8',
    );
    const css = readFileSync(
      new URL('../src/browser.css', import.meta.url),
      'utf8',
    );
    const template = browserSource.match(/app\.innerHTML = `([\s\S]*?)`;\n/)?.[1];
    expect(template).toBeTruthy();

    const ids = [...template!.matchAll(/\bid="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(template).toContain('<span>Возраст <strong id="tick-value">');
    expect(template).not.toMatch(/>\s*Тик\s*</);
    expect(template).toContain('data-console-tab="diagnostics"');
    expect(template).toContain('id="catch-up-overlay"');
    expect(template).toContain('id="text-scale"');
    expect(template).toContain('id="resident-picker"');
    expect(template).toContain('id="resident-profession"');
    expect(template).toContain('id="satiety-value"');
    expect(template).toContain('id="conversation-feed"');
    expect(browserSource).toContain('readableLawReports');
    expect(browserSource).toContain('readableInterventionReports');
    expect(browserSource).toContain('deathDiagnostics');
    expect(browserSource).toContain('worldHealth');
    expect(browserSource).toContain("document.addEventListener('visibilitychange'");
    expect(browserSource).toContain('resumeOfflineClockFromStoredAnchor');
    expect(browserSource).toContain("event.data.type === 'catch_up_progress'");
    expect(browserSource).toContain('conversation.observerAudible');
    expect(browserSource).toContain(
      'cardinalActivity.authorizationDecisionCount > 0',
    );
    expect(browserSource).toContain(
      'подробная запись уже вне короткой ленты',
    );
    expect(css).toContain('.resident-avatar.is-moving');
    expect(css).toContain('.resident-avatar.is-ambient');
    expect(css).toContain('.cardinal-console__tabs');
    expect(css).toContain('minmax(138px, 1fr)');
    expect(css).toContain('.map-place:not(.map-place--home)');
    expect(css).toContain('.map-place:not(.is-active) .place-count');
    expect(css).toContain('.resident-picker-label select');
    expect(css).toContain('.conversation-window');
    expect(css).toContain('.need-track.need-track--satiety span');
    expect(css).toContain('pointer-events: auto');
    expect(browserSource).toContain("report.kind === 'place'");
  });

  it('produces finite surface positions, physical routes and visible movement data', async () => {
    const world = await WorldEngine.create({
      worldId: 'browser-ui-spatial-smoke',
      seed: 'browser-ui-spatial-smoke',
      store: new InMemoryWorldStore(),
      agentNames: Array.from({ length: 10 }, (_, index) => `UI ${index + 1}`),
      startTime: 0,
    });

    let observedMovement = false;
    for (let tick = 1; tick <= 40; tick += 1) {
      await world.step(tick);
      if (
        Object.values(world.snapshot().agents).some(
          (agent) => agent.life.alive && agent.movement,
        )
      ) {
        observedMovement = true;
        break;
      }
    }

    const snapshot = world.snapshot();
    expect(Object.keys(snapshot.routes).length).toBeGreaterThan(0);
    expect(observedMovement).toBe(true);
    for (const agent of Object.values(snapshot.agents).filter(
      (resident) => resident.life.alive,
    )) {
      expect(Number.isFinite(agent.position.x)).toBe(true);
      expect(Number.isFinite(agent.position.y)).toBe(true);
      expect(agent.position.layerId).toBe('surface');
      if (agent.movement) {
        expect(agent.movement.waypoints.length).toBeGreaterThan(1);
        expect(agent.movement.nextWaypointIndex).toBeGreaterThan(0);
      }
    }
  }, 15_000);

  it('spreads co-located residents across the physical footprint of a place', async () => {
    const engine = await WorldEngine.create({
      worldId: 'browser-ui-crowding-regression',
      seed: 'browser-ui-crowding-regression',
      store: new InMemoryWorldStore(),
      agentNames: Array.from({ length: 10 }, (_, index) => `Crowd ${index + 1}`),
      startTime: 0,
    });
    const world = engine.snapshot();
    const agents = Object.values(world.agents).filter((agent) => agent.life.alive);
    const sharedPlace = world.places.commons;
    expect(sharedPlace).toBeDefined();

    const projected = agents.map((agent) => {
      const crowded = structuredClone(agent);
      crowded.locationId = sharedPlace!.id;
      crowded.position = {
        x: sharedPlace!.mapX,
        y: sharedPlace!.mapY,
        layerId: 'surface',
      };
      crowded.movement = undefined;
      crowded.lastAction = 'socialize';
      return projectedResidentPosition(crowded, world, 12);
    });

    const unique = new Set(
      projected.map((point) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`),
    );
    const xs = projected.map((point) => point.x);
    const ys = projected.map((point) => point.y);
    expect(unique.size).toBe(agents.length);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(1.5);
  });

  it('paints motion before the first slow-speed quantum without changing resident decisions', async () => {
    const runtime = await LiveWorldRuntime.create({
      mode: 'observer',
      seed: 'slow-speed-visible-motion',
      worldId: 'slow-speed-visible-motion',
      store: new InMemoryWorldStore(),
      controlLog: new InMemoryAppendOnlyLog(),
      worldSpeedId: 'hour_per_minute',
      worldSpeedMultiplier: 1,
    });
    const frame = await runtime.tick();
    const resident = Object.values(frame.world.agents).find(
      (agent) => agent.life.alive,
    );

    expect(frame.world.calendar.elapsedWorldMinutes).toBe(1);
    expect(frame.world.v15?.simulationClock.quantumIndex).toBe(0);
    expect(
      Object.values(frame.world.agents).every(
        (agent) => !agent.lastAction && !agent.lastDecision && !agent.movement,
      ),
    ).toBe(true);
    expect(resident).toBeDefined();

    const persistedBefore = structuredClone(resident!.position);
    const before = projectedResidentPosition(
      resident!,
      frame.world,
      frame.tick,
    );
    const later = projectedResidentPosition(
      resident!,
      frame.world,
      frame.tick + 1,
    );
    expect(Math.hypot(later.x - before.x, later.y - before.y)).toBeGreaterThan(0);
    expect(resident!.position).toEqual(persistedBefore);
  });

  it('crosses the founding settlement in world minutes instead of six-day jumps', async () => {
    const runtime = await LiveWorldRuntime.create({
      mode: 'observer',
      seed: 'continuous-physical-movement',
      worldId: 'continuous-physical-movement',
      store: new InMemoryWorldStore(),
      controlLog: new InMemoryAppendOnlyLog(),
      worldSpeedId: 'year_per_minute',
      worldSpeedMultiplier: 1,
    });

    let frame = await runtime.tick();
    let traveller = Object.values(frame.world.agents).find(
      (agent) => agent.life.alive && agent.movement,
    );
    for (let index = 0; index < 20 && !traveller; index += 1) {
      frame = await runtime.tick();
      traveller = Object.values(frame.world.agents).find(
        (agent) => agent.life.alive && agent.movement,
      );
    }
    expect(traveller?.movement).toBeDefined();

    const travellerId = traveller!.id;
    const physicalOriginPlaceId = traveller!.locationId;
    const startPosition = structuredClone(traveller!.position);
    const target = frame.world.places[traveller!.movement!.targetPlaceId];
    expect(physicalOriginPlaceId).not.toBe(target.id);
    expect(traveller!.locationId).toBe(physicalOriginPlaceId);
    runtime.setWorldSpeed('hour_per_minute', 1);
    frame = await runtime.tick();
    const afterOneMinute = frame.world.agents[travellerId];
    expect(
      Math.hypot(
        afterOneMinute.position.x - startPosition.x,
        afterOneMinute.position.y - startPosition.y,
      ),
    ).toBeGreaterThan(0.1);

    let elapsedMinutes = 1;
    while (frame.world.agents[travellerId].movement && elapsedMinutes < 60) {
      frame = await runtime.tick();
      elapsedMinutes += 1;
    }
    const arrived = frame.world.agents[travellerId];
    expect(arrived.movement).toBeUndefined();
    expect(arrived.locationId).toBe(target.id);
    expect(elapsedMinutes).toBeLessThanOrEqual(60);
    expect(arrived.position.x).toBeCloseTo(target.mapX, 6);
    expect(arrived.position.y).toBeCloseTo(target.mapY, 6);
  }, 20_000);
});
