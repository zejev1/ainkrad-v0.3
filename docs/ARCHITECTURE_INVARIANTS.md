# Ainkrad v0.3 Architecture Invariants

These rules convert failures from the previous implementation into tests and structural constraints.

## Cardinal

1. Cardinal is the central research system, but the world must remain autonomous without it.
2. `OFF` and `OBSERVER` must produce identical world state and autonomous world-event history under the same seed and disturbances.
3. Observer code receives read-only world/event capabilities.
4. Cardinal Core may propose an intervention but cannot hold the world mutation capability.
5. The independent intervention gateway authorizes **and executes** simulation interventions.
6. Intervention rate and magnitude are bounded outside Cardinal Core.
7. Every evaluation is journaled, including `no_action`.
8. Every intervention authorization decision is journaled.
9. Executed interventions receive later outcome observations and independent audit.
10. Cardinal metrics come from real world state/events, not synthetic Cardinal-owned NPC state.

## Control-world fairness

11. Cardinal must never possess a recovery mechanism that the control world is deliberately prevented from having.
12. The autonomous world must have endogenous recovery paths such as resource regeneration, cooperation and adaptation.
13. Disturbances are applied equivalently to paired worlds.
14. A successful experiment must be capable of concluding that Cardinal is useless or harmful.

## History and storage

15. Current state, active signals, experiment history and technical transport data are different categories.
16. `activeUntil` ends current influence; it never authorizes deletion of historical evidence.
17. Ordinary historical events are not treated as forever-active signals.
18. Experimental history is append-only by default.
19. Full long-term memory history lives outside the hot world snapshot; agents query bounded recent slices for decisions.
20. Technical queue rows may be pruned only after acknowledgement.
21. Dedupe tombstones use an explicit bounded policy in persistent adapters; they must not grow accidentally forever.

## Concurrency and retries

22. No ordinary input path may allocate `lastInputNumber + 1` from one global hot record.
23. Input consumers use claims/leases so concurrent workers do not process the same event simultaneously.
24. World input application is idempotent by stable input event ID.
25. A crash between world commit and queue acknowledgement must not duplicate world history.
26. Broad mutable-table reads and hot shared writes are treated as architectural smells in any future database adapter.

## Scheduler / jobs

27. Scheduled work contains IDs and small primitives, not serialized worlds, maps or full NPC arrays.
28. The application payload guard stays conservative even if a provider allows larger payloads.

## Agents and emergence

29. Relationships may improve or deteriorate based on interaction outcome.
30. Relationships and memories must affect future behavior; they are not decorative telemetry.
31. Agent routines may influence choices but must not permanently bypass autonomous/social decision paths.
32. Agent history and current relationship projections are separate concepts.
33. Social exploration remains possible so early relationships do not permanently freeze the society into scripted cliques.

## Reproducibility

34. Experimental behavior uses seeded randomness.
35. Determinism state is part of world state so a future persistent adapter can resume/replay correctly.
36. Infrastructure-generated IDs must not affect autonomous decision randomness.

## Project safety

37. No automatic upstream materializer may overwrite reviewed Ainkrad code.
38. Ainkrad v0.3 does not use Convex; storage providers are adapters, not the domain model.
39. CI must typecheck and test changes before we treat a revision as healthy.
40. README is the project constitution. If code conflicts with it, code changes.

## Audit round 2 additions

41. Sensor reads are side-effect free; asking what was active at one time must not destroy the ability to inspect another time.
42. Event and memory identities are scoped by world, so identical external IDs in different worlds cannot collide.
43. Exact memory/event retries are idempotent; same ID with different content is a hard error.
44. Dedupe tombstones for unacknowledged transport rows cannot be pruned.
45. Input envelopes are size-bounded just like scheduled operations.
46. Gateway allowlists are checked at runtime and configuration cannot raise intervention magnitude above the constitutional hard cap.
47. Stable proposal/disturbance operation IDs prevent a retry from applying the same world mutation twice.
48. A finished experiment may not silently discard pending intervention outcomes; a follow-up observation tail completes them.
49. Persistent adapters must atomically couple a logical world-state mutation with its historical evidence, or implement an equivalent recoverable commit protocol.
50. Any gateway capable of real external execution must run outside Cardinal's control boundary; the only in-process external gateway allowed in v0.3 is deny-all.

51. Single-world before/after intervention outcomes are labeled observational; causal claims require a matched control or another explicit counterfactual design.
52. Active signals never influence a time before their own `occurredAt`; temporal projections obey both start and end boundaries.
53. Serialized input envelopes are validated at runtime; TypeScript source unions are not a transport security boundary.
54. OFF/OBSERVER contamination checks compare autonomous world-event history as well as the final world snapshot.

