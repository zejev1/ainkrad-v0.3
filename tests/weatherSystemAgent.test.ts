import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { WeatherSystemAgent } from '../src/world/systems/WeatherSystemAgent';
import { worldWeatherV21 } from '../src/v21/WeatherV21';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';

const input = { id: 'weather-regression', epoch: 1, volatility: 0.2 };

describe('first autonomous weather system', () => {
  it('exactly preserves 42 weather samples captured from the accepted F2 implementation', () => {
    const samples = JSON.parse(readFileSync(new URL('./weather-v1-baseline.json', import.meta.url), 'utf8'));
    const agent = new WeatherSystemAgent();
    for (const row of samples) {
      expect(agent.sample({ ...input, epoch: row.epoch, volatility: row.volatility }, row.minute)).toEqual(row.expected);
    }
  });

  it('continues without a conductor and survives stop/restrict/restore with identical physical weather', () => {
    const agent = new WeatherSystemAgent();
    const autonomous = new WeatherSystemAgent();
    agent.applyCardinalCommand({ kind: 'stop', reason: 'isolate implementation' });
    expect(agent.sample(input, 8760)).toEqual(autonomous.sample(input, 8760));
    expect(agent.health().healthy).toBe(false);
    agent.applyCardinalCommand({ kind: 'restore', reason: 'reconnect at present time' });
    expect(agent.sample(input, 17520)).toEqual(autonomous.sample(input, 17520));
    expect(agent.health().healthy).toBe(true);
    expect(() => agent.applyCardinalCommand({ kind: 'restrict', allowedCapabilityIds: ['sparks.emotions.write'], reason: 'invalid' })).toThrow();
    agent.applyCardinalCommand({ kind: 'restrict', allowedCapabilityIds: [], reason: 'isolation' });
    expect(agent.sample(input, 26280)).toEqual(autonomous.sample(input, 26280));
  });

  it('contains thrown and invalid model results without stopping weather', () => {
    for (const model of [() => { throw new Error('injected failure'); }, () => ({ temperatureC: NaN }) as any]) {
      const broken = new WeatherSystemAgent(undefined, model);
      expect(broken.sample(input, 100)).toEqual(new WeatherSystemAgent().sample(input, 100));
      expect(broken.health().lifecycle).toBe('faulted');
      expect(broken.snapshot().fallback).toBe(true);
      const restored = new WeatherSystemAgent(broken.snapshot());
      expect(restored.sample(input, 5000)).toEqual(new WeatherSystemAgent().sample(input, 5000));
    }
  });

  it('commits with the real world, reloads, deduplicates control and does not rewrite residents', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({ worldId: 'weather-live', seed: 'weather-live', store, startTime: 0 });
    const before = world.snapshot();
    expect(before.weatherSystem?.current).toEqual(worldWeatherV21(before));
    expect(await world.controlWeatherSystem({ kind: 'stop', reason: 'test' }, 'stop-1', before.revision)).toBe(true);
    const stopped = world.snapshot();
    expect(stopped.agents).toEqual(before.agents);
    expect(stopped.determinism).toEqual(before.determinism);
    expect(stopped.weatherSystem?.fallback).toBe(true);
    expect(await world.controlWeatherSystem({ kind: 'stop', reason: 'test' }, 'stop-1', before.revision)).toBe(false);
    await world.advanceCanonicalTimeTo(8760);
    const saved = world.snapshot();
    const reopened = await WorldEngine.open({ worldId: 'weather-live', store });
    expect(reopened.snapshot().weatherSystem).toEqual(saved.weatherSystem);
    expect(worldWeatherV21(reopened.snapshot())).toEqual(worldWeatherV21(saved));
    await reopened.controlWeatherSystem({ kind: 'restore', reason: 'present state' }, 'restore-1', reopened.snapshot().revision);
    expect(reopened.snapshot().calendar).toEqual(saved.calendar);
    expect(reopened.snapshot().agents).toEqual(saved.agents);
    expect(reopened.snapshot().weatherSystem?.fallback).toBe(false);
  });

  it('adds weather state to an old save without removing any existing information', async () => {
    const source = new InMemoryWorldStore();
    const first = await WorldEngine.create({ worldId: 'weather-legacy', seed: 'old', store: source, startTime: 0 });
    const old = first.snapshot(); delete old.weatherSystem;
    const store = new InMemoryWorldStore(); await store.initializeWorld(old);
    const world = await WorldEngine.open({ worldId: old.id, store });
    const prior = world.snapshot();
    await world.controlWeatherSystem({ kind: 'start' }, 'initialize', prior.revision);
    const after = world.snapshot();
    expect(after.weatherSystem?.lifecycle).toBe('running');
    expect(after.agents).toEqual(prior.agents);
    expect(after.relationships).toEqual(prior.relationships);
    expect(after.v18).toEqual(prior.v18);
  });
});
