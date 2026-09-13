import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { nextCatchUpBatchSize } from '../src/runtime/LiveAccelerationBudget';
import { WORLD_MINUTES_PER_YEAR as YEAR } from '../src/world/WorldClock';

const temp = process.env.RUNNER_TEMP!;
assert(temp);
const probe = join(temp, 'fix4-command-probe');
writeFileSync(probe, 'execution-read-write-ok');
assert.equal(readFileSync(probe, 'utf8'), 'execution-read-write-ok'); rmSync(probe);
const base = resolve(process.argv[2]);
const readModule = (path: string) => import(pathToFileURL(join(base, path)).href);
const [{ LiveWorldRuntime: OldRuntime }, { InMemoryWorldStore: OldStore },
  { InMemoryAppendOnlyLog: OldLog }] = await Promise.all([
    readModule('src/runtime/LiveWorldRuntime.ts'), readModule('src/world/InMemoryWorldStore.ts'),
    readModule('src/persistence/AppendOnlyLog.ts')]);
const options = { worldId: 'fix4-throughput', seed: 'ainkrad-browser-world', mode: 'observer' as const,
  worldSpeedId: 'century_per_minute' as const };
const old = await OldRuntime.create({ ...options, store: new OldStore(), controlLog: new OldLog() });
const next = await LiveWorldRuntime.create({ ...options, store: new InMemoryWorldStore(), controlLog: new InMemoryAppendOnlyLog(),
  boundedLiveAcceleration: true });
old.enqueueLiveElapsed(60_000); old.setWorldSpeed('real_time', 1);
assert.equal(old.liveTiming().pendingWorldMinutes, YEAR * 100);
next.enqueueLiveElapsed(60_000);
assert(next.liveTiming().pendingWorldMinutes < YEAR);
next.discardPendingLiveTime();
assert.equal(next.liveTiming().pendingWorldMinutes, 0);

async function advance(runtime: LiveWorldRuntime, target: number, size: number) {
  while (!(await runtime.catchUpBatchTo(target, size)).completed) { /* no skipped semantic steps */ }
}
await advance(old, YEAR * 27, 24);
await advance(next, YEAR * 27, 24);
assert.deepEqual(next.worldSnapshot(), old.worldSnapshot(), 'The optimized metadata read changed world history.');
const population = Object.values(next.worldSnapshot().agents).filter(a => a.life.alive).length;
const oldStart = performance.now();
await advance(old, YEAR * 28, 1);
const baselineSeconds = (performance.now() - oldStart) / 1000;
let size = 4, batches = 0, largestBatchMs = 0;
const newStart = performance.now();
while (true) {
  const started = performance.now();
  const batch = await next.catchUpBatchTo(YEAR * 28, size);
  const ms = performance.now() - started;
  largestBatchMs = Math.max(largestBatchMs, ms); batches++;
  size = nextCatchUpBatchSize(size, batch.semanticQuantaProcessed, ms);
  if (batch.completed) break;
}
const fixedSeconds = (performance.now() - newStart) / 1000;
const { revision: _oldRevision, ...oldLife } = old.worldSnapshot();
const { revision: _newRevision, ...newLife } = next.worldSnapshot();
assert.deepEqual(newLife, oldLife, 'Resident history, RNG or canonical time changed when batching.');
assert(fixedSeconds < baselineSeconds, 'The measured mature-world catch-up did not improve.');
const report = { environment: 'Node 22 / GitHub Actions, in-memory persistence; not Android or Xbox',
  baseline: process.argv[3], populationAt27Years: population, comparedWorldYears: 1,
  baselineSeconds, fixedSeconds, speedup: baselineSeconds / fixedSeconds,
  newBatches: batches, largestNewBatchMs: largestBatchMs,
  worldHistoryEqualExceptRevision: true, originalQueueYearsAfterSlowdown: 100,
  browserQueueBounded: true, cancellationPreservesCommittedWorld: true, ioProbe: 'passed' };
console.log('FIX4_BENCHMARK=' + JSON.stringify(report));
writeFileSync(join(temp, 'ainkrad-fix4-benchmark.json'), JSON.stringify(report, null, 2));
