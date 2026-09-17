import type { LiveWorldFrame } from '../runtime/LiveWorldRuntime';
import { worldExplorationLevel, worldExplorationPercent } from './WorldExplorationProgress';

const WORLD_CHANNEL_NAME = 'ainkrad-v0-3-live-world-frames';

type FrameMessage = {
  type: 'frame';
  frame: LiveWorldFrame;
};

function applyWorldExplorationDisplay(frame: LiveWorldFrame): void {
  const world = frame.world;
  const level = worldExplorationLevel(world);
  const percent = worldExplorationPercent(world);

  // Browser.ts owns the main render. Run on the next animation frame so this
  // read-only correction always lands after the normal frame renderer.
  requestAnimationFrame(() => {
    const title = document.getElementById('world-title');
    const levelValue = document.getElementById('world-level-value');
    const growthValue = document.getElementById('growth-value');
    if (title) title.textContent = `Мир · уровень ${level}`;
    if (levelValue) levelValue.textContent = `ур. ${level}`;
    if (growthValue) {
      growthValue.textContent = `${Object.keys(world.places).length} мест · изучено ${percent}%`;
    }
  });
}

const channel = new BroadcastChannel(WORLD_CHANNEL_NAME);
channel.addEventListener('message', (event: MessageEvent<Partial<FrameMessage>>) => {
  if (event.data.type !== 'frame' || !event.data.frame) return;
  applyWorldExplorationDisplay(event.data.frame);
});
