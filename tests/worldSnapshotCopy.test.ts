import { describe, expect, it } from 'vitest';
import { cloneWorldState } from '../src/world/cloneWorldState';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';

describe('Lossless plain world snapshot copies', () => {
  it('matches native cloning including aliases, cycles, undefined, sparse arrays and special numeric values', () => {
    const shared = { value: 1 }, input: any = { a: shared, b: shared, missing: undefined,
      sparse: new Array(3), values: [NaN, -0, Infinity, 2n] };
    input.sparse[2] = undefined; input.self = input;
    Object.defineProperty(input, '__proto__', { value: { safe: true }, enumerable: true });
    const copy: any = cloneWorldState(input);
    expect(copy).toEqual(structuredClone(input));
    expect(copy.a).toBe(copy.b); expect(copy.self).toBe(copy);
    expect(0 in copy.sparse).toBe(false); expect(2 in copy.sparse).toBe(true);
    copy.a.value = 99; expect(shared.value).toBe(1);
    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
  });
  it('uses native semantics for an unexpected native value, preserving aliases across that graph', () => {
    const a = { x: 1 }, input: any = { a, map: new Map([['a', a]]), date: new Date(123), buffer: new Uint8Array([1,2]) };
    const copy: any = cloneWorldState(input);
    expect(copy).toEqual(structuredClone(input)); expect(copy.a).toBe(copy.map.get('a'));
  });
  it('preserves the entire real save and keeps both public snapshots and UI frames isolated from engine state', async () => {
    const store = new InMemoryWorldStore();
    const engine = await WorldEngine.create({ worldId: 'clone-check', seed: 'copy', store, startTime: 0 });
    await engine.advanceCanonicalTimeTo(8760 * 3);
    const actual = engine.runtimeStateView();
    expect(cloneWorldState(actual)).toEqual(structuredClone(actual));
    const snapshot = engine.snapshot(); snapshot.agents.agent_1.name = 'edited clone';
    expect(engine.runtimeStateView().agents.agent_1.name).not.toBe('edited clone');
    const runtime = await LiveWorldRuntime.create({ worldId: 'clone-check', store, mode: 'off' });
    const frame = await runtime.tick(0), before = runtime.worldSnapshot();
    frame.world.agents.agent_1.name = 'edited frame';
    frame.world.vegetationSystem!.sites.resource_field.water = 0;
    expect(runtime.worldSnapshot()).toEqual(before);
  });
});
