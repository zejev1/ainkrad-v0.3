import {
  LiveWorldRuntime,
  type CardinalConsoleSnapshot,
  type LiveWorldDisturbance,
  type LiveWorldFrame,
} from './LiveWorldRuntime';
import { createIndexedDbPersistence } from '../persistence/IndexedDbPersistence';
import { WorldRevisionConflictError } from '../world/persistence';
import {
  isWorldSpeedId,
  isWorldSpeedMultiplier,
  LIVE_TICK_DELAY_MS,
} from '../world/WorldClock';
import type {
  WorldSpeedId,
  WorldSpeedMultiplier,
} from '../world/WorldClock';

const WORLD_LOCK_NAME = 'ainkrad-v0-3-live-world-writer';
const WORLD_CHANNEL_NAME = 'ainkrad-v0-3-live-world-frames';
const CLOCK_CHANNEL_NAME = 'ainkrad-v0-3-world-clock-control';
const CONSOLE_CHANNEL_NAME = 'ainkrad-v0-3-cardinal-console';
const FRAME_PROTOCOL_VERSION = 'ainkrad-live-frame-0.3.12';
const COMPATIBLE_FRAME_PROTOCOLS = new Set([
  'ainkrad-live-frame-0.3.10',
  'ainkrad-live-frame-0.3.11',
  FRAME_PROTOCOL_VERSION,
]);

const disturbances: readonly LiveWorldDisturbance[] = [
  { tick: 12, kind: 'resource_shock', magnitude: 0.86 },
  { tick: 30, kind: 'social_barrier', magnitude: 0.82, duration: 14 },
  { tick: 45, kind: 'safety_shock', magnitude: 0.78, duration: 14 },
];

const recurringDisturbances = [
  {
    firstTick: 120,
    interval: 360,
    kind: 'resource_shock',
    magnitude: 0.86,
  },
  {
    firstTick: 300,
    interval: 480,
    kind: 'social_barrier',
    magnitude: 0.82,
    duration: 16,
  },
  {
    firstTick: 420,
    interval: 600,
    kind: 'safety_shock',
    magnitude: 0.78,
    duration: 16,
  },
] as const;

type LiveWorldWorkerMessage =
  | {
      type: 'frame';
      protocolVersion: typeof FRAME_PROTOCOL_VERSION;
      frame: LiveWorldFrame;
    }
  | {
      type: 'cardinal_console';
      protocolVersion: typeof FRAME_PROTOCOL_VERSION;
      requestId: string;
      snapshot: CardinalConsoleSnapshot;
    }
  | {
      type: 'fatal';
      protocolVersion: typeof FRAME_PROTOCOL_VERSION;
      message: string;
    };

interface LiveWorldClockMessage {
  type: 'set_speed';
  speedId: WorldSpeedId;
  multiplier: WorldSpeedMultiplier;
}

interface CardinalConsoleRequest {
  type: 'request_cardinal_console';
  requestId: string;
}

type LiveWorldWorkerCommand = LiveWorldClockMessage | CardinalConsoleRequest;

type CardinalConsoleChannelMessage =
  | CardinalConsoleRequest
  | Extract<LiveWorldWorkerMessage, { type: 'cardinal_console' }>;

const workerScope = self as unknown as {
  postMessage(message: LiveWorldWorkerMessage): void;
};

const frameChannel = new BroadcastChannel(WORLD_CHANNEL_NAME);
const clockChannel = new BroadcastChannel(CLOCK_CHANNEL_NAME);
const consoleChannel = new BroadcastChannel(CONSOLE_CHANNEL_NAME);
let activeRuntime: LiveWorldRuntime | undefined;
let pendingClockControl: LiveWorldClockMessage | undefined;

