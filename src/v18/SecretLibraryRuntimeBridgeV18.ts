import type {
  LiveWorldRuntime,
} from '../runtime/LiveWorldRuntime';

import type {
  WorldStore,
} from '../world/persistence';

import {
  runSecretLibraryIntegrationV18,
  secretLibraryStateV18,
  type SecretLibraryIntegrationResultV18,
} from './SecretLibraryIntegrationV18';

const SECRET_LIBRARY_CHECK_EVERY_CALLS =
  20;

const TELEMETRY_CHANNEL_NAME =
  'ainkrad-secret-library-v18';

const telemetryChannel =
  new BroadcastChannel(
    TELEMETRY_CHANNEL_NAME,
  );

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

function visitorStatusLabel(
  status: string,
): string {
  switch (status) {
    case 'selected':
      return 'Выбран';

    case 'travelling':
      return 'Идёт в библиотеку';

    case 'inside':
      return 'В библиотеке';

    case 'temporarily_outside':
      return 'Временно вышел';

    case 'finished':
      return 'Закончил';

    case 'failed':
      return 'Ошибка доступа';

    default:
      return status;
  }
}

function broadcastLibraryTelemetry(
  runtime:
    LiveWorldRuntime,
): void {
  const world =
    runtime.worldSnapshot();

  const library =
    secretLibraryStateV18(
      world,
    );

  if (!library) {
    return;
  }

  const visitors =
    library.visitors.map(
      (visitor) => {
        const agent =
          world.agents[
            visitor.agentId
          ];

        const learned =
          library
            .knowledgeByAgentId[
              visitor.agentId
            ] ?? [];

        return {
          agentId:
            visitor.agentId,

          agentName:
            agent?.name ??
            visitor.agentId,

          status:
            visitorStatusLabel(
              visitor.status,
            ),

          studyMinutes:
            visitor.studiedMinutes,

          studyHours:
            Math.round(
              (
                visitor.studiedMinutes /
                60
              ) *
                10,
            ) / 10,

          learnedCount:
            learned.length,

          learnedKnowledge:
            learned.map(
              (knowledge) => ({
                topic:
                  knowledge.topic,

                sourceTitle:
                  knowledge.sourceTitle,

                sourceUrl:
                  knowledge.sourceUrl,

                understandingPercent:
                  Math.round(
                    knowledge
                      .understanding *
                      100,
                  ),

                rememberedText:
                  knowledge.summary,
              }),
            ),

          locationId:
            agent?.locationId ??
            'unknown',

          targetPlaceId:
            agent?.movement
              ?.targetPlaceId ??
            null,

          error:
            visitor.error ??
            null,
        };
      },
    );

  const totalStudyMinutes =
    visitors.reduce(
      (
        total,
        visitor,
      ) =>
        total +
        visitor.studyMinutes,
      0,
    );

  const totalLearnedKnowledge =
    visitors.reduce(
      (
        total,
        visitor,
      ) =>
        total +
        visitor.learnedCount,
      0,
    );

  telemetryChannel.postMessage({
    type:
      'secret_library_inspector',

    inspector: {
      placeId:
        'secret_library_v18',

      name:
        'Тайная библиотека',

      status:
        library.status ===
        'open'
          ? 'Открыта'
          : 'Закрыта',

      currentYear:
        library.currentAccessYear,

      visitorLimit:
        5,

      selectedVisitors:
        visitors,

      totalStudyMinutes,

      totalStudyHours:
        Math.round(
          (
            totalStudyMinutes /
            60
          ) *
            10,
        ) / 10,

      totalLearnedKnowledge,

      booksKnownToLibrary:
        library
          .totalKnowledgeRecords,

      externalAccess: {
        enabled:
          true,

        source:
          'Wikisource',

        directNpcInternetAccess:
          false,
      },

      rules: [
        'Библиотека открывается один раз в игровой год.',
        'Право доступа получают максимум пять NPC.',
        'Период доступа длится один игровой месяц.',
        'Книги нельзя вынести наружу.',
        'Чтение возможно только после физического прихода NPC.',
        'Полученные знания остаются у NPC.',
      ],
    },
  });
}

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

  /**
   * После синхронизации отправляем
   * фактическое состояние библиотеки
   * существующему UI.
   */
  broadcastLibraryTelemetry(
    runtime,
  );

  return result;
}

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
