# Cardinal Recovery Contract

Cardinal is the central research system of Ainkrad. A process restart must not let Cardinal, its gateway, or the surrounding harness "forget" evidence that would change how Cardinal is evaluated.

This document describes recovery semantics. It does not grant Cardinal any new authority.

## Separate capabilities

Cardinal remains split into capabilities that do not collapse into one self-trusting component:

- **Observer**: read-only world evidence.
- **Core**: evaluation and proposal generation.
- **Simulation Intervention Gateway**: independent authorization and simulation mutation capability.
- **Gateway Ledger**: append-only control evidence for authorization/execution recovery.
- **Research Journal**: append-only Cardinal evaluations, intervention records, outcomes and audits.
- **Auditor**: independent evaluation of Cardinal decisions and outcomes.

The gateway ledger and research journal are intentionally different stores/capabilities. Cardinal cannot edit gateway history to improve its own apparent performance.

## Why gateway state must survive restart

A purely in-memory cooldown is not a safety boundary. Restarting the process would erase the fact that an intervention just occurred.

Therefore the gateway persists, through an `InterventionGatewayLedger` port:

- proposal identity and fingerprint;
- evaluation identity;
- observed world revision;
- gateway policy version;
- effect duration;
- authorization intent;
- final execution state;
- exact committed world revision for successful execution.

## Recoverable intervention state machine

A new proposal can finish in one of these states:

- `denied`: independent gateway policy rejected it;
- `authorized_pending`: authorization is durably recorded but execution is not yet finalized;
- `executed`: the world committed the intervention exactly once;
- `stale`: authorization was valid for the observed revision, but the world changed before the intervention could commit.

For an authorized intervention:

1. append `authorized_pending` to the gateway ledger;
2. execute against the exact observed world revision using the stable proposal ID;
3. if the world commit succeeds, append final `executed` evidence with the exact committed revision;
4. reconcile the final gateway record into the Cardinal research journal;
5. later observe the outcome and audit it.

## Crash cases

### Crash before world commit

The ledger still contains `authorized_pending`.

Recovery retries the same stable proposal. If the world has moved on, the attempt becomes `stale`; it is not applied to the newer world under the old authorization.

### Crash after world commit but before gateway finalization

The world already stores the stable intervention operation ID.

Recovery retries that exact ID. The world returns the original committed operation instead of applying the intervention again. The gateway can then finalize the ledger as `executed`.

### Crash after gateway finalization but before research-journal append

`reconcileGatewayJournal()` copies final gateway evidence into the research journal using the stable intervention ID. The journal is idempotent, so reconciliation can itself be retried.

## Stale-observation protection

A snapshot equality check before execution is useful but not sufficient because another writer can change the world between the check and commit.

The world commit boundary therefore receives the observed revision. An intervention authorized at revision `R` may commit only as the operation based on `R`. A competing commit causes revision conflict and the gateway records the intervention as `stale` rather than silently applying it to a different world state.

## Persistence provider rule

`AppendOnlyLog` is a provider-neutral port. The in-memory implementation is only a reference/test implementation.

A real durable implementation must provide atomic compare-and-append per stream (or equivalent transactional semantics). A torn or partial final record must never be interpreted as a successful append.

Streams are partitioned by world and purpose. There is no global hot sequence shared by all Ainkrad worlds.

## External boundary remains unchanged

This recovery protocol concerns interventions **inside the simulated Ainkrad world**.

It does not weaken the external-world rule:

> Freedom inside. Control at the boundary.

Any future real-world executor remains outside Cardinal's process and outside Cardinal's control, with credentials and authorization owned by the independent external gateway.
