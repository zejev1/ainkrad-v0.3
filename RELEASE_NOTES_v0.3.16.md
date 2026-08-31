# Ainkrad v0.3.16

This is an additive living-society foundation built from the supplied stable
v0.3.15 archive. It does not recreate the project, reset the world, import code
from GitHub main or connect Convex.

## Repair of the already-pushed v0.3.16 build

- GitHub `main` was inspected read-only and its current parent was confirmed as
  `f0e7f3a` (`remont sborki`). The final SPCK project keeps that history so one
  repair commit lands exactly on top of the version already deployed; GitHub
  was not used as the source of world logic and no write was made there.
- Existing browsers that saved an early v0.3.16 world no longer stop at
  `settlementEconomy...harvestEventsByMaterial`. World open performs one
  atomic, idempotent additive-schema repair before validation and preserves
  residents, relationships, world time, RNG, v15 evidence and Cardinal
  history. A second open performs no write.
- Safe deterministic place-footprint spreading and settlement-local movement
  preferences from that archive are retained.
- The broken shared 128-person ceiling is replaced with capacity derived from
  real built homes, settlements and material construction.
- Old v0.3.15 saves normalize only the derived race life stage, preserving
  people, minds, relationships, evidence, RNG and canonical time.
- War deaths are valid persisted deaths, and an active voluntary war no longer
  disappears because a single mobilization window had no willing fighters.
- CI now uses `npm ci` and runs typecheck, all regressions and production build.

## Living world

- Race-specific physical life stages apply to every sapient people. A
  one-year-old can only rest; childhood capability grows gradually.
- Humans, goblins, orcs and ogres share the same voluntary separation of love,
  intimacy and child intent. Descendants have real parents and generations.
- Population room follows actual homes and settlements rather than a shared
  128-person quota. Real descendants may voluntarily found or join connected
  settlements; no recovery cohort, ready-made couple or population injection
  was added.
- Settlement-local food, wood, stone, metal and fuel are gathered from
  reachable terrain. Farming knowledge and tools increase food production;
  homes, tools and weapons consume physical local materials; storage has a
  bounded building-based capacity.
- Settlements can meet, claim land, build trust/grievance, raid resources,
  enter voluntary war and later make peace. Participants are real willing
  adults; Cardinal cannot command them.
- Every new sapient death leaves remains. Exposure creates local contamination;
  voluntary burial creates a real cemetery and interment record for any race.

## Truthful presentation

- Resident selection exposes persisted lineage, work/actions, evidenced skill,
  learning, social contacts, preferences and life history without invented
  biography.
- Wildlife and monster selection shows the modeled species, habitat,
  population, capacity, threat and encounter evidence.
- Place selection shows modeled biome, fertility, danger, routes, local stocks,
  tools/projects, claims, graves, contamination and settlement relations.
- The 2D map adds original biome terrain, claims and cemetery markers while
  preserving physical routes, zoom and display-only slow-speed interpolation.

## Portable Cardinal

- `PortableCardinalRuntime` owns observation, reasoning and journaling without
  a host-mutation capability.
- Ainkrad supplies an explicit read-only observation adapter. The action
  gateway remains separate and host-owned.
- Aggregate learned capability may be exported to a future host, but raw timed
  evidence is archived rather than imported into the new host's current
  autonomy window or policy/sensor epoch.
- Existing Ainkrad Cardinal journals, epochs and learned evidence are preserved
  by migration.

## Continuity

The release preserves the stable 10 ordinary founders plus four separate
Genesis teachers, Genesis shutdown after year 3, canonical world-minute
Cardinal semantics, independent gateway, family agency, renewable-base/store
separation, local warehouse authority, hunting, weapons, smithing, generations
and ordinary teaching. See `TEST_RESULTS_v0.3.16.md` and
`docs/V0_3_16_RELEASE_AUDIT.json` for tests that were actually executed.

## Commit message

`fix(v0.3.16): resume existing worlds and restore full autonomy`
