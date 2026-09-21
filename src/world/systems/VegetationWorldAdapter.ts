import type { WorldState, WorldPlace } from '../types';
import type { CardinalSystemCommand } from '../../cardinal/SystemAgentContracts';
import { bindWorldTerrain } from '../geography/WorldTerrain';
import { HydrologyWorldAdapter } from './HydrologyWorldAdapter';
import { nearestRiverPoint } from '../geography/RiverCourses';
import { VegetationSystemAgent, type LandResourceInput } from './VegetationSystemAgent';
import { unit, buildSeedEdges, type SeedEdge, type PlantHabitat } from './plants/VegetationModel';

const kinds = new Set(['resource_field', 'meadow', 'forest', 'outskirts', 'quiet_space', 'shore', 'mountains', 'swamp', 'ruins', 'river', 'lake']);
function habitatKind(p: WorldPlace): PlantHabitat['kind'] {
  return p.kind === 'resource_field' ? 'field' : p.biome === 'swamp' || ['river', 'lake'].includes(p.kind) ? 'wetland'
    : p.biome === 'forest' ? 'woodland' : p.biome === 'mountains' ? 'rock' : p.biome === 'coast' ? 'coast' : 'meadow';
}
/** Host adapter selects only physical world inputs. The agent never sees WorldState. */
export class VegetationWorldAdapter {
  private world?: WorldState;
  private agent?: VegetationSystemAgent;
  private terrainKey?: string;
  private habitats: PlantHabitat[] = [];
  private readonly waterHost = new HydrologyWorldAdapter();
  private edges: SeedEdge[] = [];
  private signatures = new Map<string, { x: number; y: number; kind: string; biome: string; surface: string; region?: string; carriers: boolean }>();

  attach(world: WorldState): VegetationSystemAgent {
    if (this.world !== world || this.agent?.stateForCommit() !== world.vegetationSystem) {
      this.world = world;
      this.agent = new VegetationSystemAgent(world.vegetationSystem, world.calendar.elapsedWorldMinutes,
        `${world.id}:${world.epoch ?? 1}`);
      world.vegetationSystem = this.agent.stateForCommit();
    }
    const key = world.terrain?.key ?? `${world.id}:${world.epoch ?? 1}`;
    let changed = key !== this.terrainKey;
    const carriers = new Set(Object.values(world.wildlife).filter(w => w.species === 'bird' && w.count > 0).map(w => w.habitatId));
    const places = Object.values(world.places).filter(p => kinds.has(p.kind) && p.surface !== 'water');
    if (places.length !== this.signatures.size) changed = true;
    for (const p of places) {
      const s = this.signatures.get(p.id);
      if (!s || s.x !== p.mapX || s.y !== p.mapY || s.kind !== p.kind || s.biome !== p.biome
        || s.surface !== p.surface || s.region !== p.settlementId || s.carriers !== carriers.has(p.id)) changed = true;
    }
    const terrain = bindWorldTerrain(world);
    if (changed) {
      this.terrainKey = key; this.signatures.clear();
      this.habitats = places.map(p => {
        this.signatures.set(p.id, { x: p.mapX, y: p.mapY, kind: p.kind, biome: p.biome, surface: p.surface,
          region: p.settlementId, carriers: carriers.has(p.id) });
        const sample = terrain?.sample(p.mapX, p.mapY);
        const kind = habitatKind(p);
        const moisture = kind === 'wetland' ? Math.max(0.86, sample?.moisture ?? 0.9) : sample?.moisture ?? 0.55;
        const reach = terrain?.rivers.query({ minX: p.mapX - 3, minY: p.mapY - 3, maxX: p.mapX + 3, maxY: p.mapY + 3 })
          .find(r => nearestRiverPoint({ x: p.mapX, y: p.mapY }, r).distance <= r.width + 3);
        return { id: p.id, region: p.settlementId, x: p.mapX, y: p.mapY, elevationM: Math.max(0, sample?.height ?? 150),
          moisture: unit(moisture), fertility: p.fertility, slope: unit(sample?.slope ?? 0.05),
          // There is no measured soil chemistry in this fictional terrain. pH is
          // an explicit habitat prior, exposed as estimated in the inspector.
          soilPh: kind === 'woodland' ? 5.6 : kind === 'rock' ? 5.2 : kind === 'wetland' ? 6.2 : 6.6,
          kind, marine: sample?.biome === 'ocean', seedCarriers: carriers.has(p.id), watercourse: reach?.id };
      });
    }
    const landPassage = (a: PlantHabitat, b: PlantHabitat) => {
      if (!terrain) return true;
      for (let i = 1; i < 8; i++) if (terrain.sample(a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8, false).biome === 'ocean') return false;
      return true;
    };
    if (changed) this.edges = buildSeedEdges(this.habitats, landPassage);
    this.agent!.synchronizeHabitats(this.habitats, world.calendar.elapsedWorldMinutes, landPassage, this.edges);
    this.waterHost.attach(world, this.habitats);
    return this.agent!;
  }

  advance(world: WorldState, resources: readonly LandResourceInput[]) {
    const agent = this.attach(world), state = agent.stateForCommit(), to = world.calendar.elapsedWorldMinutes;
    const water = this.waterHost.advance(world, this.habitats);
    // A restored water executor may catch up an older physical checkpoint.
    // Never replay already committed plant growth for that earlier interval.
    const slices = water.slices[0]?.minute === state.lastMinute ? water.slices : water.slices.flatMap(slice => {
      const start=Math.max(slice.minute,state.lastMinute),end=slice.minute+slice.duration;
      return end>start?[start===slice.minute?slice:{...slice,minute:start,duration:end-start}]:[];
    });
    const result = agent.advance(slices, resources, to);
    world.vegetationSystem = agent.stateForCommit();
    for (const p of Object.values(world.vegetationSystem.sites)) {
      if (p.active && world.places[p.habitat.id] && Number.isFinite(p.fertility)) world.places[p.habitat.id].fertility = p.fertility;
    }
    return { ...result, waterEvents: water.events };
  }
  commandWater(world: WorldState, command: CardinalSystemCommand): void {
    this.attach(world); this.waterHost.command(world, this.habitats, command);
  }
  command(world: WorldState, command: CardinalSystemCommand): void {
    const agent = this.attach(world); agent.applyCardinalCommand(command);
    world.vegetationSystem = agent.stateForCommit();
  }
}
