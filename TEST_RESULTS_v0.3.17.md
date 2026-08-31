# Ainkrad v0.3.17 — executed release verification

Date: 2026-08-28 UTC  
Source: the complete v15-derived v0.3.17 repair tree intended to be overlaid as
uncommitted changes on the read-only verified GitHub parent `d5e2af9`.

No unexecuted check is labelled PASS.

## Build and regression

- TypeScript: PASS — `tsc -p tsconfig.json`.
- Full sequential regression: PASS — Vitest 3.1.1, 35/35 files and 152/152
  tests, including Cardinal equal-time equivalence at x1/x10/x100.
- Production build: PASS — Vite 7.0.4 emitted index, CSS, application JS and
  the dedicated `liveWorld.worker` bundle.
- Existing v16 save repair: PASS — additive, atomic and idempotent; residents,
  relationships, world minutes and RNG future are preserved.
- Closed-tab continuity: PASS — epoch-scoped absolute targets, bounded catch-up
  and duplicate-tab protection are covered by runtime tests.
- Monster food chain: PASS — physically reachable prey is decremented, a viable
  reserve is preserved, recovery requires food, isolation causes starvation and
  an extinct population cannot return merely from an old feeding timestamp.
- Death aftermath: PASS — feeding after a lethal monster attack does not erase
  remains or bypass contamination, burial and cemetery logic.
- `git diff --check`: PASS.

## Real browser verification

The v0.3.17 runtime and settlement presentation were exercised in a real
browser before the final food-chain-only engine patch:

- page and worker loaded without an application console error;
- 12 of 14 residents changed physical position during a 1.6-second sample;
- workshop, resident and Cardinal evidence inspectors opened from real clicks;
- the status header remained readable without overlap;
- closing and reopening advanced the same epoch from year 6 day 213 22:00 to
  year 6 day 236 20:07 and showed the saved continuation point.

The final food-chain patch changes world events and their Russian feed text, not
the verified map layout or offline clock. The final browser-source/UI contract
tests and production build were rerun afterward.

## Fresh autonomous 30-year worlds

Each seed began with exactly ten ordinary human founders plus four separate
Genesis teachers. No residents, couples, births or outcomes were injected.

| Seed | Living H/G/O/Og | Human generations | Births/deaths | Animal prey consumed | Hunger losses | Result |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `v16-demography-01` | 35/13/14/10 | 0:10, 1:21, 2:4 | 52/2 | 131 | 0 | PASS |
| `v16-demography-02` | 38/9/10/9 | 0:10, 1:21, 2:7 | 47/3 | 48 | 3 | PASS |
| `v16-demography-03` | 36/10/11/5 | 0:10, 1:20, 2:6 | 42/2 | 113 | 2 | PASS |

Across these worlds:

- every sapient race retained descendants and humans reached generation 2;
- 210 monster/wildlife feeding events consumed 292 real animals;
- five monster starvation losses were recorded where prey was unavailable;
- five lethal monster feedings and two defensive-wildlife deaths created seven
  remains; all seven were buried and cemeteries were established;
- food, wood, stone, metal and fuel harvests were recorded in every world;
- 10 material construction projects and 36 tools completed from local stocks;
- every settlement stock remained between zero and its physical capacity;
- generation-1 residents taught generation-2 residents 20/57/34 verified
  ordinary lessons; Genesis recorded zero lessons after year 3;
- total living populations 72/66/62 remained below physical capacities
  118/114/114; monster totals 7/2/7 remained within carrying capacities.

## 60-year scope

The complete v0.3.16 society foundation previously passed a real 60-year seed
with generations 0/1/2/3, 44 humans, all sapient lineages, local materials,
23 burials and bounded monsters. A new v0.3.17 60-year repeat reached year 30
but was terminated when the Work execution environment expired; it is not
labelled PASS. The final food-chain code is instead covered by three fresh
30-year acceptance worlds, the deterministic feeding/starvation regression and
the 15-year habitat-integrity long-run test.

Machine-readable final seed outputs are stored under `artifacts/acceptance/`
during verification and summarized in `docs/V0_3_17_RELEASE_AUDIT.json`.
