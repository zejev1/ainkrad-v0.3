import type {
  AgentState,
  WorldPoint2D,
  WorldState,
} from '../world/types';

import type {
  WorldStore,
} from '../world/persistence';

import {
  orientedRouteWaypoints,
  routeIdBetween,
} from '../world/WorldNavigation';

import {
  fetchRealHumanTextV18,
  searchRealHumanTextsV18,
} from './SecretLibraryGatewayV18';

import {
  SECRET_LIBRARY_PLACE_ID_V18,
} from './SecretLibraryPlaceV18';

import {
  mountSecretLibraryIntoWorldV18,
} from './SecretLibraryWorldMountV18';

const VISITOR_LIMIT = 5;

const MONTH_WORLD_MINUTES =
  30 * 24 * 60;

const YEAR_WORLD_MINUTES =
  365 * 24 * 60;

export type SecretLibraryVisitStatusV18 =
  | 'selected'
  | 'travelling'
  | 'inside'
  | 'temporarily_outside'
  | 'finished'
  | 'failed';

export interface SecretLibraryKnowledgeRecordV18 {
  id: string;
  topic: string;
  sourceTitle: string;
  sourceUrl: string;

  acquiredWorldMinute: number;

  understanding: number;

  summary: string;

  practicalDomains: string[];
}

export interface SecretLibraryPersistentVisitorV18 {
  agentId: string;

  status:
    SecretLibraryVisitStatusV18;

  selectedWorldMinute: number;

  arrivedWorldMinute?: number;

  finishedWorldMinute?: number;

  originalLocationId: string;

  topic?: string;

  sourceTitle?: string;

  sourceUrl?: string;

  studiedMinutes: number;

  error?: string;
}

export interface SecretLibraryPersistentStateV18 {
  version: 'secret-library-v18';

  currentAccessYear: number;

  opensAtWorldMinute: number;

  closesAtWorldMinute: number;

  status:
    | 'closed'
    | 'open';

  visitors:
    SecretLibraryPersistentVisitorV18[];

  knowledgeByAgentId:
    Record<
      string,
      SecretLibraryKnowledgeRecordV18[]
    >;

  totalVisits: number;

  totalKnowledgeRecords: number;
}

/**
 * Храним библиотеку прямо внутри persisted v18 state.
 * Отдельный cast нужен, чтобы пока не переписывать
 * огромный общий тип мира.
 */
interface WorldV18WithSecretLibrary {
  secretLibrary?:
    SecretLibraryPersistentStateV18;
}

function worldYearAt(
  worldMinutes: number,
): number {
  return (
    Math.floor(
      worldMinutes /
        YEAR_WORLD_MINUTES,
    ) + 1
  );
}

function yearStartMinute(
  year: number,
): number {
  return (
    (year - 1) *
    YEAR_WORLD_MINUTES
  );
}

function libraryStateFromWorld(
  world: WorldState,
):
  | SecretLibraryPersistentStateV18
  | undefined {
  return (
    world.v18 as
      | (
          typeof world.v18 &
          WorldV18WithSecretLibrary
        )
      | undefined
  )?.secretLibrary;
}

function ensureLibraryState(
  world: WorldState,
): SecretLibraryPersistentStateV18 {
  if (!world.v18) {
    throw new Error(
      'Secret Library requires WorldV18State.',
    );
  }

  const v18 =
    world.v18 as
      typeof world.v18 &
      WorldV18WithSecretLibrary;

  if (v18.secretLibrary) {
    return v18.secretLibrary;
  }

  const year =
    worldYearAt(
      world.calendar
        .elapsedWorldMinutes,
    );

  const start =
    yearStartMinute(year);

  v18.secretLibrary = {
    version:
      'secret-library-v18',

    currentAccessYear:
      year,

    opensAtWorldMinute:
      start,

    closesAtWorldMinute:
      start +
      MONTH_WORLD_MINUTES,

    status:
      'closed',

    visitors: [],

    knowledgeByAgentId: {},

    totalVisits: 0,

    totalKnowledgeRecords: 0,
  };

  return v18.secretLibrary;
}

function candidateScore(
  agent:
    Readonly<AgentState>,
): number {
  return (
    agent.personality.curiosity *
      0.30 +
    agent.personality.diligence *
      0.20 +
    agent.mind.values.knowledge *
      0.25 +
    agent.mind.memoryCoherence *
      0.15 +
    agent.skills.craft *
      0.10 +
  );
}

