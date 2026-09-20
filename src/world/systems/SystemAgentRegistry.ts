import type {
  CardinalSystemAgent,
  CardinalSystemCommand,
  SystemAgentHealth,
  SystemAgentManifest,
} from '../../cardinal/SystemAgentContracts';

/**
 * World-owned registry for autonomous infrastructure agents.
 *
 * This registry intentionally does NOT know about Spark cognition, goals,
 * professions, relationships or emotions. It only owns lifecycle control of
 * registered infrastructure agents.
 */
export class SystemAgentOrchestrator {
  private readonly agents = new Map<string, CardinalSystemAgent>();

  register(agent: CardinalSystemAgent): void {
    const id = agent.manifest.id;
    if (this.agents.has(id)) throw new Error(`System agent already registered: ${id}`);
    this.agents.set(id, agent);
  }

  manifest(agentId: string): SystemAgentManifest | undefined {
    return this.agents.get(agentId)?.manifest;
  }

  health(agentId: string): SystemAgentHealth | undefined {
    return this.agents.get(agentId)?.health();
  }

  list(): readonly SystemAgentManifest[] {
    return [...this.agents.values()]
      .map((agent) => agent.manifest)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  command(agentId: string, command: CardinalSystemCommand): void {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Unknown system agent: ${agentId}`);
    agent.applyCardinalCommand(command);
  }

  /**
   * Replacement is explicit and atomic from the conductor's perspective.
   * A replacement must claim exactly the same subsystem domain unless a future
   * audited migration deliberately changes the architecture.
   */
  replace(agentId: string, replacement: CardinalSystemAgent): void {
    const current = this.agents.get(agentId);
    if (!current) throw new Error(`Unknown system agent: ${agentId}`);
    if (replacement.manifest.id !== agentId) {
      throw new Error(`Replacement id mismatch: expected ${agentId}`);
    }
    if (replacement.manifest.domain !== current.manifest.domain) {
      throw new Error(`Replacement domain mismatch for ${agentId}`);
    }
    current.applyCardinalCommand({ kind: 'retire', reason: 'replaced by Cardinal' });
    this.agents.set(agentId, replacement);
  }
}
