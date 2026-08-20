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

## Database adapters come later

v0.3 starts with domain contracts and in-memory reference implementations.

Convex or another database is an adapter.

The research model must not depend on a vendor-specific bottleneck.
