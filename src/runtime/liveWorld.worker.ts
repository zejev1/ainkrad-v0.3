import { cooperativeWorldTimeExecution } from '../world/WorldTimeExecution';
import { ExternalClockCommands, type ExternalClockCommand } from './ExternalClockCommands';
import {
  INITIAL_RAPID_CATCH_UP_BATCH_QUANTA,
  MAX_RAPID_CATCH_UP_BATCH_QUANTA,
  nextCatchUpBatchSize,
} from './LiveAccelerationBudget';
import { LiveWallClock, liveLoopDelay } from './LiveWallClock';
import {
  LiveWorldRuntime,
  OFFLINE_CATCH_UP_MAX_BATCH_QUANTA,
  type CardinalConsoleSnapshot,
  type LiveWorldDisturbance,
  type LiveWorldFrame,
} from './LiveWorldRuntime';
import { createIndexedDbPersistence } from '../persistence/IndexedDbPersistence';
import { WorldRevisionConflictError } from '../world/persistence';
import type {
  WorldSpeedId,
  WorldSpeedMultiplier,
} from '../world/WorldClock';
import {
  DEFAULT_WORLD_SPEED_ID,
  isMaximumAccelerationSpeed,
} from '../world/WorldClock';
import type {
  DivineContactKind,
  DivineGiftKind,
  DivineBurdenKind,
} from '../world/types';
import type { V19DivineInterpretation } from '../v19/types';

const WORLD_LOCK_NAME = 'ainkrad-v0-3-live-world-writer';
const WORLD_CHANNEL_NAME = 'ainkrad-v0-3-live-world-frames';
const CLOCK_CHANNEL_NAME = 'ainkrad-v0-3-world-clock-control';
const CONSOLE_CHANNEL_NAME = 'ainkrad-v0-3-cardinal-console';
const RESET_CHANNEL_NAME = 'ainkrad-v0-3-world-reset';
const OFFLINE_CLOCK_CHANNEL_NAME = 'ainkrad-v0-3-offline-clock';
const DIVINE_AUDIENCE_CHANNEL_NAME = 'ainkrad-v0-3-divine-audience';
const STORAGE_CHECK_INTERVAL_TICKS = 300;
const AINKRAD_STORAGE_SOFT_BUDGET_BYTES = 2 * 1024 * 1024 * 1024;
const AINKRAD_STORAGE_CRITICAL_BUDGET_BYTES = 4 * 1024 * 1024 * 1024;
const FRAME_PROTOCOL_VERSION = 'ainkrad-live-frame-0.3.21-hotfix.10.4';
const COMPATIBLE_FRAME_PROTOCOLS = new Set([FRAME_PROTOCOL_VERSION]);

// Test disturbances never run automatically in the persistent live world.
const disturbances: readonly LiveWorldDisturbance[] = [];
const recurringDisturbances = [] as const;

type LiveWorldWorkerPayload =
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
      type: 'catch_up_progress';
      protocolVersion: typeof FRAME_PROTOCOL_VERSION;
      worldEpoch: number;
      fromWorldMinutes: number;
      currentWorldMinutes: number;
      targetWorldMinutes: number;
      percent: number;
      elapsedRealMs: number;
      estimatedRemainingMs: number | null;
      semanticQuantaProcessed: number;
      completed: boolean;
    }
  | {
      type: 'catch_up_recovery';
      protocolVersion: typeof FRAME_PROTOCOL_VERSION;
      message: string;
      batchQuanta: number;
      abandoned: boolean;
    }
  | {
      type: 'clock_applied';
      protocolVersion: typeof FRAME_PROTOCOL_VERSION;
      speedId: WorldSpeedId;
      multiplier: WorldSpeedMultiplier;
      worldEpoch: number;
      currentWorldMinutes: number;
      discarded: boolean;
    }
  | {
      type: 'fatal';
      protocolVersion: typeof FRAME_PROTOCOL_VERSION;
      message: string;
    }
  | {
      type: 'divine_audience_result';
      protocolVersion: typeof FRAME_PROTOCOL_VERSION;
      requestId: string;
      agentId: string;
      authorized: boolean;
      giftGranted?: boolean;
      burdenApplied?: boolean;
      contactRecorded?: boolean;
      interpretation?: V19DivineInterpretation;
      residentResponse?: string;
      reason: string;
    };

