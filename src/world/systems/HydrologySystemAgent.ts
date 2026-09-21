import type { CardinalSystemAgent, CardinalSystemCommand, SystemAgentManifest, SystemAgentLifecycle } from '../../cardinal/SystemAgentContracts';
import { HYDROLOGY_DATA_VERSION } from './water/HydrologyKnowledge';
import { evolveWater, initializeWater, validWaterUnit, waterForPlants, waterVolume, type WaterClimate, type WaterUnit, type WaterUnitSpec, type WaterCondition } from './water/HydrologyModel';

export interface WaterBudget { beforeM3: number; precipitationM3: number; evaporationM3: number; transpirationM3: number;
  oceanM3: number; afterM3: number; residualM3: number; relativeError: number }
export interface HydrologyState {
  version: 1; dataVersion: string; lifecycle: SystemAgentLifecycle; allowed: boolean; fallback: boolean;
  lastFault?: string; lastHeartbeatWorldMinute?: number; lastMinute: number; updates: number;
  units: Record<string, WaterUnit>; budget: WaterBudget;
  totals: { initialM3: number; precipitationM3: number; atmosphereM3: number; oceanM3: number };
}
export interface HydrologyEvent { unitId: string; minute: number; from: WaterCondition; to: WaterCondition }
export const HYDROLOGY_AGENT_MANIFEST: SystemAgentManifest = Object.freeze({ id: 'hydrology-system', version: '1', domain: 'hydrology',
  infrastructureOnly: true, description: 'Finite watershed, snow, soil, aquifer and surface-water balance.',
  capabilities: Object.freeze([Object.freeze({ id: 'hydrology.water.write', domain: 'hydrology' as const,
    readScopes: Object.freeze(['geography.drainage', 'weather.regional', 'ecology.physical_cover', 'hydrology.catalog']),
    writeScopes: Object.freeze(['hydrology.stores', 'hydrology.fluxes', 'hydrology.conditions']) })]) });
const emptyBudget = (): WaterBudget => ({ beforeM3: 0, precipitationM3: 0, evaporationM3: 0, transpirationM3: 0, oceanM3: 0, afterM3: 0, residualM3: 0, relativeError: 0 });
const lifecycles = ['running','registered','restricted','stopped','faulted','retired'];

export class HydrologySystemAgent implements CardinalSystemAgent {
  readonly manifest = HYDROLOGY_AGENT_MANIFEST;
  private state: HydrologyState;
  private invalid = new Set<string>();
  private specs?: readonly WaterUnitSpec[];
  private active: WaterUnit[] = [];
  private metrics = { modelSteps: 0, topologyBuilds: 0 };
  constructor(saved: HydrologyState | undefined, minute: number, private readonly replacement?: typeof evolveWater) {
    this.state = saved ?? { version: 1, dataVersion: HYDROLOGY_DATA_VERSION, lifecycle: 'running', allowed: true,
      fallback: false, lastMinute: minute, updates: 0, units: {}, budget: emptyBudget(),
      totals: { initialM3: 0, precipitationM3: 0, atmosphereM3: 0, oceanM3: 0 } };
    if (this.state.version !== 1 || this.state.dataVersion !== HYDROLOGY_DATA_VERSION || !lifecycles.includes(this.state.lifecycle)) this.fault('Invalid hydrology metadata; physical records retained');
    for (const [id, s] of Object.entries(this.state.units ?? {})) if (!validWaterUnit(s)) { this.invalid.add(id); this.fault(`Invalid water reservoir ${id}; retained for diagnosis`); }
  }
  private fault(reason: string) { this.state.lifecycle = 'faulted'; this.state.fallback = true; this.state.lastFault = reason.slice(0,240); }
  health() { return { lifecycle: this.state.lifecycle, healthy: !this.state.fallback, lastFault: this.state.lastFault, lastHeartbeatWorldMinute: this.state.lastHeartbeatWorldMinute }; }
  stateForCommit() { return this.state; }
  snapshot() { return structuredClone(this.state); }
  operationCounts() { return { ...this.metrics }; }

