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

/**
 * Тайная библиотека не должна пересчитываться
 * на каждом тике мира.
 *
 * Полный интеграционный проход — тяжёлая операция:
 * он читает WorldState, клонирует состояние и
 * проверяет маршруты/посетителей.
 */
const SECRET_LIBRARY_CHECK_EVERY_CALLS =
  20;

let bridgeCallCounter =
  0;

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

/**
 * Принудительный запуск:
 * используется там, где библиотеку нужно
 * синхронизировать немедленно:
 * - старт runtime;
 * - новый мир.
 */
export async function forceSecretLibraryRuntimeBridgeV18(
  runtime:
    LiveWorldRuntime,

  store:
    WorldStore,
): Promise<
  SecretLibraryIntegrationResultV18
> {
  bridgeCallCounter =
    0;

  const result =
    await runSecretLibraryIntegrationV18(
      store,
      runtime.worldSnapshot(),
    );

  if (result.changed) {
    await runtime.synchronize();
  }

  lastResult =
    result;

  return result;
}

/**
 * Обычный дешёвый вызов из основного цикла.
 *
 * Реальная интеграция запускается только
 * раз в 20 обращений, а не каждый тик.
 */
export async function runSecretLibraryRuntimeBridgeV18(
  runtime:
    LiveWorldRuntime,

  store:
    WorldStore,
): Promise<
  SecretLibraryIntegrationResultV18
> {
  bridgeCallCounter +=
    1;

  if (
    bridgeCallCounter <
    SECRET_LIBRARY_CHECK_EVERY_CALLS
  ) {
    return lastResult;
  }

  bridgeCallCounter =
    0;

  const result =
    await runSecretLibraryIntegrationV18(
      store,
      runtime.worldSnapshot(),
    );

  if (result.changed) {
    await runtime.synchronize();
  }

  lastResult =
    result;

  return result;
}
