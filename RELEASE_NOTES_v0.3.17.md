# Ainkrad v0.3.17

This is an additive repair of the deployed v0.3.16 world. It preserves the
existing IndexedDB world, people, relationships, canonical time, RNG future,
append-only evidence and learned Cardinal experience.

## Continuous physical world

- Resident routes advance with canonical world minutes instead of waiting for
  the six-day decision quantum. Consequential choices and Cardinal
  opportunities remain on their existing deterministic semantic grid.
- A resident can cross the founding settlement in less than one Ainkrad hour;
  visual motion no longer means the body remains frozen for days.
- Territorial monsters require physical co-location. Merely selecting a remote
  destination cannot cause an attack before the route is travelled; hunting
  and territorial encounters still occur and remain auditable.
- Monster populations now consume real, physically reachable wildlife above a
  viable prey reserve. A monster cannot reproduce without food, starvation
  reduces an isolated population, and a lethal attack on a resident is recorded
  as feeding rather than disappearing behind a generic death counter.

## Closed-tab continuity

- The browser stores an epoch-scoped wall-clock anchor with the selected
  external speed and multiplier.
- Reopening computes one absolute canonical target and simulates the missed
  interval in bounded chunks. The UI reports catch-up progress instead of
  pretending JavaScript continued to run after the browser closed.
- Web Locks, an absolute target and revision-safe persistence prevent two tabs
  from adding the same elapsed interval twice.
- A new world epoch rejects the previous epoch's pending time debt.

## Cardinal epoch isolation

- Current evaluation, proposal, authorization, executed-intervention and world
  law counters are rebuilt only from the active epoch.
- Historical rows remain append-only and continue to teach portable Cardinal;
  they are not misreported as actions inside a new world.
- If the latest detailed event has left the short live feed, the panel reports
  the exact current-epoch totals instead of contradicting its own counters.

## Original settlement presentation

- The map uses original terrain, road, field, workshop, building and settlement
  styling inspired by the readability of classic strategy games; no proprietary
  artwork, layout data or game code is copied.
- The coordinate legend uses the actual physical scale: one world-map unit is
  100 metres.
- Residents, creatures and places open separate factual inspectors. Building
  clicks no longer get swallowed by resident sprites; empty count badges and
  permanent labels on every house no longer bury the settlement.
- The status strip wraps long population and calendar values without overlap
  on desktop and mobile layouts.

## Compatibility and authority

- The v0.3.16 same-version repair remains atomic and idempotent, including old
  saves that lack later economy counters.
- Cardinal still has no resident mind/action/identity writer and cannot control
  the world clock. Host mutation remains behind independent gateways.
- No Convex connection was added.
- GitHub `main` was inspected read-only at parent
  `d5e2af9277589463caa6f2dc003462f796432998`; no commit or push was performed
  while preparing the release.

Executed evidence is recorded in `TEST_RESULTS_v0.3.17.md` and
`docs/V0_3_17_RELEASE_AUDIT.json`.
