import { ClockContinuity } from '../runtime/ClockContinuity';
import { parseOfflineWorldClockAnchor, type OfflineWorldClockAnchor } from '../runtime/OfflineWorldClock';
import type { LiveWorldFrame } from '../runtime/LiveWorldRuntime';
import { worldDurationDescription } from '../v15/WorldTimeContract';
import type { WorldSpeedId, WorldSpeedMultiplier } from '../world/WorldClock';

export interface CatchUpProgress {
  worldEpoch: number; fromWorldMinutes: number; currentWorldMinutes: number; targetWorldMinutes: number;
  percent: number; elapsedRealMs: number; estimatedRemainingMs: number | null;
  semanticQuantaProcessed: number; completed: boolean;
}
interface PanelOptions {
  root: HTMLElement; overlay: HTMLElement; status: HTMLElement;
  title: HTMLElement; percent: HTMLElement; bar: HTMLElement; detail: HTMLElement;
  initialAnchor?: OfflineWorldClockAnchor; storageAvailable: boolean; anchorKey: string; preferenceKey: string;
  speedId: WorldSpeedId; multiplier: WorldSpeedMultiplier;
  post(message: unknown): void;
  onPreference(speedId: WorldSpeedId, multiplier: WorldSpeedMultiplier): void;
}

/** Clock UI owns only external timing metadata. It never writes world state. */
export class WorldClockPanel {
  readonly continuity: ClockContinuity;
  private checked = false;
  private initialAnchor?: OfflineWorldClockAnchor;
  private storageAvailable: boolean;
  private speedId: WorldSpeedId;
  private multiplier: WorldSpeedMultiplier;
  private readonly stop: HTMLButtonElement;

  constructor(private readonly options: PanelOptions) {
    this.initialAnchor = options.initialAnchor;
    this.continuity = new ClockContinuity(options.initialAnchor);
    this.storageAvailable = options.storageAvailable;
    this.speedId = options.speedId; this.multiplier = options.multiplier;
    this.stop = document.createElement('button');
    this.stop.type = 'button';
    this.stop.className = 'map-control';
    this.stop.textContent = 'Остановить догон';
    this.stop.title = 'Продолжить с уже прожитого момента в обычном времени';
    this.stop.addEventListener('click', () => this.publish('real_time', 1));
    options.root.append(this.stop);
    const label = document.createElement('label');
    label.style.cssText = 'grid-column:1/-1;display:flex;gap:8px;align-items:center;font-size:0.85rem';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.continuity.backgroundMode === 'selected';
    checkbox.addEventListener('change', () => {
      this.continuity.backgroundMode = checkbox.checked ? 'selected' : 'real_time';
      this.writeAnchor();
      this.showStatus();
    });
    label.append(checkbox, document.createTextNode('Сохранять ускорение при закрытой вкладке'));
    options.root.append(label);
  }

  accepts(revision: number): boolean {
    if (!this.continuity.accepts(revision)) return false;
    this.continuity.revision = revision;
    return true;
  }

  publish(speedId: WorldSpeedId, multiplier: WorldSpeedMultiplier, initial = false): void {
    const command = this.continuity.command(speedId, multiplier, Date.now(), initial);
    this.speedId = speedId; this.multiplier = multiplier;
    this.options.onPreference(speedId, multiplier);
    try { localStorage.setItem(this.options.preferenceKey, JSON.stringify({ speedId, multiplier })); } catch { /* session still works */ }
    // Persist intent BEFORE posting: an immediate refresh cannot resurrect the queue.
    this.writeAnchor();
    if (command.discardPending) {
      this.options.overlay.hidden = true;
      this.options.status.textContent = 'Завершаем текущий шаг и сохраняем прожитую историю…';
      this.stop.disabled = true;
    }
    this.options.post(command);
  }

  acknowledge(message: { clockRevision?: number; worldEpoch: number; currentWorldMinutes: number;
    speedId: WorldSpeedId; multiplier: WorldSpeedMultiplier; discarded: boolean }): void {
    if (!this.continuity.acknowledge(message.clockRevision ?? 0, message, message.discarded)) return;
    this.speedId = message.speedId; this.multiplier = message.multiplier;
    this.continuity.observeSpeed(message.speedId, message.multiplier);
    this.options.onPreference(message.speedId, message.multiplier);
    this.stop.disabled = false;
    if (message.discarded) this.options.overlay.hidden = true;
    if (this.checked || message.discarded) this.writeAnchor();
    this.showStatus();
  }

  persist(_frame?: Readonly<LiveWorldFrame>, now = Date.now(),
    speedId = this.speedId, multiplier = this.multiplier): void {
    this.writeAnchor(now, speedId, multiplier);
  }