  synchronize(specs: readonly WaterUnitSpec[], initial: Readonly<Record<string, { water: number; snow: number }>> = {}): void {
    if (specs === this.specs) return;
    this.specs = specs; this.metrics.topologyBuilds++;
    const ids = new Set(specs.map(s => s.id));
    for (const [id,s] of Object.entries(this.state.units)) if(s) s.active = ids.has(id) && !this.invalid.has(id);
    const first = Object.keys(this.state.units).length === 0;
    for (const spec of specs) {
      if(this.invalid.has(spec.id)) continue; // Never replace a corrupt/null saved record with invented water.
      let s = this.state.units[spec.id];
      if (!s) {
        s = initializeWater(spec, this.state.lastMinute, initial[spec.id]?.water, initial[spec.id]?.snow);
        const donor = spec.downstream && this.state.units[spec.downstream];
        if (!first && donor && spec.kind !== 'catchment' && validWaterUnit(donor)) {
          // Refining an already simulated catchment transfers its existing
          // water, it cannot add a new stock every time a place is discovered.
          const fraction = Math.min(1, spec.areaM2 / (donor.spec.areaM2 + spec.areaM2));
          for (const key of ['soilM3','groundwaterM3','snowM3','surfaceM3'] as const) {
            s[key] = donor[key] * fraction; donor[key] -= s[key];
          }
        } else this.state.totals.initialM3 += waterVolume(s); // documented first description/new physical geography
        this.state.units[spec.id] = s;
      } else if (!this.invalid.has(spec.id)) { s.spec = spec; s.active = true; }
    }
    // Fail closed on malformed/cyclic topology, without rewriting saved water.
    const done = new Set<string>();
    for (const spec of specs) {
      const path = new Set<string>(); let id: string | undefined = spec.id;
      while (id && !done.has(id)) {
        if(this.invalid.has(id)) break;
        if (path.has(id) || !this.state.units[id]) throw new Error('Invalid hydrology drainage topology');
        path.add(id); id = this.state.units[id].spec.downstream;
      }
      for (const p of path) done.add(p);
    }
    this.active = Object.entries(this.state.units).filter(([id,s]) => s?.active && !this.invalid.has(id)).map(([,s])=>s);
  }

