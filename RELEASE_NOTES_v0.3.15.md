# Ainkrad v0.3.15

This release migrates Cardinal's modern semantics from technical ticks to canonical Ainkrad world minutes while preserving the v15 living-world baseline.

## Main changes

- CardinalCore and CardinalAuditor use a 129,600-world-minute autonomy window and canonical washout.
- Intervention and world-authority gateways use explicit world-minute cooldown/effect/duration fields.
- Predictions and outcome scheduling use `horizonWorldMinutes`.
- Current research evidence is restricted to the current world epoch, policy, sensor and research versions and canonical timestamps; ambiguous tick-only rows remain history but cannot enter modern autonomy math.
- Live runtime crosses fixed 8,760-world-minute semantic boundaries, producing equal Cardinal opportunities at `×1`, `×10` and `×100` for equal Ainkrad time.
- Resident map motion is now projected continuously between semantic boundaries. Slow clock modes remain visibly alive without adding decisions, RNG draws or Cardinal opportunities.
- A freshly reset epoch no longer displays stale resume metadata from the previous world.
- Production UI presents Ainkrad time/durations and connects readable law/intervention reports, death diagnostics and world-health reporting.
- Long-run acceptance distinguishes humans from separately emerging intelligent races and correctly treats generation-2 children below lesson age.

## Preserved invariants

Ten ordinary founders and four separate three-year Genesis teachers remain unchanged. Family intimacy and child desire stay independent and voluntary. Renewable base and stored/local settlement resources remain separate. Hunting, weapons, smithing, resident choice, generations, learning, ecology and death telemetry remain active. No hidden recovery cohort is present.

## Verification

See `TEST_RESULTS_v0.3.15.md` and `docs/V0_3_15_RELEASE_AUDIT.json`. Captured final results: TypeScript PASS, Vite production build PASS, 131/131 regression tests PASS and three autonomous 30-year seed audits PASS.

## Suggested commit message

```text
fix(v0.3.15): restore visible resident movement at slow world speeds

- project map movement continuously without changing world decisions or RNG
- keep canonical Cardinal opportunities identical at ×1, ×10 and ×100
- clear stale resume metadata after creating a new world
- preserve the validated 27–31 population long-run baseline
```