function chooseVisitors(
  world:
    Readonly<WorldState>,
): AgentState[] {
  return Object.values(
    world.agents,
  )
    .filter(
      (agent) =>
        agent.life.alive &&
        (agent.race ??
          'human') ===
          'human' &&
        agent.life.ageYears >=
          10,
    )
    .sort(
      (a, b) =>
        candidateScore(b) -
        candidateScore(a),
    )
    .slice(
      0,
      VISITOR_LIMIT,
    );
}

function chooseTopic(
  agent:
    Readonly<AgentState>,
): string {
  switch (agent.goal.kind) {
    case 'secure_resources':
      return 'agriculture irrigation crop rotation grain storage';

    case 'contribute':
      return 'architecture construction masonry engineering tools';

    case 'explore':
      return 'geography navigation cartography astronomy travel';

    case 'seek_truth':
      return 'mathematics astronomy natural philosophy science';

    case 'build_family':
      return 'medicine hygiene childbirth nutrition health';

    case 'connect':
      return 'trade accounting law governance negotiation';

    case 'recover':
      return 'medicine wounds hygiene healing';

    case 'reflect':
      return 'philosophy ethics mathematics governance';
  }
}

function practicalDomainsForTopic(
  topic: string,
): string[] {
  const lower =
    topic.toLowerCase();

  const domains:
    string[] = [];

  if (
    /agricultur|crop|irrig|grain|soil/.test(
      lower,
    )
  ) {
    domains.push(
      'agriculture',
    );
  }

  if (
    /architect|construct|masonry|engineering|tool/.test(
      lower,
    )
  ) {
    domains.push(
      'construction',
      'craft',
    );
  }

  if (
    /medicine|hygiene|health|wound|childbirth/.test(
      lower,
    )
  ) {
    domains.push(
      'medicine',
      'care',
    );
  }

  if (
    /trade|account|econom|govern|law/.test(
      lower,
    )
  ) {
    domains.push(
      'trade',
      'governance',
    );
  }

  if (
    /navigation|geography|cartograph|travel|astronomy/.test(
      lower,
    )
  ) {
    domains.push(
      'exploration',
    );
  }

  if (
    /mathemat|science|philosophy/.test(
      lower,
    )
  ) {
    domains.push(
      'knowledge',
    );
  }

  return [
    ...new Set(
      domains,
    ),
  ];
}

function understandingFor(
  agent:
    Readonly<AgentState>,
): number {
  return Math.max(
    0.08,

    Math.min(
      0.96,

      agent.personality.curiosity *
        0.23 +
        agent.personality.diligence *
          0.20 +
        agent.mind.values.knowledge *
          0.24 +
        agent.mind.memoryCoherence *
          0.18 +
        agent.skills.craft *
          0.10 +
        0.05,
    ),
  );
}

/**
 * Ищем путь по connectedPlaceIds.
 */
function findPlacePath(
  world:
    Readonly<WorldState>,

  fromId:
    string,

  toId:
    string,
): string[] | undefined {
  if (fromId === toId) {
    return [fromId];
  }

  const queue:
    string[][] = [
      [fromId],
    ];

  const visited =
    new Set<string>([
      fromId,
    ]);

  while (
    queue.length > 0
  ) {
    const path =
      queue.shift()!;

    const currentId =
      path[
        path.length - 1
      ];

    const current =
      world.places[
        currentId
      ];

    if (!current) {
      continue;
    }

    for (
      const nextId of
      current.connectedPlaceIds
    ) {
      if (
        visited.has(
          nextId,
        )
      ) {
        continue;
      }

      const nextPath = [
        ...path,
        nextId,
      ];

      if (
        nextId === toId
      ) {
        return nextPath;
      }

      visited.add(
        nextId,
      );

      queue.push(
        nextPath,
      );
    }
  }

  return undefined;
}

function movementWaypoints(
  world:
    Readonly<WorldState>,

  fromPlaceId:
    string,

  toPlaceId:
    string,
):
  | WorldPoint2D[]
  | undefined {
  const path =
    findPlacePath(
      world,
      fromPlaceId,
      toPlaceId,
    );

  if (
    !path ||
    path.length < 2
  ) {
    return undefined;
  }

  const result:
    WorldPoint2D[] = [];

  for (
    let index = 0;
    index <
    path.length - 1;
    index += 1
  ) {
    const from =
      path[index];

    const to =
      path[index + 1];

    const route =
      world.routes[
        routeIdBetween(
          from,
          to,
        )
      ];

    if (!route) {
      return undefined;
    }

    const points =
      orientedRouteWaypoints(
        route,
        from,
      );

    if (
      result.length > 0
    ) {
      points.shift();
    }

    result.push(
      ...points,
    );
  }

  return result;
}

