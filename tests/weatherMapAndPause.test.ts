import { describe, it, expect, vi } from 'vitest';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { ClockContinuity } from '../src/runtime/ClockContinuity';
import { ExternalClockCommands } from '../src/runtime/ExternalClockCommands';
import { parseOfflineWorldClockAnchor, offlineWorldMinuteTarget } from '../src/runtime/OfflineWorldClock';
import { WeatherSystemAgent } from '../src/world/systems/WeatherSystemAgent';
import { worldWeatherAtPointV21, weatherSiteAt } from '../src/v21/WeatherV21';
import { createWeatherMapSnapshot, WeatherMapSession, WEATHER_MAP_COLUMNS, WEATHER_MAP_ROWS } from '../src/presentation/WeatherMapSnapshot';
import { evolvePatch, initializePatch } from '../src/world/systems/plants/VegetationModel';
import { WORLD_MINUTES_PER_YEAR as YEAR } from '../src/world/WorldClock';
import { CANONICAL_WORLD_QUANTUM_MINUTES as Q } from '../src/v15/WorldTimeContract';

const create = (store = new InMemoryWorldStore(), controlLog = new InMemoryAppendOnlyLog()) =>
  LiveWorldRuntime.create({ worldId: 'f13-physical', seed: 'f13-physical', mode: 'observer', store, controlLog, boundedLiveAcceleration: true });
const input = { id: 'regional-test', epoch: 1, volatility: 0.2 };
const site = { x: -20000, y: 0, elevationM: 100, moisture: 0.6, maritime: 0, upwindElevationM: 100 };
const realTime = { speedId: 'real_time' as const, multiplier: 1 as const, worldMinutesPerTick: 1 / 60 };

