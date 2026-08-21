# Ainkrad v0.3 Migration Rules

The old Ainkrad repository is a donor, not the architecture.

Do not copy a file into v0.3 merely because it already exists.

Every reused component must answer:

1. Does it preserve agent autonomy?
2. Does it preserve experimental history?
3. Does it keep Cardinal observable and falsifiable?
4. Does it avoid unnecessary write contention?
5. Does it avoid large scheduler payloads?
6. Does it separate observation from intervention?
7. Does it preserve the independence of the Auditor and gateways?

## Explicitly rejected old patterns

- Shared `last input number + 1` allocation.
- Broad write transactions that read large mutable tables.
- Age-based deletion of memories, conversations or Cardinal history.
- Treating `expiresAt` as permission to delete history.
- Automatic positive relationship changes after every conversation.
- Cardinal state seeded as if it were observation.
- Cardinal directly injecting private goals/pressure into NPC cognition.
- Routine logic that always overrides social/autonomous choice.
- Large objects stored in scheduled-function arguments.
- Auto-materialization workflows that overwrite hand-reviewed project code.
- Read methods that silently compact or delete observational data.
- Runtime trust in TypeScript-only allowlists for gateway authorization.
- Retried scheduled/intervention operations without stable idempotency IDs.
- In-process real-world executors or credentials reachable by Cardinal.

## Server-grade database adapters come later

v0.3 starts with domain contracts, in-memory reference implementations and a browser-local IndexedDB adapter for the live demo.

Ainkrad v0.3 does not use Convex. Any future always-on/server storage is chosen separately and must remain an adapter behind the domain contracts.

The research model must not depend on a vendor-specific bottleneck.

## Persistence commit rule

A future persistent adapter must not reproduce the old retry failure pattern by committing current state separately from its historical evidence. One logical world operation must be atomic across its current-state projection and append-only evidence, or use an equivalent recoverable commit protocol with stable operation IDs.

## Audit 3: persistence-before-provider rule

Do not add a database driver until it can implement the `WorldStore` contract without weakening it.

Rejected adapter designs include:

- updating the current world row and appending evidence in separate non-recoverable writes;
- relying on one process's RAM for world-operation idempotency;
- silently overwriting a newer world revision after a stale read;
- resuming an old snapshot under changed world rules without explicit migration;
- using transport wall-clock timestamps as autonomous simulation time;
- allowing retry-generated Cardinal rows to inflate the apparent amount of research evidence.


## Cardinal research-version changes

A change to Cardinal hypothesis/persistence semantics is an experiment interpretation change, even if the world rules themselves did not change. Persisted evidence remains historical evidence, but new Cardinal research logic must carry a new policy/research version and must not silently treat incompatible old evaluations as a continuous persistence chain.

## Audit 7: autonomous-world schema boundary

World rules `ainkrad-world-rules-0.3.7` add persistent places and required nested NPC personality, needs, skills, goals, home and location state. Older snapshots must not be relabeled and opened as if those fields always existed. They require an explicit migration or a fresh experimental world.

Sensor `ainkrad-world-sensors-0.3.7` also changes the meaning of social isolation from "has a relationship projection" to recent autonomous social contact. Results produced by the older metric remain historical evidence, but they are not semantically interchangeable with the new sensor definition.

## Audit 8: choice and browser-continuity boundary

World rules `ainkrad-world-rules-0.3.8` change ordinary action selection from strict highest-score execution to seeded weighted selection among bounded reasonable alternatives. An existing v0.3.7 snapshot must not be relabeled: doing so would mix histories produced by different decision semantics.

The new optional `lastDecision` projection records the chosen action, dominant alternative, considered-action count and openness. Absence at initial world creation is valid; once a tick commits it becomes ordinary persisted history.

The first IndexedDB browser database starts a fresh v0.3.8 local world. Future changes to IndexedDB object stores require a database-version upgrade. Future changes to world semantics still require an explicit world migration or a new world even when the physical database schema itself remains readable.

