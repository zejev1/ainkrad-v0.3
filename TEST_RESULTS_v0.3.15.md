# Ainkrad v0.3.15 release verification

Date: 2026-08-24 UTC  
Source archive: `Ainkrad_v15_CHECKPOINT_LONGRUN_STABLE_2026-08-24_1340.zip`  
Source SHA256: `1fb790791bf95af77e33d884166829491020293b50624b4b3d72e5cca340bccc`

## Executed checks

| Check | Executed command / evidence | Result |
|---|---|---|
| TypeScript | `./node_modules/.bin/tsc -p tsconfig.json` | PASS |
| Full regression suite | `./node_modules/.bin/vitest run` | PASS — 31 files, 131/131 tests |
| Production build | `./node_modules/.bin/vite build` | PASS |
| Speed equivalence | `tests/liveWorldRuntime.test.ts` inside the captured full suite | PASS — `×1`, `×10`, `×100` identical at equal Ainkrad time |
| Slow-speed movement/UI contract | `tests/browserUiSmoke.test.ts` inside the captured full suite | PASS — every frame receives a changing display position before the first 8,760-minute quantum while resident state, decisions and RNG remain untouched |
| Reset continuity | `tests/liveWorldRuntime.test.ts` inside the captured full suite | PASS — a new epoch clears stale resume metadata without forcing an early semantic action |
| Real long-run seeds | `node --import tsx src/v15/runReleaseAcceptance.ts` | PASS — three autonomous 30-year seeds with exact 8/10/12/30-year samples |

The package manager script for typecheck resolves to the same checked-in command (`tsc -p tsconfig.json`). The local executable was invoked directly because the Work sandbox blocked the `npm` launcher while waiting for network approval; no dependency download was needed or attempted for the executed check.

## Long-run evidence

| Seed | Year-30 living humans | Living generations | Renewable base | Stored resources | Monsters / capacity | Death telemetry |
|---|---:|---|---:|---:|---:|---|
| `v15-longrun-04` | 31 | 0/1/2 | 0.463 | 0.913 | 10/16 | monster 3, wildlife 2 |
| `v15-longrun-05` | 27 | 0/1/2 | 0.220 | 0.927 | 9/12 | monster 1 |
| `v15-longrun-13` | 31 | 0/1/2 | 0.398 | 0.838 | 6/12 | wildlife 1 |

All three quarterly long-run audits produced zero warnings and zero critical alerts. Genesis active count after year 3 and Genesis lessons after year 3 were both zero in every seed. `v15-longrun-13` recorded two verified ordinary generation-1 → generation-2 lessons; the generation-2 residents in the other two seeds had not yet reached structured-lesson age. Full machine-readable samples and findings are in `docs/V0_3_15_RELEASE_AUDIT.json`.

## UI verification boundary

The production bundle and deterministic UI/2D smoke tests passed. The available environment had no installed Chromium executable, so no claim is made that an interactive local-browser visual session ran for this final motion fix. The SPCK checklist therefore retains a short device-side visual inspection step.

No GitHub write, commit or push was performed.