function sendAgentToLibrary(
  world:
    WorldState,

  visitor:
    SecretLibraryPersistentVisitorV18,
): boolean {
  const agent =
    world.agents[
      visitor.agentId
    ];

  if (
    !agent ||
    !agent.life.alive
  ) {
    visitor.status =
      'failed';

    visitor.error =
      'NPC unavailable';

    return false;
  }

  if (
    agent.locationId ===
      SECRET_LIBRARY_PLACE_ID_V18
  ) {
    visitor.status =
      'inside';

    visitor.arrivedWorldMinute ??=
      world.calendar
        .elapsedWorldMinutes;

    return true;
  }

  /**
   * Если движок уже ведёт его именно
   * в библиотеку — не перезаписываем.
   */
  if (
    agent.movement
      ?.targetPlaceId ===
      SECRET_LIBRARY_PLACE_ID_V18
  ) {
    visitor.status =
      'travelling';

    return true;
  }

  /**
   * Еда/сон/аварийные действия имеют приоритет.
   * Если NPC сейчас занят движением по своей жизни,
   * библиотека ждёт следующего свободного момента.
   */
  if (agent.movement) {
    return false;
  }

  const waypoints =
    movementWaypoints(
      world,
      agent.locationId,
      SECRET_LIBRARY_PLACE_ID_V18,
    );

  if (
    !waypoints ||
    waypoints.length === 0
  ) {
    visitor.status =
      'failed';

    visitor.error =
      `No route from ${agent.locationId}`;

    return false;
  }

  agent.movement = {
    targetPlaceId:
      SECRET_LIBRARY_PLACE_ID_V18,

    purpose:
      'walk',

    waypoints,

    nextWaypointIndex:
      0,

    startedAt:
      world.now,

    worldStageAtStart:
      world.growth.stage,
  };

  visitor.status =
    'travelling';

  return true;
}

function applyKnowledgeToAgent(
  agent:
    AgentState,

  understanding:
    number,

  domains:
    readonly string[],
): void {
  /**
   * Знание увеличивается умеренно:
   * книга не превращает крестьянина
   * мгновенно в профессора.
   */
  agent.mind.values.knowledge =
    Math.min(
      1,

      agent.mind.values.knowledge +
        understanding *
          0.035,
    );

  if (
    domains.includes(
      'craft',
    ) ||
    domains.includes(
      'construction',
    )
  ) {
    agent.skills.craft =
      Math.min(
        1,

        agent.skills.craft +
          understanding *
            0.028,
      );
  }

  if (
    domains.includes(
      'exploration',
    )
  ) {
    agent.skills.exploration =
      Math.min(
        1,

        agent.skills.exploration +
          understanding *
            0.025,
      );
  }

  if (
    domains.includes(
      'trade',
    ) ||
    domains.includes(
      'governance',
    )
  ) {
    agent.skills.social =
      Math.min(
        1,

        agent.skills.social +
          understanding *
            0.022,
      );
  }

  agent.mind.memoryCoherence =
    Math.min(
      1,

      agent.mind.memoryCoherence +
        understanding *
          0.012,
    );
}

function readableSummary(
  text:
    string,
): string {
  const cleaned =
    text
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();

  /**
   * В WorldState храним только небольшой
   * фрагмент усвоенного содержания,
   * а не целую книгу.
   */
  return cleaned.slice(
    0,
    700,
  );
}