## Audit 9: growing-world migration

World rules `ainkrad-world-rules-0.3.9` add persistent growth stage/progress, discovered-region identity, wildlife populations, habitat support, hunting skill and three new resident actions. The runtime contains one explicit migration from `0.3.8`.

That migration must preserve the existing world ID, logical time, RNG future, residents, goals, locations, relationships and prior evidence. It initializes an undiscovered frontier, adds an empty wildlife projection and derives each resident's hunting skill deterministically from existing world-owned traits and skills. It commits one `world.migrated` event with a stable operation identity.

This is a semantic migration, not a reset. Any snapshot older than `0.3.8`, newer than the runtime, or malformed under its declared version still fails closed and requires a separately reviewed migration.

Cardinal experience does not require an opaque mutable schema row. It is reconstructed from prior append-only evaluation and outcome evidence, including older compatible historical records for experience totals. Hypothesis persistence still uses only the current policy/sensor-compatible window.

## Audit 10: personhood, generations and constitutional authority

World rules `ainkrad-world-rules-0.3.10` add stable mind identity, emotions, values, beliefs, biological life, lineage, population counters, uncapped procedural frontier topology, cosmology, registered world-law mechanisms and the permanent protected-personhood constitution.

The runtime explicitly accepts both v0.3.8 and deployed v0.3.9 snapshots. For v0.3.9 it preserves the existing frontier, wildlife, habitat support and learned hunting skill. For both versions it preserves world ID, logical tick, RNG state, existing resident IDs, goals, locations, relationships and append-only history. It adds new fields to the same people; it never generates replacement adults.

All existing place connections are made reciprocal during migration. Existing geography receives deterministic coordinates and biome metadata. New demographic ages are deterministic from stable resident order and become the starting point for future aging; they do not retroactively manufacture birth or death events.

Cardinal policy, research, audit context, gateway and sensor versions advance to v0.3.10. Older evaluations remain historical experience totals, but they do not silently form a same-policy persistence chain for a new intervention decision.

Snapshots older than v0.3.8, newer than v0.3.10 or malformed under their declared version still fail closed.

## Audit 11: unified clock, physiology and civilization

World rules `ainkrad-world-rules-0.3.11` add one persisted elapsed-world-minute clock, age-derived physiology, dangerous remote monster populations, endogenous village/city growth and calibrated world pressures for Cardinal.

The runtime accepts v0.3.8, v0.3.9 and deployed v0.3.10. For v0.3.10 it converts the age already accumulated under 96 legacy ticks per year into world minutes. The visible calendar and every resident then continue from that same duration; neither the population nor the world is restarted.

Existing wildlife remains ordinary wildlife. A migrated mature frontier receives only a bounded seeded monster habitat, and later monsters and settlements emerge through normal world rules. Cardinal policy and sensors advance to v0.3.11 because their pressure meanings and thresholds changed; older evidence remains history but does not become a same-policy persistence chain.

## Audit 12: physical map and bounded hot-history access

World rules `ainkrad-world-rules-0.3.12` add persisted settlement membership, surface semantics, deterministic curved routes, resident 2D position and an interruptible movement projection. Migration from deployed v0.3.11 must preserve the logical tick, elapsed world minutes, age, identity, relationships, frontier, history and RNG future. It may deterministically regroup founding homes into the founding settlement and derive route/position projections because v0.3.11 had no causal spatial position.

Reachable lake, river and sea locations denote shore. Explicit open-water places are not walkable and receive no implicit route. Later bridges, boats, dungeons and sky layers require explicit reviewed world state; they may not be faked by browser animation.

Cardinal evidence remains append-only. Stream length/range access and bounded active views are permitted performance indexes, while deleting old evaluations, outcomes, audits, memories or world events remains prohibited. The interactive console must state when an older record lacks detail rather than fabricating a retrospective explanation.

World speed is not a Cardinal rule and is not part of a world migration. It belongs to the independent external clock gateway. Future increases in acceleration must preserve deterministic substeps and must not skip causal history.
