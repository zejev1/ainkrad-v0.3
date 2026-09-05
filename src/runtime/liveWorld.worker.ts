import {
  LiveWorldRuntime,
  type CardinalConsoleSnapshot,
  type LiveWorldDisturbance,
  type LiveWorldFrame,
} from './LiveWorldRuntime';

import {
  createIndexedDbPersistence,
} from '../persistence/IndexedDbPersistence';

import {
  WorldRevisionConflictError,
} from '../world/persistence';

import {
  isWorldSpeedId,
  isWorldSpeedMultiplier,
  LIVE_TICK_DELAY_MS,
} from '../world/WorldClock';

import type {
  WorldSpeedId,
  WorldSpeedMultiplier,
} from '../world/WorldClock';

import {
  mountSecretLibraryIntoWorldV18,
} from '../v18/SecretLibraryWorldMountV18';

const WORLD_LOCK_NAME =
  'ainkrad-v0-3-live-world-writer';

const WORLD_CHANNEL_NAME =
  'ainkrad-v0-3-live-world-frames';

const CLOCK_CHANNEL_NAME =
  'ainkrad-v0-3-world-clock-control';

const CONSOLE_CHANNEL_NAME =
  'ainkrad-v0-3-cardinal-console';

const RESET_CHANNEL_NAME =
  'ainkrad-v0-3-world-reset';

const OFFLINE_CLOCK_CHANNEL_NAME =
  'ainkrad-v0-3-offline-clock';

const STORAGE_CHECK_INTERVAL_TICKS =
  300;

const AINKRAD_STORAGE_SOFT_BUDGET_BYTES =
  2 * 1024 * 1024 * 1024;

const AINKRAD_STORAGE_CRITICAL_BUDGET_BYTES =
  4 * 1024 * 1024 * 1024;

const FRAME_PROTOCOL_VERSION =
  'ainkrad-live-frame-0.3.18';

const COMPATIBLE_FRAME_PROTOCOLS =
  new Set([
    'ainkrad-live-frame-0.3.10',
    'ainkrad-live-frame-0.3.11',
    'ainkrad-live-frame-0.3.12',
    'ainkrad-live-frame-0.3.13',
    'ainkrad-live-frame-0.3.14',
    'ainkrad-live-frame-0.3.15',
    'ainkrad-live-frame-0.3.16',
    'ainkrad-live-frame-0.3.17',
    FRAME_PROTOCOL_VERSION,
  ]);

// Test disturbances never run automatically
// in the persistent live world.
const disturbances:
  readonly LiveWorldDisturbance[] =
  [];

const recurringDisturbances =
  [] as const;

type LiveWorldWorkerMessage =
  | {
      type: 'frame';
      protocolVersion:
        typeof FRAME_PROTOCOL_VERSION;
      frame: LiveWorldFrame;
    }
  | {
      type: 'cardinal_console';
      protocolVersion:
        typeof FRAME_PROTOCOL_VERSION;
      requestId: string;
      snapshot:
        CardinalConsoleSnapshot;
    }
  | {
      type: 'catch_up_progress';
      protocolVersion:
        typeof FRAME_PROTOCOL_VERSION;
      worldEpoch: number;
      fromWorldMinutes: number;
      currentWorldMinutes: number;
      targetWorldMinutes: number;
      percent: number;
      elapsedRealMs: number;
      estimatedRemainingMs:
        number | null;
      semanticQuantaProcessed:
        number;
      completed: boolean;
    }
  | {
      type: 'fatal';
      protocolVersion:
        typeof FRAME_PROTOCOL_VERSION;
      message: string;
    };

interface LiveWorldClockMessage {
  type: 'set_speed';
  speedId: WorldSpeedId;
  multiplier:
    WorldSpeedMultiplier;
}

interface CardinalConsoleRequest {
  type:
    'request_cardinal_console';

  requestId:
    string;
}

interface OfflineClockCatchUpMessage {
  type:
    'catch_up_world_time';

  worldEpoch:
    number;

