import type { WorldState } from '../types';
import type { CardinalSystemAgent, CardinalSystemCommand, SystemAgentLifecycle, SystemAgentManifest } from '../../cardinal/SystemAgentContracts';
import { SystemAgentOrchestrator } from './SystemAgentRegistry';
import { createCachedWeatherModelV21, type WeatherModelInput, type WorldWeatherV21 } from '../../v21/WeatherModelV21';
import { createRegionalWeatherProjector, type WeatherSite } from '../../v21/RegionalWeatherV21';

export interface WeatherSystemState {
  version: 1;
  lifecycle: SystemAgentLifecycle;
  allowed: boolean;
  fallback: boolean;
  lastHeartbeatWorldMinute?: number;
  lastFault?: string;
  current?: WorldWeatherV21;
}

export const WEATHER_AGENT_MANIFEST: SystemAgentManifest = Object.freeze({
  id: 'weather-system', version: '1', domain: 'weather', infrastructureOnly: true,
  description: 'Autonomous regional weather, preserved global reference and local fallback.',
  capabilities: Object.freeze([Object.freeze({
    id: 'weather.state.write', domain: 'weather' as const,
    readScopes: Object.freeze(['weather.inputs']),
    writeScopes: Object.freeze(['weather.current']),
  })]),
});

type WeatherModel = (input: Readonly<WeatherModelInput>, minute: number) => WorldWeatherV21;
const lifecycles: readonly string[] = ['running', 'registered', 'restricted', 'stopped', 'faulted', 'retired'];
const weatherKinds = ['clear', 'cloudy', 'fog', 'rain', 'storm', 'snow'];
const unitKeys = ['precipitation', 'wind', 'severity', 'comfort', 'outdoorDecisionPenalty', 'walkingScale'] as const;
export const WEATHER_CACHE_LIMIT = 16;

function validWeather(value: WorldWeatherV21): boolean {
  if (!value || !weatherKinds.includes(value.kind)) return false;
  return unitKeys.every(key => Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1)
    && Number.isFinite(value.temperatureC) && Math.abs(value.temperatureC) <= 80
    && Number.isFinite(value.safetyModifier) && Math.abs(value.safetyModifier) <= 1
    && Number.isFinite(value.habitatModifier) && Math.abs(value.habitatModifier) <= 1
    && typeof value.label === 'string' && typeof value.comfortLabel === 'string';
}

/** Has no WorldState, RNG, resident, storage or Cardinal dependency. */
export class WeatherSystemAgent implements CardinalSystemAgent {
  readonly manifest = WEATHER_AGENT_MANIFEST;
  private state: WeatherSystemState;
  private cachedInput?: Readonly<WeatherModelInput>;
  private cachedMinute?: number;
  private cached?: Readonly<WorldWeatherV21>;
  private readonly samples = new Map<number, Readonly<WorldWeatherV21>>();
  private readonly originalModel = createCachedWeatherModelV21();
  private readonly regional = createRegionalWeatherProjector();
  private readonly localSamples = new Map<string, { input: Readonly<WeatherModelInput>; minute: number; site: Readonly<WeatherSite>; weather: Readonly<WorldWeatherV21> }>();

  constructor(saved?: WeatherSystemState, private readonly model?: WeatherModel) {
    this.state = saved?.version === 1 && lifecycles.includes(saved.lifecycle)
      ? { ...structuredClone(saved), allowed: saved.allowed === true }
      : { version: 1, lifecycle: 'running', allowed: true, fallback: false };
    if (saved && (saved.version !== 1 || !lifecycles.includes(saved.lifecycle))) {
      this.state.lifecycle = 'faulted';
      this.state.lastFault = 'Invalid weather agent state; original weather model remains active.';
      this.state.fallback = true;
    }
  }

  health() {
    return { lifecycle: this.state.lifecycle, healthy: !this.state.fallback,
      lastHeartbeatWorldMinute: this.state.lastHeartbeatWorldMinute, lastFault: this.state.lastFault };
  }

  snapshot(): WeatherSystemState { return structuredClone(this.state); }

  sampleAt(input: Readonly<WeatherModelInput>, minute: number, site: Readonly<WeatherSite>): Readonly<WorldWeatherV21> {
    const key = `${site.x}:${site.y}`;
    const previous = this.localSamples.get(key);
    if (previous && previous.minute === minute && previous.input.id === input.id && previous.input.epoch === input.epoch
      && previous.input.volatility === input.volatility && previous.site.elevationM === site.elevationM
      && previous.site.moisture === site.moisture && previous.site.maritime === site.maritime
      && previous.site.upwindElevationM === site.upwindElevationM) return previous.weather;
    const weather = this.regional(input, minute, site, this.sample(input, minute));
    if (this.localSamples.size >= 256) this.localSamples.delete(this.localSamples.keys().next().value!);
    this.localSamples.set(key, { input: { ...input }, minute, site: { ...site }, weather });
    return weather;
  }

