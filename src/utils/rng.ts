function hashString(
  value: string,
): number {
  let hash = 2166136261;

  for (
    let i = 0;
    i < value.length;
    i += 1
  ) {
    hash ^=
      value.charCodeAt(i);

    hash =
      Math.imul(
        hash,
        16777619,
      );
  }

  return hash >>> 0;
}

export class SeededRng {
  private state: number;

  constructor(
    seed: string,
  ) {
    this.state =
      hashString(seed) ||
      0x6d2b79f5;
  }

  next(): number {
    let t =
      this.state +=
        0x6d2b79f5;

    t =
      Math.imul(
        t ^ (t >>> 15),
        t | 1,
      );

    t ^=
      t +
      Math.imul(
        t ^ (t >>> 7),
        t | 61,
      );

    return (
      (
        t ^
        (t >>> 14)
      ) >>>
      0
    ) /
    4294967296;
  }

  between(
    min: number,
    max: number,
  ): number {
    return (
      min +
      (
        max - min
      ) *
      this.next()
    );
  }

  pick<T>(
    values: readonly T[],
  ): T {
    if (
      values.length ===
      0
    ) {
      throw new Error(
        'Cannot pick from an empty array.',
      );
    }

    const index =
      Math.floor(
        this.next() *
        values.length,
      );

    return values[
      Math.min(
        values.length - 1,
        index,
      )
    ];
  }
}
