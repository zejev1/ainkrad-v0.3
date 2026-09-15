# Resident life continuity repair — 2026-09-15

Base: `b3bfd24aaff1a80c54abd3bfdc370395dc85631e` (`main` before this repair).
This change repairs resident opportunities, not residents' wishes. Cardinal,
Gateway, permissions, constitutional boundaries and family-agency values are
not expanded or rewritten. No population target, assigned explorer role,
compulsory expedition, partner, intimacy or birth is introduced.

## Changes

* Every living resident gets an ordinary action opportunity each canonical
  simulation quantum. Sleep and physical restrictions still apply. Growing a
  distant race no longer reduces another resident's actions/learning per year.
* Family opportunities use a persisted stable-key round-robin cursor instead
  of `tick % pairCount`. New counters separate scheduled and actually evaluated
  opportunities from the old candidate-pool sum. Physical checks and separate
  voluntary family decisions retain their existing rules and probabilities.
* Exploration uses the ordinary physical departure/provisioning path, checks
  that movement really starts, and records mapping only after an on-site survey.
  A fed traveller can rest locally; shortages still require actual resupply.
  Already surveyed sites no longer receive an unconditional 55% local-choice
  shortcut. Lower positive preferences are not discarded as impossible actions.
* A verified, co-located survival lesson during lived exploration/walking can
  teach a small bounded practical exploration increment. Ordinary residents
  can teach descendants after Genesis; skills are not copied into newborns.
* Additive exploration receipts count attempts, starts, arrivals, surveys,
  supplies and practical lessons. Old saves begin tracking when an event occurs;
  no past journeys are invented from a job label or an old map. Arrival is not
  a survey. Reporting uses race-specific age/health gates and never labels
  zero practice as an adventure specialty.
* The first longer trial exposed a real warehouse-overflow bug. A trade now
  respects physical capacity **before** moving money/goods; unsold stock remains
  with its owner. Capacity validation stays enabled. Extinct monster populations
  also cannot reproduce merely because exploration reveals reachable prey.
* Fresh price reads no longer repeat whole-world education/contract repair.
  Dungeon-entrance presence checks use one occupied-place set rather than
  rescanning every resident for every place. Neither optimization skips life.

## Verification completed before publication

The original engine passed 342 tests. The repair passed **371 tests in 77 files**,
TypeScript checking and the production build locally. The ordinary Vite warning
about bundles over 500 kB remains; this is not a build failure or a claim of
mobile speed acceptance. The final PR must also pass its own exact-head CI.

There are **29 new regression tests**: 19 continuity/fairness/fieldwork tests,
3 reporting tests and 7 physical material-capacity tests. Fourteen selected
regressions were also run against the original engine and failed as expected.
The existing isolated predator ecology fixture now holds world expansion still
for its one-year food-access assertion: its original assertions are unchanged.
Normal world-growth tests and the new no-resurrection test remain enabled.

Two deterministic 20-year controls used the same world IDs and seeds before and
after, with Cardinal in `off` mode. Counts are outcomes, **not acceptance quotas**.

| 20-year outcome | Control A old | Control A repair | Control B old | Control B repair |
| --- | ---: | ---: | ---: | ---: |
| Living, all races | 186 | 198 | 186 | 199 |
| Living humans | 45 | 41 | 40 | 42 |
| Moving at final snapshot | 20 | 48 | 27 | 59 |
| Recorded dungeon runs | 4 | 128 | 15 | 29 |
| Successful runs | 1 | 21 | 3 | 4 |
| Adventure subsystem trade volume | 5.906035 | 162.328807 | 0 | 26.852908 |

These controls show more actual adventure activity, **not a demonstrated
population-growth improvement**. Human results are mixed. Surviving adult
first-generation human samples are only 1–3 residents at year 20; they cannot
establish durable multi-generation success. Twenty years, typecheck and CI do
not certify 50–100 year ecology/demography, or browser rates of 10/20/50/100
years per minute. Those are separate acceptance questions. The user's old
stalled save was not supplied or tested and must not be reset to apply the fix.

The final read-only query optimizations reproduced all reported checkpoint
fields at years 10 and 20 for both seeds, excluding only elapsed wall time.
Parallel local timings are not controlled performance comparisons.

## Reproduction

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run build
node --import tsx src/v18/runLifeContinuityAuditV22.ts life-repair-control-a 10,20,50,100
node --import tsx src/v18/runLifeContinuityAuditV22.ts life-repair-control-b 10,20,50,100
```

For an unchanged-engine control, checkout the base commit separately and copy
only the two read-only `LifeContinuityDiagnosticsV22.ts` / audit-runner files
into its `src/v18` directory. They do not modify engine behavior. Compare the
same seed and the same checkpoint, not different seeds at different ages.
Absent new receipts in the old engine are reported as `null`, not zero.

## Deliberately not claimed or implemented

No rewrite of the complete apprenticeship/party system or persistent family
planning model is included. Weather hazards still matter. Existing legacy maps
are not erased because past visitation cannot be reconstructed reliably.
`mayKnowPlaceV20` restricts libraries, not ordinary unknown route intermediates;
the earlier diagnosis overstated that gate and it has not been weakened.