type LiveWorldWorkerMessage = LiveWorldWorkerPayload & { clockRevision?: number };
type LiveWorldClockMessage = ExternalClockCommand;

interface CardinalConsoleRequest {
  type: 'request_cardinal_console';
  requestId: string;
}

interface OfflineClockCatchUpMessage {
  type: 'catch_up_world_time';
  clockRevision: number;
  worldEpoch: number;
  targetWorldMinutes: number;
}

interface DivineAudiencePauseCommand {
  type: 'set_divine_audience_pause';
  paused: boolean;
}

interface PrivateDivineAudienceCommand {
  type: 'grant_private_divine_audience';
  requestId: string;
  agentId: string;
  deityId: string;
  deityName: string;
  religionName?: string;
  message?: string;
  gift?: DivineGiftKind;
  inheritanceGift?: DivineGiftKind;
  burden?: DivineBurdenKind;
  lineageCurse?: boolean;
  contactKind?: DivineContactKind;
  relatedPrayerId?: string;
}

type LiveWorldWorkerCommand =
  | LiveWorldClockMessage
  | OfflineClockCatchUpMessage
  | CardinalConsoleRequest
  | DivineAudiencePauseCommand
  | PrivateDivineAudienceCommand
  | { type: 'reset_world' };

type CardinalConsoleChannelMessage =
  | CardinalConsoleRequest
  | Extract<LiveWorldWorkerMessage, { type: 'cardinal_console' }>;

const workerScope = self as unknown as {
  postMessage(message: LiveWorldWorkerMessage): void;
};

const frameChannel = new BroadcastChannel(WORLD_CHANNEL_NAME);
const clockChannel = new BroadcastChannel(CLOCK_CHANNEL_NAME);
const consoleChannel = new BroadcastChannel(CONSOLE_CHANNEL_NAME);
const resetChannel = new BroadcastChannel(RESET_CHANNEL_NAME);
const offlineClockChannel = new BroadcastChannel(OFFLINE_CLOCK_CHANNEL_NAME);
const divineAudienceChannel = new BroadcastChannel(DIVINE_AUDIENCE_CHANNEL_NAME);
let activeRuntime: LiveWorldRuntime | undefined;
const liveWallClock = new LiveWallClock(performance.now());
const clockCommands = new ExternalClockCommands();
let appliedClockRevision = 0;
let pendingWorldReset = false;
let pendingOfflineCatchUp: OfflineClockCatchUpMessage | undefined;
let divineAudiencePaused = false;
let catchUpBatchQuanta = INITIAL_RAPID_CATCH_UP_BATCH_QUANTA;
let catchUpBatchCeiling = MAX_RAPID_CATCH_UP_BATCH_QUANTA;
let appliedSpeedId: WorldSpeedId = DEFAULT_WORLD_SPEED_ID;
let lastCatchUpProgressPostedAt = 0;
let catchUpFailureCount = 0;
let catchUpTracker:
  | {
      worldEpoch: number;
      startWorldMinutes: number;
      targetWorldMinutes: number;
      startedRealMs: number;
      semanticQuantaProcessed: number;
    }
  | undefined;

function applyClockControl(message: LiveWorldClockMessage): void {
  clockCommands.enqueue(message);
}

