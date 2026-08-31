import type { WorldState } from '../world/types';
import { CardinalCore } from './CardinalCore';
import type { CardinalJournal } from './CardinalJournal';
import { CardinalObserver } from './CardinalObserver';
import { AinkradCardinalObservationAdapter } from './portable/AinkradCardinalAdapters';
import { PortableCardinalRuntime } from './portable/PortableCardinalRuntime';

// CardinalRuntime can observe, reason and journal. It deliberately has no
// mutable WorldEngine reference and no intervention gateway capability.
export class CardinalRuntime extends PortableCardinalRuntime<WorldState> {
  constructor(
    observer: CardinalObserver,
    core: CardinalCore,
    journal: CardinalJournal,
  ) {
    super(new AinkradCardinalObservationAdapter(observer), core, journal);
  }
}
