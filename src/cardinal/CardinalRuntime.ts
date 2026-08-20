import type { WorldState } from '../world/types';
import { CardinalCore } from './CardinalCore';
import type { CardinalJournal } from './CardinalJournal';
import { CardinalObserver } from './CardinalObserver';
import type { CardinalEvaluation, CardinalMode } from './types';

// CardinalRuntime can observe, reason and journal. It deliberately has no
// mutable WorldEngine reference and no intervention gateway capability.
export class CardinalRuntime {
  constructor(
    private readonly observer: CardinalObserver,
    private readonly core: CardinalCore,
    private readonly journal: CardinalJournal,
  ) {}

  async cycle(
    mode: CardinalMode,
    world: Readonly<WorldState>,
    now: number,
  ): Promise<CardinalEvaluation | undefined> {
    if (mode === 'off') {
      return undefined;
    }

    const observation = await this.observer.observe(world, now);
    const evaluation = this.core.evaluate(mode, observation);
    await this.journal.appendEvaluation(evaluation);
    return evaluation;
  }
}
