# Ainkrad v0.3.16 — final executed verification

Date: 2026-08-26 UTC  
Source: exact repair-release working tree before final packaging on top of the
read-only verified GitHub parent `f0e7f3a`.

No result below is inferred or labeled from an unexecuted test. The seed runs
were executed against this v15-derived v0.3.16 source before the final
world-open-only compatibility repair; that repair was then covered by its own
regression, the complete 146-test suite, typecheck and production build.

## Build and regression

- TypeScript: PASS — `tsc -p tsconfig.json`.
- Full regression: PASS — Vitest 3.1.1, 34/34 files and 146/146 tests.
- Existing v16 save repair: PASS — a fixture matching the deployed failure
  (missing `settlementEconomyById.*.harvestEventsByMaterial`) opened without a
  reset, preserved residents/relationships/RNG/world time, committed exactly
  one additive migration, reopened idempotently and resumed canonical time.
- Cardinal equal-time test: PASS — x1 for 100 worker advances, x10 for 10 and
  x100 for one all reached 876,000 world minutes with identical world state,
  evaluations and Auditor output. Semantic opportunities were exactly on
  8,760-minute boundaries.
- Production build: PASS — Vite 7.0.4 emitted the application CSS/JS and the
  dedicated `liveWorld.worker` bundle.
- Production HTTP preview: PASS — built index, application JS/CSS and worker
  assets all returned successfully from a local Vite preview.
- 2D/UI contract smoke: PASS — four tests verified finite surface positions,
  physical routes, visible display-only motion before the first slow quantum,
  deterministic spreading of ten co-located residents and non-mutation of
  resident decisions/state.
- Truthful inspector tests: PASS — resident, wildlife/monster and place reports
  use persisted evidence and expose unknown data as unknown.

An automated real-browser click run was not executed because this environment
has no Chromium/WebKit/Firefox executable. It is not mislabeled as PASS. The
SPCK checklist includes the short manual mobile check after Vercel deploy.

## Autonomous 8/10/12-year samples

All samples used the real `WorldEngine`, beginning with exactly ten ordinary
human founders plus four separate Genesis teachers. No residents, couples,
births or outcomes were injected.

| Seed | Humans y8 | Humans y10 | Humans y12 | State at y12 |
| --- | ---: | ---: | ---: | --- |
| `v16-demography-01` | 19 | 21 | 23 | generations 0/1; humans, goblins and orcs present |
| `v16-demography-02` | 16 | 18 | 20 | generations 0/1; humans, goblins and orcs present |
| `v16-demography-03` | 18 | 20 | 22 | generations 0/1; humans, goblins and orcs present |

## Three autonomous 30-year samples

| Seed | Living H/G/O/Og | Human generations | Births/deaths | Result |
| --- | --- | --- | ---: | --- |
| `v16-demography-01` | 32/6/8/9 (55 total) | 0:10, 1:20, 2:2 | 36/3 | PASS |
| `v16-demography-02` | 33/11/7/8 (59 total) | 0:9, 1:19, 2:5 | 41/4 | PASS |
| `v16-demography-03` | 35/11/6/10 (62 total) | 0:10, 1:17, 2:8 | 41/1 | PASS |

Every seed retained generation 2, bounded all wildlife/monster populations by
their carrying capacity, produced food and construction materials, stayed
within built-housing capacity and had zero active Genesis teachers. Ordinary
generation-1 to generation-2 teaching was recorded (9 and 60 verified lessons
in the two runs whose evidence snapshot ended at year 30).

## Autonomous 60-year sample

`v16-demography-01` completed with acceptance PASS:

- 88 living sapients: 44 humans, 7 goblins, 20 orcs and 17 ogres;
- living human generations 0/1/2/3: 1/18/16/9;
- 89 births and 23 deaths;
- two independently founded human settlements and 12 voluntary resettlements;
- six inhabited settlements total, including two non-human cities;
- 12,725 ordinary lessons and 1,587 verified generation-1 to generation-2
  lessons; zero Genesis lessons after year 3;
- 536 food, 253 wood, 352 stone, 5 metal and 10 fuel harvest events;
- 88 residents inside physical capacity 174; materials remained within every
  local storage capacity;
- 23 physical remains, all 23 buried, with five established cemeteries;
- death causes: 9 old age, 6 deprivation, 4 monsters, 3 wildlife, 1 illness;
- 18 monsters, with every population at or below its carrying capacity;
- `renewableBase=0.8735755839` and `storedResources=0.9997868014`, persisted as
  separate quantities;
- every sapient race recorded voluntary family opportunities and descendants;
- zero active Genesis teachers after the third year.

This natural seed did not happen to enter a war. The separate deterministic
regression creates two resource/land competitors, requires willing adults and
verifies conflict/peace/death behavior without giving Cardinal a participant
or action writer.

## Continuity and migration assertions

- v0.3.15 migration preserved resident identities, minds, memories,
  relationships, world time, evidence and RNG state.
- Early same-version v0.3.16 saves are repaired atomically before validation.
  Only absent additive fields are initialized; existing data is never
  regenerated, and corrupt present values still fail strict validation.
- Only the derived race life stage is normalized for old non-human saves.
- One-year-olds cannot gather, work, hunt, build or form adult relationships.
- No hidden recovery cohort or compulsory-family rule exists.
- Public stock remains settlement-local and cannot teleport.
- Cardinal current timed evidence is world-minute based and restricted to the
  current world, policy, sensor and research epoch; tick-only legacy rows are
  excluded from modern autonomy math.

Machine-readable seed evidence is in `docs/V0_3_16_RELEASE_AUDIT.json`.
