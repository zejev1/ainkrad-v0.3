# External Boundary Contract

Ainkrad's most important containment rule is:

> Freedom inside. Control at the boundary.

Cardinal may be highly capable inside its own research environment. That does not grant it direct authority over the external world.

## Current v0.3 state

`ClosedExternalGateway` is a deny-all development/test adapter. It is intentionally incapable of executing anything.

It is **not** a template for a future open gateway running inside the Cardinal process.

## Requirement for any future real external action

Any gateway capable of executing a real-world action must be architecturally independent from Cardinal. At minimum:

1. The executor runs in a separate process/service or stronger isolation boundary.
2. External credentials, device handles and privileged API keys are unavailable to the Cardinal process.
3. Cardinal receives only a request capability; it does not receive the executor capability.
4. The gateway owns its allowlist, rate limits, magnitude limits and authorization policy.
5. Cardinal cannot edit the gateway's code/configuration, stop it, replace it or grant itself new permissions.
6. The gateway validates serialized input at runtime. TypeScript types and prompt rules are not security boundaries.
7. Authorization decisions and actual executions are recorded in an audit trail outside Cardinal's control.
8. A failure, malformed request or unknown action fails closed.
9. No alternate network, shell, filesystem, device or credential channel may be exposed to Cardinal as a bypass.
10. The gateway can be physically/logically disabled without cooperation from Cardinal.

The simulation `IndependentInterventionGateway` is a different boundary: it controls changes to the simulated Ainkrad world. It must not be confused with permission to act on the real external world.
