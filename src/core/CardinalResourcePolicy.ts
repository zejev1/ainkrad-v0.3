/** Historical kinds remain readable, but cannot authorize new subsidies. */
export const CARDINAL_RESOURCE_POLICY_VERSION = 'no-resource-subsidies-f14';
export const isResourceSubsidy = (kind: string) => kind === 'resource_relief' || kind === 'habitat_support';
export const isResourceSubsidyLaw = (mechanism: string) =>
  ['resource_regeneration', 'wildlife_recovery', 'habitat_integrity', 'catastrophe_recovery'].includes(mechanism);
export const RESOURCE_SUBSIDY_DENIAL = 'Cardinal resource subsidies are prohibited; recovery must follow autonomous world physics and voluntary work.';
