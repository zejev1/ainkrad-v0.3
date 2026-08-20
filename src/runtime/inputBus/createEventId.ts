export function createEventId(
  prefix = 'evt',
): string {
  const randomUuid =
    globalThis.crypto?.randomUUID?.();

  if (randomUuid) {
    return `${prefix}_${randomUuid}`;
  }

  const time =
    Date.now().toString(36);

  const randomA =
    Math.random()
      .toString(36)
      .slice(2, 12);

  const randomB =
    Math.random()
      .toString(36)
      .slice(2, 12);

  return `${prefix}_${time}_${randomA}_${randomB}`;
}