async function studyInsideLibrary(
  world:
    WorldState,

  library:
    SecretLibraryPersistentStateV18,

  visitor:
    SecretLibraryPersistentVisitorV18,
): Promise<void> {
  const agent =
    world.agents[
      visitor.agentId
    ];

  if (
    !agent ||
    !agent.life.alive
  ) {
    visitor.status =
      'failed';

    visitor.error =
      'NPC died before study';

    return;
  }

  if (
    agent.locationId !==
      SECRET_LIBRARY_PLACE_ID_V18
  ) {
    return;
  }

  visitor.status =
    'inside';

  visitor.arrivedWorldMinute ??=
    world.calendar
      .elapsedWorldMinutes;

  /**
   * Уже прочитал книгу в этом годовом окне.
   */
  if (
    visitor.finishedWorldMinute !==
      undefined
  ) {
    visitor.status =
      'finished';

    return;
  }

  const topic =
    visitor.topic ??
    chooseTopic(
      agent,
    );

  visitor.topic =
    topic;

  try {
    const results =
      await searchRealHumanTextsV18(
        topic,
        'en',
        5,
      );

    if (
      results.length === 0
    ) {
      visitor.error =
        `No Wikisource result for ${topic}`;

      return;
    }

    const selected =
      results[0];

    const realText =
      await fetchRealHumanTextV18(
        selected.title,
        'en',
      );

    const understanding =
      understandingFor(
        agent,
      );

    const domains =
      practicalDomainsForTopic(
        topic,
      );

    const record:
      SecretLibraryKnowledgeRecordV18 = {
        id:
          [
            'library-knowledge',
            agent.id,
            library.currentAccessYear,
            library
              .totalKnowledgeRecords +
              1,
          ].join(':'),

        topic,

        sourceTitle:
          realText.title,

        sourceUrl:
          realText.sourceUrl,

        acquiredWorldMinute:
          world.calendar
            .elapsedWorldMinutes,

        understanding,

        summary:
          readableSummary(
            realText.text,
          ),

        practicalDomains:
          domains,
      };

    const knowledge =
      library
        .knowledgeByAgentId[
          agent.id
        ] ??
      [];

    knowledge.push(
      record,
    );

    library
      .knowledgeByAgentId[
        agent.id
      ] =
      knowledge;

    library
      .totalKnowledgeRecords +=
      1;

    visitor.sourceTitle =
      realText.title;

    visitor.sourceUrl =
      realText.sourceUrl;

    /**
     * Одна реальная учебная сессия.
     * Дальше NPC может жить своей жизнью.
     */
    visitor.studiedMinutes +=
      6 * 60;

    visitor.finishedWorldMinute =
      world.calendar
        .elapsedWorldMinutes;

    visitor.status =
      'finished';

    applyKnowledgeToAgent(
      agent,
      understanding,
      domains,
    );
  } catch (error) {
    visitor.error =
      error instanceof Error
        ? error.message
        : String(error);
  }
}

function beginYearIfNeeded(
  world:
    WorldState,

  library:
    SecretLibraryPersistentStateV18,
): void {
  const now =
    world.calendar
      .elapsedWorldMinutes;

  const year =
    worldYearAt(now);

  if (
    library.currentAccessYear ===
      year &&
    library.visitors.length >
      0
  ) {
    return;
  }

  const start =
    yearStartMinute(
      year,
    );

  library.currentAccessYear =
    year;

  library.opensAtWorldMinute =
    start;

  library.closesAtWorldMinute =
    start +
    MONTH_WORLD_MINUTES;

  library.status =
    now <
    library.closesAtWorldMinute
      ? 'open'
      : 'closed';

  library.visitors =
    [];

  if (
    library.status !==
      'open'
  ) {
    return;
  }

  const selected =
    chooseVisitors(
      world,
    );

  library.visitors =
    selected.map(
      (agent) => ({
        agentId:
          agent.id,

        status:
          'selected',

        selectedWorldMinute:
          now,

        originalLocationId:
          agent.locationId,

        studiedMinutes:
          0,
      }),
    );

  library.totalVisits +=
    selected.length;
}

function updateWindowStatus(
  world:
    Readonly<WorldState>,

  library:
    SecretLibraryPersistentStateV18,
): void {
  const now =
    world.calendar
      .elapsedWorldMinutes;

  if (
    now >=
    library.closesAtWorldMinute
  ) {
    library.status =
      'closed';

    for (
      const visitor of
      library.visitors
    ) {
      if (
        visitor.status !==
          'finished' &&
        visitor.status !==
          'failed'
      ) {
        visitor.status =
          'finished';

        visitor.finishedWorldMinute ??=
          now;
      }
    }
  }
}

function fingerprint(
  world:
    Readonly<WorldState>,

  library:
    Readonly<SecretLibraryPersistentStateV18>,
): string {
  return [
    world.id,
    world.epoch ?? 1,
    world.revision,
    library.currentAccessYear,
    library.status,
    library.visitors
      .map(
        (visitor) =>
          [
            visitor.agentId,
            visitor.status,
            visitor.studiedMinutes,
            visitor.sourceTitle ??
              '',
          ].join(':'),
      )
      .join(','),
  ].join('|');
}

