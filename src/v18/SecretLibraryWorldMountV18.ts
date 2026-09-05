import type {
  WorldState,
  WorldPlace,
} from '../world/types';

import type {
  WorldStore,
} from '../world/persistence';

import {
  rebuildWorldRoutes,
} from '../world/WorldNavigation';

import {
  SECRET_LIBRARY_PLACE_ID_V18,
  SECRET_LIBRARY_PLACE_NAME_V18,
} from './SecretLibraryPlaceV18';

export interface SecretLibraryWorldMountResultV18 {
  mounted: boolean;
  alreadyExists: boolean;
  placeId: string;
  revisionBefore: number;
  revisionAfter: number;
}

function calculatePhysicalPositionV18(
  world: Readonly<WorldState>,
): {
  mapX: number;
  mapY: number;
} {
  const places =
    Object.values(world.places).filter(
      (place) =>
        place.id !==
        SECRET_LIBRARY_PLACE_ID_V18,
    );

  if (places.length === 0) {
    return {
      mapX: -12,
      mapY: 12,
    };
  }

  const minX = Math.min(
    ...places.map(
      (place) => place.mapX,
    ),
  );

  const maxY = Math.max(
    ...places.map(
      (place) => place.mapY,
    ),
  );

  return {
    mapX: minX - 5,
    mapY: maxY + 5,
  };
}

function chooseConnectionPlaceV18(
  world: Readonly<WorldState>,
): string | undefined {
  if (world.places.outskirts) {
    return 'outskirts';
  }

  if (world.places.commons) {
    return 'commons';
  }

  return Object.values(
    world.places,
  ).find(
    (place) =>
      place.surface === 'land' &&
      place.id !==
        SECRET_LIBRARY_PLACE_ID_V18,
  )?.id;
}

function createPhysicalLibraryPlaceV18(
  world: Readonly<WorldState>,
  connectionPlaceId:
    string | undefined,
): WorldPlace {
  const position =
    calculatePhysicalPositionV18(
      world,
    );

  return {
    id:
      SECRET_LIBRARY_PLACE_ID_V18,

    name:
      SECRET_LIBRARY_PLACE_NAME_V18,

    kind:
      'ruins',

    capacity:
      6,

    biome:
      'ancient_ruins',

    mapX:
      position.mapX,

    mapY:
      position.mapY,

    connectedPlaceIds:
      connectionPlaceId
        ? [connectionPlaceId]
        : [],

    fertility:
      0,

    danger:
      0,

    surface:
      'land',
  };
}

export async function mountSecretLibraryIntoWorldV18(
  store: WorldStore,
  world: Readonly<WorldState>,
): Promise<
  SecretLibraryWorldMountResultV18
> {
  const existing =
    world.places[
      SECRET_LIBRARY_PLACE_ID_V18
    ];

  if (existing) {
    return {
      mounted: false,
      alreadyExists: true,
      placeId:
        SECRET_LIBRARY_PLACE_ID_V18,
      revisionBefore:
        world.revision,
      revisionAfter:
        world.revision,
    };
  }

  const connectionPlaceId =
    chooseConnectionPlaceV18(
      world,
    );

  const nextPlaces =
    structuredClone(
      world.places,
    );

  const libraryPlace =
    createPhysicalLibraryPlaceV18(
      world,
      connectionPlaceId,
    );

  nextPlaces[
    SECRET_LIBRARY_PLACE_ID_V18
  ] = libraryPlace;

  if (
    connectionPlaceId &&
    nextPlaces[
      connectionPlaceId
    ]
  ) {
    const connectedPlace =
      nextPlaces[
        connectionPlaceId
      ];

    if (
      !connectedPlace.connectedPlaceIds.includes(
        SECRET_LIBRARY_PLACE_ID_V18,
      )
    ) {
      connectedPlace.connectedPlaceIds.push(
        SECRET_LIBRARY_PLACE_ID_V18,
      );
    }
  }

  const nextRoutes =
    rebuildWorldRoutes(
      nextPlaces,
      world.routes,
    );

  const nextState:
    WorldState = {
      ...structuredClone(
        world,
      ),

      places:
        nextPlaces,

      routes:
        nextRoutes,

      revision:
        world.revision + 1,
    };

  const epoch =
    world.epoch ?? 1;

  const operationId =
    [
      'secret-library',
      'mount',
      world.id,
      `epoch-${epoch}`,
    ].join(':');

  const operationFingerprint =
    [
      SECRET_LIBRARY_PLACE_ID_V18,
      libraryPlace.mapX,
      libraryPlace.mapY,
      connectionPlaceId ??
        'none',
      epoch,
    ].join('|');

  const result =
    await store.commit({
      operationId,
      operationFingerprint,

      worldId:
        world.id,

      expectedRevision:
        world.revision,

      nextState,

      events: [],
      memories: [],
    });

  return {
    mounted:
      result.committed,

    alreadyExists:
      result.duplicate,

    placeId:
      SECRET_LIBRARY_PLACE_ID_V18,

    revisionBefore:
      world.revision,

    revisionAfter:
      result.state.revision,
  };
}
