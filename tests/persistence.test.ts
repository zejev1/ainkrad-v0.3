import { describe, expect, it } from 'vitest';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import type { WorldCommitBatch, WorldCommitResult } from '../src/world/persistence';
import { WorldRevisionConflictError } from '../src/world/persistence';
import { WorldEngine } from '../src/world/WorldEngine';

class RejectOnceStore extends InMemoryWorldStore {
  rejectNextCommit = false;

  override async commit(batch: WorldCommitBatch): Promise<WorldCommitResult> {
    if (this.rejectNextCommit) {
      this.rejectNextCommit = false;
      throw new Error('synthetic commit failure');
    }
    return await super.commit(batch);
  }
}


class GateCommitStore extends InMemoryWorldStore {
  gateNextCommit = false;
  enteredCommit: Promise<void> = Promise.resolve();
  private signalEntered: (() => void) | undefined;
  private releaseCommit: (() => void) | undefined;
  private waitForRelease: Promise<void> | undefined;

  armGate(): void {
    this.gateNextCommit = true;
    this.enteredCommit = new Promise<void>((resolve) => {
      this.signalEntered = resolve;
    });
    this.waitForRelease = new Promise<void>((resolve) => {
      this.releaseCommit = resolve;
    });
  }

  release(): void {
    this.releaseCommit?.();
  }

  override async commit(batch: WorldCommitBatch): Promise<WorldCommitResult> {
    if (this.gateNextCommit) {
      this.gateNextCommit = false;
      this.signalEntered?.();
      await this.waitForRelease;
    }
    return await super.commit(batch);
  }
}

describe('World persistence boundary', () => {
  it('retries an already committed operation after reopen without duplicating evidence', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'world_retry',
      seed: 'retry-seed',
      store,
      agentNames: [],
      startTime: 0,
    });

    expect(
      await world.applyDisturbance('resource_shock', 0.2, 1, 8, 'shock_once'),
    ).toBe(true);
    const afterFirst = world.snapshot();

    const reopened = await WorldEngine.open({ worldId: 'world_retry', store });
    expect(
      await reopened.applyDisturbance(
        'resource_shock',
        0.2,
        1,
        8,
        'shock_once',
      ),
    ).toBe(false);

    expect(reopened.snapshot()).toEqual(afterFirst);
    expect(await store.history('world_retry')).toHaveLength(1);
  });

  it('rejects reuse of an operation ID with different content', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'world_collision',
      seed: 'collision-seed',
      store,
      agentNames: [],
      startTime: 0,
    });

    await world.applyDisturbance('resource_shock', 0.2, 1, 8, 'same_id');
    await expect(
      world.applyDisturbance('resource_shock', 0.3, 1, 8, 'same_id'),
    ).rejects.toThrow();
  });

  it('does not adopt a mutated world state when the atomic commit fails', async () => {
    const store = new RejectOnceStore();
    const world = await WorldEngine.create({
      worldId: 'world_rollback',
      seed: 'rollback-seed',
      store,
      agentNames: ['A', 'B'],
      startTime: 0,
    });

    const before = world.snapshot();
    store.rejectNextCommit = true;
    await expect(world.step(1)).rejects.toThrow('synthetic commit failure');

    expect(world.snapshot()).toEqual(before);
    expect(await store.loadWorld('world_rollback')).toEqual(before);

    await world.step(1);
    expect(world.snapshot().revision).toBe(before.revision + 1);
  });

  it('detects stale concurrent world writers instead of silently overwriting', async () => {
    const store = new InMemoryWorldStore();
    const first = await WorldEngine.create({
      worldId: 'world_concurrent',
      seed: 'concurrent-seed',
      store,
      agentNames: [],
      startTime: 0,
    });
    const stale = await WorldEngine.open({ worldId: 'world_concurrent', store });

    await first.step(1);
    await expect(
      stale.applyDisturbance('resource_shock', 0.1, 1, 8, 'stale_shock'),
    ).rejects.toBeInstanceOf(WorldRevisionConflictError);

    await stale.reload();
    expect(
      await stale.applyDisturbance('resource_shock', 0.1, 1, 8, 'stale_shock'),
    ).toBe(true);
  });

  it('recognizes an exact old retry after the world has progressed', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'world_old_retry',
      seed: 'old-retry-seed',
      store,
      agentNames: [],
      startTime: 0,
    });

    expect(
      await world.applyDisturbance('resource_shock', 0.2, 1, 8, 'old_shock'),
    ).toBe(true);
    expect(await world.step(2)).toBe(true);
    const progressed = world.snapshot();

    expect(
      await world.applyDisturbance('resource_shock', 0.2, 1, 8, 'old_shock'),
    ).toBe(false);
    expect(await world.step(2)).toBe(false);
    expect(world.snapshot()).toEqual(progressed);

    await expect(
      world.applyDisturbance('resource_shock', 0.3, 1, 8, 'old_shock'),
    ).rejects.toThrow('retried with different content');
  });

  it('keeps snapshots committed-only and serializes operations on one engine', async () => {
    const store = new GateCommitStore();
    const world = await WorldEngine.create({
      worldId: 'world_single_engine_concurrency',
      seed: 'single-engine-concurrency',
      store,
      agentNames: [],
      startTime: 0,
    });

    const before = world.snapshot();
    store.armGate();

    const disturbance = world.applyDisturbance(
      'resource_shock',
      0.2,
      1,
      8,
      'gated_shock',
    );
    await store.enteredCommit;

    // The working copy already contains the disturbance, but readers must see
    // only the previous committed projection until commit finishes.
    expect(world.snapshot()).toEqual(before);

    const tick = world.step(1);
    store.release();

    await expect(disturbance).resolves.toBe(true);
    await expect(tick).resolves.toBe(true);

    expect(world.snapshot().revision).toBe(2);
    expect(world.snapshot().now).toBe(1);
    expect(await store.history('world_single_engine_concurrency')).toHaveLength(1);
  });

});

describe('World logical time commits', () => {
  it('does not expose a future disturbance inside an older current-state timestamp', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'world_time',
      seed: 'time-seed',
      store,
      agentNames: [],
      startTime: 0,
    });

    await world.applyDisturbance('resource_shock', 0.2, 1, 8, 'time_shock');
    expect(world.snapshot().now).toBe(1);
    expect((await store.history('world_time'))[0].occurredAt).toBe(1);

    // A disturbance and the autonomous tick may belong to the same logical
    // time. Tick idempotency is tracked by operation ID, not by `now === now`.
    expect(await world.step(1)).toBe(true);
    expect(await world.step(1)).toBe(false);
  });
});
