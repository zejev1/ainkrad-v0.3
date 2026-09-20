import { WeatherMapSession, weatherMapAllowed, type WeatherMapSnapshot } from './WeatherMapSnapshot';
import type { WorldState } from '../world/types';
import type { WorldClockControl } from '../boundary/WorldClockGateway';
import { formatAinkradWorldTime } from '../v15/CardinalReadableReport';

const colors = { clear: '#dcb955', cloudy: '#8eaaa8', fog: '#b4bdc1', rain: '#518aba', storm: '#72559d', snow: '#e5f1fa' };
const labels = { clear: 'Ясно', cloudy: 'Облачно', fog: 'Туман', rain: 'Дождь', storm: 'Гроза', snow: 'Снег' };
export class WeatherMapPanel {
  private readonly session = new WeatherMapSession();
  private readonly dialog: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly caption: HTMLElement;
  private readonly places: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  constructor(private readonly trigger: HTMLButtonElement, private readonly hint: HTMLElement,
    private readonly context: () => { world: Readonly<WorldState>; clock: Readonly<WorldClockControl>; busy: boolean } | undefined) {
    this.dialog = document.createElement('section'); this.dialog.hidden = true;
    this.dialog.className = 'weather-map-dialog'; this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true'); this.dialog.setAttribute('aria-label', 'Погодная карта материка');
    this.dialog.innerHTML = `<div class="weather-map-card"><header><h2>Погодная карта материка</h2><button type="button" aria-label="Закрыть погодную карту">×</button></header><p class="weather-map-caption"></p><canvas role="img" aria-label="Распределение погоды по материку" width="1" height="1"></canvas><div class="weather-map-legend"></div><div class="weather-map-places"></div><p>Север — сверху. Снимок сохраняется до закрытия; откройте карту снова, чтобы обновить погоду.</p></div>`;
    document.body.append(this.dialog);
    this.canvas = this.dialog.querySelector('canvas')!;
    this.caption = this.dialog.querySelector('.weather-map-caption')!;
    this.places = this.dialog.querySelector('.weather-map-places')!;
    this.closeButton = this.dialog.querySelector('button')!;
    const legend = this.dialog.querySelector('.weather-map-legend')!;
    for (const kind of Object.keys(colors) as (keyof typeof colors)[]) {
      const item = document.createElement('span'), dot = document.createElement('i'); dot.style.background = colors[kind];
      item.append(dot, labels[kind]); legend.append(item);
    }
    trigger.addEventListener('click', () => this.open());
    this.closeButton.addEventListener('click', () => this.close());
    this.dialog.addEventListener('click', e => { if (e.target === this.dialog) this.close(); });
    this.dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
      if (e.key === 'Tab') { e.preventDefault(); this.closeButton.focus(); }
    });
    this.sync();
  }
  sync(): void {
    const current = this.context(), allowed = current && weatherMapAllowed(current.clock, current.busy);
    this.trigger.disabled = !allowed;
    this.hint.textContent = allowed ? 'Нажмите на погоду — карта материка' : 'Карта погоды доступна при 1м = 1м';
    this.trigger.title = this.hint.textContent;
    if (current) this.session.synchronize(current.clock, current.busy);
    if (!allowed && !this.dialog.hidden) this.close(false);
  }
  private open(): void {
    const current = this.context(); if (!current || !this.dialog.hidden) return;
    const snapshot = this.session.open(current.world, current.clock, current.busy); if (!snapshot) return;
    this.paint(snapshot); this.dialog.hidden = false; this.closeButton.focus();
  }
  private close(focus = true): void {
    this.dialog.hidden = true; this.session.close(); this.canvas.width = 1; this.canvas.height = 1;
    this.places.replaceChildren(); if (focus && !this.trigger.disabled) this.trigger.focus();
  }
  private paint(snapshot: WeatherMapSnapshot): void {
    const width = 720, height = 640; this.canvas.width = width; this.canvas.height = height;
    const ctx = this.canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#172f40'; ctx.fillRect(0, 0, width, height);
    for (const cell of snapshot.cells) {
      ctx.fillStyle = colors[cell.weather.kind];
      ctx.fillRect(cell.column * width / snapshot.columns, cell.row * height / snapshot.rows,
        width / snapshot.columns + 0.5, height / snapshot.rows + 0.5);
      if (cell.column % 6 === 3 && cell.row % 5 === 2) {
        ctx.fillStyle = '#13242b'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`${cell.weather.temperatureC}°`, (cell.column + 0.5) * width / snapshot.columns,
          (cell.row + 0.8) * height / snapshot.rows);
      }
    }
    const point = (x: number, y: number) => ({ x: (x - snapshot.bounds.minX) / (snapshot.bounds.maxX - snapshot.bounds.minX) * width,
      y: (y - snapshot.bounds.minY) / (snapshot.bounds.maxY - snapshot.bounds.minY) * height });
    ctx.beginPath(); snapshot.outline.forEach((p, i) => { const q = point(p.x, p.y); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
    ctx.closePath(); ctx.strokeStyle = '#eff9ed'; ctx.lineWidth = 1.5; ctx.stroke();
    const occupied = new Set<string>();
    for (const p of snapshot.places) {
      const q = point(p.x, p.y), key = `${Math.round(q.x / 45)}:${Math.round(q.y / 25)}`;
      if (!occupied.has(key)) {
        occupied.add(key); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.font = '12px sans-serif'; ctx.textAlign = q.x > width / 2 ? 'right' : 'left';
        ctx.fillText(p.name, q.x + (q.x > width / 2 ? -7 : 7), q.y - 6);
      }
      const row = document.createElement('p'); row.textContent = `${p.name}: ${p.weather.label}, ${p.weather.temperatureC}°C`; this.places.append(row);
    }
    const counts = new Map<string, number>(); for (const cell of snapshot.cells) counts.set(cell.weather.label, (counts.get(cell.weather.label) ?? 0) + 1);
    this.canvas.setAttribute('aria-label', `Погода материка: ${[...counts.keys()].join(', ')}. Температуры и поселения указаны на карте и ниже.`);
    this.caption.textContent = `Снимок: ${formatAinkradWorldTime(snapshot.minute)}`;
  }
}