  targetWorldMinutes:
    number;
}

type LiveWorldWorkerCommand =
  | LiveWorldClockMessage
  | OfflineClockCatchUpMessage
  | CardinalConsoleRequest
  | {
      type:
        'reset_world';
    };

type CardinalConsoleChannelMessage =
  | CardinalConsoleRequest
  | Extract<
      LiveWorldWorkerMessage,
      {
        type:
          'cardinal_console';
      }
    >;

const workerScope =
  self as unknown as {
    postMessage(
      message:
        LiveWorldWorkerMessage,
    ): void;
  };

const frameChannel =
  new BroadcastChannel(
    WORLD_CHANNEL_NAME,
  );

const clockChannel =
  new BroadcastChannel(
    CLOCK_CHANNEL_NAME,
  );

const consoleChannel =
  new BroadcastChannel(
    CONSOLE_CHANNEL_NAME,
  );

const resetChannel =
  new BroadcastChannel(
    RESET_CHANNEL_NAME,
  );

const offlineClockChannel =
  new BroadcastChannel(
    OFFLINE_CLOCK_CHANNEL_NAME,
  );

let activeRuntime:
  LiveWorldRuntime |
  undefined;

let pendingClockControl:
  LiveWorldClockMessage |
  undefined;

let pendingWorldReset =
  false;

let pendingOfflineCatchUp:
  OfflineClockCatchUpMessage |
  undefined;

let catchUpTracker:
  | {
      worldEpoch:
        number;

      startWorldMinutes:
        number;

      targetWorldMinutes:
        number;

      startedRealMs:
        number;

      semanticQuantaProcessed:
        number;
    }
  | undefined;

function applyClockControl(
  message:
    LiveWorldClockMessage,
): void {
  if (
    !isWorldSpeedId(
      message.speedId,
    ) ||
    !isWorldSpeedMultiplier(
      message.multiplier,
    )
  ) {
    throw new Error(
      'Rejected malformed external clock control.',
    );
  }

  pendingClockControl =
    message;

  activeRuntime
    ?.setWorldSpeed(
      message.speedId,
      message.multiplier,
    );
}

function applyOfflineCatchUp(
  message:
    OfflineClockCatchUpMessage,
): void {
  if (
    !Number.isInteger(
      message.worldEpoch,
    ) ||
    message.worldEpoch < 1 ||
    !Number.isFinite(
      message.targetWorldMinutes,
    ) ||
    message.targetWorldMinutes <
      0
  ) {
    throw new Error(
      'Rejected malformed offline world-clock target.',
    );
  }

  if (
    !pendingOfflineCatchUp ||
    pendingOfflineCatchUp
      .worldEpoch !==
      message.worldEpoch ||
    message.targetWorldMinutes >
      pendingOfflineCatchUp
        .targetWorldMinutes
  ) {
    pendingOfflineCatchUp =
      message;
  }
}

self.addEventListener(
  'message',

  (
    event:
      MessageEvent<
        Partial<
          LiveWorldWorkerCommand
        >
      >,
  ) => {
    if (
      event.data.type ===
      'reset_world'
    ) {
      if (activeRuntime) {
        pendingWorldReset =
          true;
      } else {
        resetChannel
          .postMessage({
            type:
              'reset_world',
          });
      }

      return;
    }

    if (
      event.data.type ===
      'request_cardinal_console'
    ) {
      const request =
        event.data as CardinalConsoleRequest;

      if (
        !request.requestId
          ?.trim()
      ) {
        return;
      }

      if (activeRuntime) {
        void sendCardinalConsole(
          request.requestId,
          true,
        );
      } else {
        consoleChannel
          .postMessage(
            request,
          );
      }

      return;
    }

    if (
      event.data.type ===
      'catch_up_world_time'
    ) {
      try {
        const message =
          event.data as OfflineClockCatchUpMessage;

        applyOfflineCatchUp(
          message,
        );

        offlineClockChannel
          .postMessage(
            message,
          );
      } catch {
        // Malformed wall-clock requests never enter canonical world time.
      }

      return;
    }

    if (
      event.data.type !==
      'set_speed'
    ) {
      return;
    }

    try {
      const message =
        event.data as LiveWorldClockMessage;

      applyClockControl(
        message,
      );

      // If this tab is a read-only mirror,
      // the tab holding the world-writer
      // lock still receives the external console command.
      clockChannel
        .postMessage(
          message,
        );
    } catch {
      // Invalid clock commands never enter
      // the autonomous world.
    }
  },
);

