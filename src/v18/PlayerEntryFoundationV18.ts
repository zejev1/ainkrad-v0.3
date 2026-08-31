/**
 * Dormant player-entry contract for a later release.
 *
 * v0.3.18 intentionally exposes no login, account picker, playable avatar or
 * control surface. These stable command/role names let later migrations add
 * those features without teaching the world engine about an authentication
 * provider or giving Cardinal an entry capability.
 */
export const PLAYER_ENTRY_FOUNDATION_V18 = {
  version: 'ainkrad-player-entry-foundation-0.3.18',
  productionEntryEnabled: false,
  productionControlsEnabled: false,
  authenticationProvider: 'none',
  worldEntryGatewayRequired: true,
  cardinalMayIssueCredentials: false,
  cardinalMayControlAvatar: false,
  supportedFutureRoles: ['resident', 'hero', 'deity'],
  supportedFutureIntents: [
    'move_along_route',
    'speak',
    'inspect',
    'offer_item',
    'request_interaction',
  ],
} as const;

export type FuturePlayerEntryRole =
  (typeof PLAYER_ENTRY_FOUNDATION_V18.supportedFutureRoles)[number];

export type FuturePlayerIntentKind =
  (typeof PLAYER_ENTRY_FOUNDATION_V18.supportedFutureIntents)[number];

export interface FutureExternalIdentityProfileV18 {
  externalIdentityId: string;
  displayName: string;
  role: FuturePlayerEntryRole;
  /** Profiles stay outside WorldState and must later be authenticated by an
   * independent service before the existing WorldEntryGateway sees them. */
  authenticatedOutsideWorld: true;
}
