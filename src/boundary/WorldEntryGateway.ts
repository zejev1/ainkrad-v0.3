import { createStableId } from '../core/stableId';
import { stableJsonStringify } from '../core/stableJson';
import type { WorldMutationResult } from '../world/WorldEngine';
import {
  StaleWorldObservationError,
  WorldRevisionConflictError,
} from '../world/persistence';
import type { WorldEntryRole, WorldState } from '../world/types';

export const WORLD_ENTRY_GATEWAY_POLICY_VERSION =
  'ainkrad-world-entry-gateway-0.3.10';

export type DivineOmenKind =
  | 'aurora'
  | 'voice'
  | 'eclipse'
  | 'miracle'
  | 'storm_sign';

export interface WorldEntryRequest {
  requestId: string;
  worldId: string;
  externalIdentityId: string;
  displayName: string;
  role: WorldEntryRole;
  requestedAt: number;
}

export interface DivineOmenRequest {
  requestId: string;
  worldId: string;
  deityId: string;
  omen: DivineOmenKind;
  magnitude: number;
  requestedAt: number;
}

export interface WorldEntryRecord {
  entryRecordId: string;
  requestId: string;
  worldId: string;
  role: WorldEntryRole | 'omen';
  gatewayPolicyVersion: string;
  authorized: boolean;
  reason: string;
  committedWorldRevision?: number;
}

export interface WorldEntryTarget {
  snapshot(): WorldState;
  applyAuthorizedResidentEntry(
    worldId: string,
    entryId: string,
    name: string,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult>;
  applyAuthorizedDeityEntry(
    worldId: string,
    deityId: string,
    name: string,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult>;
  applyAuthorizedDivineOmen(
    worldId: string,
    deityId: string,
    omen: DivineOmenKind,
    magnitude: number,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult>;
}

/**
 * External people and deity accounts enter through this gateway. Cardinal has
 * no reference to it, cannot issue entry credentials and cannot impersonate a
 * resident. Entering as a resident creates a new person; it never replaces an
 * existing native mind.
 */
export class IndependentWorldEntryGateway {
  readonly policyVersion = WORLD_ENTRY_GATEWAY_POLICY_VERSION;

  constructor(private readonly target: WorldEntryTarget) {}

  async enter(
    request: Readonly<WorldEntryRequest>,
    expectedWorld: Readonly<WorldState>,
  ): Promise<WorldEntryRecord> {
    const denied = this.validateEntry(request, expectedWorld);
    if (denied) return this.record(request, request.role, false, denied);

    let result: WorldMutationResult;
    try {
      result =
        request.role === 'resident'
          ? await this.target.applyAuthorizedResidentEntry(
              request.worldId,
              request.externalIdentityId,
              request.displayName,
              request.requestedAt,
              request.requestId,
              expectedWorld.revision,
            )
          : await this.target.applyAuthorizedDeityEntry(
              request.worldId,
              request.externalIdentityId,
              request.displayName,
              request.requestedAt,
              request.requestId,
              expectedWorld.revision,
            );
    } catch (error) {
      if (
        error instanceof StaleWorldObservationError ||
        error instanceof WorldRevisionConflictError
      ) {
        return this.record(
          request,
          request.role,
          false,
          'World changed before entry could commit.',
        );
      }
      throw error;
    }
    return {
      ...this.record(
        request,
        request.role,
        true,
        'Independent gateway admitted a new identity without replacing a native resident.',
      ),
      committedWorldRevision: result.committedRevision,
    };
  }

  async omen(
    request: Readonly<DivineOmenRequest>,
    expectedWorld: Readonly<WorldState>,
  ): Promise<WorldEntryRecord> {
    const base = {
      ...request,
      externalIdentityId: request.deityId,
      displayName: request.deityId,
      role: 'deity' as const,
    };
    const staleReason = this.validateWorld(base, expectedWorld);
    if (staleReason) return this.record(base, 'omen', false, staleReason);
    const deity = expectedWorld.cosmology.deities[request.deityId];
    if (!deity || deity.origin !== 'external_entry') {
      return this.record(base, 'omen', false, 'Only an admitted deity may create an omen.');
    }
    if (
      !['aurora', 'voice', 'eclipse', 'miracle', 'storm_sign'].includes(
        request.omen,
      ) ||
      !Number.isFinite(request.magnitude) ||
      request.magnitude <= 0 ||
      request.magnitude > 0.35
    ) {
      return this.record(base, 'omen', false, 'Omen exceeds the gateway perception envelope.');
    }
    let result: WorldMutationResult;
    try {
      result = await this.target.applyAuthorizedDivineOmen(
        request.worldId,
        request.deityId,
        request.omen,
        request.magnitude,
        request.requestedAt,
        request.requestId,
        expectedWorld.revision,
      );
    } catch (error) {
      if (
        error instanceof StaleWorldObservationError ||
        error instanceof WorldRevisionConflictError
      ) {
        return this.record(
          base,
          'omen',
          false,
          'World changed before the omen could commit.',
        );
      }
      throw error;
    }
    return {
      ...this.record(
        base,
        'omen',
        true,
        'Omen may be perceived and interpreted; it cannot write beliefs directly.',
      ),
      committedWorldRevision: result.committedRevision,
    };
  }

  private validateEntry(
    request: Readonly<WorldEntryRequest>,
    expectedWorld: Readonly<WorldState>,
  ): string | undefined {
    const worldReason = this.validateWorld(request, expectedWorld);
    if (worldReason) return worldReason;
    if (!['resident', 'deity'].includes(request.role)) {
      return 'Requested role is not supported.';
    }
    if (!request.externalIdentityId.trim() || !request.displayName.trim()) {
      return 'Entry identity and display name are required.';
    }
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(
        request.externalIdentityId,
      ) ||
      request.displayName.length > 64
    ) {
      return 'Entry identity or display name is outside the stable gateway format.';
    }
    if (request.role === 'deity' && Object.keys(expectedWorld.cosmology.deities).length >= 8) {
      return 'The current cosmology cannot safely host another deity.';
    }
    return undefined;
  }

  private validateWorld(
    request: Pick<
      WorldEntryRequest,
      'requestId' | 'worldId' | 'requestedAt'
    >,
    expectedWorld: Readonly<WorldState>,
  ): string | undefined {
    if (!request.requestId.trim()) return 'Stable requestId is required.';
    const actual = this.target.snapshot();
    if (request.worldId !== expectedWorld.id || request.worldId !== actual.id) {
      return 'Entry request targets another world.';
    }
    if (request.requestedAt !== expectedWorld.now) {
      return 'Entry time does not match the observed world.';
    }
    if (stableJsonStringify(actual) !== stableJsonStringify(expectedWorld)) {
      return 'World changed after entry authorization was prepared.';
    }
    return undefined;
  }

  private record(
    request: Pick<WorldEntryRequest, 'requestId' | 'worldId'>,
    role: WorldEntryRecord['role'],
    authorized: boolean,
    reason: string,
  ): WorldEntryRecord {
    return {
      entryRecordId: createStableId('world-entry-record', {
        requestId: request.requestId,
        worldId: request.worldId,
        role,
        policyVersion: this.policyVersion,
      }),
      requestId: request.requestId,
      worldId: request.worldId,
      role,
      gatewayPolicyVersion: this.policyVersion,
      authorized,
      reason,
    };
  }
}
