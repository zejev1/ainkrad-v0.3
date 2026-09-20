import type { CardinalSystemAgent, CardinalSystemCommand, SystemAgentLifecycle, SystemAgentManifest } from '../../cardinal/SystemAgentContracts';
import { PLANT_DATA_VERSION } from './plants/PlantKnowledge';
import { buildSeedEdges, disperseSeeds, evolvePatch, initializePatch, plantCover, unit,
  type PlantHabitat, type PlantWeather, type SeedEdge, type VegetationEvent, type VegetationPatch } from './plants/VegetationModel';

export interface VegetationSystemState {
  version: 1; dataVersion: string; lifecycle: SystemAgentLifecycle; allowed: boolean;
  fallback: boolean; lastFault?: string; lastHeartbeatWorldMinute?: number;
  lastMinute: number; updates: number; sites: Record<string, VegetationPatch>;
  regions: Record<string, { base: number; fertility: number }>;
}
/** Physical recovery potential prepared by the host. No skill, mind, identity,
 * knowledge profile or resident object crosses this boundary. */
export interface LandResourceInput {
  id: string; base: number; fertility: number; baseRecovery: number; soilRecovery: number;
}
export interface LandResourceOutput { id: string; base: number; fertility: number }
export const VEGETATION_AGENT_MANIFEST: SystemAgentManifest = Object.freeze({
  id: 'vegetation-system', version: '1', domain: 'ecology', infrastructureOnly: true,
  description: 'Source-backed soil and vegetation dynamics, autonomous with the same local fallback.',
  capabilities: Object.freeze([Object.freeze({ id: 'ecology.vegetation.write', domain: 'ecology' as const,
    readScopes: Object.freeze(['ecology.habitats', 'ecology.soil', 'weather.current', 'ecology.physical_extraction', 'ecology.seed_vectors', 'ecology.plant_catalog']),
    writeScopes: Object.freeze(['ecology.soil', 'ecology.vegetation', 'ecology.renewable_capacity']) })]),
});
const lifecycles = ['running', 'registered', 'restricted', 'stopped', 'faulted', 'retired'];
type PatchModel = typeof evolvePatch;

/** World-independent domain agent. All state is ecological; no I/O or world RNG. */
export class VegetationSystemAgent implements CardinalSystemAgent {
  readonly manifest = VEGETATION_AGENT_MANIFEST;
  private state: VegetationSystemState;
  private habitats?: readonly PlantHabitat[];
  private edges: SeedEdge[] = [];
  private invalidSites = new Set<string>();
  private metrics = { modelSteps: 0, topologyBuilds: 0 };

  constructor(saved: VegetationSystemState | undefined, minute: number,
    private readonly seed: string, private readonly model?: PatchModel) {
    this.state = saved ?? { version: 1, dataVersion: PLANT_DATA_VERSION, lifecycle: 'running',
      allowed: true, fallback: false, lastMinute: minute, updates: 0, sites: {}, regions: {} };
    if (this.state.version !== 1 || this.state.dataVersion !== PLANT_DATA_VERSION || !lifecycles.includes(this.state.lifecycle)) {
      this.fault('Vegetation metadata or catalog version is invalid; physical records retained');
    }
    // Validate once at adoption, not per plant per query. Corrupt sites remain
    // available for diagnosis; other sites continue, with no invented replacement.
    for (const [id, patch] of Object.entries(this.state.sites ?? {})) {
      if (![patch.water, patch.snow, patch.fertility, patch.litter, patch.lastMinute].every(Number.isFinite)
        || !Array.isArray(patch.plants) || patch.plants.some(c =>
          ![c.adult, c.juvenile, c.seeds, c.adultAge, c.juvenileAge].every(n => Number.isFinite(n) && n >= 0))) {
        this.invalidSites.add(id); this.fault(`Invalid ecological site ${id}; preserved for diagnosis`);
      }
    }
  }
  private fault(reason: string) { this.state.lifecycle = 'faulted'; this.state.fallback = true; this.state.lastFault = reason.slice(0, 240); }
  health() { return { lifecycle: this.state.lifecycle, healthy: !this.state.fallback,
    lastFault: this.state.lastFault, lastHeartbeatWorldMinute: this.state.lastHeartbeatWorldMinute }; }
  snapshot(): VegetationSystemState { return structuredClone(this.state); }
  /** Host adoption only. The host's existing atomic world transaction owns it. */
  stateForCommit(): VegetationSystemState { return this.state; }
  operationCounts() { return { ...this.metrics }; }

  synchronizeHabitats(habitats: readonly PlantHabitat[], minute: number,
    landPassage: (a: PlantHabitat, b: PlantHabitat) => boolean, preparedEdges?: SeedEdge[]): void {
    if (this.habitats === habitats) return;
    this.habitats = habitats;
    const active = new Set(habitats.map(h => h.id));
    for (const [id, patch] of Object.entries(this.state.sites)) patch.active = active.has(id) && !this.invalidSites.has(id);
    for (const habitat of habitats) {
      let patch = this.state.sites[habitat.id];
      if (!patch) patch = this.state.sites[habitat.id] = initializePatch(habitat, minute, this.seed);
      else patch.habitat = { ...habitat, fertility: patch.habitat.fertility }; // Preserve the initial soil prior across reload.
    }
    this.edges = preparedEdges ?? buildSeedEdges(habitats, landPassage);
    if (!preparedEdges) this.metrics.topologyBuilds++;
  }

