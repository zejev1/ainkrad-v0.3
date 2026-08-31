import { createStableId } from '../../core/stableId';
import { CardinalCore } from '../CardinalCore';
import type { CardinalJournal } from '../CardinalJournal';
import {
  buildCardinalResearchContext,
  type CardinalResearchContext,
} from '../CardinalResearch';
import type { CardinalEvaluation, CardinalMode } from '../types';
import {
  inheritPortableCardinalExperience,
  type PortableCardinalExperienceSeed,
} from './CardinalExperienceTransfer';
import type { CardinalObservationPort } from './types';

export interface PortableCardinalRuntimeOptions {
  inheritedExperience?: PortableCardinalExperienceSeed;
}

/**
 * World-neutral Cardinal assembly. It can observe, reason and journal. It has
 * no action gateway field and therefore cannot acquire a mutation capability.
 */
export class PortableCardinalRuntime<THostSnapshot> {
  private readonly inheritedExperience?: PortableCardinalExperienceSeed;

  constructor(
    private readonly observationPort: CardinalObservationPort<THostSnapshot>,
    private readonly core: CardinalCore,
    private readonly journal: CardinalJournal,
    options: PortableCardinalRuntimeOptions = {},
  ) {
    this.inheritedExperience = options.inheritedExperience
      ? structuredClone(options.inheritedExperience)
      : undefined;
  }

  async cycle(
    mode: CardinalMode,
    hostSnapshot: Readonly<THostSnapshot>,
    technicalOrder: number,
  ): Promise<CardinalEvaluation | undefined> {
    if (mode === 'off') return undefined;

    const observation = await this.observationPort.observe(
      hostSnapshot,
      technicalOrder,
    );
    let research = await buildCardinalResearchContext(
      this.journal,
      observation.worldId,
      observation.observedAt,
      observation.observedWorldMinutes,
      observation.worldEpoch,
      this.core.policyVersion,
      observation.sensorVersion,
    );
    research = this.withInheritedExperience(research);
    const evaluation = this.core.evaluate(mode, observation, research);
    await this.journal.appendEvaluation(evaluation);
    return evaluation;
  }

  private withInheritedExperience(
    research: CardinalResearchContext,
  ): CardinalResearchContext {
    if (!this.inheritedExperience) return research;
    const experience = inheritPortableCardinalExperience(
      research.experience,
      this.inheritedExperience,
    );
    return {
      ...research,
      experience,
      fingerprint: createStableId('portable-research-context', {
        baseResearchFingerprint: research.fingerprint,
        observationAdapterId: this.observationPort.adapterId,
        inheritedExperienceFingerprint: this.inheritedExperience.fingerprint,
        experience,
      }),
    };
  }
}

