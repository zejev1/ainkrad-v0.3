export type WorldPresenceRole = 'resident_peer' | 'creator_avatar';

export interface WorldPresenceRequest {
  presenceId: string;
  role: WorldPresenceRole;
  requestedAtWorldMinute: number;
  requestedBy: 'creator' | 'cardinal';
}

export interface WorldPresenceGrant {
  presenceId: string;
  role: WorldPresenceRole;
  grantedAtWorldMinute: number;
  expiresAtWorldMinute?: number;
  capabilities: readonly WorldPresenceCapability[];
}

export type WorldPresenceCapability =
  | 'observe_local_world'
  | 'speak'
  | 'move'
  | 'use_owned_items'
  | 'receive_body_state'
  | 'creator_manifestation';

const RESIDENT_PEER_CAPABILITIES: readonly WorldPresenceCapability[] = [
  'observe_local_world',
  'speak',
  'move',
  'use_owned_items',
  'receive_body_state',
];

const CREATOR_AVATAR_CAPABILITIES: readonly WorldPresenceCapability[] = [
  ...RESIDENT_PEER_CAPABILITIES,
  'creator_manifestation',
];

/**
 * Inactive boundary scaffold for future human/AI presence inside Ainkrad.
 *
 * This module intentionally has no transport, UI, VR, WebXR, WorldEngine or
 * gateway integration yet. It only defines what a future embodied presence is
 * allowed to ask for. Entering the world never grants Cardinal/system-agent
 * authority and never exposes hidden gateway capabilities.
 */
export function grantWorldPresence(request: Readonly<WorldPresenceRequest>): WorldPresenceGrant {
  if (!request.presenceId.trim()) throw new Error('World presence requires an id.');
  if (!Number.isFinite(request.requestedAtWorldMinute) || request.requestedAtWorldMinute < 0) {
    throw new Error('World presence requires a valid world minute.');
  }

  return {
    presenceId: request.presenceId,
    role: request.role,
    grantedAtWorldMinute: request.requestedAtWorldMinute,
    capabilities: request.role === 'creator_avatar'
      ? CREATOR_AVATAR_CAPABILITIES
      : RESIDENT_PEER_CAPABILITIES,
  };
}

export function worldPresenceCan(
  grant: Readonly<WorldPresenceGrant>,
  capability: WorldPresenceCapability,
): boolean {
  return grant.capabilities.includes(capability);
}

/** Explicitly forbidden escalation paths for every embodied visitor. */
export const WORLD_PRESENCE_FORBIDDEN = [
  'cardinal_control',
  'system_agent_control',
  'gateway_access',
  'direct_world_state_write',
  'resident_mind_write',
  'resident_free_will_override',
] as const;
