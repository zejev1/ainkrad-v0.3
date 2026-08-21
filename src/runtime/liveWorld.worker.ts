import {
  LiveWorldRuntime,
  type LiveWorldDisturbance,
  type LiveWorldFrame,
} from './runtime/LiveWorldRuntime';

const TICK_DELAY_MS = 550;

const disturbances: readonly LiveWorldDisturbance[] = [
  { tick: 12, kind: 'resource_shock', magnitude: 0.6 },
  { tick: 30, kind: 'social_barrier', magnitude: 0.5, duration: 8 },
  { tick: 45, kind: 'safety_shock', magnitude: 0.5, duration: 8 },
];

type LiveWorldWorkerMessage =
  | { type: 'frame'; frame: LiveWorldFrame }
  | { type: 'fatal'; message: string };

const workerScope = self as unknown as {
  postMessage(message: LiveWorldWorkerMessage): void;
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function runForever(): Promise<void> {
  const runtime = await LiveWorldRuntime.create({
    mode: 'intervene',
    seed: 'ainkrad-browser-world',
    worldId: 'ainkrad_live_world',
    disturbances,
  });

  while (true) {
    const frame = await runtime.tick();
    workerScope.postMessage({ type: 'frame', frame });
    await sleep(TICK_DELAY_MS);
  }
}

void runForever().catch((error: unknown) => {
  workerScope.postMessage({
    type: 'fatal',
    message:
      error instanceof Error
        ? error.message
        : 'Unknown live-world error.',
  });
});