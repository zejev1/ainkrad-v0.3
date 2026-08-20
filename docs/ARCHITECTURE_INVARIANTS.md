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
