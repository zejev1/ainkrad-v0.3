import type { WorldState } from '../types';
import type { CardinalSystemAgent, CardinalSystemCommand, SystemAgentLifecycle, SystemAgentManifest } from '../../cardinal/SystemAgentContracts';
import { SystemAgentOrchestrator } from '../../cardinal/SystemAgentOrchestrator';
import { calculateWeatherV21, type WeatherModelInput, type WorldWeatherV21 } from '../../v21/WeatherModelV21';

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
  description: 'Autonomous weather using the preserved F2 model, with local fallback.',
  capabilities: Object.freeze([Object.freeze({
    id: 'weather.state.write', domain: 'weather' as const,
    readScopes: Object.freeze(['weather.inputs']),
    writeScopes: Object.freeze(['weather.current']),
  })]),
});

type WeatherModel = (input: Readonly<WeatherModelInput>, minute: number) => WorldWeatherV21;
const lifecycles: readonly string[] = ['running', 'registered', 'restricted', 'stopped', 'faulted', 'retired'];

function validWeather(value: WorldWeatherV21): boolean {
  if (!value || !['clear', 'cloudy', 'fog', 'rain', 'storm', 'snow'].includes(value.kind)) return false;
  const unitKeys = ['precipitation', 'wind', 'severity', 'comfort', 'outdoorDecisionPenalty', 'walkingScale'] as const;
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
  private cacheKey?: string;
  private cached?: Readonly<WorldWeatherV21>;

  constructor(saved?: WeatherSystemState, private readonly model: WeatherModel = calculateWeatherV21) {
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

  sample(input: Readonly<WeatherModelInput>, minute: number): WorldWeatherV21 {
    if (!input.id || !Number.isFinite(input.epoch) || !Number.isFinite(input.volatility)
      || !Number.isFinite(minute) || minute < 0) throw new Error('Invalid weather inputs');
    const key = JSON.stringify([input.id, input.epoch, input.volatility, minute]);
    if (key === this.cacheKey && this.cached) return { ...this.cached };
    const canRun = this.state.allowed && ['running', 'registered', 'restricted'].includes(this.state.lifecycle);
    let current: WorldWeatherV21;
    this.state.fallback = !canRun;
    if (canRun) {
      try {
        current = this.model(Object.freeze({ ...input }), minute);
        if (!validWeather(current)) throw new Error('Weather model returned invalid physical values');
      } catch (error) {
        this.state.lifecycle = 'faulted';
        this.state.lastFault = (error instanceof Error ? error.message : 'Weather model failed').slice(0, 240);
        this.state.fallback = true;
        current = calculateWeatherV21(input, minute);
      }
    } else current = calculateWeatherV21(input, minute);
    this.cached = Object.freeze({ ...current });
    this.cacheKey = key;
    this.state.current = { ...current };
    this.state.lastHeartbeatWorldMinute = minute;
    return { ...current };
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
    this.cacheKey = undefined;
    this.cached = undefined;
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
