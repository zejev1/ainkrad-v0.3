import {
  LiveWorldRuntime,
  type LiveWorldDisturbance,
  type LiveWorldFrame,
} from './LiveWorldRuntime';
import { createIndexedDbPersistence } from '../persistence/IndexedDbPersistence';
import { WorldRevisionConflictError } from '../world/persistence';

const TICK_DELAY_MS = 700;
const WORLD_LOCK_NAME = 'ainkrad-v0-3-live-world-writer';
const WORLD_CHANNEL_NAME = 'ainkrad-v0-3-live-world-frames';
const FRAME_PROTOCOL_VERSION = 'ainkrad-live-frame-0.3.10';

const disturbances: readonly LiveWorldDisturbance[] = [
  { tick: 12, kind: 'resource_shock', magnitude: 0.6 },
  { tick: 30, kind: 'social_barrier', magnitude: 0.5, duration: 8 },
  { tick: 45, kind: 'safety_shock', magnitude: 0.5, duration: 8 },
];

type LiveWorldWorkerMessage =
  | {
      type: 'frame';
      protocolVersion: typeof FRAME_PROTOCOL_VERSION;
      frame: LiveWorldFrame;
    }
  | {
      type: 'fatal';
      protocolVersion: typeof FRAME_PROTOCOL_VERSION;
      message: string;
    };

const workerScope = self as unknown as {
  postMessage(message: LiveWorldWorkerMessage): void;
};

const frameChannel = new BroadcastChannel(WORLD_CHANNEL_NAME);

frameChannel.addEventListener(
  'message',
  (event: MessageEvent<Partial<LiveWorldWorkerMessage>>) => {
    // A waiting tab remains a read-only mirror of the tab that owns the
    // exclusive world-writer lock. Frames from an older deployment are
    // ignored so a legacy tab cannot crash the newly migrated interface.
    if (event.data.protocolVersion !== FRAME_PROTOCOL_VERSION) return;
    workerScope.postMessage(event.data as LiveWorldWorkerMessage);
  },
);

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function runForever(): Promise<void> {
  const persistence = createIndexedDbPersistence();
  const runtime = await LiveWorldRuntime.create({
    mode: 'intervene',
    seed: 'ainkrad-browser-world',
    worldId: 'ainkrad_live_world',
    disturbances,
    store: persistence.worldStore,
    controlLog: persistence.controlLog,
    durable: true,
  });

  while (true) {
    try {
      const frame = await runtime.tick();
      const message = {
        type: 'frame',
        protocolVersion: FRAME_PROTOCOL_VERSION,
        frame,
      } as const;
      workerScope.postMessage(message);
      frameChannel.postMessage(message);
    } catch (error) {
      if (error instanceof WorldRevisionConflictError) {
        // Browsers without Web Locks can briefly overlap workers. Reload the
        // committed projection instead of losing or overwriting the world.
        await runtime.synchronize();
      } else {
        throw error;
      }
    }
    await sleep(TICK_DELAY_MS);
  }
}

async function start(): Promise<void> {
  const lockManager = (
    navigator as unknown as {
      locks?: {
        request(
          name: string,
          options: { mode: 'exclusive' },
          callback: () => Promise<void>,
        ): Promise<void>;
      };
    }
  ).locks;

  if (lockManager) {
    await lockManager.request(
      WORLD_LOCK_NAME,
      { mode: 'exclusive' },
      runForever,
    );
    return;
  }

  await runForever();
}

void start().catch((error: unknown) => {
  const message = {
    type: 'fatal',
    protocolVersion: FRAME_PROTOCOL_VERSION,
    message:
      error instanceof Error
        ? error.message
        : 'Unknown live-world error.',
  } as const;
  workerScope.postMessage(message);
  frameChannel.postMessage(message);
});
