import type { WorldState } from '../world/types';

export class WorldPersistenceError extends Error {
  constructor(readonly code: 'invalid_record'|'missing_record', message: string) {
    super(message);this.name='WorldPersistenceError';
  }
}
export function validateWorldSave(value: unknown, worldId: string): asserts value is WorldState {
  const s=value as Partial<WorldState>|null;
  if (!s || typeof s!=='object' || s.id!==worldId || typeof s.rulesVersion!=='string' ||
      !Number.isInteger(s.revision) || s.revision!<0 || !Number.isFinite(s.now) || !s.agents ||
      typeof s.agents!=='object' || !s.places || !s.determinism ||
      !Number.isFinite(s.determinism.rngState)) {
    throw new WorldPersistenceError('invalid_record','Существующее сохранение мира повреждено или имеет неверный формат. Создание нового мира остановлено.');
  }
}
export function missingWorldRecord(worldId:string): never {
  throw new WorldPersistenceError('missing_record',`Запись мира ${worldId} отсутствует, но найдены следы предыдущего мира. Новый мир не создан; требуется проверка резервных копий.`);
}
export function worldStorageDiagnostics(world: Readonly<WorldState>, origin: string): string {
  return `Адрес хранилища: ${origin}\nМир: ${world.id}\nЭпоха: ${world.epoch ?? 1}; ревизия: ${world.revision}\nИгровые минуты: ${world.calendar.elapsedWorldMinutes}\nВерсия правил: ${world.rulesVersion}\nСохранения разных адресов сайта хранятся раздельно.`;
}
