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

## Browser adapter

The v0.3.12 live page uses IndexedDB as a concrete `WorldStore` adapter. Its world commit is one read-write transaction across:

- the current world projection;
- the stable operation record;
- append-only world events;
- append-only resident memories.

The transaction checks the current per-world revision and all event/memory identities before writing. A conflict aborts the whole transaction; the engine cannot expose a new projection without its evidence.

Cardinal research and independent simulation-gateway records use indexed append-only stream entries with a compare-and-append head. Records are not rewritten as one growing array. Recreating the live runtime reconstructs evaluation counts, intervention counts, cooldown and pending recovery from these streams.

Multiple tabs must not become independent writers over one browser-local world. The live worker uses an exclusive Web Lock when supported and broadcasts committed frames to waiting tabs. The storage revision check remains the final protection for browsers without that lock.

Broadcast frames carry a v0.3.12 protocol version and can normalize v0.3.10/v0.3.11 frames while migration completes. A newly deployed tab ignores incompatible frames instead of attempting to render an unknown world shape.

IndexedDB provides durable continuity for the same browser profile and origin. It does not make the browser an always-on service. Closing every page stops execution; clearing site data removes the local database. A future 24/7 runtime must implement the same ports on an independent host without giving Cardinal control of the runtime or external gateway.

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

The reviewed migration from `0.3.8`, `0.3.9`, `0.3.10` or deployed `0.3.11` to `0.3.12` is one idempotent world operation. It atomically writes the upgraded projection and a `world.migrated` event while preserving society, ecology, RNG future and logical tick. Existing v0.3.10 biological elapsed time is converted to the unified persisted world-minute calendar; v0.3.11 locations deterministically acquire settlement, route and surface-position projections. A failed or concurrent migration cannot expose a half-upgraded life-cycle, clock, spatial or governance projection.

Cardinal streams expose exact length plus bounded range/tail reads. The live loop warms and validates one journal index, then uses bounded research/audit windows and aggregate counters instead of requesting every historical evaluation on every tick. This changes the access path only: no evidence is compacted or deleted. The Cardinal console is also requested on demand and capped to review windows rather than copied into every live frame.

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


## Cardinal cognitive memory is derived from evidence

Cardinal's longitudinal research memory is reconstructed from append-only evaluation/intervention/outcome evidence rather than stored as an opaque mutable belief blob.

The active reasoning window may be bounded, but the evidence that produced it is retained. A restart over the same durable journal must reconstruct the same compatible context for the same logical observation. The current cycle excludes records from its own logical observation time so a retry cannot inflate persistence by counting itself twice.

Research context compatibility is versioned. A change to sensor meaning, Cardinal policy or research-context semantics must be reflected in experiment metadata rather than silently mixing unlike evidence.

Cardinal experience is a deterministic projection of those retained evaluation and outcome streams. Restarting the browser or Cardinal runtime recalculates the same level, experience total and unlocked capabilities; no separate mutable XP counter can drift from the evidence.
