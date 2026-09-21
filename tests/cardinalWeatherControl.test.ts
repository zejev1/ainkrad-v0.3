import { describe, expect, it, vi } from 'vitest';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { CardinalSystemControl } from '../src/runtime/CardinalSystemControl';
import { WeatherAgentConductor } from '../src/cardinal/WeatherAgentConductor';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import { CANONICAL_WORLD_QUANTUM_MINUTES as QUANTUM } from '../src/v15/WorldTimeContract';
import type { WeatherSystemState } from '../src/world/systems/WeatherSystemAgent';

const fault = (): WeatherSystemState => ({ version: 1, lifecycle: 'faulted', allowed: true,
  fallback: true, lastFault: 'Injected executor failure' });
async function fixture(broken = true) {
  const worldId = 'cardinal-weather-control';
  const source = new InMemoryWorldStore();
  const engine = await WorldEngine.create({ worldId, seed: worldId, store: source, startTime: 0 });
  const checkpoint = engine.snapshot();
  if (broken) checkpoint.weatherSystem = fault();
  const store = new InMemoryWorldStore();
  await store.initializeWorld(checkpoint);
  return { worldId, seed: worldId, store, controlLog: new InMemoryAppendOnlyLog() };
}
function physical(state: ReturnType<LiveWorldRuntime['worldSnapshot']>) {
  const copy = structuredClone(state);
  delete copy.weatherSystem;
  delete (copy as any).revision;
  return copy;
}

describe('Cardinal weather control in the live world', () => {
  it('detects, restores, verifies and journals a fault before year 200 without changing life or clock', async () => {
    const options = await fixture();
    const runtime = await LiveWorldRuntime.create({ ...options, mode: 'intervene' });
    const before = runtime.worldSnapshot();
    const frame = await runtime.tick(0);
    expect(frame.cardinalControl?.status).toBe('ONLINE');
    expect(frame.cardinalControl?.recent.map(r => r.kind)).toEqual(['repair_requested', 'recovered']);
    expect(frame.world.weatherSystem?.fallback).toBe(false);
    expect(frame.cardinalControl?.recoveries).toBe(1);
    expect(physical(frame.world)).toEqual(physical(before));
    expect(frame.executedInterventionCount).toBe(0);
    expect(frame.world.governance).toEqual(before.governance);
    expect(frame.cardinalActivity.authorizedWorldChangeCount).toBe(0);
    const reopened = await LiveWorldRuntime.create(options);
    expect((await reopened.tick(0)).cardinalControl?.recoveries).toBe(1);
  });

  it('persists OFF through save/reopen, advances autonomously and reconnects at the present', async () => {
    const options = await fixture();
    let runtime = await LiveWorldRuntime.create({ ...options, mode: 'off' });
    await runtime.setCardinalEnabled(true);
    await runtime.setCardinalEnabled(false);
    const before = runtime.worldSnapshot();
    const off = await runtime.tick(QUANTUM);
    expect(off.world.calendar.elapsedWorldMinutes).toBe(QUANTUM);
    expect(off.evaluationCount).toBe(0);
    expect(off.cardinalControl?.status).toBe('OFF');
    expect(off.world.weatherSystem?.lastHeartbeatWorldMinute).toBe(QUANTUM);
    runtime = await LiveWorldRuntime.create({ ...options, mode: 'intervene' });
    const reloaded = await runtime.tick(0);
    expect(reloaded.cardinalControl?.status).toBe('OFF');
    const saved = runtime.worldSnapshot();
    await runtime.setCardinalEnabled(true);
    expect(runtime.worldSnapshot()).toEqual(saved);
    const on = await runtime.tick(QUANTUM);
    expect(on.evaluationCount).toBeGreaterThan(0);
    expect(on.world.calendar.elapsedWorldMinutes).toBe(2 * QUANTUM);
    expect(on.world.epoch).toBe(before.epoch);
    expect(on.executedInterventionCount).toBe(0);
  });

  it('keeps identical autonomous physics with observation and conductor ON/OFF while weather is healthy', async () => {
    const options = await fixture(false);
    const initial = await options.store.loadWorld(options.worldId);
    const otherStore = new InMemoryWorldStore(); await otherStore.initializeWorld(initial!);
    const on = await LiveWorldRuntime.create({ ...options, mode: 'observer' });
    const off = await LiveWorldRuntime.create({ ...options, store: otherStore, controlLog: new InMemoryAppendOnlyLog(), mode: 'off' });
    const a = await on.tick(2 * QUANTUM), b = await off.tick(2 * QUANTUM);
    expect(a.world).toEqual(b.world);
    expect(await options.store.history(options.worldId)).toEqual(await otherStore.history(options.worldId));
    expect(a.cardinalControl?.recent).toEqual([]);
  });

  it('survives abrupt disappearance and save/reload, then recovers existing failure', async () => {
    const options = await fixture();
    const runtime = await LiveWorldRuntime.create(options);
    runtime.disconnectCardinal('unplugged');
    const frame = await runtime.tick(QUANTUM);
    expect(frame.cardinalControl?.status).toBe('OFFLINE');
    expect(frame.world.calendar.elapsedWorldMinutes).toBe(QUANTUM);
    expect(frame.world.weatherSystem?.fallback).toBe(true);
    expect(frame.evaluationCount).toBe(0);
    const before = runtime.worldSnapshot();
    const reopened = await LiveWorldRuntime.create(options);
    const recovered = await reopened.tick(0);
    expect(recovered.cardinalControl?.recoveries).toBe(1);
    expect(physical(recovered.world)).toEqual(physical(before));
  });
});

