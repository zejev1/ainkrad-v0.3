import type { LiveWorldFrame } from '../runtime/LiveWorldRuntime';
import { worldExplorationLevel, worldExplorationPercent } from './WorldExplorationProgress';

type AinkradWindow = Window & {
  __ainkradLatestFrame?: LiveWorldFrame;
};

const FRAME_EVENT = 'ainkrad:live-world-frame';
const RECOMPUTE_INTERVAL_MS = 10_000;
let latestFrame: LiveWorldFrame | undefined;
let lastComputedAt = Number.NEGATIVE_INFINITY;
let cachedLevel = 1;
let cachedPercent = 0;
let cachedPlaceCount = 0;
let rafPending = false;

function formatPercent(percent: number): string {
  if (percent >= 100) return '100%';
  if (percent >= 10) return `${percent.toFixed(1)}%`;
  return `${percent.toFixed(2)}%`;
}

function renderCached(): void {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const title = document.getElementById('world-title');
    const levelValue = document.getElementById('world-level-value');
    const growthValue = document.getElementById('growth-value');
    if (title) title.textContent = `Мир · уровень ${cachedLevel}`;
    if (levelValue) levelValue.textContent = `ур. ${cachedLevel}`;
    if (growthValue) {
      growthValue.textContent = `${cachedPlaceCount} мест · изучено ${formatPercent(cachedPercent)}`;
    }
  });
}

function acceptFrame(frame: LiveWorldFrame): void {
  latestFrame = frame;
  const now = performance.now();
  // Heavy evidence folding is presentation-only and runs at most once per
  // ten real seconds. Ordinary frames only perform the cheap cached DOM write.
  if (lastComputedAt === Number.NEGATIVE_INFINITY || now - lastComputedAt >= RECOMPUTE_INTERVAL_MS) {
    cachedLevel = worldExplorationLevel(frame.world);
    cachedPercent = worldExplorationPercent(frame.world);
    cachedPlaceCount = Object.keys(frame.world.places).length;
    lastComputedAt = now;
  }
  renderCached();
}

window.addEventListener(FRAME_EVENT, (event) => {
  const frame = (event as CustomEvent<LiveWorldFrame>).detail;
  if (frame) acceptFrame(frame);
});

const initial = (window as AinkradWindow).__ainkradLatestFrame;
if (initial) acceptFrame(initial);

// Browser.ts rewrites these labels on accepted worker frames. Re-apply only
// cached values; there is no world scan or simulation work in this timer.
setInterval(() => {
  if (latestFrame) renderCached();
}, 1_000);
