# Cardinal: weather supervision and ON/OFF

Исторический документ выпуска. Возрастные ограничения Кардинала отменены в f14; текущая политика — AGENTS.md §35 и HYDROLOGY_AGENT_F14.md.

Base: `bddb5e73ae1cd7565c06753467149e0c5bee7eea` (the user's pushed weather-agent release).

## Behavior

- The live runtime connects Cardinal's narrow `WeatherAgentConductor` to the existing weather executor. The conductor sees only weather health, world epoch, revision and time; it has no Spark writer or resident state.
- An actual executor fault produces a persisted request, an authorized `restore` command, verification against the current committed world, and a persisted result. Valid storms, snow and other natural weather are not faults. Deliberate stop/restrict/retire commands are respected.
- The original weather model and its bounded cache remain intact. Recovery changes the executor lifecycle only, not climate parameters, world time, RNG, residents, their histories or physical outcomes.
- Failed recovery is limited to three attempts with increasing world-time delays. The attempt limit survives restart. The visible journal contains at most eight records; durable records are not deleted. Healthy checks write nothing and reuse unchanged revision checks.
- The lower Cardinal panel contains ON/OFF, ONLINE/OFF/OFFLINE status, a recovery count and the system-agent journal. Commands from secondary tabs reach the active world writer.
- OFF persists in the world's existing control log, disables Cardinal observation, outcome analysis and orchestration, and leaves the world/weather running locally. ON attaches to the current world and can immediately recover an existing weather failure. It does not load an old world snapshot.
- Unexpected conductor errors mark it OFFLINE instead of aborting world progression. A recovery already committed before disconnection remains committed; an unsent command is cancelled. A pending committed recovery is reconciled from current weather state after restart.

## The first 200 years

Normal intervention and world-law authority remain disabled until 200 world years. The same restriction now covers the pre-existing ocean-frontier branch, which previously ran ahead of the age check. The sole new early exception is technical recovery of the weather executor. This does not permit changing weather to steer inhabitants, resource relief, changing laws or writing to Sparks.

## Independent world build

The complete local test run exposed an existing dependency from `WeatherSystemAgent` to the registry inside `src/cardinal`. The registry now lives in `src/world/systems/SystemAgentRegistry.ts`; the old Cardinal path re-exports it for compatibility. `WorldEngine` bundles without runtime/Cardinal/gateway modules. No Spark implementation or Iskorka file was changed.

## Verification and limits

- Live-world tests exercise detection → request → recovery → verification → journal, year-zero recovery, OFF persistence, autonomous progression, restart, reconnection without rollback, and exact ON/OFF physical-state/event equality.
- Additional checks cover deliberate lifecycle restrictions, 100,000 healthy polls with zero storage/command work, disconnect during a pending command, and a persistent three-attempt limit.
- Initial complete local run: 451/452 tests passed; the sole failure was the independent-world import described above. After fixing it, all affected tests and the world-module boundary test passed. The final pushed SHA is also checked by GitHub Actions and by Vercel's `npm run check && npm run build`.
- Typecheck and production build pass. The pre-existing bundle-size warning is not a build failure.
- Reproducible runtime performance comparison: `node --import tsx scripts/benchmark-cardinal-control.ts BASELINE_DIR OUTPUT_JSON`. It compares one full year with the same seed, observations, world state, events, memories and reload state. Measurements are local Node/in-memory data, not Android FPS.
- This is software detachment in the current host. A separate USB/network Cardinal process and interruption of a synchronously hung JavaScript executor remain separate work. No paired-experiment UI or other world-domain agent is claimed here.

Measured medians (five alternating runs): accepted baseline 983.38 ms / 1115.14 ms CPU; connected weather supervision 961.36 ms / 1105.28 ms CPU. Exact complete world/event/memory/reload equality passed. This shows no slowdown in this scenario, not a universal speed guarantee. Raw observations are in `validation/cardinal-weather-control-performance.json`.