async function sendCardinalConsole(
  requestId:
    string,

  broadcast:
    boolean,
): Promise<void> {
  if (!activeRuntime) {
    return;
  }

  const message = {
    type:
      'cardinal_console',

    protocolVersion:
      FRAME_PROTOCOL_VERSION,

    requestId,

    snapshot:
      await activeRuntime
        .cardinalConsole(),
  } as const;

  workerScope
    .postMessage(
      message,
    );

  if (broadcast) {
    consoleChannel
      .postMessage(
        message,
      );
  }
}

consoleChannel
  .addEventListener(
    'message',

    (
      event:
        MessageEvent<
          CardinalConsoleChannelMessage
        >,
    ) => {
      if (
        event.data.type ===
        'request_cardinal_console'
      ) {
        if (activeRuntime) {
          void sendCardinalConsole(
            event.data
              .requestId,
            true,
          );
        }

        return;
      }

      workerScope
        .postMessage({
          ...event.data,

          protocolVersion:
            FRAME_PROTOCOL_VERSION,
        });
    },
  );

resetChannel
  .addEventListener(
    'message',

    (
      event:
        MessageEvent<{
          type:
            'reset_world';
        }>,
    ) => {
      if (
        event.data.type ===
          'reset_world' &&
        activeRuntime
      ) {
        pendingWorldReset =
          true;
      }
    },
  );

offlineClockChannel
  .addEventListener(
    'message',

    (
      event:
        MessageEvent<
          OfflineClockCatchUpMessage
        >,
    ) => {
      if (
        event.data.type !==
        'catch_up_world_time'
      ) {
        return;
      }

      try {
        applyOfflineCatchUp(
          event.data,
        );
      } catch {
        // Cross-tab messages receive
        // the same strict validation.
      }
    },
  );

clockChannel
  .addEventListener(
    'message',

    (
      event:
        MessageEvent<
          LiveWorldClockMessage
        >,
    ) => {
      if (
        event.data.type !==
        'set_speed'
      ) {
        return;
      }

      try {
        applyClockControl(
          event.data,
        );
      } catch {
        // The independent gateway rejects
        // malformed cross-tab messages.
      }
    },
  );

frameChannel
  .addEventListener(
    'message',

    (
      event:
        MessageEvent<
          Partial<
            LiveWorldWorkerMessage
          >
        >,
    ) => {
      if (
        !event.data
          .protocolVersion ||
        !COMPATIBLE_FRAME_PROTOCOLS
          .has(
            event.data
              .protocolVersion,
          )
      ) {
        return;
      }

      workerScope
        .postMessage({
          ...event.data,

          protocolVersion:
            FRAME_PROTOCOL_VERSION,
        } as LiveWorldWorkerMessage);
    },
  );

const sleep = (
  milliseconds:
    number,
) =>
  new Promise<void>(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  );

/**
 * Гарантирует, что Тайная библиотека
 * существует как настоящий WorldPlace.
 *
 * После commit runtime перезагружает
 * сохранённую проекцию мира.
 */
async function ensureSecretLibraryMountedV18(
  runtime:
    LiveWorldRuntime,

  worldStore:
    ReturnType<
      typeof createIndexedDbPersistence
    >['worldStore'],
): Promise<void> {
  const world =
    runtime.worldSnapshot();

  const result =
    await mountSecretLibraryIntoWorldV18(
      worldStore,
      world,
    );

  if (result.mounted) {
    await runtime.synchronize();
  }
}