describe('Regional weather and an on-demand continental snapshot', () => {
  it('has coherent nearby weather, colder heights and a dry leeward slope; local fallback is identical', () => {
    const agent = new WeatherSystemAgent(), minute = YEAR * 0.4;
    const low = agent.sampleAt(input, minute, site), nearby = agent.sampleAt(input, minute, { ...site, x: site.x + 1 });
    expect(Math.abs(low.precipitation - nearby.precipitation)).toBeLessThan(0.001);
    expect(Math.abs(low.temperatureC - nearby.temperatureC)).toBeLessThanOrEqual(1);
    expect(agent.sampleAt(input, minute, site)).toBe(low);
    expect(agent.sampleAt(input, minute, { ...site, elevationM: 2100 }).temperatureC).toBe(low.temperatureC - 13);
    expect(agent.sampleAt(input, minute, { ...site, upwindElevationM: 2100 }).precipitation).toBeLessThan(low.precipitation);
    expect(agent.sampleAt(input, minute, site)).toEqual(low);
    agent.applyCardinalCommand({ kind: 'stop' });
    expect(agent.sampleAt(input, minute, site)).toEqual(low);
    expect(agent.health().healthy).toBe(false);
    for (let n = 0; n < 300; n++) agent.sampleAt(input, minute + n, { ...site, x: -50000 + n * 200 });
    for (const next of [input, { ...input, epoch: 2 }, { ...input, id: 'another-continent', volatility: 0.8 }]) {
      expect(agent.sampleAt(next, minute, site)).toEqual(new WeatherSystemAgent().sampleAt(next, minute, site));
    }
  });

  it('uses the same physical sampler on the map without changing geography, RNG, life or saved weather', async () => {
    const runtime = await create(), world = runtime.worldSnapshot(), before = structuredClone(world);
    const map = createWeatherMapSnapshot(world);
    expect(map.cells.length).toBeGreaterThan(300);
    expect(map.cells.length).toBeLessThanOrEqual(WEATHER_MAP_COLUMNS * WEATHER_MAP_ROWS);
    expect(new Set(map.cells.map(c => c.weather.temperatureC)).size).toBeGreaterThan(12);
    expect(new Set(map.cells.map(c => c.weather.kind)).size).toBeGreaterThan(2);
    for (const p of map.places) expect(p.weather).toEqual(worldWeatherAtPointV21(world, p.x, p.y));
    expect(world).toEqual(before);
    const restored = await create();
    expect(createWeatherMapSnapshot(restored.worldSnapshot())).toEqual(map);
  });

  it('does zero sampling when closed or accelerated, samples once when opened, and releases its snapshot', async () => {
    const world = (await create()).worldSnapshot(), sample = vi.fn(createWeatherMapSnapshot), session = new WeatherMapSession(sample);
    const accelerated = { ...realTime, speedId: 'year_per_minute' as const, worldMinutesPerTick: YEAR / 60 };
    for (let n = 0; n < 10000; n++) session.synchronize(realTime);
    expect(sample).not.toHaveBeenCalled();
    expect(session.open(world, accelerated)).toBeUndefined();
    expect(session.open(world, { ...accelerated, paused: true })).toBeUndefined();
    expect(session.open(world, realTime, true)).toBeUndefined();
    expect(sample).not.toHaveBeenCalled();
    const first = session.open(world, realTime)!;
    for (let n = 0; n < 10000; n++) { session.synchronize(realTime); expect(session.open(world, realTime)).toBe(first); }
    expect(sample).toHaveBeenCalledTimes(1);
    session.synchronize(accelerated); expect(session.snapshot).toBeUndefined();
    session.open(world, { ...realTime, paused: true }); expect(sample).toHaveBeenCalledTimes(2);
    session.close(); expect(session.snapshot).toBeUndefined();
  });

  it('feeds actual site weather into soil and plants, with no double altitude correction', async () => {
    const runtime = await create(), calls = vi.spyOn(WeatherSystemAgent.prototype, 'samplePhysicalSites');
    await runtime.tick(Q); const world = runtime.worldSnapshot();
    expect(calls.mock.calls.length).toBeGreaterThan(1);
    const habitats = Object.values(world.vegetationSystem!.sites).filter(p => p.active);
    for (const patch of habitats) expect(calls.mock.calls.some(([, , sites]) => sites.some(s => s.x === patch.habitat.x && s.y === patch.habitat.y))).toBe(true);
    calls.mockRestore();
    const h = { ...habitats[0].habitat, id: 'high', elevationM: 3000, moisture: 0.3 };
    const wet = initializePatch(h, 0, 'weather-test'), dry = structuredClone(wet);
    const conditions = { temperatureC: 18, precipitation: 0.8, rain: true, snow: false, wind: 0.1 };
    evolvePatch(wet, { minute: 0, duration: 1440, ...conditions, local: { high: conditions } });
    evolvePatch(dry, { minute: 0, duration: 1440, ...conditions, local: { high: { ...conditions, rain: false, precipitation: 0 } } });
    expect(wet.water).toBeGreaterThan(dry.water);
    expect(wet.snow).toBe(0);
    expect(weatherSiteAt(world, h.x, h.y)).toBe(weatherSiteAt(world, h.x, h.y));
  });

  it('gives batched physical systems exactly the same weather as individual local observations', () => {
    const agent = new WeatherSystemAgent();
    const sites = Array.from({length:320},(_,i)=>({...site,x:i*430-50000,y:(i%29)*3000-40000,elevationM:i*13,maritime:(i%10)/10}));
    for (const source of [input,{...input,epoch:3},{...input,id:'a different prefix',volatility:0.95}]) {
      for (const minute of [0,1234,87600,365000]) {
        const batch = agent.samplePhysicalSites(source,minute,sites);
        for (let i=0;i<sites.length;i++) {
          const local=agent.sampleAt(source,minute,sites[i]);
          expect(batch[i]).toEqual({temperatureC:local.temperatureC,precipitation:local.precipitation,wind:local.wind,
            rain:local.kind==='rain'||local.kind==='storm',snow:local.kind==='snow'});
        }
      }
      agent.applyCardinalCommand({kind:'stop'});
    }
  });
});

