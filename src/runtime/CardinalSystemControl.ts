import { WeatherAgentConductor } from '../cardinal/WeatherAgentConductor';
import type { CardinalSystemCommand } from '../cardinal/SystemAgentContracts';
import type { AppendOnlyLog } from '../persistence/AppendOnlyLog';
import type { WeatherSystemState } from '../world/systems/WeatherSystemAgent';

export interface WeatherControlObservation {
  epoch: number;
  revision: number;
  minute: number;
  weather?: Readonly<WeatherSystemState>;
}
export interface WeatherControlPort {
  observe(): WeatherControlObservation;
  restore(command: CardinalSystemCommand, requestId: string, revision: number): Promise<boolean>;
}
export interface CardinalSystemRecord {
  sequence: number;
  enabled: boolean;
  epoch: number;
  minute: number;
  kind: 'on' | 'off' | 'repair_requested' | 'recovered' | 'repair_failed';
  attempts: number;
  recoveries: number;
  retryAfter: number;
  detail: string;
}
export interface CardinalControlSnapshot {
  status: 'ONLINE' | 'OFF' | 'OFFLINE';
  enabled: boolean;
  recoveries: number;
  attempts: number;
  error?: string;
  recent: readonly CardinalSystemRecord[];
  vegetation?: CardinalControlSnapshot;
  hydrology?: CardinalControlSnapshot;
}

/** Host boundary. Cardinal receives narrow weather diagnostics, never the host. */
export class CardinalSystemControl {
  private readonly conductor = new WeatherAgentConductor();
  private readonly stream: string;
  private sequence = 0;
  private epoch = 0;
  private attempts = 0;
  private recoveries = 0;
  private retryAfter = 0;
  private enabled: boolean;
  private offline?: string;
  private recent: CardinalSystemRecord[] = [];
  private busy = false;
  private generation = 0;
  private checkedRevision = -1;
  private checkedEpoch = -1;

  constructor(worldId: string, enabled: boolean, private readonly log: AppendOnlyLog,
    private readonly port: WeatherControlPort,
    private readonly domain: { id: 'weather' | 'vegetation' | 'hydrology'; minimumMinute: number } = { id: 'weather', minimumMinute: 0 }) {
    this.stream = `${domain.id === 'weather' ? 'cardinal-system-control' : `cardinal-${domain.id}-control`}:${worldId}:v1`;
    this.enabled = enabled;
  }

  get online(): boolean { return this.enabled && this.offline === undefined; }
  snapshot(): CardinalControlSnapshot {
    return { status: this.offline !== undefined ? 'OFFLINE' : this.enabled ? 'ONLINE' : 'OFF',
      enabled: this.enabled, recoveries: this.recoveries, attempts: this.attempts,
      ...(this.offline !== undefined ? { error: this.offline } : {}), recent: this.recent };
  }

  async initialize(): Promise<void> {
    try {
      this.offline = undefined;
      this.checkedRevision = -1;
      const [length, tail] = await Promise.all([this.log.length(this.stream), this.log.readTail(this.stream, 8)]);
      this.sequence = length;
      this.recent = tail.map(raw => JSON.parse(raw) as CardinalSystemRecord);
      const last = this.recent.at(-1);
      if (!last) return;
      if (last.sequence !== length || typeof last.enabled !== 'boolean' ||
        ![last.epoch, last.minute, last.attempts, last.recoveries, last.retryAfter].every(n => Number.isFinite(n) && n >= 0)) {
        throw new Error('Invalid Cardinal control record');
      }
      this.enabled = last.enabled;
      this.epoch = last.epoch;
      this.attempts = last.attempts;
      this.recoveries = last.recoveries;
      this.retryAfter = last.retryAfter;
      // A crash after a committed command but before its result is verified
      // against the current world. Never replay an old world snapshot.
      if (last.kind === 'repair_requested') {
        const current = this.port.observe();
        if (current.epoch === last.epoch && current.weather?.lifecycle === 'running' && !current.weather.fallback) {
          this.recoveries++;
          this.attempts = 0;
          await this.record('recovered', current, 'Recovery verified after reconnect');
        }
      }
    } catch (error) { this.disconnect(error); }
  }