  advance(weather: readonly PlantWeather[], resources: readonly LandResourceInput[], toMinute: number):
    { resources: LandResourceOutput[]; events: VegetationEvent[] } {
    if (toMinute <= this.state.lastMinute) return { resources: [], events: [] };
    const canRun = this.state.allowed && ['running', 'registered', 'restricted'].includes(this.state.lifecycle);
    this.state.fallback = !canRun || this.invalidSites.size > 0;
    // An injected replacement is isolated transactionally; the built-in path
    // does not copy the ecosystem on every tick.
    if (canRun && this.model) {
      const before = structuredClone(this.state);
      try { return this.evolve(weather, resources, toMinute, this.model); }
      catch (error) {
        this.state = before;
        this.fault(error instanceof Error ? error.message : 'Vegetation executor failed');
      }
    }
    return this.evolve(weather, resources, toMinute, evolvePatch);
  }

  private evolve(weather: readonly PlantWeather[], resources: readonly LandResourceInput[], toMinute: number, model: PatchModel) {
    const events: VegetationEvent[] = [];
    const sites = Object.values(this.state.sites).filter(p => p.active && !p.habitat.marine && !this.invalidSites.has(p.habitat.id));
    const regional = new Map<string, VegetationPatch[]>();
    const beforeFertility = new Map<VegetationPatch, number>();
    const occupied = new Map<string, Set<string>>();
    for (const patch of sites) {
      patch.lastGrowth = 0; patch.lastMortality = 0;
      beforeFertility.set(patch, patch.fertility);
      occupied.set(patch.habitat.id, new Set(patch.plants.filter(c => c.adult + c.juvenile > 0.00001).map(c => c.speciesId)));
      if (patch.habitat.region) {
        const list = regional.get(patch.habitat.region);
        if (list) list.push(patch); else regional.set(patch.habitat.region, [patch]);
      }
    }
    // Existing extraction/support enters as a physical land delta only.
    for (const r of resources) {
      const prior = this.state.regions[r.id];
      if (!prior) continue;
      const pressure = unit((prior.base - r.base) / Math.max(0.01, prior.base));
      for (const patch of regional.get(r.id) ?? []) {
        for (const c of patch.plants) { c.adult *= 1 - pressure; c.juvenile *= 1 - pressure; }
        patch.fertility = unit(patch.fertility + r.fertility - prior.fertility);
        // Do not re-apply extraction to the resource projection a second time.
        beforeFertility.set(patch, patch.fertility);
      }
    }
    for (const slice of weather) {
      if (slice.duration <= 0 || slice.minute < this.state.lastMinute) continue;
      for (const patch of sites) {
        model(patch, slice); this.metrics.modelSteps++;
        if (this.model && (![patch.water, patch.fertility].every(n => Number.isFinite(n) && n >= 0 && n <= 1)
          || patch.plants.some(c => ![c.adult, c.juvenile, c.seeds].every(n => Number.isFinite(n) && n >= 0 && n <= 1)))) {
          throw new Error('Vegetation replacement returned invalid physical values');
        }
      }
      disperseSeeds(this.state.sites, this.edges, slice);
    }
    for (const patch of sites) {
      const prior = occupied.get(patch.habitat.id)!;
      for (const c of patch.plants) {
        const alive = c.adult + c.juvenile > 0.00001;
        if (alive !== prior.has(c.speciesId)) events.push({ minute: toMinute, siteId: patch.habitat.id,
          speciesId: c.speciesId, kind: alive ? 'colonized' : 'locally_extinct', detail: c.limitation });
      }
    }
    const output: LandResourceOutput[] = resources.map(r => {
      const patches = regional.get(r.id) ?? [];
      let productivity = 1, soilDelta = 0, mortality = 0;
      if (patches.length) {
        productivity = 0;
        for (const p of patches) {
          // Resource capacity follows living cover and current plant condition.
          const living = p.plants.reduce((n, c) => n + (c.adult + c.juvenile) * c.suitability, 0);
          productivity += Math.min(1.25, living / 0.55);
          soilDelta += p.fertility - beforeFertility.get(p)!;
          // Ordinary turnover replaced by new growth is not land degradation.
          mortality += Math.max(0, p.lastMortality - p.lastGrowth);
        }
        productivity /= patches.length; soilDelta /= patches.length; mortality /= patches.length;
      }
      const next = { id: r.id, base: unit(r.base + r.baseRecovery * productivity - mortality * 0.08),
        fertility: unit(r.fertility + r.soilRecovery + soilDelta) };
      this.state.regions[r.id] = { base: next.base, fertility: next.fertility };
      return next;
    });
    this.state.lastMinute = toMinute; this.state.lastHeartbeatWorldMinute = toMinute; this.state.updates++;
    return { resources: output, events };
  }

  applyCardinalCommand(command: CardinalSystemCommand): void {
    switch (command.kind) {
      case 'start': case 'restore':
        if (this.invalidSites.size || this.state.version !== 1 || this.state.dataVersion !== PLANT_DATA_VERSION) {
          this.fault('Physical vegetation data require repair; lifecycle restart cannot replace history'); return;
        }
        this.state.lifecycle = 'running'; this.state.allowed = true; this.state.fallback = false; delete this.state.lastFault; return;
      case 'stop': case 'retire':
        this.state.lifecycle = command.kind === 'stop' ? 'stopped' : 'retired'; this.state.fallback = true; return;
      case 'restrict':
        if (command.allowedCapabilityIds.some(id => id !== 'ecology.vegetation.write')) throw new Error('Vegetation capability denied');
        this.state.lifecycle = 'restricted'; this.state.allowed = command.allowedCapabilityIds.includes('ecology.vegetation.write');
        this.state.fallback = !this.state.allowed; return;
      default: throw new Error('Unknown vegetation lifecycle command');
    }
  }
}