function applyClockControl(message: LiveWorldClockMessage): void {
  if (
    !isWorldSpeedId(message.speedId) ||
    !isWorldSpeedMultiplier(message.multiplier)
  ) {
    throw new Error('Rejected malformed external clock control.');
  }
  pendingClockControl = message;
  activeRuntime?.setWorldSpeed(message.speedId, message.multiplier);
}

self.addEventListener(
  'message',
  (event: MessageEvent<Partial<LiveWorldWorkerCommand>>) => {
    if (event.data.type === 'request_cardinal_console') {
      const request = event.data as CardinalConsoleRequest;
      if (!request.requestId?.trim()) return;
      if (activeRuntime) {
        void sendCardinalConsole(request.requestId, true);
      } else {
        consoleChannel.postMessage(request);
      }
      return;
    }
    if (event.data.type !== 'set_speed') return;
    try {
      const message = event.data as LiveWorldClockMessage;
      applyClockControl(message);
      // If this tab is a read-only mirror, the tab holding the world-writer
      // lock still receives the external console command.
      clockChannel.postMessage(message);
    } catch {
      // Invalid clock commands never enter the autonomous world.
    }
  },
);

async function sendCardinalConsole(
  requestId: string,
  broadcast: boolean,
): Promise<void> {
  if (!activeRuntime) return;
  const message = {
    type: 'cardinal_console',
    protocolVersion: FRAME_PROTOCOL_VERSION,
    requestId,
    snapshot: await activeRuntime.cardinalConsole(),
  } as const;
  workerScope.postMessage(message);
  if (broadcast) consoleChannel.postMessage(message);
}

consoleChannel.addEventListener(
  'message',
  (event: MessageEvent<CardinalConsoleChannelMessage>) => {
    if (event.data.type === 'request_cardinal_console') {
      if (activeRuntime) void sendCardinalConsole(event.data.requestId, true);
      return;
    }
    workerScope.postMessage({
      ...event.data,
      protocolVersion: FRAME_PROTOCOL_VERSION,
    });
  },
);

clockChannel.addEventListener(
  'message',
  (event: MessageEvent<LiveWorldClockMessage>) => {
    if (event.data.type !== 'set_speed') return;
    try {
      applyClockControl(event.data);
    } catch {
      // The independent gateway rejects malformed cross-tab messages.
    }
  },
);

frameChannel.addEventListener(
  'message',
  (event: MessageEvent<Partial<LiveWorldWorkerMessage>>) => {
    // A waiting tab remains a read-only mirror of the tab that owns the
    // exclusive world-writer lock. Compatible old frames are normalized to
    // the current protocol until that tab closes and this worker takes over.
    if (
      !event.data.protocolVersion ||
      !COMPATIBLE_FRAME_PROTOCOLS.has(event.data.protocolVersion)
    ) {
      return;
    }
    workerScope.postMessage({
      ...event.data,
      protocolVersion: FRAME_PROTOCOL_VERSION,
    } as LiveWorldWorkerMessage);
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
    recurringDisturbances,
    store: persistence.worldStore,
    controlLog: persistence.controlLog,
    durable: true,
  });
  activeRuntime = runtime;
  if (pendingClockControl) {
    runtime.setWorldSpeed(
      pendingClockControl.speedId,
      pendingClockControl.multiplier,
    );
  }

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
    await sleep(LIVE_TICK_DELAY_MS);
  }
}

async function start(): Promise<void> {
  const lockManager = (
    navigator as unknown as {
      locks?: {
        request(
          name: string,
          options: { mode: 'exclusive'; ifAvailable?: boolean },
          callback: (lock: unknown | null) => Promise<void>,
        ): Promise<void>;
      };
    }
  ).locks;

  if (lockManager) {
    while (true) {
      let acquired = false;
      await lockManager.request(
        WORLD_LOCK_NAME,
        { mode: 'exclusive', ifAvailable: true },
        async (lock) => {
          if (!lock) return;
          acquired = true;
          await runForever();
        },
      );
      if (acquired) return;
      await sleep(1_500);
    }
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
