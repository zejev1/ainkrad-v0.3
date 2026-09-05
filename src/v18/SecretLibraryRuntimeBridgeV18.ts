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
 * Связка настоящего runtime Ainkrad
 * с Тайной библиотекой.
 *
 * После изменения persisted WorldState
 * runtime сразу перечитывает его.
 */
export async function runSecretLibraryRuntimeBridgeV18(
  runtime:
    LiveWorldRuntime,

  store:
    WorldStore,
): Promise<
  SecretLibraryIntegrationResultV18
> {
  const result =
    await runSecretLibraryIntegrationV18(
      store,
      runtime.worldSnapshot(),
    );

  if (result.changed) {
    await runtime.synchronize();
  }

  return result;
}
