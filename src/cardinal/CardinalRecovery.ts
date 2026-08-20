import type { CardinalJournal } from './CardinalJournal';
import type { IndependentInterventionGateway } from './InterventionGateway';

/**
 * Reconcile the independent gateway's final execution evidence into the
 * research journal after a restart or a crash between gateway completion and
 * journal append. Both sides are idempotent by stable intervention ID.
 */
export async function reconcileGatewayJournal(
  worldId: string,
  gateway: IndependentInterventionGateway,
  journal: CardinalJournal,
): Promise<void> {
  await gateway.recover(worldId);
  const entries = await gateway.ledgerEntries(worldId);
  for (const entry of entries) {
    if (entry.phase !== 'final') {
      continue;
    }
    await journal.appendIntervention(entry.record);
  }
}