  restore(frame: Readonly<LiveWorldFrame>, anchor?: Readonly<OfflineWorldClockAnchor>, now = Date.now()): void {
    this.continuity.observe({ worldEpoch: frame.world.epoch ?? 1,
      currentWorldMinutes: frame.world.calendar.elapsedWorldMinutes }, frame.liveTiming?.pendingWorldMinutes ?? 0);
    if (anchor === undefined && this.storageAvailable) {
      try { anchor = parseOfflineWorldClockAnchor(localStorage.getItem(this.options.anchorKey)); }
      catch { this.storageAvailable = false; }
    }
    const previous = this.continuity.targetWorldMinutes;
    const target = this.continuity.restore(anchor, now);
    if (target === undefined || target === previous) return;
    this.options.overlay.hidden = false;
    this.options.title.textContent = 'Продолжаем жизнь мира';
    this.options.percent.textContent = '0%'; this.options.bar.style.width = '0%';
    this.options.detail.textContent = 'Можно остановить догон: уже прожитая история сохранится.';
    this.options.post({ type: 'catch_up_world_time', worldEpoch: frame.world.epoch ?? 1,
      targetWorldMinutes: target, clockRevision: this.continuity.revision });
    this.writeAnchor(now);
  }

  update(frame: Readonly<LiveWorldFrame>): void {
    this.speedId = frame.clock.speedId; this.multiplier = frame.clock.multiplier;
    this.continuity.observeSpeed(frame.clock.speedId, frame.clock.multiplier);
    this.continuity.observe({ worldEpoch: frame.world.epoch ?? 1,
      currentWorldMinutes: frame.world.calendar.elapsedWorldMinutes }, frame.liveTiming?.pendingWorldMinutes ?? 0);
    if (!this.checked) {
      this.checked = true;
      this.restore(frame, this.initialAnchor);
      this.initialAnchor = undefined;
    }
    if (this.continuity.targetWorldMinutes !== undefined &&
        frame.world.calendar.elapsedWorldMinutes >= this.continuity.targetWorldMinutes - 1e-7) {
      this.continuity.targetWorldMinutes = undefined;
      this.options.overlay.hidden = true;
    }
    this.showStatus();
    this.writeAnchor();
  }

  progress(message: CatchUpProgress): void {
    this.continuity.observe(message);
    this.continuity.targetWorldMinutes = message.completed ? undefined : message.targetWorldMinutes;
    const percent = Math.max(0, Math.min(100, message.percent * 100));
    const label = percent > 0 && percent < 1 ? percent.toFixed(1) : Math.round(percent).toString();
    this.options.overlay.hidden = message.completed;
    this.options.percent.textContent = label + '%';
    this.options.bar.style.width = percent + '%';
    const remaining = Math.max(0, message.targetWorldMinutes - message.currentWorldMinutes);
    const seconds = message.estimatedRemainingMs === null ? null : Math.ceil(message.estimatedRemainingMs / 1000);
    const eta = seconds === null ? 'оцениваем время' : seconds >= 60
      ? 'примерно ' + Math.ceil(seconds / 60) + ' мин.' : 'примерно ' + Math.max(1, seconds) + ' сек.';
    this.options.title.textContent = 'Просчитано ' + worldDurationDescription(
      Math.max(0, message.currentWorldMinutes - message.fromWorldMinutes));
    this.options.detail.textContent = 'Осталось ' + worldDurationDescription(remaining) + ' · ' + eta +
      '. Догон можно остановить без сброса мира.';
    this.options.status.textContent = message.completed ? 'Догон завершён' : 'Догон: ' + label + '% · ' + eta;
    this.options.status.classList.toggle('is-catching-up', !message.completed);
    // Advance the durable anchor even while full map frames are suppressed.
    this.writeAnchor();
  }

  reset(): void {
    this.initialAnchor = undefined;
    this.checked = true;
    this.continuity.targetWorldMinutes = undefined;
    this.options.overlay.hidden = true;
  }

  private showStatus(): void {
    if (this.continuity.cancelling) return;
    this.options.status.classList.toggle('is-catching-up', this.continuity.targetWorldMinutes !== undefined);
    this.options.status.textContent = this.continuity.targetWorldMinutes !== undefined
      ? 'Догон продолжается · можно остановить с сохранением прожитого'
      : !this.storageAvailable ? 'Фоновое время недоступно: браузер запретил сохранение'
      : this.continuity.backgroundMode === 'selected'
        ? 'Закрытая вкладка: выбранное ускорение · при возвращении потребуется расчёт'
        : 'Закрытая вкладка: обычное время · ускорение действует при открытом мире';
  }

  private writeAnchor(now = Date.now(), speedId = this.speedId, multiplier = this.multiplier): void {
    if (!this.storageAvailable) return;
    const anchor = this.continuity.anchor(now, speedId, multiplier);
    if (!anchor) return;
    try { localStorage.setItem(this.options.anchorKey, JSON.stringify(anchor)); }
    catch { this.storageAvailable = false; }
  }
}
