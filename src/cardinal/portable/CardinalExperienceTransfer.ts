import { createStableId } from '../../core/stableId';
import type { CardinalJournal } from '../CardinalJournal';
import { deriveCardinalExperienceFromCounters } from '../CardinalExperience';
import type {
  AuditRecord,
  CardinalEvaluation,
  CardinalExperienceState,
  InterventionOutcomeRecord,
  InterventionRecord,
} from '../types';

export const PORTABLE_CARDINAL_EXPERIENCE_VERSION =
  'ainkrad-portable-cardinal-experience-1';

export interface PortableCardinalExperienceSeed {
  schemaVersion: typeof PORTABLE_CARDINAL_EXPERIENCE_VERSION;
  sourceId: string;
  exportedAtTechnicalOrder: number;
  observationCycles: number;
  ecologyObservationCycles: number;
  evaluatedOutcomes: number;
  successfulPredictions: number;
  fingerprint: string;
}

export interface PortableCardinalExperienceArchive {
  schemaVersion: typeof PORTABLE_CARDINAL_EXPERIENCE_VERSION;
  sourceWorldId: string;
  seed: PortableCardinalExperienceSeed;
  evaluations: CardinalEvaluation[];
  interventions: InterventionRecord[];
  outcomes: InterventionOutcomeRecord[];
  audits: AuditRecord[];
}

type ExperienceCounters = Pick<
  PortableCardinalExperienceSeed,
  | 'observationCycles'
  | 'ecologyObservationCycles'
  | 'evaluatedOutcomes'
  | 'successfulPredictions'
>;

function assertCounter(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Portable Cardinal ${name} must be a non-negative integer.`);
  }
}

export function createPortableCardinalExperienceSeed(
  sourceId: string,
  exportedAtTechnicalOrder: number,
  counters: Readonly<ExperienceCounters>,
): PortableCardinalExperienceSeed {
  if (!sourceId.trim()) {
    throw new Error('Portable Cardinal sourceId must not be empty.');
  }
  assertCounter('exportedAtTechnicalOrder', exportedAtTechnicalOrder);
  assertCounter('observationCycles', counters.observationCycles);
  assertCounter('ecologyObservationCycles', counters.ecologyObservationCycles);
  assertCounter('evaluatedOutcomes', counters.evaluatedOutcomes);
  assertCounter('successfulPredictions', counters.successfulPredictions);
  if (counters.ecologyObservationCycles > counters.observationCycles) {
    throw new Error(
      'Portable Cardinal ecology observations cannot exceed all observations.',
    );
  }
  if (counters.successfulPredictions > counters.evaluatedOutcomes) {
    throw new Error(
      'Portable Cardinal successful predictions cannot exceed evaluated outcomes.',
    );
  }

  const payload = {
    schemaVersion: PORTABLE_CARDINAL_EXPERIENCE_VERSION,
    sourceId,
    exportedAtTechnicalOrder,
    observationCycles: counters.observationCycles,
    ecologyObservationCycles: counters.ecologyObservationCycles,
    evaluatedOutcomes: counters.evaluatedOutcomes,
    successfulPredictions: counters.successfulPredictions,
  } as const;
  return {
    ...payload,
    fingerprint: createStableId('portable-cardinal-experience', payload),
  };
}

export async function exportPortableCardinalExperience(
  journal: CardinalJournal,
  worldId: string,
  exportedAtTechnicalOrder: number,
): Promise<PortableCardinalExperienceArchive> {
  const [summary, evaluations, interventions, outcomes, audits] =
    await Promise.all([
      journal.summary(worldId, exportedAtTechnicalOrder),
      journal.evaluations(worldId),
      journal.interventions(worldId),
      journal.outcomes(worldId),
      journal.audits(worldId),
    ]);
  const seed = createPortableCardinalExperienceSeed(
    worldId,
    exportedAtTechnicalOrder,
    {
      observationCycles: summary.evaluationCount,
      ecologyObservationCycles: summary.ecologyEvaluationCount,
      evaluatedOutcomes: summary.outcomeCount,
      successfulPredictions: summary.successfulPredictionCount,
    },
  );

  return {
    schemaVersion: PORTABLE_CARDINAL_EXPERIENCE_VERSION,
    sourceWorldId: worldId,
    seed,
    evaluations: structuredClone(
      evaluations.filter(
        (evaluation) => evaluation.evaluatedAt < exportedAtTechnicalOrder,
      ),
    ),
    interventions: structuredClone(
      interventions.filter(
        (intervention) =>
          intervention.requestedAt < exportedAtTechnicalOrder,
      ),
    ),
    outcomes: structuredClone(
      outcomes.filter(
        (outcome) => outcome.observedAt < exportedAtTechnicalOrder,
      ),
    ),
    audits: structuredClone(
      audits.filter((audit) => audit.auditedAt < exportedAtTechnicalOrder),
    ),
  };
}

/**
 * Only aggregate learned capability is inherited by a new host. Old timed
 * interventions/outcomes remain in the archive for audit and never enter the
 * new world's autonomy window, washout, policy epoch or sensor epoch math.
 */
export function inheritPortableCardinalExperience(
  current: Readonly<CardinalExperienceState>,
  inherited: Readonly<PortableCardinalExperienceSeed>,
): CardinalExperienceState {
  if (inherited.schemaVersion !== PORTABLE_CARDINAL_EXPERIENCE_VERSION) {
    throw new Error(
      `Unsupported Portable Cardinal experience version: ${inherited.schemaVersion}`,
    );
  }
  const expected = createPortableCardinalExperienceSeed(
    inherited.sourceId,
    inherited.exportedAtTechnicalOrder,
    inherited,
  );
  if (expected.fingerprint !== inherited.fingerprint) {
    throw new Error('Portable Cardinal experience fingerprint is invalid.');
  }
  return deriveCardinalExperienceFromCounters({
    observationCycles:
      current.observationCycles + inherited.observationCycles,
    ecologyObservationCycles:
      current.ecologyObservationCycles + inherited.ecologyObservationCycles,
    evaluatedOutcomes:
      current.evaluatedOutcomes + inherited.evaluatedOutcomes,
    successfulPredictions:
      current.successfulPredictions + inherited.successfulPredictions,
  });
}
