# F2 working checkpoint — human multiple births

This checkpoint extends the accepted F1 family lifecycle without changing the package/release number yet.

## Human pregnancy multiplicity

Multiplicity is chosen exactly once at physical conception and stored in `V16FamilyLifecycleState.expectedChildCount`.
Older saves without the field remain singleton pregnancies.

Natural human pregnancy probabilities:
- singleton: 98.564%
- twins: 1.4%
- triplets: 0.035%
- quadruplets: 0.001%

Current binary Fertility gift (temporary until the progressive 0..100% gift model is integrated):
- singleton: 94.724%
- twins: 4.9%
- triplets: 0.335%
- quadruplets: 0.041%

The gift therefore raises multiplicity modestly but does not create annual litter-style reproduction. Existing consent, physical meeting, pregnancy, gestation and parental cooldown rules remain in force.

## Physical consequences

Each child is a separate Spark with its own agent id, name, body, personality/inheritance state and relationships while sharing the same parents and birth event.

Base maternal mortality risk caused by multiplicity itself:
- singleton: 0%
- twins: 0.5%
- triplets: 6%
- quadruplets: 50% exactly

Surviving multiple deliveries also impose bounded maternal health loss. Multiple newborns begin with a small multiplicity-related health penalty.

A childbirth death is recorded as canonical death cause `childbirth`, including telemetry/UI support.

## Performance rule

Multiplicity adds no recurring scan. One random draw is made at conception and one integer is stored until delivery.

Birth body initialization was changed from full-world `ensureEmbodiedWorldV21()` to `ensureAgentEmbodiedWorldV21(childId)`. A delivery now initializes only the newborn body instead of rescanning all living bodies after every child.

Synthetic fixed-path stress check (150 forced singleton deliveries, same two founding parents, unrelated systems frozen):
- previous F1: 15.37–18.26 ms/delivery in two runs
- this checkpoint: 12.44–14.98 ms/delivery in two runs

This is a targeted birth-path benchmark, not a phone/browser FPS claim.

## Validation performed locally

- `tsc -p tsconfig.json`: PASS.
- Runtime integration: forced quadruplet pregnancy produced four distinct Sparks with unique ids and names and the same parents: PASS.
- Quadruplet maternal risk function returns exactly `0.5`: PASS.
- Forced fatal quadruplet roll records mother death cause `childbirth`: PASS.
- Legacy pregnancy with no `expectedChildCount` produces exactly one child: PASS.
- Pure multiplicity selection covers singleton/twins/triplets/quadruplets and keeps non-human races singleton until separately designed: PASS.

Full Vitest/Vite execution was not available in the local container because npm dependencies were not materialized; no GitHub push was used to obtain CI. The new formal Vitest regression file is `tests/v0_3_22_multipleBirths.test.ts` and must run in the eventual F2 release audit.
