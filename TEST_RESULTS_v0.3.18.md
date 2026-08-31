# Ainkrad v0.3.18 — executed release verification

Date: 2026-08-31 UTC  
Source: complete v15-derived v0.3.18 tree, packaged as uncommitted changes on
the read-only verified `zejev1/ainkrad-v0.3` parent
`dad1dc0f72bd0883f801b93e3da4cae1587b6270`.

No unexecuted check is labelled PASS.

## Build and regression

- TypeScript: PASS — `tsc -p tsconfig.json`.
- Full sequential regression: PASS — Vitest 3.1.1, 38/38 files and 160/160
  tests in 59.34 seconds.
- Cardinal equal-time causality: PASS — ×1, ×10 and ×100 produce identical
  opportunities and decisions at equal Ainkrad time.
- OFF/OBSERVER autonomy: PASS — read-only observation does not change the
  autonomous world.
- Production build: PASS — Vite 7.0.4 emitted index, CSS, application JS and a
  dedicated 407.45 kB `liveWorld.worker` bundle.
- Production HTTP smoke: PASS — built index returned 200 with the application
  mount; worker returned 200 as JavaScript, 401,781 bytes, with the catch-up
  progress protocol.
- Existing-save repair: PASS — v16/v17 and early-v18 saves receive missing
  nested fields atomically and idempotently without replacing residents,
  relations, world time, RNG future or Cardinal experience.
- UI/2D contract: PASS — five smoke tests cover catch-up status, mobile text
  controls, resident picker, profession/satiety fields, audible conversation
  output and independent pointer hit layers.
- `git diff --check`: recorded in the final packaging audit.

## Final autonomous long runs

Each run used the real runtime with its normal RNG, residents, deaths, births,
resources, Cardinal opportunities and canonical quanta. No residents, couples,
expeditions, professions or outcomes were injected.

| Years | Living | Moving | Outside home | Settlements | Expedition outcomes | Elapsed |
| ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 100 | 20 | 11 | 15.0% | 7 | 4 founded, 1 returned, 1 failed | 15.573 s |
| 138 | 38 | 16 | 15.8% | 6 | 2 founded, 1 returned, 1 failed | 24.516 s |
| 200 | 88 | 40 | 14.8% | 7 | 3 founded, 1 returned, 1 failed | 43.128 s |

The 100-year expedition groups contained only voluntary generation-1 to
generation-4 candidates. Generation-zero residents never became permanent
frontier founders. Camp refusal, expedition failure, ruins and continued
settlement life all occurred naturally.

At year 200 the world had generations 1-9, 40 residents physically travelling,
40,746 cumulative outside-settlement actions and 38,733 cumulative productive
actions. Current action shares were: walking 45.86%, gathering 14.25%, social
interaction 10.99%, work 3.67%, exploration 1.90% and prayer 1.11%.
Conversation therefore remained important without displacing food, travel or
work.

The same seed temporarily fell to 37 residents near year 130 and recovered to
88 by year 200 without injected rescue population. Monster danger remained
real: 34 of 101 recorded deaths were monster encounters; ordinary wildlife
caused four. This release does not guarantee survival of every people in every
seed: in this run humans and ogres continued while goblin and orc lineages died
out. Race-neutral family agency itself is covered by regression tests.

## Browser limitation

The production preview started successfully, but this Work environment's cloud
Chrome rejected both local preview addresses with `ERR_BLOCKED_BY_CLIENT`.
Therefore no final real-browser screenshot or click result is labelled PASS.
The final release instead has the passed production build, HTTP/worker smoke
and five UI contract tests above. The deployed Vercel build must receive the
real mobile click check after the user commits and pushes through SPCK.

Machine-readable evidence is summarized in
`docs/V0_3_18_RELEASE_AUDIT.json`.
