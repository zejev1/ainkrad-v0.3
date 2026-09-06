import type {
  LiveWorldRuntime,
} from '../runtime/LiveWorldRuntime';

import type {
  WorldStore,
} from '../world/persistence';

import {
  runSecretLibraryIntegrationV18,
  type SecretLibraryIntegrationResultV18,
} from './SecretLibraryIntegrationV18';

const SECRET_LIBRARY_CHECK_EVERY_CALLS =
  20;

let bridgeCallCounter =
  0;

let lastWorldEpoch:
  number | undefined;

let initialized =
  false;

let lastResult:
  SecretLibraryIntegrationResultV18 =
  {
    changed: false,
    mounted: false,
    status: 'closed',
    currentYear: 1,
    visitorCount: 0,
    insideCount: 0,
    learnedCount: 0,
  };

async function executeLibraryCycleV18(
  runtime:
    LiveWorldRuntime,

  store:
    WorldStore,
): Promise<
  SecretLibraryIntegrationResultV18
> {
  const snapshot =
    runtime.worldSnapshot();

  const result =
    await runSecretLibraryIntegrationV18(
      store,
      snapshot,
    );

  if (result.changed) {
    await runtime.synchronize();
  }

  lastWorldEpoch =
    snapshot.epoch ?? 1;

  initialized =
    true;

  lastResult =
    result;

  bridgeCallCounter =
    0;

  return result;
}

/**
 * Основной вызов.
 *
 * Полный цикл выполняется:
 * - сразу при первом запуске;
 * - сразу после смены worldEpoch / Новый мир;
 * - затем только раз в 20 обращений.
 */
export async function runSecretLibraryRuntimeBridgeV18(
  runtime:
    LiveWorldRuntime,

  store:
    WorldStore,
): Promise<
  SecretLibraryIntegrationResultV18
> {
  const snapshot =
    runtime.worldSnapshot();

  const currentEpoch =
    snapshot.epoch ?? 1;

  if (
    !initialized ||
    lastWorldEpoch !==
      currentEpoch
  ) {
    return executeLibraryCycleV18(
      runtime,
      store,
    );
  }

  bridgeCallCounter +=
    1;

  if (
    bridgeCallCounter <
    SECRET_LIBRARY_CHECK_EVERY_CALLS
  ) {
    return lastResult;
  }

  return executeLibraryCycleV18(
    runtime,
    store,
  );
}

/**
 * Оставляем отдельный force API
 * на случай будущих ручных вызовов.
 */
export async function forceSecretLibraryRuntimeBridgeV18(
  runtime:
    LiveWorldRuntime,

  store:
    WorldStore,
): Promise<
  SecretLibraryIntegrationResultV18
> {
  return executeLibraryCycleV18(
    runtime,
    store,
  );
}
