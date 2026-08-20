# Ainkrad v0.3 Persistence Contract

Ainkrad v0.3 does not use Convex.

The domain must be able to survive process restarts and future storage-provider changes without changing the research semantics.

## One logical operation, one commit boundary

World mutation is staged before persistence.

A logical operation produces together:

- the next current `WorldState` projection;
- zero or more append-only `WorldEvent` records;
- zero or more append-only long-term `MemoryRecord` records;
- one stable operation-deduplication record.

A persistent `WorldStore.commit()` must save those pieces atomically, or implement an equivalent recoverable protocol that cannot expose a new current state without its required evidence.

The engine does not adopt its working mutation until the commit succeeds.

## Per-world revision, not a global hot counter

`WorldState.revision` is a compare-and-swap boundary for one world.

It is not a global sequence shared by all worlds or all inputs.

A stale writer must receive a revision conflict, reload the current world, and retry its own logical operation. It must never silently overwrite a newer world state.

## Stable operation identities

Transport inputs, ticks, scheduled disturbances and authorized interventions use stable operation identities.

The store records the logical fingerprint beside the operation ID.

- same operation ID + same fingerprint = retry/no-op;
- same operation ID + different fingerprint = hard error.

This survives a process restart because idempotency is stored at the persistence boundary, not only in a worker's RAM.

## Hydration and rules version

A world can be reopened from its persisted `WorldState`, including RNG state and event-sequence state.

Every world snapshot carries `rulesVersion`.

A runtime must not silently resume a world created by incompatible world rules. A version mismatch requires an explicit migration or a new experiment.

The same rule applies to research interpretation:

- sensor output carries a sensor version;
- Cardinal evaluation carries a policy version;
- experiment results carry a manifest of versions, seed and disturbance schedule fingerprint.

This prevents data generated under different algorithms from being silently compared as if it came from one unchanged experiment.

## Time domains

Transport wall-clock time is not simulation time.

An input envelope may have a wall-clock `createdAt`, but the world event records the logical `appliedAt` supplied by `WorldRuntime`.

When an input, disturbance or intervention is committed at logical time `T`, the current world projection advances to `T` in the same commit. The engine must not expose a state stamped `T-1` that already contains an effect whose evidence says it occurred at `T`. Multiple operations may share the same logical time; exact tick replay is prevented by the stable tick operation ID rather than by assuming `now === world.now` means the tick already ran.

Sensor evidence is bounded by the snapshot's logical time. Future events are not present evidence, and a sensor may not combine a current world snapshot with an unrelated observation timestamp.

## No evidence-by-retry

Retrying a completed Cardinal evaluation, intervention record, outcome or audit must not manufacture additional evidence rows.

Logical Cardinal/Auditor identities are deterministic. The v0.3 persistence port includes a log-backed Cardinal journal: when its `AppendOnlyLog` is durable, recreating the journal preserves evidence and rejects same-ID/different-content collisions across restart.

Outcome follow-up work is derived from executed intervention records that do not yet have an outcome. It is not allowed to exist only in a volatile `pending[]` array. Outcome records also bind the before/after world revisions, sensor version and evidence IDs used for the follow-up measurement.

## Storage growth

World operation records, world events, memories and research audit records are not ordinary disposable queue rows.

Do not solve growth by blind age-based deletion.

Technical transport tombstones may use an explicit bounded idempotency window only after the live queue item is acknowledged and no longer depends on that tombstone.

## In-process transaction visibility

`WorldEngine` serializes logical mutations per engine instance. Its working copy is private to the in-flight operation; `snapshot()` returns only the last committed projection. This prevents sensors or concurrent callers from observing half-applied state while evidence is still uncommitted.

Exact retries are checked by stable operation identity before temporal validation for a new operation. Therefore a retry of an operation from logical time 10 remains a no-op when the world is already at logical time 50, while a genuinely new operation targeting time 10 is rejected as retroactive.

## Cardinal and gateway durable-control streams

World persistence and Cardinal control persistence are related but intentionally separate capabilities.

The independent simulation gateway stores authorization intent and final execution evidence in its own append-only ledger. The Cardinal research journal stores evaluations, intervention evidence, outcomes and audits. Cardinal cannot rewrite the gateway ledger.

For an authorized proposal the recovery protocol is:

1. persist a `pending` gateway intent containing the stable proposal ID, evaluation ID, proposal fingerprint, observed world revision, effect duration and gateway policy version;
2. ask the world to commit the intervention using that same stable proposal ID and observed revision;
3. finalize the gateway entry as `executed` with the exact committed world revision;
4. reconcile the final gateway record into the research journal.

If the process dies after step 2 but before step 3, restart recovery retries the same world operation ID. Because world idempotency is persisted, recovery obtains the original committed revision without reapplying the effect.

If the world changed before the intervention commit, the gateway finalizes the attempt as `stale`. It does not reinterpret the stale authorization as permission to act on a newer world.

Unknown/transient execution failures leave the intent pending so a restart cannot silently reset cooldown or forget an unfinished authorized action.

The generic `AppendOnlyLog` port uses compare-and-append per stream. Implementations should partition streams by world and purpose; they must not recreate a single global hot sequence for all worlds or all evidence.

A durable adapter must make each compare-and-append atomic, or use an equivalent recoverable transaction. If its physical medium can produce a torn final record, recovery must detect and reject/truncate that incomplete tail before exposing the stream.
