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

## Database adapters come later

v0.3 starts with domain contracts and in-memory reference implementations.

Ainkrad v0.3 does not use Convex. Any future persistent storage is chosen separately and must remain an adapter behind the domain contracts.

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