async function runForever():
  Promise<void> {
  const persistence =
    createIndexedDbPersistence();

  if (
    navigator.storage
      ?.persist
  ) {
    try {
      const persistent =
        await navigator.storage
          .persist();

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

  const runtime =
    await LiveWorldRuntime
      .create({
        mode:
          'intervene',

        seed:
          'ainkrad-browser-world',

        worldId:
          'ainkrad_live_world',

        disturbances,

        recurringDisturbances,

        store:
          persistence.worldStore,

        controlLog:
          persistence.controlLog,

        durable:
          true,
      });

  /**
   * ВАЖНО:
   * монтируем библиотеку и в уже существующий мир.
   */
  await ensureSecretLibraryMountedV18(
    runtime,
    persistence.worldStore,
  );

  activeRuntime =
    runtime;

  if (
    pendingClockControl
  ) {
    runtime
      .setWorldSpeed(
        pendingClockControl
          .speedId,

        pendingClockControl
          .multiplier,
      );
  }

  while (true) {
    try {
      if (
        pendingWorldReset
      ) {
        pendingWorldReset =
          false;

        pendingOfflineCatchUp =
          undefined;

        catchUpTracker =
          undefined;

        await runtime
          .resetWorld();

        /**
         * Новый мир получает новую
         * физическую Тайную библиотеку.
         */
        await ensureSecretLibraryMountedV18(
          runtime,
          persistence.worldStore,
        );
      }

      const beforeFrame =
        runtime
          .worldContinuityPosition();

      let completedCatchUpThisLoop =
        false;

      if (
        pendingOfflineCatchUp
      ) {
        if (
          pendingOfflineCatchUp
            .worldEpoch !==
          beforeFrame
            .worldEpoch
        ) {
          pendingOfflineCatchUp =
            undefined;

          catchUpTracker =
            undefined;
        } else {
          const targetWorldMinutes =
            pendingOfflineCatchUp
              .targetWorldMinutes;

          if (
            targetWorldMinutes <=
            beforeFrame
              .elapsedWorldMinutes +
              1e-7
          ) {
            pendingOfflineCatchUp =
              undefined;

            catchUpTracker =
              undefined;
          } else {
            if (
              !catchUpTracker ||
              catchUpTracker
                .worldEpoch !==
                pendingOfflineCatchUp
                  .worldEpoch
            ) {
              catchUpTracker = {
                worldEpoch:
                  pendingOfflineCatchUp
                    .worldEpoch,

                startWorldMinutes:
                  beforeFrame
                    .elapsedWorldMinutes,

                targetWorldMinutes,

                startedRealMs:
                  performance.now(),

                semanticQuantaProcessed:
                  0,
              };
            } else {
              catchUpTracker
                .targetWorldMinutes =
                Math.max(
                  catchUpTracker
                    .targetWorldMinutes,

                  targetWorldMinutes,
                );
            }

            const batch =
              await runtime
                .catchUpBatchTo(
                  catchUpTracker
                    .targetWorldMinutes,
                );

            catchUpTracker
              .semanticQuantaProcessed +=
              batch
                .semanticQuantaProcessed;

            const elapsedRealMs =
              Math.max(
                1,

                performance.now() -
                  catchUpTracker
                    .startedRealMs,
              );

            const total =
              Math.max(
                1,

                catchUpTracker
                  .targetWorldMinutes -
                  catchUpTracker
                    .startWorldMinutes,
              );

            const processed =
              Math.max(
                0,

                batch
                  .currentWorldMinutes -
                  catchUpTracker
                    .startWorldMinutes,
              );

            const percent =
              Math.max(
                0,

                Math.min(
                  1,

                  processed /
                    total,
                ),
              );

            const estimatedRemainingMs =
              processed <= 0
                ? null
                : Math.max(
                    0,

                    (
                      elapsedRealMs /
                      processed
                    ) *
                      (
                        total -
                        processed
                      ),
                  );

            const progressMessage = {
              type:
                'catch_up_progress',

              protocolVersion:
                FRAME_PROTOCOL_VERSION,

              worldEpoch:
                batch.worldEpoch,

              fromWorldMinutes:
                catchUpTracker
                  .startWorldMinutes,

              currentWorldMinutes:
                batch
                  .currentWorldMinutes,

              targetWorldMinutes:
                catchUpTracker
                  .targetWorldMinutes,

              percent,

              elapsedRealMs,

              estimatedRemainingMs,

              semanticQuantaProcessed:
                catchUpTracker
                  .semanticQuantaProcessed,

              completed:
                batch.completed,
            } as const;

            workerScope
              .postMessage(
                progressMessage,
              );

            frameChannel
              .postMessage(
                progressMessage,
              );

            if (
              !batch.completed
            ) {
              await sleep(0);

              continue;
            }

            pendingOfflineCatchUp =
              undefined;

            catchUpTracker =
              undefined;

            completedCatchUpThisLoop =
              true;
          }
        }
      }

      const frame =
        await runtime.tick(
          completedCatchUpThisLoop
            ? 0
            : undefined,
        );

      const message = {
        type:
          'frame',

        protocolVersion:
          FRAME_PROTOCOL_VERSION,

        frame,
      } as const;

      workerScope
        .postMessage(
          message,
        );

      frameChannel
        .postMessage(
          message,
        );

      if (
        frame.tick %
          STORAGE_CHECK_INTERVAL_TICKS ===
          0 &&
        navigator.storage
          ?.estimate
      ) {
        try {
          const estimate =
            await navigator.storage
              .estimate();

          const usage =
            estimate.usage ??
            0;

          const quota =
            estimate.quota ??
            0;

          if (
            usage >=
              AINKRAD_STORAGE_CRITICAL_BUDGET_BYTES ||
            (
              quota > 0 &&
              usage /
                quota >=
                0.5
            )
          ) {
            console.error(
              '[Ainkrad storage] CRITICAL: local experiment storage is approaching an unsafe size.',
              {
                usage,
                quota,
              },
            );
          } else if (
            usage >=
              AINKRAD_STORAGE_SOFT_BUDGET_BYTES ||
            (
              quota > 0 &&
              usage /
                quota >=
                0.25
            )
          ) {
            console.warn(
              '[Ainkrad storage] Warning: local experiment storage is growing.',
              {
                usage,
                quota,
              },
            );
          }
        } catch {
          // Storage diagnostics must never stop
          // the autonomous world.
        }
      }
    } catch (error) {
      if (
        error instanceof
        WorldRevisionConflictError
      ) {
        await runtime
          .synchronize();
      } else {
        throw error;
      }
    }

    await sleep(
      LIVE_TICK_DELAY_MS,
    );
  }
}

async function start():
  Promise<void> {
  const lockManager =
    (
      navigator as unknown as {
        locks?: {
          request(
            name:
              string,

            options: {
              mode:
                'exclusive';

              ifAvailable?:
                boolean;
            },

            callback: (
              lock:
                unknown |
                null,
            ) => Promise<void>,
          ): Promise<void>;
        };
      }
    ).locks;

  if (lockManager) {
    while (true) {
      let acquired =
        false;

      await lockManager
        .request(
          WORLD_LOCK_NAME,

          {
            mode:
              'exclusive',

            ifAvailable:
              true,
          },

          async (
            lock,
          ) => {
            if (!lock) {
              return;
            }

            acquired =
              true;

            await runForever();
          },
        );

      if (acquired) {
        return;
      }

      await sleep(
        1_500,
      );
    }
  }

  await runForever();
}

void start()
  .catch(
    (
      error:
        unknown,
    ) => {
      const message = {
        type:
          'fatal',

        protocolVersion:
          FRAME_PROTOCOL_VERSION,

        message:
          error instanceof
          Error
            ? error.message
            : 'Unknown live-world error.',
      } as const;

      workerScope
        .postMessage(
          message,
        );

      frameChannel
        .postMessage(
          message,
        );
    },
  );