describe('Narrow conductor boundary and bounded work', () => {
  it('leaves healthy weather and deliberate lifecycle restrictions alone', () => {
    const conductor = new WeatherAgentConductor();
    for (const lifecycle of ['running', 'stopped', 'retired', 'restricted'] as const) {
      expect(conductor.diagnose({ version: 1, lifecycle, allowed: lifecycle === 'running', fallback: lifecycle !== 'running' })).toBeUndefined();
    }
    expect(conductor.diagnose(fault())?.kind).toBe('restore');
  });

  it('does no storage work or commands across 100,000 unchanged healthy checks', async () => {
    const log = new InMemoryAppendOnlyLog();
    const append = vi.spyOn(log, 'append'), read = vi.spyOn(log, 'readTail');
    const restore = vi.fn();
    const control = new CardinalSystemControl('bounded', true, log, {
      observe: () => ({ epoch: 1, revision: 1, minute: 0,
        weather: { version: 1, lifecycle: 'running', allowed: true, fallback: false } }), restore,
    });
    await control.initialize(); read.mockClear();
    for (let i = 0; i < 100_000; i++) await control.service();
    expect(append).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled(); expect(restore).not.toHaveBeenCalled();
  });

  it('cancels a queued repair when Cardinal disconnects before the command', async () => {
    const log = new InMemoryAppendOnlyLog();
    let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const original = log.append.bind(log);
    vi.spyOn(log, 'append').mockImplementation(async (...args) => { await blocked; return original(...args); });
    const restore = vi.fn();
    const control = new CardinalSystemControl('disconnect', true, log, {
      observe: () => ({ epoch: 1, revision: 1, minute: 0, weather: fault() }), restore,
    });
    await control.initialize();
    const pending = control.service();
    control.disconnect(); release(); await pending;
    expect(restore).not.toHaveBeenCalled();
    expect(control.snapshot().status).toBe('OFFLINE');
  });

  it('limits unsuccessful recovery to three attempts and retains that limit after restart', async () => {
    const log = new InMemoryAppendOnlyLog();
    let minute = 0;
    const port = { observe: () => ({ epoch: 1, revision: 1, minute, weather: fault() }), restore: vi.fn(async () => true) };
    let control = new CardinalSystemControl('failed', true, log, port);
    await control.initialize();
    for (let i = 0; i < 10; i++) { await control.service(); minute += 10080; }
    expect(port.restore).toHaveBeenCalledTimes(3);
    control = new CardinalSystemControl('failed', true, log, port); await control.initialize();
    await control.service(); expect(port.restore).toHaveBeenCalledTimes(3);
    expect(control.snapshot().recent.length).toBeLessThanOrEqual(8);
  });
});