  disconnect(error: unknown = 'Cardinal disconnected'): void {
    this.generation++;
    this.offline = (error instanceof Error ? error.message : String(error)).slice(0, 240);
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.generation++;
    this.checkedRevision = -1;
    if (this.enabled === enabled && !this.offline) return;
    // OFF takes effect before awaiting persistence; queued work cannot act.
    this.enabled = false;
    if (this.offline) await this.initialize();
    if (this.offline) return; // Fail closed if control storage is unavailable.
    this.enabled = enabled;
    this.attempts = 0;
    this.retryAfter = 0;
    try {
      await this.record(enabled ? 'on' : 'off', this.port.observe(),
        enabled ? 'Connected to current world; system-agent recovery available from startup; resource subsidies prohibited' : 'Observation and orchestration detached; world remains autonomous');
    } catch (error) { this.disconnect(error); }
  }

  /** O(1) healthy/OFF path: no world copy, model calculation or storage access. */
  service(): Promise<void> | undefined {
    if (!this.online || this.busy) return;
    const observation = this.port.observe();
    if (observation.minute < this.domain.minimumMinute) return;
    if (observation.revision === this.checkedRevision && observation.epoch === this.checkedEpoch) return;
    if (observation.epoch !== this.epoch) {
      this.epoch = observation.epoch; this.attempts = 0; this.retryAfter = 0;
    }
    if (this.attempts >= 3 || observation.minute < this.retryAfter) return;
    const command = this.conductor.diagnose(observation.weather);
    if (!command) {
      this.checkedRevision = observation.revision; this.checkedEpoch = observation.epoch;
      return;
    }
    return this.repair(command, observation);
  }

  private async repair(command: CardinalSystemCommand, observation: WeatherControlObservation): Promise<void> {
    this.busy = true;
    const generation = this.generation;
    try {
      this.attempts++;
      this.retryAfter = observation.minute + 1440 * this.attempts;
      await this.record('repair_requested', observation, observation.weather?.lastFault ?? `${this.domain.id} executor fault`);
      if (!this.online || generation !== this.generation) return;
      // This boundary permits only recovery of the weather implementation.
      if (command.kind !== 'restore') throw new Error('Weather control command denied');
      await this.port.restore({ ...command, reason: `Cardinal: restore ${this.domain.id} executor; retain physical history` },
        `cardinal-${this.domain.id}:${observation.epoch}:${this.sequence}`, observation.revision);
      const result = this.port.observe();
      const healthy = result.epoch === observation.epoch && result.weather?.lifecycle === 'running' && !result.weather.fallback;
      if (healthy) { this.recoveries++; this.attempts = 0; this.retryAfter = 0; }
      await this.record(healthy ? 'recovered' : 'repair_failed', result,
        healthy ? `${this.domain.id} executor restored; physical state and world history preserved` : 'Executor remains on autonomous fallback');
    } catch (error) {
      // A failed conductor/storage connection must not abort world progression.
      this.disconnect(error);
    } finally { this.busy = false; }
  }

  private async record(kind: CardinalSystemRecord['kind'], observation: WeatherControlObservation, detail: string): Promise<void> {
    const entry: CardinalSystemRecord = { sequence: this.sequence + 1, enabled: this.enabled,
      epoch: observation.epoch, minute: observation.minute, kind, attempts: this.attempts,
      recoveries: this.recoveries, retryAfter: this.retryAfter, detail: detail.slice(0, 240) };
    this.sequence = await this.log.append(this.stream, this.sequence, JSON.stringify(entry));
    this.recent = [...this.recent.slice(-7), entry];
  }
}
