# Cardinal portability contract — v0.3.16

Cardinal is the reusable core of Ainkrad, while the simulated world is one
host. The portable boundary is code, not a promise:

- `PortableCardinalRuntime<THostSnapshot>` owns observation, reasoning and
  journaling only. It has no action gateway and cannot mutate a host.
- `CardinalObservationPort<THostSnapshot>` converts an immutable host snapshot
  into the stable `SensorSnapshot` semantic contract.
- `CardinalActionGatewayPort<THostSnapshot>` is a separate, host-owned
  authorization/mutation boundary. A host can omit it and run observer-only.
- `CardinalJournal` remains the evidence store. Raw evaluations,
  interventions, outcomes and audits can be exported as a portable archive.
- `PortableCardinalExperienceSeed` transfers only aggregate learned capability
  counters. Historical timed interventions never enter a new host's autonomy
  window, washout, policy epoch or sensor epoch calculations.

## Ainkrad adapter

`CardinalRuntime` now uses `PortableCardinalRuntime<WorldState>` through
`AinkradCardinalObservationAdapter`. The independent
`AinkradCardinalActionGatewayAdapter` wraps the existing gateway but is never
given to the portable reasoning runtime.

This keeps current Ainkrad behavior and accumulated journal evidence intact
while making a future host integration explicit:

1. Implement one observation adapter that emits canonical world minutes and
   the stable Cardinal metrics.
2. Provide a fresh journal for the new host.
3. Optionally supply an exported experience seed to retain learned
   capabilities without importing old timed autonomy evidence.
4. Keep any mutation implementation behind a separate action gateway.

Technical order values are used only for ordering and idempotency. Semantic
windows and outcomes use the host adapter's canonical world-minute field.
