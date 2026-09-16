import { InMemoryAppendOnlyLog } from '../persistence/AppendOnlyLog';
import { LiveWorldRuntime } from '../runtime/LiveWorldRuntime';
import { InMemoryWorldStore } from '../world/InMemoryWorldStore';
import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';
import { lifeContinuityDiagnosticsV22 } from './LifeContinuityDiagnosticsV22';

declare const process: { argv: string[] };
const seed = process.argv[2] ?? 'life-repair-control-a';
const checkpoints = (process.argv[3] ?? '10,20').split(',').map(Number);
if (!checkpoints.length || checkpoints.some((y, i) => !Number.isFinite(y) || y <= 0 || (i > 0 && y <= checkpoints[i - 1]))) {
  throw new Error('Checkpoint years must be positive, finite, and strictly increasing.');
}
const runtime = await LiveWorldRuntime.create({
  mode: 'off', seed, worldId: `v18-offline-benchmark-${seed}`,
  store: new InMemoryWorldStore(), controlLog: new InMemoryAppendOnlyLog(), durable: false,
});
const start = performance.now();
let currentWorldMinutes = 0;
for (const year of checkpoints) {
  const target = year * WORLD_MINUTES_PER_YEAR;
  while (currentWorldMinutes < target - 1e-7) {
    const batch = await runtime.catchUpBatchTo(target);
    currentWorldMinutes = batch.currentWorldMinutes;
    if (batch.completed) break;
  }
  console.log(JSON.stringify({
    seed, checkpoint: year, elapsedSeconds: Number(((performance.now() - start) / 1_000).toFixed(3)),
    ...lifeContinuityDiagnosticsV22(runtime.worldSnapshot()),
  }));
}
console.log(JSON.stringify({ completed: true, seed, checkpoints }));
