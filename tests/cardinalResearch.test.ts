import { describe, expect, it } from 'vitest';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import {
  buildCardinalResearchContext,
  emptyCardinalResearchContext,
} from '../src/cardinal/CardinalResearch';
import { LogBackedCardinalJournal } from '../src/cardinal/LogBackedCardinalJournal';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import type { SensorSnapshot } from '../src/sensors/types';

function observation(observedAt: number): SensorSnapshot {
  return {
    sensorVersion: 'ainkrad-world-sensors-0.3.3',
    worldId: 'world_research',
    worldRevision: observedAt,
    observedAt,
    metrics: {
      populationActivity: 0.5,
      averageStress: 0.3,
      socialIsolation: 0.2,
      conflictPressure: 0.1,
      resourcePressure: 0.82,
      relationshipDiversity: 0.3,
      recoveryCapacity: 0.3,
      activeSignalCount: 0,
    },
    evidenceEventIds: [`event_${observedAt}`],
    limitations: [],
  };
}

describe('Cardinal research memory', () => {
  it('reconstructs the same reasoning context after restart and ignores its own exact retry', async () => {
    const log = new InMemoryAppendOnlyLog();
    const journal = new LogBackedCardinalJournal(log);
    const core = new CardinalCore();

    const first = core.evaluate('intervene', observation(8), emptyCardinalResearchContext());
    await journal.appendEvaluation(first);

    const context9 = await buildCardinalResearchContext(
      journal,
      'world_research',
      9,
      core.policyVersion,
      observation(9).sensorVersion,
    );
    const second = core.evaluate('intervene', observation(9), context9);
    await journal.appendEvaluation(second);

    const uninterruptedContext = await buildCardinalResearchContext(
      journal,
      'world_research',
      10,
      core.policyVersion,
      observation(10).sensorVersion,
    );
    const uninterrupted = core.evaluate(
      'intervene',
      observation(10),
      uninterruptedContext,
    );

    const restartedJournal = new LogBackedCardinalJournal(log);
    const restartedContext = await buildCardinalResearchContext(
      restartedJournal,
      'world_research',
      10,
      core.policyVersion,
      observation(10).sensorVersion,
    );
    const afterRestart = core.evaluate('intervene', observation(10), restartedContext);

    expect(afterRestart).toEqual(uninterrupted);
    expect(afterRestart.decision).toBe('propose');

    await restartedJournal.appendEvaluation(afterRestart);
    const retryContext = await buildCardinalResearchContext(
      restartedJournal,
      'world_research',
      10,
      core.policyVersion,
      observation(10).sensorVersion,
    );
    const exactRetry = core.evaluate('intervene', observation(10), retryContext);

    expect(exactRetry).toEqual(afterRestart);
  });
});

function researchIntervention(
  index: number,
  executed: boolean,
): import('../src/cardinal/types').InterventionRecord {
  return {
    interventionId: `research_intervention_${index}`,
    evaluationId: `research_evaluation_${index}`,
    worldId: 'world_research',
    requestedAt: index + 1,
    observedWorldRevision: index + 1,
    gatewayPolicyVersion: 'gateway-research-test',
    authorizedEffectDuration: 8,
    proposal: {
      proposalId: `research_proposal_${index}`,
      worldId: 'world_research',
      hypothesisId: `research_hypothesis_${index}`,
      kind: 'resource_relief',
      magnitude: 0.1,
      reason: 'test',
      expectedOutcome: 'test',
      prediction: {
        metric: 'resourcePressure',
        direction: 'decrease',
        minimumImprovement: 0.01,
        horizon: 4,
        statement: 'resourcePressure should decrease.',
      },
    },
    authorized: executed,
    authorizationReason: executed ? 'authorized test' : 'denied test',
    executionStatus: executed ? 'executed' : 'denied',
    executed,
    committedWorldRevision: executed ? index + 2 : undefined,
  };
}

describe('Cardinal research mandatory unresolved evidence', () => {
  it('does not let an unresolved executed intervention fall out of the bounded tail', async () => {
    const log = new InMemoryAppendOnlyLog();
    const journal = new LogBackedCardinalJournal(log);

    for (let index = 0; index < 14; index += 1) {
      await journal.appendIntervention(researchIntervention(index, index === 0));
    }

    const context = await buildCardinalResearchContext(
      journal,
      'world_research',
      100,
      new CardinalCore().policyVersion,
      'ainkrad-world-sensors-0.3.3',
    );

    expect(
      context.priorInterventions.some(
        (item) => item.interventionId === 'research_intervention_0',
      ),
    ).toBe(true);
    expect(
      context.priorInterventions.some(
        (item) => item.interventionId === 'research_intervention_1',
      ),
    ).toBe(false);
  });
});