function applyOfflineCatchUp(message: OfflineClockCatchUpMessage): void {
  if (
    !Number.isInteger(message.worldEpoch) ||
    message.worldEpoch < 1 ||
    !Number.isFinite(message.targetWorldMinutes) ||
    message.targetWorldMinutes < 0
  ) {
    throw new Error('Rejected malformed offline world-clock target.');
  }
  if (!clockCommands.acceptsTarget(message.clockRevision)) return;
  if (
    !pendingOfflineCatchUp ||
    pendingOfflineCatchUp.worldEpoch !== message.worldEpoch ||
    message.targetWorldMinutes > pendingOfflineCatchUp.targetWorldMinutes
  ) {
    if (
      !pendingOfflineCatchUp ||
      pendingOfflineCatchUp.worldEpoch !== message.worldEpoch
    ) {
      catchUpBatchQuanta = INITIAL_RAPID_CATCH_UP_BATCH_QUANTA;
      catchUpBatchCeiling = MAX_RAPID_CATCH_UP_BATCH_QUANTA;
      catchUpFailureCount = 0;
    }
    activeRuntime?.coverLiveTimeThrough(message.targetWorldMinutes, message.worldEpoch);
    pendingOfflineCatchUp = message;
  }
}

function readableError(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'Unknown offline catch-up error.';
}

function publishCatchUpRecovery(
  message: string,
  abandoned: boolean,
): void {
  const recovery = {
    type: 'catch_up_recovery',
    protocolVersion: FRAME_PROTOCOL_VERSION, clockRevision: appliedClockRevision,
    message,
    batchQuanta: catchUpBatchQuanta,
    abandoned,
  } as const;
  workerScope.postMessage(recovery);
  frameChannel.postMessage(recovery);
}

function applyDivineAudiencePause(message: DivineAudiencePauseCommand): void {
  if (!divineAudiencePaused && activeRuntime && !pendingOfflineCatchUp) {
    activeRuntime.enqueueLiveElapsed(liveWallClock.sample(performance.now()));
  }
  liveWallClock.reset(performance.now());
  divineAudiencePaused = message.paused === true;
}

async function grantPrivateDivineAudience(
  request: PrivateDivineAudienceCommand,
  broadcast: boolean,
): Promise<void> {
  if (!activeRuntime) return;
  applyDivineAudiencePause({ type: 'set_divine_audience_pause', paused: true });
  const record = await activeRuntime.grantPrivateDivineAudience({
    requestId: request.requestId,
    agentId: request.agentId,
    deityId: request.deityId,
    deityName: request.deityName,
    ...(request.religionName?.trim()
      ? { religionName: request.religionName.trim() }
      : {}),
    ...(request.message?.trim() ? { message: request.message.trim() } : {}),
    ...(request.gift ? { gift: request.gift } : {}),
    ...(request.contactKind ? { contactKind: request.contactKind } : {}),
    ...(request.inheritanceGift ? { inheritanceGift: request.inheritanceGift } : {}),
    ...(request.burden ? { burden: request.burden, lineageCurse: Boolean(request.lineageCurse) } : {}),
    ...(request.relatedPrayerId
      ? { relatedPrayerId: request.relatedPrayerId }
      : {}),
  });
  const world = activeRuntime.worldSnapshot();
  const profile = world.v19?.divineAgency.byAgentId[request.agentId];
  const gift = profile?.gifts.find(
    (candidate) => candidate.id === `gift:${request.requestId}`,
  );
  const contact = profile?.contacts.find(
    (candidate) => candidate.id === `contact:${request.requestId}`,
  );
  const burden = profile?.burdens?.find(
    (candidate) => candidate.id === `burden:${request.requestId}`,
  );
  const result = {
    type: 'divine_audience_result',
    protocolVersion: FRAME_PROTOCOL_VERSION, clockRevision: appliedClockRevision,
    requestId: request.requestId,
    agentId: request.agentId,
    authorized: record.authorized,
    ...(record.authorized
      ? {
          giftGranted: Boolean(gift),
          burdenApplied: Boolean(burden),
          contactRecorded: Boolean(contact),
          ...(contact?.interpretation || gift?.interpretation
            ? { interpretation: contact?.interpretation ?? gift?.interpretation }
            : {}),
          ...(contact?.residentResponse || gift?.residentResponse || burden?.residentResponse
            ? { residentResponse: contact?.residentResponse ?? gift?.residentResponse ?? burden?.residentResponse }
            : {}),
        }
      : {}),
    reason: record.reason,
  } as const;
  workerScope.postMessage(result);
  if (broadcast) divineAudienceChannel.postMessage(result);

  const frame = await activeRuntime.tick(0);
  const frameMessage = {
    type: 'frame',
    protocolVersion: FRAME_PROTOCOL_VERSION, clockRevision: appliedClockRevision,
    frame,
  } as const;
  workerScope.postMessage(frameMessage);
  frameChannel.postMessage(frameMessage);
}