## Audit round 3 additions

55. WorldEngine stages state changes, events and memories before one persistence commit; it does not write current state first and evidence later.
56. `WorldState.revision` provides per-world compare-and-swap protection against stale concurrent writers; it is never a global input counter.
57. World operation idempotency survives process restart because stable operation IDs and fingerprints live at the `WorldStore` boundary.
58. Same world operation ID with different logical content is a hard error.
59. A failed world commit leaves the live engine state and RNG state unchanged.
60. A persisted world can be reopened with its RNG and event-sequence determinism state intact.
61. World snapshots carry a rules version and incompatible rules require explicit migration rather than silent continuation.
62. Sensor snapshots carry a sensor version and Cardinal evaluations carry a policy version.
63. Experiment results record a reproducibility manifest containing seed, versions and disturbance-schedule fingerprint.
64. Transport wall-clock `createdAt` is not simulation time; world input evidence records the logical application time.
65. Time-bounded sensor evidence excludes events whose `occurredAt` is in the future.
66. A sensor observation timestamp must match the supplied world snapshot timestamp.
67. Cardinal evaluation, proposal, outcome and Auditor decision identities are stable across exact logical retries.
68. Cardinal journal exact retries are idempotent and same-ID/different-content reuse is rejected.
69. Input event IDs and deduplication keys reject different-content reuse instead of silently discarding the collision.
70. A new world operation may not reuse an event or memory ID already owned by another committed world operation.
71. Pending intervention outcome work is reconstructed from journal evidence instead of existing only in an ephemeral in-process array.
72. Outcome evidence records the before/after world revisions, sensor version and supporting event IDs used for the follow-up observation.
73. Reading `WorldEngine.snapshot()` is side-effect free; determinism state is synchronized at operation commit, not by observation.
74. A committed world event/effect may not claim a logical time later than the current-state timestamp that already contains its effect; multiple operations may share one logical time and are deduplicated by operation ID, not by `now === now`.

75. Exact retries are recognized by stable operation identity even after the world has progressed beyond the operation's original logical time; temporal guards apply only to genuinely new operations.
76. One `WorldEngine` instance serializes logical mutations so concurrent callers cannot share or corrupt a working transaction.
77. `snapshot()` exposes only the last committed projection; uncommitted working state is never observable by sensors or other readers.

## Audit round 4 additions

78. Gateway cooldown and prior execution state must not live only in process RAM; a restart cannot erase intervention history.
79. An authorized intervention intent is persisted before the simulation mutation is attempted.
80. A pending gateway intent is recoverable by stable proposal ID; an exact retry may finalize it but must never apply the world effect twice.
81. Unknown or transient gateway failures leave a recoverable pending intent rather than silently forgetting authorization state.
82. Gateway authorization based on world revision `R` is rechecked at the world commit boundary; preflight snapshot equality alone is insufficient.
83. If another writer advances the world between authorization and commit, the intervention finishes as `stale` and does not mutate the world.
84. World revision conflicts refresh the engine from committed storage before later decisions continue.
85. A simulation intervention target verifies the target `worldId` as well as the proposal kind and magnitude; a ledger entry for another world cannot be executed against the current world.
86. Gateway records include the policy version, observed world revision, execution status and exact committed world revision when execution succeeds.
87. Gateway recovery resolves pending intents before a new proposal can rely on reset in-memory cooldown state.
88. Cardinal research evidence has an append-only log-backed journal contract that survives component recreation when backed by durable storage.
89. Same Cardinal evidence ID + same content is an idempotent retry across restart; same ID + different content is a hard collision.
90. Cardinal journal streams are partitioned by world and evidence kind; there is no global journal sequence shared by unrelated worlds.
91. Gateway ledger streams are partitioned by world; intervention control does not use one shared global counter.
92. Gateway final evidence can be reconciled into the Cardinal research journal after a crash between execution completion and journal append.
93. The gateway ledger and Cardinal journal are separate capabilities: Cardinal cannot rewrite gateway execution history to make itself look better.
94. An executed intervention's recorded committed revision comes from the committed world operation itself, not from a later snapshot that may already include unrelated mutations.
95. The experiment manifest records the intervention-gateway policy version in addition to world, sensor and Cardinal policy versions.
96. A durable `AppendOnlyLog` adapter must make each compare-and-append atomic (or recoverably equivalent); a torn record is never accepted as committed evidence.
97. Compaction or indexing of Cardinal/gateway logs may improve storage efficiency but may not erase experimental evidence or alter stable identities.