describe('External world pause and continuity', () => {
  it('freezes canonical time, RNG, history, agents and Cardinal; resume admits only new elapsed time', async () => {
    const store = new InMemoryWorldStore(), log = new InMemoryAppendOnlyLog(), runtime = await create(store, log);
    await runtime.tick(Q * 2);
    const before = runtime.worldSnapshot(), history = await store.history(before.id), journal = await runtime.cardinalConsole();
    runtime.enqueueLiveElapsed(60000); runtime.setWorldPaused(true);
    for (let n = 0; n < 1000; n++) await runtime.advanceResponsive(60000);
    expect((await runtime.tick(YEAR)).clock.paused).toBe(true);
    await runtime.catchUpBatchTo(YEAR, 1);
    expect(runtime.worldSnapshot()).toEqual(before);
    expect(await store.history(before.id)).toEqual(history);
    expect(await runtime.cardinalConsole()).toEqual(journal);
    expect(runtime.liveTiming().pendingWorldMinutes).toBe(0);
    const reopened = await create(store, log); reopened.setWorldPaused(true);
    expect((await reopened.tick()).world).toEqual(before);
    runtime.setWorldSpeed('real_time', 1); expect((await runtime.tick()).clock.paused).toBe(true);
    runtime.setWorldPaused(false); await runtime.advanceResponsive(60000);
    expect(runtime.worldSnapshot().calendar.elapsedWorldMinutes).toBe(before.calendar.elapsedWorldMinutes + 1);
  });

  it('finishes only the already committing step when pause arrives during accelerated work', async () => {
    const store = new InMemoryWorldStore(), runtime = await create(store), original = store.commit.bind(store);
    let entered!: () => void, release!: () => void;
    const waiting = new Promise<void>(r => { entered = r; }), gate = new Promise<void>(r => { release = r; });
    const spy = vi.spyOn(store, 'commit').mockImplementationOnce(async batch => { entered(); await gate; return original(batch); });
    const work = runtime.advanceResponsive(60000); await waiting;
    runtime.setWorldPaused(true); release(); await work; spy.mockRestore();
    const saved = runtime.worldSnapshot();
    expect(saved.calendar.elapsedWorldMinutes).toBe(Q);
    await runtime.advanceResponsive(60000);
    expect(runtime.worldSnapshot()).toEqual(saved);
    expect(await store.loadWorld(saved.id)).toEqual(saved);
    expect(runtime.liveTiming().pendingWorldMinutes).toBe(0);
  });

  it('persists pause intent before acknowledgement and never catches up time spent paused, even after reload', () => {
    const position = { worldEpoch: 1, currentWorldMinutes: Q * 2 }, clock = new ClockContinuity();
    clock.observe(position, YEAR); clock.observeSpeed('year_per_minute', 1); clock.targetWorldMinutes = YEAR * 9;
    const command = clock.command('year_per_minute', 1, 1000, false, true);
    expect(command.discardPending).toBe(true);
    const anchor = parseOfflineWorldClockAnchor(JSON.stringify(clock.anchor(1000, 'year_per_minute', 1)))!;
    expect(anchor.paused).toBe(true); expect(anchor.targetWorldMinutes).toBeUndefined();
    expect(offlineWorldMinuteTarget({ anchor, ...position, nowWallClockMs: 1e12, currentWorldEpoch: position.worldEpoch })).toBe(position.currentWorldMinutes);
    const reopened = new ClockContinuity(anchor); reopened.observe(position);
    expect(reopened.restore(anchor, 1e12)).toBeUndefined();
    const init = reopened.command('year_per_minute', 1, 1e12, true); expect(init.paused).toBe(true);
    reopened.acknowledge(init.clockRevision, position, true);
    const resume = reopened.command('year_per_minute', 1, 1e12 + 1, false, false);
    expect(resume.clockRevision).toBeGreaterThan(init.clockRevision); expect(resume.speedId).toBe('year_per_minute');
    reopened.acknowledge(resume.clockRevision, position, true);
    const resumed = reopened.anchor(1e12 + 1, 'year_per_minute', 1)!;
    expect(offlineWorldMinuteTarget({ anchor: resumed, ...position, currentWorldEpoch: 1, nowWallClockMs: 1e12 + 60001 })).toBe(position.currentWorldMinutes + 1);
    expect(parseOfflineWorldClockAnchor(JSON.stringify({ ...resumed, paused: 'yes' }))).toBeUndefined();
  });

  it('rejects stale cross-tab resume and catch-up requests while paused', () => {
    const queue = new ExternalClockCommands();
    queue.enqueue({ type: 'set_speed', ...realTime, clockRevision: 20, paused: true }); queue.take();
    expect(queue.acceptsTarget(20)).toBe(false);
    expect(queue.enqueue({ type: 'set_speed', ...realTime, clockRevision: 19, paused: false })).toBe(false);
    queue.enqueue({ type: 'set_speed', ...realTime, clockRevision: 21, paused: false });
    expect(queue.take()?.discardPending).toBe(true); expect(queue.acceptsTarget(21)).toBe(true);
    expect(() => queue.enqueue({ type: 'set_speed', ...realTime, clockRevision: 22, paused: 'false' as any })).toThrow();
  });
});