self.addEventListener(
  'message',
  (event: MessageEvent<Partial<LiveWorldWorkerCommand>>) => {
    if (event.data.type === 'reset_world') {
      if (activeRuntime) pendingWorldReset = true;
      else resetChannel.postMessage({ type: 'reset_world' });
      return;
    }

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
    if (event.data.type === 'set_divine_audience_pause') {
      const message = event.data as DivineAudiencePauseCommand;
      applyDivineAudiencePause(message);
      divineAudienceChannel.postMessage(message);
      return;
    }
    if (event.data.type === 'grant_private_divine_audience') {
      const request = event.data as PrivateDivineAudienceCommand;
      if (activeRuntime) void grantPrivateDivineAudience(request, true);
      else divineAudienceChannel.postMessage(request);
      return;
    }
    if (event.data.type === 'catch_up_world_time') {
      try {
        const message = event.data as OfflineClockCatchUpMessage;
        applyOfflineCatchUp(message);
        offlineClockChannel.postMessage(message);
      } catch {
        // Malformed wall-clock requests never enter canonical world time.
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
    protocolVersion: FRAME_PROTOCOL_VERSION, clockRevision: appliedClockRevision,
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

resetChannel.addEventListener('message', (event: MessageEvent<{ type: 'reset_world' }>) => {
  if (event.data.type === 'reset_world' && activeRuntime) pendingWorldReset = true;
});

offlineClockChannel.addEventListener(
  'message',
  (event: MessageEvent<OfflineClockCatchUpMessage>) => {
    if (event.data.type !== 'catch_up_world_time') return;
    try {
      applyOfflineCatchUp(event.data);
    } catch {
      // Cross-tab messages receive the same strict validation.
    }
  },
);

divineAudienceChannel.addEventListener(
  'message',
  (event: MessageEvent<
    DivineAudiencePauseCommand |
    PrivateDivineAudienceCommand |
    Extract<LiveWorldWorkerMessage, { type: 'divine_audience_result' }>
  >) => {
    if (event.data.type === 'set_divine_audience_pause') {
      applyDivineAudiencePause(event.data);
      return;
    }
    if (event.data.type === 'grant_private_divine_audience') {
      if (activeRuntime) void grantPrivateDivineAudience(event.data, true);
      return;
    }
    workerScope.postMessage(event.data);
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
    // exclusive world-writer lock. Older code must not masquerade as the new
    // simulation; the existing tab keeps its save until ownership is released.
    if (
      !event.data.protocolVersion ||
      !COMPATIBLE_FRAME_PROTOCOLS.has(event.data.protocolVersion)
    ) {
      if (event.data.type === 'frame' && event.data.protocolVersion) workerScope.postMessage({
        type: 'fatal', protocolVersion: FRAME_PROTOCOL_VERSION, clockRevision: appliedClockRevision,
        message: 'Мир открыт другой вкладкой старой версии. Закройте остальные вкладки Ainkrad: сохранённый мир продолжится здесь без сброса.',
      });
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
  if (navigator.storage?.persist) {
    try {
      const persistent = await navigator.storage.persist();
      if (!persistent) {
        console.warn(
          '[Ainkrad storage] Browser did not grant persistent storage; canonical remote persistence is still required.',
        );
      }
    } catch {
      console.warn(
        '[Ainkrad storage] Persistent-storage request failed; continuing without deleting local history.',
      );
    }
  }
  const runtime = await LiveWorldRuntime.create({
    mode: 'intervene',
    seed: 'ainkrad-browser-world',
    worldId: 'ainkrad_live_world',
    disturbances,
    recurringDisturbances,
    store: persistence.worldStore,
    controlLog: persistence.controlLog,
    durable: true,
    boundedLiveAcceleration: true,
  });
  activeRuntime = runtime;
  runtime.setCooperativeExecution(cooperativeWorldTimeExecution(
    () => clockCommands.revision !== appliedClockRevision || pendingWorldReset || divineAudiencePaused,
    () => pendingOfflineCatchUp || isMaximumAccelerationSpeed(appliedSpeedId) ? 48 : 12,
  ));
  liveWallClock.reset(performance.now());
  let lastFramePostedAt = -Infinity;


  while (true) {
    const loopStartedAt = performance.now();
    try {
      const command = clockCommands.take();
      if (command) {
        if (!command.discardPending && !divineAudiencePaused && !pendingOfflineCatchUp) {
          runtime.enqueueLiveElapsed(liveWallClock.sample(performance.now()));
        }
        runtime.setWorldSpeed(command.speedId, command.multiplier);
        appliedSpeedId = command.speedId;
        if (command.discardPending) {
          pendingOfflineCatchUp = undefined;
          catchUpTracker = undefined;
          catchUpBatchQuanta = INITIAL_RAPID_CATCH_UP_BATCH_QUANTA;
          catchUpBatchCeiling = MAX_RAPID_CATCH_UP_BATCH_QUANTA;
          catchUpFailureCount = 0;
          runtime.discardPendingLiveTime();
        }
        appliedClockRevision = command.clockRevision;
        liveWallClock.reset(performance.now());
        const position = runtime.worldContinuityPosition();
        const acknowledgement = { type: 'clock_applied', protocolVersion: FRAME_PROTOCOL_VERSION, clockRevision: appliedClockRevision, speedId: command.speedId, multiplier: command.multiplier,
          worldEpoch: position.worldEpoch, currentWorldMinutes: position.elapsedWorldMinutes,
          discarded: command.discardPending ?? false } as const;
        workerScope.postMessage(acknowledgement);
        frameChannel.postMessage(acknowledgement);
        lastFramePostedAt = -Infinity;
      }
      if (divineAudiencePaused) {
        liveWallClock.reset(performance.now());
        await sleep(100);
        continue;
      }
      if (pendingWorldReset) {
        pendingWorldReset = false;
        pendingOfflineCatchUp = undefined;
        catchUpTracker = undefined;
        catchUpBatchQuanta = INITIAL_RAPID_CATCH_UP_BATCH_QUANTA;
        catchUpBatchCeiling = MAX_RAPID_CATCH_UP_BATCH_QUANTA;
        catchUpFailureCount = 0;
        await runtime.resetWorld();
        liveWallClock.reset(performance.now());
      }
      const beforeFrame = runtime.worldContinuityPosition();
      let completedCatchUpThisLoop = false;
      if (pendingOfflineCatchUp) {
        if (pendingOfflineCatchUp.worldEpoch !== beforeFrame.worldEpoch) {
          pendingOfflineCatchUp = undefined;
          catchUpTracker = undefined;
        } else {
          const targetWorldMinutes = pendingOfflineCatchUp.targetWorldMinutes;
          if (
            targetWorldMinutes <=
            beforeFrame.elapsedWorldMinutes + 1e-7
          ) {
            pendingOfflineCatchUp = undefined;
            catchUpTracker = undefined;
          } else {
            if (
              !catchUpTracker ||
              catchUpTracker.worldEpoch !== pendingOfflineCatchUp.worldEpoch
            ) {
              catchUpTracker = {
                worldEpoch: pendingOfflineCatchUp.worldEpoch,
                startWorldMinutes: beforeFrame.elapsedWorldMinutes,
                targetWorldMinutes,
                startedRealMs: performance.now(),
                semanticQuantaProcessed: 0,
              };
            } else {
              catchUpTracker.targetWorldMinutes = Math.max(
                catchUpTracker.targetWorldMinutes,
                targetWorldMinutes,
              );
            }
            let batch;
            const batchStartedAt = performance.now();
            try {
              batch = await runtime.catchUpBatchTo(
                catchUpTracker.targetWorldMinutes,
                catchUpBatchQuanta,
              );
              catchUpFailureCount = 0;
            } catch (error) {
              if (error instanceof WorldRevisionConflictError) throw error;
              const message = readableError(error);
              console.warn(
                '[Ainkrad offline catch-up] Durable batch failed; restoring the last committed world state.',
                {
                  message,
                  batchQuanta: catchUpBatchQuanta,
                  failureCount: catchUpFailureCount + 1,
                },
              );
              await runtime.synchronize();
              catchUpFailureCount += 1;
              if (catchUpBatchQuanta > 1 && catchUpFailureCount <= 5) {
                catchUpBatchQuanta = Math.max(
                  1,
                  Math.floor(catchUpBatchQuanta / 2),
                );
                catchUpBatchCeiling = catchUpBatchQuanta;
                publishCatchUpRecovery(message, false);
              } else {
                pendingOfflineCatchUp = undefined;
                catchUpTracker = undefined;
                runtime.discardPendingLiveTime();
                liveWallClock.reset(performance.now());
                publishCatchUpRecovery(message, true);
                catchUpBatchQuanta = INITIAL_RAPID_CATCH_UP_BATCH_QUANTA;
                catchUpBatchCeiling = MAX_RAPID_CATCH_UP_BATCH_QUANTA;
                catchUpFailureCount = 0;
              }
              await sleep(0);
              continue;
            }
            const batchWorkMs = Math.max(1, performance.now() - batchStartedAt);
            catchUpBatchQuanta = Math.min(catchUpBatchCeiling, OFFLINE_CATCH_UP_MAX_BATCH_QUANTA,
              nextCatchUpBatchSize(
                catchUpBatchQuanta,
                batch.semanticQuantaProcessed,
                batchWorkMs,
                catchUpBatchCeiling,
              ));
            catchUpTracker.semanticQuantaProcessed +=
              batch.semanticQuantaProcessed;
            const elapsedRealMs = Math.max(
              1,
              performance.now() - catchUpTracker.startedRealMs,
            );
            const total = Math.max(
              1,
              catchUpTracker.targetWorldMinutes -
                catchUpTracker.startWorldMinutes,
            );
            const processed = Math.max(
              0,
              batch.currentWorldMinutes - catchUpTracker.startWorldMinutes,
            );
            const percent = Math.max(0, Math.min(1, processed / total));
            const estimatedRemainingMs =
              processed <= 0
                ? null
                : Math.max(0, (elapsedRealMs / processed) * (total - processed));
            const progressMessage = {
              type: 'catch_up_progress',
              protocolVersion: FRAME_PROTOCOL_VERSION, clockRevision: appliedClockRevision,
              worldEpoch: batch.worldEpoch,
              fromWorldMinutes: catchUpTracker.startWorldMinutes,
              currentWorldMinutes: batch.currentWorldMinutes,
              targetWorldMinutes: catchUpTracker.targetWorldMinutes,
              percent,
              elapsedRealMs,
              estimatedRemainingMs,
              semanticQuantaProcessed: catchUpTracker.semanticQuantaProcessed,
              completed: batch.completed,
            } as const;
            if (batch.completed || performance.now() - lastCatchUpProgressPostedAt >= 500) {
              workerScope.postMessage(progressMessage);
              frameChannel.postMessage(progressMessage);
              lastCatchUpProgressPostedAt = performance.now();
            }
            if (!batch.completed) {
              // Keep UI/clock controls responsive and avoid a continuous hot loop.
              await sleep(clockCommands.revision !== appliedClockRevision ? 0 : liveLoopDelay(batchWorkMs, 1));
              continue;
            }
            pendingOfflineCatchUp = undefined;
            catchUpTracker = undefined;
            catchUpBatchQuanta = INITIAL_RAPID_CATCH_UP_BATCH_QUANTA;
            catchUpBatchCeiling = MAX_RAPID_CATCH_UP_BATCH_QUANTA;
            catchUpFailureCount = 0;
            completedCatchUpThisLoop = true;
          }
        }
      }
      const wallNow = performance.now();
      if (completedCatchUpThisLoop) liveWallClock.reset(wallNow);
      // At fictional Underworld-scale requests, presentation must not compete
      // with residents for device time. One sparse frame keeps controls and
      // clock continuity alive; the browser hides the heavy map between them.
      const frameIntervalMs = isMaximumAccelerationSpeed(appliedSpeedId) ? 10_000 : 1_000;
      const emitFrame = completedCatchUpThisLoop || wallNow - lastFramePostedAt >= frameIntervalMs;
      // Sample BEFORE the await. Work and persistence time are charged by the
      // next iteration; there is no one-second clamp dropping elapsed time.
      const elapsed = liveWallClock.sample(wallNow);
      const frame = completedCatchUpThisLoop ? await runtime.tick(0) :
        await runtime.advanceResponsive(elapsed, emitFrame);
      if (frame) {
        frame.liveTiming = runtime.liveTiming();
        const message = { type: 'frame', protocolVersion: FRAME_PROTOCOL_VERSION, clockRevision: appliedClockRevision, frame } as const;
        workerScope.postMessage(message);
        frameChannel.postMessage(message);
        lastFramePostedAt = wallNow;
      }

      if (
        frame && frame.tick % STORAGE_CHECK_INTERVAL_TICKS === 0 &&
        navigator.storage?.estimate
      ) {
        try {
          const estimate = await navigator.storage.estimate();
          const usage = estimate.usage ?? 0;
          const quota = estimate.quota ?? 0;
          if (
            usage >= AINKRAD_STORAGE_CRITICAL_BUDGET_BYTES ||
            (quota > 0 && usage / quota >= 0.5)
          ) {
            console.error(
              '[Ainkrad storage] CRITICAL: local experiment storage is approaching an unsafe size.',
              { usage, quota },
            );
          } else if (
            usage >= AINKRAD_STORAGE_SOFT_BUDGET_BYTES ||
            (quota > 0 && usage / quota >= 0.25)
          ) {
            console.warn(
              '[Ainkrad storage] Warning: local experiment storage is growing.',
              { usage, quota },
            );
          }
        } catch {
          // Storage diagnostics must never stop the autonomous world.
        }
      }
    } catch (error) {
      if (error instanceof WorldRevisionConflictError) {
        // Browsers without Web Locks can briefly overlap workers. Reload the
        // committed projection instead of losing or overwriting the world.
        await runtime.synchronize();
      } else {
        throw error;
      }
    }
    await sleep(clockCommands.revision !== appliedClockRevision ? 0 : liveLoopDelay(performance.now() - loopStartedAt, runtime.liveTiming().pendingWorldMinutes));
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
    protocolVersion: FRAME_PROTOCOL_VERSION, clockRevision: appliedClockRevision,
    message:
      error instanceof Error
        ? `${error.name}: ${error.message}\n` +
          (activeRuntime?.storageDiagnostics(self.location.origin) ?? `Ошибка загрузки сохранения. Адрес: ${self.location.origin}`)
        : 'Unknown live-world error.',
  } as const;
  console.error('[Ainkrad live world] Worker stopped.', error);
  workerScope.postMessage(message);
});