export interface SecretLibraryIntegrationResultV18 {
  changed: boolean;

  mounted: boolean;

  status:
    | 'closed'
    | 'open';

  currentYear: number;

  visitorCount: number;

  insideCount: number;

  learnedCount: number;
}

/**
 * ЕДИНСТВЕННАЯ функция, которую должен вызывать runtime.
 *
 * Она:
 * - гарантирует физическую библиотеку;
 * - выбирает 5 NPC;
 * - отправляет их реальным movement;
 * - читает только после физического прихода;
 * - сохраняет знания прямо в WorldState.
 */
export async function runSecretLibraryIntegrationV18(
  store:
    WorldStore,

  sourceWorld:
    Readonly<WorldState>,
): Promise<
  SecretLibraryIntegrationResultV18
> {
  let workingWorld =
    structuredClone(
      sourceWorld,
    );

  let mounted =
    false;

  if (
    !workingWorld.places[
      SECRET_LIBRARY_PLACE_ID_V18
    ]
  ) {
    const mount =
      await mountSecretLibraryIntoWorldV18(
        store,
        workingWorld,
      );

    mounted =
      mount.mounted;

    if (
      mount.mounted ||
      mount.alreadyExists
    ) {
      const reloaded =
        await store.loadWorld(
          workingWorld.id,
        );

      if (reloaded) {
        workingWorld =
          reloaded;
      }
    }
  }

  const before =
    JSON.stringify(
      libraryStateFromWorld(
        workingWorld,
      ) ??
        null,
    );

  const library =
    ensureLibraryState(
      workingWorld,
    );

  beginYearIfNeeded(
    workingWorld,
    library,
  );

  updateWindowStatus(
    workingWorld,
    library,
  );

  if (
    library.status ===
      'open'
  ) {
    for (
      const visitor of
      library.visitors
    ) {
      if (
        visitor.status ===
          'finished' ||
        visitor.status ===
          'failed'
      ) {
        continue;
      }

      sendAgentToLibrary(
        workingWorld,
        visitor,
      );

      if (
        workingWorld.agents[
          visitor.agentId
        ]?.locationId ===
          SECRET_LIBRARY_PLACE_ID_V18
      ) {
        await studyInsideLibrary(
          workingWorld,
          library,
          visitor,
        );
      }
    }
  }

  const after =
    JSON.stringify(
      library,
    );

  const changed =
    mounted ||
    before !== after ||
    workingWorld.revision !==
      sourceWorld.revision ||
    Object.values(
      workingWorld.agents,
    ).some(
      (agent) => {
        const original =
          sourceWorld.agents[
            agent.id
          ];

        return (
          original &&
          JSON.stringify(
            original.movement ??
              null,
          ) !==
            JSON.stringify(
              agent.movement ??
                null,
            )
        );
      },
    );

  if (
    changed &&
    workingWorld.revision ===
      sourceWorld.revision
  ) {
    const nextState:
      WorldState = {
        ...workingWorld,

        revision:
          workingWorld.revision +
          1,
      };

    await store.commit({
      operationId:
        [
          'secret-library',
          'integration',
          workingWorld.id,
          workingWorld.epoch ??
            1,
          workingWorld.now,
          workingWorld.revision,
        ].join(':'),

      operationFingerprint:
        fingerprint(
          workingWorld,
          library,
        ),

      worldId:
        workingWorld.id,

      expectedRevision:
        workingWorld.revision,

      nextState,

      events: [],

      memories: [],
    });
  }

  return {
    changed,

    mounted,

    status:
      library.status,

    currentYear:
      library.currentAccessYear,

    visitorCount:
      library.visitors.length,

    insideCount:
      library.visitors.filter(
        (visitor) =>
          visitor.status ===
          'inside',
      ).length,

    learnedCount:
      Object.values(
        library
          .knowledgeByAgentId,
      ).reduce(
        (
          total,
          entries,
        ) =>
          total +
          entries.length,

        0,
      ),
  };
}

export function secretLibraryStateV18(
  world:
    Readonly<WorldState>,
):
  | SecretLibraryPersistentStateV18
  | undefined {
  return libraryStateFromWorld(
    world as WorldState,
  );
}