  advance(minute: number, duration: number, climates: Readonly<Record<string, WaterClimate>>, covers: Readonly<Record<string, number>>): HydrologyEvent[] {
    if (minute + duration <= this.state.lastMinute) return [];
    if (minute !== this.state.lastMinute || !Number.isFinite(duration) || duration <= 0 || duration > 1440) throw new Error('Hydrology requires contiguous daily-or-shorter slices');
    const canRun = this.state.allowed && ['running','registered','restricted'].includes(this.state.lifecycle);
    this.state.fallback = !canRun || this.invalid.size > 0;
    if (canRun && this.replacement) {
      const before = structuredClone(this.state);
      try { return this.evolve(minute, duration, climates, covers, this.replacement); }
      catch (error) {
        this.state = before; this.active = this.active.map(s => before.units[s.spec.id]);
        this.fault(error instanceof Error ? error.message : 'Hydrology executor failed');
      }
    }
    return this.evolve(minute, duration, climates, covers, evolveWater);
  }
  private evolve(minute: number, duration: number, climates: Readonly<Record<string, WaterClimate>>, covers: Readonly<Record<string, number>>, model: typeof evolveWater) {
    const budget = emptyBudget(), events: HydrologyEvent[] = [];
    for (const s of this.active) {
      const weather = climates[s.spec.id];
      if (!weather || !Number.isFinite(weather.temperatureC) || !Number.isFinite(weather.precipitation) || !Number.isFinite(weather.wind)) throw new Error('Missing or invalid physical weather forcing');
      const before = waterVolume(s), flux = model(s, weather, duration, covers[s.spec.id] ?? 0.65);
      budget.beforeM3 += before;
      this.metrics.modelSteps++;
      if (this.replacement && (!validWaterUnit(s) || Object.values(flux).some(n => !Number.isFinite(n) || n < 0)
        || Math.abs(waterVolume(s) - before - flux.precipitationM3 + flux.evaporationM3 + flux.transpirationM3 + flux.outflowM3) > Math.max(1e-6, before * 1e-10))) throw new Error('Replacement violates water conservation');
      budget.precipitationM3 += flux.precipitationM3; budget.evaporationM3 += flux.evaporationM3; budget.transpirationM3 += flux.transpirationM3;
    }
    // Simultaneous routing: an inflow cannot traverse the continent in one step.
    for (const s of this.active) {
      const id = s.spec.downstream, receiver = id && this.state.units[id], amount = s.flux.outflowM3;
      if (receiver && receiver.active && !this.invalid.has(receiver.spec.id)) { receiver.surfaceM3 += amount; receiver.flux.inflowM3 += amount; }
      else if (id) { s.surfaceM3 += amount; s.flux.outflowM3 = 0; } // retain water upstream of an isolated reservoir
      else budget.oceanM3 += amount;
    }
    // River/lake storage and inundation draw from the actual hosting channel.
    // This lateral exchange is conservative and separate from downstream flow.
    for (const s of this.active) if (s.spec.downstream && (s.spec.riparian || s.spec.kind === 'lake' || s.spec.kind === 'river')) {
      const channel = this.state.units[s.spec.downstream];
      if (!channel?.active || this.invalid.has(channel.spec.id)) continue;
      const level = channel.surfaceM3 / channel.spec.surfaceAreaM2;
      const bank = channel.spec.bankfullM3 / channel.spec.surfaceAreaM2;
      const target = (s.spec.kind === 'plot' ? Math.max(0, level-bank) : level) * s.spec.surfaceAreaM2;
      const amount = Math.min(channel.surfaceM3, Math.max(0, target-s.surfaceM3)) * (1-Math.exp(-duration/1440));
      channel.surfaceM3 -= amount; s.surfaceM3 += amount;
      channel.flux.exchangeOutM3 += amount; s.flux.exchangeInM3 += amount;
    }
    for (const s of this.active) {
      const p = waterForPlants(s), old = s.condition;
      s.condition = p.floodDepthM > (old === 'flood' ? 0.02 : 0.06) ? 'flood'
        : p.water < (old === 'drought' ? 0.23 : 0.15) ? 'drought' : 'normal';
      if (old !== s.condition) events.push({ unitId: s.spec.id, minute: minute+duration, from: old, to: s.condition });
      s.lastMinute = minute+duration; budget.afterM3 += waterVolume(s);
    }
    budget.residualM3 = budget.afterM3 - budget.beforeM3 - budget.precipitationM3 + budget.evaporationM3 + budget.transpirationM3 + budget.oceanM3;
    budget.relativeError = Math.abs(budget.residualM3) / Math.max(1, budget.beforeM3 + budget.precipitationM3);
    this.state.budget = budget;
    this.state.totals.precipitationM3 += budget.precipitationM3;
    this.state.totals.atmosphereM3 += budget.evaporationM3 + budget.transpirationM3; this.state.totals.oceanM3 += budget.oceanM3;
    this.state.lastMinute = minute+duration; this.state.lastHeartbeatWorldMinute = minute+duration; this.state.updates++;
    return events;
  }
  applyCardinalCommand(command: CardinalSystemCommand): void {
    switch(command.kind) {
      case 'start': case 'restore':
        if (this.invalid.size || this.state.version !== 1 || this.state.dataVersion !== HYDROLOGY_DATA_VERSION) { this.fault('Physical water data require repair; lifecycle restart cannot replace history'); return; }
        this.state.lifecycle = 'running'; this.state.allowed = true; this.state.fallback = false; delete this.state.lastFault; return;
      case 'stop': case 'retire': this.state.lifecycle = command.kind === 'stop' ? 'stopped' : 'retired'; this.state.fallback = true; return;
      case 'restrict':
        if (command.allowedCapabilityIds.some(id => id !== 'hydrology.water.write')) throw new Error('Hydrology capability denied');
        this.state.lifecycle = 'restricted'; this.state.allowed = command.allowedCapabilityIds.includes('hydrology.water.write'); this.state.fallback = !this.state.allowed; return;
      default: throw new Error('Unknown hydrology lifecycle command');
    }
  }
}
