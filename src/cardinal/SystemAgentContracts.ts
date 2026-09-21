export type SystemAgentDomain =
  | 'weather'
  | 'hydrology'
  | 'resources'
  | 'ecology'
  | 'wildlife'
  | 'monsters'
  | 'disease_environment'
  | 'geography'
  | 'ocean'
  | 'physics'
  | 'dungeons'
  | 'economy_environment'
  | 'observation';

export type SystemAgentLifecycle =
  | 'registered'
  | 'running'
  | 'restricted'
  | 'stopped'
  | 'faulted'
  | 'retired';

export interface SystemAgentCapability {
  /** Stable capability name, e.g. weather.temperature.write. */
  id: string;
  /** World/system domain this capability is allowed to touch. */
  domain: SystemAgentDomain;
  /** Explicit state paths or subsystem keys this capability may mutate. */
  writeScopes: readonly string[];
  /** Explicit state paths or subsystem keys this capability may observe. */
  readScopes: readonly string[];
}

export interface SystemAgentManifest {
  id: string;
  version: string;
  domain: SystemAgentDomain;
  description: string;
  capabilities: readonly SystemAgentCapability[];
  /** System agents are infrastructure, never Sparks/residents. */
  infrastructureOnly: true;
}

export interface SystemAgentHealth {
  lifecycle: SystemAgentLifecycle;
  healthy: boolean;
  lastHeartbeatWorldMinute?: number;
  lastFault?: string;
}

export type CardinalSystemCommand =
  | { kind: 'start' }
  | { kind: 'stop'; reason: string }
  | { kind: 'restrict'; allowedCapabilityIds: readonly string[]; reason: string }
  | { kind: 'restore'; reason: string }
  | { kind: 'retire'; reason: string };

export interface CardinalSystemAgent {
  readonly manifest: SystemAgentManifest;
  health(): SystemAgentHealth;
  applyCardinalCommand(command: CardinalSystemCommand): void;
}

export class SystemAgentBoundaryViolation extends Error {
  constructor(
    readonly agentId: string,
    readonly requestedDomain: SystemAgentDomain,
    readonly requestedScope: string,
  ) {
    super(`System agent ${agentId} cannot write ${requestedDomain}:${requestedScope}`);
  }
}

/**
 * Fail-closed capability gate for future subsystem agents.
 * A system agent can only mutate scopes explicitly declared in its own domain.
 */
export function assertSystemAgentWriteAllowed(
  manifest: SystemAgentManifest,
  capabilityId: string,
  domain: SystemAgentDomain,
  scope: string,
): void {
  if (domain !== manifest.domain) {
    throw new SystemAgentBoundaryViolation(manifest.id, domain, scope);
  }
  const capability = manifest.capabilities.find((item) => item.id === capabilityId);
  const allowed = capability?.domain === domain && capability.writeScopes.includes(scope);
  if (!allowed) {
    throw new SystemAgentBoundaryViolation(manifest.id, domain, scope);
  }
}
