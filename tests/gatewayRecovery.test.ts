import { describe, expect, it } from 'vitest';
import { LogBackedCardinalJournal } from '../src/cardinal/LogBackedCardinalJournal';
import {
  IndependentInterventionGateway,
  INTERVENTION_GATEWAY_POLICY_VERSION,
} from '../src/cardinal/InterventionGateway';
import {
  LogBackedInterventionGatewayLedger,
  type GatewayLedgerEntry,
  type InterventionGatewayLedger,
} from '../src/cardinal/InterventionGatewayLedger';
import { reconcileGatewayJournal } from '../src/cardinal/CardinalRecovery';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';

class FailFinalizeOnceLedger implements InterventionGatewayLedger {
  failNextFinalize = true;

  constructor(private readonly inner: InterventionGatewayLedger) {}

  get(worldId: string, proposalId: string) {
    return this.inner.get(worldId, proposalId);
  }

  begin(entry: GatewayLedgerEntry) {
    return this.inner.begin(entry);
  }

  async finalize(entry: GatewayLedgerEntry): Promise<GatewayLedgerEntry> {
    if (this.failNextFinalize) {
      this.failNextFinalize = false;
      throw new Error('synthetic ledger finalize failure');
    }
    return await this.inner.finalize(entry);
  }

  entries(worldId: string) {
    return this.inner.entries(worldId);
  }

  lastExecutedAt(worldId: string) {
    return this.inner.lastExecutedAt(worldId);
  }
}

function proposal(id: string) {
  return {
    proposalId: id,
    worldId: 'world_gateway_recovery',
    hypothesisId: 'hypothesis_test',
    kind: 'resource_relief' as const,
    magnitude: 0.1,
    reason: 'test',
    expectedOutcome: 'test',
    prediction: {
      metric: 'resourcePressure' as const,
      direction: 'decrease' as const,
      minimumImprovement: 0.01,
      horizon: 4,
      statement: 'resource pressure should decrease',
    },
  };
}

async function makeWorld(store = new InMemoryWorldStore()) {
  const world = await WorldEngine.create({
    worldId: 'world_gateway_recovery',
    seed: 'gateway-recovery',
    store,
    agentNames: [],
    startTime: 0,
  });
  await world.step(10);
  return { world, store };
}

describe('Gateway restart recovery', () => {
  it('preserves cooldown across gateway recreation', async () => {
    const { world } = await makeWorld();
    const log = new InMemoryAppendOnlyLog();
    const firstLedger = new LogBackedInterventionGatewayLedger(log);
    const firstGateway = new IndependentInterventionGateway(world, {
      ledger: firstLedger,
      minInterval: 5,
    });

    const first = await firstGateway.execute(
      'evaluation_1',
      proposal('proposal_1'),
      world.snapshot(),
      10,
    );
    expect(first.executionStatus).toBe('executed');

    const restartedGateway = new IndependentInterventionGateway(world, {
      ledger: new LogBackedInterventionGatewayLedger(log),
      minInterval: 5,
    });
    const second = await restartedGateway.execute(
      'evaluation_2',
      proposal('proposal_2'),
      world.snapshot(),
      10,
    );

    expect(second.executionStatus).toBe('denied');
    expect(second.executed).toBe(false);
  });

  it('recovers a crash after world commit without applying the intervention twice', async () => {
    const { world, store } = await makeWorld();
    const log = new InMemoryAppendOnlyLog();
    const durableLedger = new LogBackedInterventionGatewayLedger(log);
    const failingLedger = new FailFinalizeOnceLedger(durableLedger);
    const firstGateway = new IndependentInterventionGateway(world, {
      ledger: failingLedger,
    });

    await expect(
      firstGateway.execute(
        'evaluation_crash',
        proposal('proposal_crash'),
        world.snapshot(),
        10,
      ),
    ).rejects.toThrow('synthetic ledger finalize failure');

    const historyAfterCommit = await store.history(world.snapshot().id);
    expect(
      historyAfterCommit.filter((event) => event.kind === 'cardinal.intervention.resource_relief'),
    ).toHaveLength(1);

    const restartedGateway = new IndependentInterventionGateway(world, {
      ledger: new LogBackedInterventionGatewayLedger(log),
    });
    await restartedGateway.recover(world.snapshot().id);

    const finalEntries = await restartedGateway.ledgerEntries(world.snapshot().id);
    expect(finalEntries).toHaveLength(1);
    expect(finalEntries[0].phase).toBe('final');
    expect(finalEntries[0].record.executionStatus).toBe('executed');

    const historyAfterRecovery = await store.history(world.snapshot().id);
    expect(
      historyAfterRecovery.filter((event) => event.kind === 'cardinal.intervention.resource_relief'),
    ).toHaveLength(1);
  });

  it('closes the preflight-to-commit race with the world revision boundary', async () => {
    const { world, store } = await makeWorld();
    const expected = world.snapshot();
    const competingWriter = await WorldEngine.open({
      worldId: expected.id,
      store,
    });
    await competingWriter.applyDisturbance(
      'resource_shock',
      0.1,
      10,
      8,
      'competing_change',
    );

    // world still holds the old local snapshot, so the gateway's preflight
    // equality check alone would pass. The store revision check must still stop it.
    expect(world.snapshot()).toEqual(expected);

    const gateway = new IndependentInterventionGateway(world, {
      ledger: new LogBackedInterventionGatewayLedger(new InMemoryAppendOnlyLog()),
    });
    const result = await gateway.execute(
      'evaluation_stale',
      proposal('proposal_stale'),
      expected,
      10,
    );

    expect(result.executionStatus).toBe('stale');
    expect(result.executed).toBe(false);
    expect(world.snapshot().revision).toBe(competingWriter.snapshot().revision);
    const history = await store.history(expected.id);
    expect(
      history.filter((event) => event.kind.startsWith('cardinal.intervention')),
    ).toHaveLength(0);
  });

  it('reconciles final gateway evidence into a restarted Cardinal journal', async () => {
    const { world } = await makeWorld();
    const log = new InMemoryAppendOnlyLog();
    const gateway = new IndependentInterventionGateway(world, {
      ledger: new LogBackedInterventionGatewayLedger(log),
      policyVersion: INTERVENTION_GATEWAY_POLICY_VERSION,
    });

    await gateway.execute(
      'evaluation_reconcile',
      proposal('proposal_reconcile'),
      world.snapshot(),
      10,
    );

    const restartedJournal = new LogBackedCardinalJournal(log);
    expect(await restartedJournal.interventions(world.snapshot().id)).toHaveLength(0);

    await reconcileGatewayJournal(world.snapshot().id, gateway, restartedJournal);
    const records = await restartedJournal.interventions(world.snapshot().id);
    expect(records).toHaveLength(1);
    expect(records[0].executionStatus).toBe('executed');
  });
});
