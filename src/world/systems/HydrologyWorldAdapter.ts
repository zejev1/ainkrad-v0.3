import type { WorldState } from '../types';
import type { CardinalSystemCommand } from '../../cardinal/SystemAgentContracts';
import { bindWorldTerrain } from '../geography/WorldTerrain';
import { invalidatePhysicalWater } from '../geography/HydrologySurface';
import { weatherSiteAt } from '../../v21/WeatherV21';
import type { WeatherSite } from '../../v21/RegionalWeatherV21';
import { weatherRuntimeFor } from './WeatherSystemAgent';
import { HydrologySystemAgent, type HydrologyEvent } from './HydrologySystemAgent';
import { hydrologyTopology } from './water/HydrologyTopology';
import { WATER_CALIBRATION as C } from './water/HydrologyKnowledge';
import { waterForPlants, type WaterClimate, type WaterUnitSpec } from './water/HydrologyModel';
import { DAY, plantCover, type PlantHabitat, type PlantWeather } from './plants/VegetationModel';

/** The only hydrology layer allowed to see the host. It exports physical inputs
 * only: no residents, personal resources, skills, identities or clock writer. */
export class HydrologyWorldAdapter {
  private world?: WorldState;
  private agent?: HydrologySystemAgent;
  private key?: string;
  private habitats?: readonly PlantHabitat[];
  private specs: WaterUnitSpec[] = [];
  private weatherSites: Readonly<WeatherSite>[] = [];
  private waterPlaces = '';
  attach(world: WorldState, habitats: readonly PlantHabitat[]): HydrologySystemAgent {
    if (this.world !== world || this.agent?.stateForCommit() !== world.hydrologySystem) {
      this.world = world; this.agent = new HydrologySystemAgent(world.hydrologySystem,
        world.vegetationSystem?.lastMinute ?? world.calendar.elapsedWorldMinutes);
      world.hydrologySystem = this.agent.stateForCommit();
    }
    const terrain = bindWorldTerrain(world), key = terrain?.foundation.key ?? world.id;
    const waterPlaces = Object.values(world.places).filter(p => p.kind === 'lake' || p.kind === 'river');
    const signature = waterPlaces.map(p => `${p.id}:${p.mapX}:${p.mapY}`).join('|');
    if (this.key !== key || this.habitats !== habitats || this.waterPlaces !== signature) {
      this.key = key; this.habitats = habitats; this.waterPlaces = signature;
      const topology = terrain && hydrologyTopology(terrain);
      const basins = new Map((topology?.specs ?? []).map(s => [s.id, { ...s }]));
      const local: WaterUnitSpec[] = [];
      for (const h of habitats) {
        if (h.marine) continue;
        const downstream = topology?.basinAt(h.x,h.y);
        const place = world.places[h.id], kind = place?.kind === 'lake' ? 'lake' : place?.kind === 'river' ? 'river' : 'plot';
        local.push({ id: h.id, x: h.x, y: h.y, kind, elevationM: h.elevationM, moisture: h.moisture, slope: h.slope,
          areaM2: C.plotAreaM2, soilCapacityMm: C.soilCapacityMm, surfaceAreaM2: C.plotAreaM2,
          bankfullM3: C.plotAreaM2 * (kind === 'plot' ? 0.005 : 1.5), residenceDays: kind === 'lake' ? 12 : kind === 'river' ? 0.4 : 0.7,
          downstream, riparian: Boolean(h.watercourse) || h.kind === 'wetland' });
      }
      for (const p of waterPlaces) if (!local.some(s => s.id === p.id)) {
        const sample = terrain?.sample(p.mapX,p.mapY,false), downstream = topology?.basinAt(p.mapX,p.mapY);
        local.push({ id: p.id, kind: p.kind as 'lake'|'river', x: p.mapX, y: p.mapY, elevationM: sample?.height ?? 0,
          moisture: 0.9, slope: 0.02, areaM2: C.plotAreaM2, soilCapacityMm: C.soilCapacityMm, surfaceAreaM2: C.plotAreaM2,
          bankfullM3: C.plotAreaM2*1.5, residenceDays: p.kind === 'lake' ? 12 : 0.4, downstream });
      }
      for (const s of local) if (s.downstream) {
        const b = basins.get(s.downstream)!;
        if (b.areaM2 <= s.areaM2) throw new Error('Local hydrological area exceeds its catchment');
        b.areaM2 -= s.areaM2;
      }
      this.specs = [...basins.values(), ...local];
      invalidatePhysicalWater(world);
      this.weatherSites = this.specs.map(s => ({...weatherSiteAt(world,s.x,s.y), elevationM: s.elevationM}));
    }
    this.agent!.synchronize(this.specs, world.vegetationSystem?.sites ?? {});
    return this.agent!;
  }
  /** One weather evaluation per reservoir and physical slice, never per frame. */
  advance(world: WorldState, habitats: readonly PlantHabitat[]): { slices: PlantWeather[]; events: HydrologyEvent[] } {
    const agent = this.attach(world, habitats), to = world.calendar.elapsedWorldMinutes;
    const slices: PlantWeather[] = [], events: HydrologyEvent[] = [];
    const input = { id: world.id, epoch: world.epoch ?? 1, volatility: world.governance.laws.weather_volatility?.value ?? 0.2 };
    const weather = weatherRuntimeFor(world).weather;
    const covers: Record<string, number> = {};
    for (const h of habitats) { const p=world.vegetationSystem?.sites[h.id]; if(p)covers[h.id]=plantCover(p); }
    for (let minute = agent.stateForCommit().lastMinute; minute < to;) {
      const end = Math.min(to,(Math.floor(minute/DAY)+1)*DAY), midpoint = (minute+end)/2;
      const climates: Record<string,WaterClimate> = {};
      const samples=weather.samplePhysicalSites(input,midpoint,this.weatherSites);
      for (let i=0;i<this.specs.length;i++) {
        const s=this.specs[i],w=samples[i];
        climates[s.id]=w;
      }
      events.push(...agent.advance(minute,end-minute,climates,covers));
      const water: NonNullable<PlantWeather['water']> = {};
      for (const h of habitats) { const s=agent.stateForCommit().units[h.id]; if(s&&s.active)water[h.id]=waterForPlants(s); }
      const global=weather.sample(input,midpoint);
      slices.push({minute,duration:end-minute,temperatureC:global.temperatureC,precipitation:global.precipitation,
        rain:global.kind==='rain'||global.kind==='storm',snow:global.kind==='snow',wind:global.wind,local:climates,water});
      minute=end;
    }
    world.hydrologySystem=agent.stateForCommit();
    return {slices,events};
  }
  command(world: WorldState, habitats: readonly PlantHabitat[], command: CardinalSystemCommand): void {
    const agent=this.attach(world,habitats);agent.applyCardinalCommand(command);world.hydrologySystem=agent.stateForCommit();
  }
}
