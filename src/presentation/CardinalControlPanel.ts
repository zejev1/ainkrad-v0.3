import type { CardinalControlSnapshot } from '../runtime/CardinalSystemControl';

const labels = { on: 'Кардинал подключён', off: 'Кардинал отключён',
  repair_requested: 'Обнаружен сбой погоды; запрошено восстановление',
  recovered: 'Работа агента восстановлена и проверена', repair_failed: 'Восстановление не удалось; погода работает через резерв' };
let lastSequence = -1;
let lastDisplay = '';

export function renderCardinalControl(control: CardinalControlSnapshot | undefined, _worldMinutes: number): void {
  const button = document.getElementById('cardinal-toggle') as HTMLButtonElement;
  const status = document.getElementById('cardinal-control-status')!;
  if (!control) { button.disabled = true; status.textContent = 'Подключение Кардинала…'; return; }
  const display = `${control.status}:${control.recoveries}:${control.attempts}:${control.error ?? ''}:${control.vegetation?.status}:${control.vegetation?.recoveries}:${control.vegetation?.attempts}:${control.hydrology?.status}:${control.hydrology?.recoveries}:${control.hydrology?.attempts}`;
  if (display !== lastDisplay) {
  lastDisplay = display;
  button.disabled = false;
  button.dataset.enabled = String(control.status === 'ONLINE');
  button.setAttribute('aria-pressed', String(control.status === 'ONLINE'));
  button.textContent = control.status === 'ONLINE' ? 'Выключить Кардинала · OFF' : 'Включить Кардинала · ON';
  status.textContent = control.status === 'OFF' ? 'Кардинал OFF · наблюдение и управление отключены. Мир работает самостоятельно.'
    : control.status === 'OFFLINE' ? 'Кардинал OFFLINE · связь прервана. Мир работает самостоятельно.'
    : 'Кардинал ONLINE · управляет системными агентами с первого запуска. Ресурсная помощь запрещена.';
  status.title = control.error ?? '';
  document.getElementById('cardinal-control-summary')!.textContent =
    `Восстановлений погоды: ${control.recoveries}; растительности: ${control.vegetation?.recoveries ?? 0}; воды: ${control.hydrology?.recoveries ?? 0}.` + (control.attempts >= 3 || (control.vegetation?.attempts ?? 0) >= 3 || (control.hydrology?.attempts ?? 0) >= 3 ? ' Повторные попытки остановлены; требуется проверка.' : '');
  }
  const sequence = (control.recent.at(-1)?.sequence ?? 0) + (control.vegetation?.recent.at(-1)?.sequence ?? 0) + (control.hydrology?.recent.at(-1)?.sequence ?? 0);
  if (lastSequence === sequence) return;
  lastSequence = sequence;
  const list = document.getElementById('cardinal-system-log')!;
  list.replaceChildren();
  const records = [...control.recent.map(r => ({ ...r, domain: 'Погода' })), ...(control.vegetation?.recent ?? []).map(r => ({ ...r, domain: 'Растительность' })), ...(control.hydrology?.recent ?? []).map(r => ({ ...r, domain: 'Вода' }))].sort((a,b) => b.minute - a.minute || b.sequence - a.sequence).slice(0, 12);
  for (const record of records) {
    const row = document.createElement('li');
    row.textContent = `Год ${(record.minute / 525600).toFixed(2)} · ${record.domain} · ${record.kind === 'repair_requested' ? 'Обнаружен сбой; запрошено восстановление' : record.kind === 'repair_failed' ? 'Работает резерв; восстановление не удалось' : labels[record.kind]}`;
    row.title = record.detail;
    list.append(row);
  }
}
