import type { WeatherSystemState } from '../world/systems/WeatherSystemAgent';
import type { CardinalSystemCommand } from './SystemAgentContracts';

/** Pure diagnosis. No world, resident, storage, clock or gateway capability. */
export class WeatherAgentConductor {
  diagnose(weather: Readonly<WeatherSystemState> | undefined): CardinalSystemCommand | undefined {
    if (!weather) return undefined; // A legacy save initializes locally.
    if (weather.version === 1 && weather.lifecycle === 'running' && !weather.fallback) return undefined;
    const invalid = weather.version !== 1 || !['running', 'registered', 'restricted', 'stopped', 'faulted', 'retired'].includes(weather.lifecycle);
    const failed = weather.lifecycle === 'faulted' ||
      (weather.fallback && ['running', 'registered'].includes(weather.lifecycle));
    // Deliberate restrictions/stops are not failures. Storms are not failures.
    if (!invalid && !failed) return undefined;
    return { kind: 'restore', reason: 'Cardinal: restore failed weather executor using the preserved model' };
  }
}