  sample(input: Readonly<WeatherModelInput>, minute: number): Readonly<WorldWeatherV21> {
    if (!input.id || !Number.isFinite(input.epoch) || !Number.isFinite(input.volatility)
      || !Number.isFinite(minute) || minute < 0) throw new Error('Invalid weather inputs');
    if (input.id !== this.cachedInput?.id || input.epoch !== this.cachedInput.epoch
      || input.volatility !== this.cachedInput.volatility) {
      this.cachedInput = Object.freeze({ ...input });
      this.samples.clear(); this.cached = undefined; this.cachedMinute = undefined;
    }
    if (minute === this.cachedMinute && this.cached) return this.cached;
    const existing = this.samples.get(minute);
    if (existing) {
      this.cachedMinute = minute; this.cached = existing;
      this.state.current = existing; this.state.lastHeartbeatWorldMinute = minute;
      return existing;
    }
    const canRun = this.state.allowed && ['running', 'registered', 'restricted'].includes(this.state.lifecycle);
    let current: WorldWeatherV21;
    this.state.fallback = !canRun;
    if (canRun && this.model) {
      try {
        current = this.model(this.cachedInput, minute);
        if (!validWeather(current)) throw new Error('Weather model returned invalid physical values');
      } catch (error) {
        this.state.lifecycle = 'faulted';
        this.state.lastFault = (error instanceof Error ? error.message : 'Weather model failed').slice(0, 240);
        this.state.fallback = true;
        this.samples.clear();
        current = this.originalModel(input, minute);
      }
    } else current = this.originalModel(input, minute);
    // The built-in model owns this fresh object; injected models retain theirs.
    this.cached = Object.freeze(this.model && canRun && !this.state.fallback ? { ...current } : current);
    this.cachedMinute = minute;
    if (this.samples.size >= WEATHER_CACHE_LIMIT) this.samples.delete(this.samples.keys().next().value!);
    this.samples.set(minute, this.cached);
    this.state.current = this.cached;
    this.state.lastHeartbeatWorldMinute = minute;
    return this.cached;
  }

  applyCardinalCommand(command: CardinalSystemCommand): void {
    switch (command.kind) {
      case 'start': case 'restore':
        this.state.lifecycle = 'running'; this.state.allowed = true;
        this.state.fallback = false; delete this.state.lastFault; break;
      case 'stop': case 'retire':
        this.state.lifecycle = command.kind === 'stop' ? 'stopped' : 'retired';
        this.state.fallback = true; break;
      case 'restrict':
        if (command.allowedCapabilityIds.some(id => id !== 'weather.state.write')) {
          throw new Error('Weather agent cannot acquire another capability');
        }
        this.state.allowed = command.allowedCapabilityIds.includes('weather.state.write');
        this.state.lifecycle = 'restricted'; this.state.fallback = !this.state.allowed; break;
      default: throw new Error('Unknown weather lifecycle command');
    }
    this.cachedMinute = undefined;
    this.cached = undefined;
    this.samples.clear();
    this.localSamples.clear();
  }
}

// One bounded cache per live snapshot; garbage-collected with that snapshot.
// Rendering never writes the persisted WorldState.
const runtimes = new WeakMap<object, { weather: WeatherSystemAgent; registry: SystemAgentOrchestrator }>();

export function weatherRuntimeFor(world: Readonly<WorldState>) {
  let runtime = runtimes.get(world);
  if (!runtime) {
    const weather = new WeatherSystemAgent(world.weatherSystem);
    const registry = new SystemAgentOrchestrator();
    registry.register(weather);
    runtime = { weather, registry };
    runtimes.set(world, runtime);
  }
  return runtime;
}

/** Called inside the world's existing atomic persistence transaction. */
export function commitWeatherSystem(world: WorldState): void {
  const { weather } = weatherRuntimeFor(world);
  weather.sample({ id: world.id, epoch: world.epoch ?? 1,
    volatility: world.governance.laws.weather_volatility?.value ?? 0.2 }, world.calendar.elapsedWorldMinutes);
  world.weatherSystem = weather.snapshot();
}

export function commandWeatherSystem(world: WorldState, command: CardinalSystemCommand): void {
  weatherRuntimeFor(world).registry.command('weather-system', command);
  commitWeatherSystem(world);
}
